import "server-only";

import {
  BlobPreconditionFailedError,
  del,
  get,
  issueSignedToken,
  list,
  presignUrl,
  put,
} from "@vercel/blob";
import { createReadStream } from "fs";
import { mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { ensureMinutesBlobStoreId } from "@/lib/minutes-blob";
import {
  deleteGithubMinutes,
  findGithubMinutesRecord,
  listGithubMinutes,
  minutesUsesGithub,
  readGithubMinutes,
  saveGithubMinutes,
} from "@/lib/minutes-github";

export type MinutesFile = {
  name: string;
  size: number;
  uploadedAt: string;
};

export class MinutesConflictError extends Error {
  readonly storedName: string;
  readonly etag: string;

  constructor(storedName: string, etag: string) {
    super("A document with this filename is already stored in Meeting Minutes.");
    this.name = "MinutesConflictError";
    this.storedName = storedName;
    this.etag = etag;
  }
}

export function isMinutesConflict(error: unknown): error is MinutesConflictError {
  return (
    error instanceof MinutesConflictError ||
    (error instanceof Error &&
      error.name === "MinutesConflictError" &&
      "storedName" in error &&
      "etag" in error)
  );
}

export const MAX_MINUTES_BYTES = 80 * 1024 * 1024;
export const BLOB_PREFIX = "minutes/";
const ALLOWED_EXT = new Set([".pdf", ".doc", ".docx"]);
export const MINUTES_CONTENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function localDir() {
  return path.join(process.cwd(), "data", "minutes");
}

export function minutesUsesBlob() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      process.env.BLOB_STORE_ID?.trim(),
  );
}

async function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };
  const storeId = await ensureMinutesBlobStoreId();
  return storeId ? { storeId } : {};
}

export function minutesBlobPath(name: string) {
  return `${BLOB_PREFIX}${name}`;
}

export function contentTypeForMinutes(name: string) {
  const ext = path.posix.extname(name).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === ".doc") return "application/msword";
  return "application/octet-stream";
}

export function minutesNamesMatch(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "accent" }) === 0;
}

export type MinutesWritePlan =
  | { action: "create"; name: string }
  | { action: "replace"; name: string; etag: string }
  | { action: "conflict"; name: string; etag: string };

export function minutesWritePlan(
  requestedName: string,
  current: { name: string; etag: string } | null,
  replace: boolean,
  etag: string | null,
): MinutesWritePlan {
  if (!current) return { action: "create", name: requestedName };
  if (!replace || etag !== current.etag) {
    return { action: "conflict", name: current.name, etag: current.etag };
  }
  return { action: "replace", name: current.name, etag: current.etag };
}

export function safeMinutesName(raw: string) {
  const base = raw.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!base || base === "." || base === "..") return null;
  const cleaned = base.replace(/[^\w.\- ()']/g, "").trim();
  if (!cleaned) return null;
  const ext = path.posix.extname(cleaned).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return null;
  const named = cleaned.slice(0, 160);
  if (named.length <= ext.length) return null;
  return named;
}

export async function isAllowedDocument(name: string, bytes: Uint8Array) {
  const ext = path.posix.extname(name).toLowerCase();
  if (ext === ".pdf") {
    const start = Buffer.from(bytes.subarray(0, 1024)).toString("latin1");
    return start.includes("%PDF");
  }
  if (ext === ".docx") {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  }
  if (ext === ".doc") {
    return (
      bytes.length >= 4 &&
      bytes[0] === 0xd0 &&
      bytes[1] === 0xcf &&
      bytes[2] === 0x11 &&
      bytes[3] === 0xe0
    );
  }
  return false;
}

async function listLocal(): Promise<MinutesFile[]> {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir);
  const files = await Promise.all(
    names
      .filter((name) => ALLOWED_EXT.has(path.posix.extname(name).toLowerCase()))
      .map(async (name) => {
        const info = await stat(path.join(dir, name));
        return {
          name,
          size: info.size,
          uploadedAt: info.mtime.toISOString(),
        };
      }),
  );
  return files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function createMinutesUploadUrl(
  name: string,
  mode: { allowOverwrite: false } | { allowOverwrite: true; ifMatch: string },
) {
  const auth = await blobAuth();
  const pathname = minutesBlobPath(name);
  const validUntil = Date.now() + 15 * 60 * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ["put"],
    allowedContentTypes: MINUTES_CONTENT_TYPES,
    maximumSizeInBytes: MAX_MINUTES_BYTES,
    validUntil,
    ...auth,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "put",
    pathname,
    access: "private",
    allowedContentTypes: MINUTES_CONTENT_TYPES,
    maximumSizeInBytes: MAX_MINUTES_BYTES,
    addRandomSuffix: false,
    allowOverwrite: mode.allowOverwrite,
    ...(mode.allowOverwrite ? { ifMatch: mode.ifMatch } : {}),
    cacheControlMaxAge: 60,
    validUntil,
    ...auth,
  });
  return {
    url: presignedUrl,
    name,
    contentType: contentTypeForMinutes(name),
  };
}

function localMinutesEtag(info: { mtimeMs: number; size: number }) {
  return `${info.mtimeMs}-${info.size}`;
}

async function findLocalMinutesRecord(target: string) {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  const names = await readdir(dir);
  const match = names.find(
    (name) =>
      ALLOWED_EXT.has(path.posix.extname(name).toLowerCase()) &&
      minutesNamesMatch(name, target),
  );
  if (!match) return null;
  const info = await stat(path.join(dir, match));
  return { name: match, etag: localMinutesEtag(info) };
}

async function findBlobMinutesRecord(target: string) {
  const auth = await blobAuth();
  let cursor: string | undefined;
  do {
    const result = await list({
      prefix: BLOB_PREFIX,
      cursor,
      limit: 1000,
      ...auth,
    });
    const match = result.blobs.find((blob) => {
      const name = blob.pathname.slice(BLOB_PREFIX.length);
      return (
        ALLOWED_EXT.has(path.posix.extname(name).toLowerCase()) &&
        minutesNamesMatch(name, target)
      );
    });
    if (match) {
      return {
        name: match.pathname.slice(BLOB_PREFIX.length),
        etag: match.etag,
      };
    }
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
  return null;
}

export async function findMinutesRecord(name: string) {
  if (minutesUsesBlob()) {
    try {
      return await findBlobMinutesRecord(name);
    } catch {
      if (!minutesUsesGithub()) throw new Error("Could not check existing documents.");
    }
  }
  if (minutesUsesGithub()) return findGithubMinutesRecord(name);
  return findLocalMinutesRecord(name);
}

export async function createMinutesDownloadUrl(name: string) {
  const auth = await blobAuth();
  const pathname = minutesBlobPath(name);
  const token = await issueSignedToken({
    pathname,
    operations: ["get"],
    validUntil: Date.now() + 5 * 60 * 1000,
    ...auth,
  });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    useCache: false,
    validUntil: Date.now() + 5 * 60 * 1000,
    ...auth,
  });
  return presignedUrl;
}

async function listBlob(): Promise<MinutesFile[]> {
  const result = await list({ prefix: BLOB_PREFIX, ...(await blobAuth()) });
  return result.blobs
    .map((blob) => ({
      name: blob.pathname.slice(BLOB_PREFIX.length),
      size: blob.size,
      uploadedAt: blob.uploadedAt.toISOString(),
    }))
    .filter(
      (file) =>
        file.name && ALLOWED_EXT.has(path.posix.extname(file.name).toLowerCase()),
    )
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function listMinutesLibrary(): Promise<{
  files: MinutesFile[];
  unavailable: boolean;
}> {
  try {
    if (minutesUsesBlob()) {
      try {
        return { files: await listBlob(), unavailable: false };
      } catch {
        if (!minutesUsesGithub()) return { files: [], unavailable: true };
      }
    }
    if (minutesUsesGithub()) {
      return { files: await listGithubMinutes(), unavailable: false };
    }
    return { files: await listLocal(), unavailable: false };
  } catch {
    return { files: [], unavailable: true };
  }
}

async function writeLocalMinutes(
  name: string,
  bytes: Uint8Array,
  mode: { replace: false } | { replace: true; etag: string },
) {
  const dir = localDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  if (!mode.replace) {
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    try {
      handle = await open(filePath, "wx");
      await handle.writeFile(bytes);
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : "";
      if (code === "EEXIST") {
        const current = await findLocalMinutesRecord(name);
        throw new MinutesConflictError(current?.name ?? name, current?.etag ?? "");
      }
      throw error;
    } finally {
      await handle?.close();
    }
    return;
  }

  const current = await findLocalMinutesRecord(name);
  if (!current || current.etag !== mode.etag || current.name !== name) {
    throw new MinutesConflictError(current?.name ?? name, current?.etag ?? "");
  }
  const temporary = `${filePath}.${process.pid}.uploading`;
  await writeFile(temporary, bytes);
  const again = await findLocalMinutesRecord(name);
  if (!again || again.etag !== mode.etag) {
    await unlink(temporary).catch(() => undefined);
    throw new MinutesConflictError(again?.name ?? name, again?.etag ?? "");
  }
  await rename(temporary, filePath);
}

export async function saveMinutes(
  name: string,
  bytes: Uint8Array,
  mode: { replace: false } | { replace: true; etag: string },
) {
  if (minutesUsesBlob()) {
    try {
      await put(minutesBlobPath(name), Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: mode.replace,
        ...(mode.replace ? { ifMatch: mode.etag } : {}),
        contentType: contentTypeForMinutes(name),
        cacheControlMaxAge: 60,
        ...(await blobAuth()),
      });
      return;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError || isMinutesConflict(error)) {
        const current = await findBlobMinutesRecord(name).catch(() => null);
        throw new MinutesConflictError(current?.name ?? name, current?.etag ?? "");
      }
      if (minutesUsesGithub()) {
        await saveGithubMinutes(name, bytes, mode.replace ? mode : { replace: false });
        return;
      }
      throw new Error("Could not save that file.");
    }
  }

  if (minutesUsesGithub()) {
    await saveGithubMinutes(name, bytes, mode.replace ? mode : { replace: false });
    return;
  }

  if (process.env.VERCEL) {
    throw new Error("Minutes storage is not available on this deployment.");
  }

  await writeLocalMinutes(name, bytes, mode.replace ? mode : { replace: false });
}

export async function openMinutes(name: string) {
  if (minutesUsesBlob()) {
    try {
      const result = await get(minutesBlobPath(name), {
        access: "private",
        ...(await blobAuth()),
      });
      if (result && result.statusCode === 200 && result.stream) {
        return { body: result.stream, size: result.blob.size };
      }
    } catch {
      // Fall through to GitHub or local.
    }
  }

  if (minutesUsesGithub()) {
    const bytes = await readGithubMinutes(name);
    if (!bytes) return null;
    return { body: Buffer.from(bytes), size: bytes.byteLength };
  }

  try {
    const filePath = path.join(localDir(), name);
    const info = await stat(filePath);
    return {
      body: Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>,
      size: info.size,
    };
  } catch {
    return null;
  }
}

export async function readMinutes(name: string) {
  if (minutesUsesBlob()) {
    try {
      const result = await get(minutesBlobPath(name), {
        access: "private",
        ...(await blobAuth()),
      });
      if (result && result.statusCode === 200) {
        const chunks: Uint8Array[] = [];
        const reader = result.stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) chunks.push(value);
        }
        const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        return bytes;
      }
    } catch {
      // Fall through to GitHub or local.
    }
  }

  if (minutesUsesGithub()) return readGithubMinutes(name);

  try {
    const buf = await readFile(path.join(localDir(), name));
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function deleteMinutes(name: string) {
  if (minutesUsesBlob()) {
    try {
      await del(minutesBlobPath(name), await blobAuth());
      return;
    } catch {
      if (!minutesUsesGithub()) throw new Error("Could not remove that file.");
    }
  }
  if (minutesUsesGithub()) {
    await deleteGithubMinutes(name);
    return;
  }
  await unlink(path.join(localDir(), name));
}
