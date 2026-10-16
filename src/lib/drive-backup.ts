import "server-only";

import { createHash, randomBytes } from "crypto";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_UNAVAILABLE_MESSAGE } from "@/lib/minutes-session";
import { assertDriveId, FOLDER_MIME } from "@/lib/drive-access-check";

/**
 * Manual backup of minutes/ and media-library/ to a new Drive folder.
 * Source Blob objects are read only. Existing Drive files are not updated or deleted.
 */

export const BACKUP_SLICE_MS = 240_000;
export const BACKUP_CHUNK_BYTES = 8 * 1024 * 1024;
const DRIVE_CHUNK_MULTIPLE = 256 * 1024;

const MINUTES_FILE = /^minutes\/[\w.\- ()']{1,160}$/;
const MINUTES_EXT = /\.(pdf|doc|docx)$/i;
const COVER_FILE =
  /^media-library\/covers\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const BACKUP_ID = /^website-backup-\d{4}-\d{2}-\d{2}T\d{6}Z-[a-f0-9]{8}$/;
const RECEIPT_NAME = /^[a-f0-9]{64}\.json$/;
const FOLDER_NAMES = new Set(["minutes", "media-library", "covers", "receipts", "sessions"]);

export type BackupFailureCode =
  | "configuration"
  | "authentication"
  | "destination"
  | "source"
  | "upload"
  | "verify"
  | "resume";

export class BackupRunError extends Error {
  readonly code: BackupFailureCode;
  readonly backupId?: string;
  readonly filesVerified?: number;
  readonly filesTotal?: number;
  readonly bytesVerified?: number;
  readonly totalBytes?: number;

  constructor(
    code: BackupFailureCode,
    progress?: {
      backupId?: string;
      filesVerified?: number;
      filesTotal?: number;
      bytesVerified?: number;
      totalBytes?: number;
    },
  ) {
    super("Backup failed.");
    this.name = "BackupRunError";
    this.code = code;
    this.backupId = progress?.backupId;
    this.filesVerified = progress?.filesVerified;
    this.filesTotal = progress?.filesTotal;
    this.bytesVerified = progress?.bytesVerified;
    this.totalBytes = progress?.totalBytes;
  }
}

export type BackupActor = {
  state: "active" | "anonymous" | "expired" | "unavailable";
  role?: "view" | "admin";
};

export type BackupSource = {
  path: string;
  size: number;
  etag: string;
  uploadedAt: string;
};

export type BackupBlobBody = {
  stream: ReadableStream<Uint8Array>;
  etag: string;
  size: number;
};

export type BackupBlobReader = {
  list(): Promise<BackupSource[]>;
  open(path: string): Promise<BackupBlobBody>;
};

export type DriveChild = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  md5?: string;
};

export type ChunkResult =
  | { complete: false }
  | { complete: true; id: string; size: number; md5: string };

export type BackupDrive = {
  ensureFolder(parentId: string, name: string): Promise<string>;
  findChild(parentId: string, name: string): Promise<DriveChild | null>;
  listChildren(parentId: string): Promise<DriveChild[]>;
  received(backupRootId: string, resumeKey: string): Promise<number>;
  writeChunk(input: {
    backupRootId: string;
    resumeKey: string;
    parentId: string;
    path: string;
    name: string;
    mimeType: string;
    total: number;
    start: number;
    bytes: Uint8Array;
  }): Promise<ChunkResult>;
  putJson(parentId: string, name: string, text: string): Promise<void>;
  getJson(parentId: string, name: string): Promise<string | null>;
};

export type BackupPublicStatus = {
  ok: true;
  status: "running" | "complete";
  backupId: string;
  filesVerified: number;
  filesTotal: number;
  bytesVerified: number;
  totalBytes: number;
};

type VerifiedFile = {
  path: string;
  size: number;
  etag: string;
  uploadedAt: string;
  md5: string;
  driveFileId: string;
};

type Receipt = VerifiedFile;

export function classifyBackupPath(pathname: string) {
  if (pathname.startsWith("auth-sessions/") || pathname.startsWith("auth-rate/")) return "exclude" as const;
  if (
    pathname.length === 0 ||
    pathname.length > 240 ||
    pathname.includes("..") ||
    pathname.includes("\\") ||
    pathname.includes("\0") ||
    pathname.startsWith("/")
  ) {
    return "reject" as const;
  }
  if (MINUTES_FILE.test(pathname) && MINUTES_EXT.test(pathname)) return "include" as const;
  if (pathname === "media-library/catalog.json") return "include" as const;
  if (COVER_FILE.test(pathname)) return "include" as const;
  if (pathname.startsWith("minutes/") || pathname.startsWith("media-library/")) return "reject" as const;
  return "exclude" as const;
}

export function isBackupEtag(value: unknown): value is string {
  return typeof value === "string" && /^[\x21-\x7E]{1,200}$/.test(value);
}

export function isBackupTime(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value);
}

export function selectBackupSources(
  blobs: { pathname: string; size: number; etag?: string; uploadedAt?: string }[],
) {
  const sources: BackupSource[] = [];
  for (const blob of blobs) {
    const kind = classifyBackupPath(blob.pathname);
    if (kind === "exclude") continue;
    if (
      kind === "reject" ||
      !Number.isInteger(blob.size) ||
      blob.size < 0 ||
      !isBackupEtag(blob.etag) ||
      !isBackupTime(blob.uploadedAt)
    ) {
      throw new BackupRunError("source");
    }
    sources.push({
      path: blob.pathname,
      size: blob.size,
      etag: blob.etag,
      uploadedAt: blob.uploadedAt,
    });
  }
  sources.sort((left, right) => left.path.localeCompare(right.path));
  return sources;
}

export function sameBackupSources(left: BackupSource[], right: BackupSource[]) {
  if (left.length !== right.length) return false;
  return left.every((source, index) => {
    const other = right[index];
    return (
      other.path === source.path &&
      other.size === source.size &&
      other.etag === source.etag &&
      other.uploadedAt === source.uploadedAt
    );
  });
}

export function backupFolderId(now: Date, suffix: string) {
  if (!/^[a-f0-9]{8}$/.test(suffix)) throw new BackupRunError("source");
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/:/g, "");
  const backupId = `website-backup-${stamp}-${suffix}`;
  if (!BACKUP_ID.test(backupId)) throw new BackupRunError("source");
  return backupId;
}

export function isBackupId(value: string) {
  return BACKUP_ID.test(value);
}

export function backupStartedAt(backupId: string) {
  const match = /^website-backup-(\d{4}-\d{2}-\d{2})T(\d{2})(\d{2})(\d{2})Z-[a-f0-9]{8}$/.exec(
    backupId,
  );
  if (!match) throw new BackupRunError("source");
  return `${match[1]}T${match[2]}:${match[3]}:${match[4]}.000Z`;
}

export function backupActorDecision(access: BackupActor) {
  if (access.state === "unavailable") {
    return { status: 503, error: MINUTES_UNAVAILABLE_MESSAGE } as const;
  }
  if (access.state === "expired") {
    return { status: 401, error: MINUTES_EXPIRED_MESSAGE, expired: true as const };
  }
  if (access.state !== "active") {
    return { status: 401, error: "Sign in required." } as const;
  }
  if (access.role !== "admin") {
    return { status: 403, error: "Admin sign-in required." } as const;
  }
  return null;
}

export function parseBackupCommand(raw: string) {
  if (raw.trim() === "") return { kind: "start" as const };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid" as const };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { kind: "invalid" as const };
  }
  const record = parsed as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 1 || keys[0] !== "backupId" || typeof record.backupId !== "string") {
    return { kind: "invalid" as const };
  }
  if (!isBackupId(record.backupId)) return { kind: "invalid" as const };
  return { kind: "continue" as const, backupId: record.backupId };
}

export function evaluateBackupRequest(input: {
  access: BackupActor;
  sameOrigin: boolean;
  contentLength: number | null;
  body: string;
  production: boolean;
}) {
  const actor = backupActorDecision(input.access);
  if (actor) {
    return {
      ok: false as const,
      status: actor.status,
      body: "expired" in actor ? { error: actor.error, expired: true as const } : { error: actor.error },
    };
  }
  if (!input.sameOrigin) {
    return {
      ok: false as const,
      status: 403,
      body: { ok: false as const, status: "failed" as const, error: "Could not run the backup." },
    };
  }
  const length = input.contentLength === null ? 0 : input.contentLength;
  if (!Number.isInteger(length) || length < 0 || length > 256 || input.body.length > 256) {
    return {
      ok: false as const,
      status: 400,
      body: { ok: false as const, status: "failed" as const, error: "Could not run the backup." },
    };
  }
  const command = parseBackupCommand(input.body);
  if (command.kind === "invalid") {
    return {
      ok: false as const,
      status: 400,
      body: { ok: false as const, status: "failed" as const, error: "Could not run the backup." },
    };
  }
  if (!input.production) {
    return {
      ok: false as const,
      status: 404,
      body: {
        ok: false as const,
        status: "failed" as const,
        error: "This backup runs only in production.",
      },
    };
  }
  return command.kind === "continue"
    ? { ok: true as const, backupId: command.backupId }
    : { ok: true as const };
}

export function mimeForBackupPath(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export function contentRange(start: number, length: number, total: number) {
  if (total === 0) return "bytes */0";
  const end = start + length - 1;
  return `bytes ${start}-${end}/${total}`;
}

export function driveChildQuery(parentId: string, name: string) {
  assertDriveId(parentId);
  if (!isDriveName(name)) throw new BackupRunError("source");
  const escaped = name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `'${parentId}' in parents and name = '${escaped}' and trashed = false`;
}

export function isAllowedBackupFolderName(name: string) {
  return FOLDER_NAMES.has(name) || BACKUP_ID.test(name);
}

export function isAllowedJsonName(name: string) {
  return name === "manifest.json" || RECEIPT_NAME.test(name);
}

function isDriveName(name: string) {
  return name.length > 0 && name.length <= 200 && !/[\r\n/\\]/.test(name);
}

function pathHash(pathname: string) {
  return createHash("sha256").update(pathname).digest("hex");
}

function concatBytes(parts: Uint8Array[]) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

class ByteQueue {
  private extra = new Uint8Array(0);
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;

  constructor(reader: ReadableStreamDefaultReader<Uint8Array>) {
    this.reader = reader;
  }

  async read(length: number) {
    const parts: Uint8Array[] = [];
    let got = 0;
    if (this.extra.length > 0) {
      parts.push(this.extra);
      got = this.extra.length;
      this.extra = new Uint8Array(0);
    }
    let spins = 0;
    while (got < length) {
      spins += 1;
      if (spins > length + 8) throw new BackupRunError("source");
      const next = await this.reader.read();
      if (next.done) throw new BackupRunError("source");
      if (!next.value || next.value.length === 0) continue;
      parts.push(next.value);
      got += next.value.length;
    }
    const merged = concatBytes(parts);
    if (merged.length > length) this.extra = merged.subarray(length);
    return merged.subarray(0, length);
  }

  async cancel() {
    await this.reader.cancel();
  }
}

function parseReceipt(text: string, source: BackupSource): Receipt {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupRunError("verify");
  }
  if (!parsed || typeof parsed !== "object") throw new BackupRunError("verify");
  const record = parsed as Record<string, unknown>;
  if (record.path !== source.path || record.size !== source.size) throw new BackupRunError("verify");
  if (record.etag !== source.etag || record.uploadedAt !== source.uploadedAt) {
    throw new BackupRunError("verify");
  }
  if (typeof record.md5 !== "string" || !/^[a-f0-9]{32}$/.test(record.md5)) {
    throw new BackupRunError("verify");
  }
  if (typeof record.driveFileId !== "string") throw new BackupRunError("verify");
  assertDriveId(record.driveFileId);
  return {
    path: source.path,
    size: source.size,
    etag: source.etag,
    uploadedAt: source.uploadedAt,
    md5: record.md5,
    driveFileId: record.driveFileId,
  };
}

function progressFor(
  backupId: string,
  verified: VerifiedFile[],
  sources: BackupSource[],
): BackupPublicStatus {
  return {
    ok: true,
    status: "running",
    backupId,
    filesVerified: verified.length,
    filesTotal: sources.length,
    bytesVerified: verified.reduce((sum, file) => sum + file.size, 0),
    totalBytes: sources.reduce((sum, file) => sum + file.size, 0),
  };
}

async function folderFor(
  drive: BackupDrive,
  backupRootId: string,
  pathname: string,
  cache: Map<string, string>,
) {
  const segments = pathname.split("/").slice(0, -1);
  let parent = backupRootId;
  let key = "";
  for (const segment of segments) {
    if (!FOLDER_NAMES.has(segment)) throw new BackupRunError("source");
    key = key ? `${key}/${segment}` : segment;
    const cached = cache.get(key);
    if (cached) {
      parent = cached;
      continue;
    }
    parent = await drive.ensureFolder(parent, segment);
    cache.set(key, parent);
  }
  return parent;
}

async function saveReceipt(drive: BackupDrive, receiptsId: string, file: VerifiedFile) {
  const name = `${pathHash(file.path)}.json`;
  const existing = await drive.getJson(receiptsId, name);
  if (existing !== null) {
    parseReceipt(existing, file);
    return;
  }
  await drive.putJson(
    receiptsId,
    name,
    JSON.stringify({
      path: file.path,
      size: file.size,
      etag: file.etag,
      uploadedAt: file.uploadedAt,
      md5: file.md5,
      driveFileId: file.driveFileId,
    }),
  );
}

async function openVerified(blobs: BackupBlobReader, source: BackupSource) {
  const opened = await blobs.open(source.path);
  if (opened.etag !== source.etag || opened.size !== source.size) {
    await opened.stream.cancel().catch(() => undefined);
    throw new BackupRunError("verify");
  }
  return opened.stream;
}

async function hashStream(stream: ReadableStream<Uint8Array>, size: number) {
  const queue = new ByteQueue(stream.getReader());
  const hash = createHash("md5");
  try {
    let hashed = 0;
    while (hashed < size) {
      const bytes = await queue.read(Math.min(BACKUP_CHUNK_BYTES, size - hashed));
      hash.update(bytes);
      hashed += bytes.length;
    }
    return hash.digest("hex");
  } finally {
    await queue.cancel();
  }
}

async function copySource(input: {
  drive: BackupDrive;
  blobs: BackupBlobReader;
  backupRootId: string;
  source: BackupSource;
  parentId: string;
  receiptsId: string;
  deadline: number;
  clock: () => number;
  chunkBytes: number;
}): Promise<"done" | "paused"> {
  const name = input.source.path.split("/").pop() ?? "";
  if (!isDriveName(name)) throw new BackupRunError("source");
  const existing = await input.drive.findChild(input.parentId, name);
  if (existing) {
    if (existing.size !== input.source.size || !existing.md5) throw new BackupRunError("verify");
    const digest = await hashStream(await openVerified(input.blobs, input.source), input.source.size);
    if (digest !== existing.md5) throw new BackupRunError("verify");
    await saveReceipt(input.drive, input.receiptsId, {
      path: input.source.path,
      size: input.source.size,
      etag: input.source.etag,
      uploadedAt: input.source.uploadedAt,
      md5: digest,
      driveFileId: existing.id,
    });
    return "done";
  }

  const resumeKey = pathHash(input.source.path);
  const uploaded = await input.drive.received(input.backupRootId, resumeKey);
  if (uploaded > input.source.size) throw new BackupRunError("resume");
  if (
    uploaded > 0 &&
    uploaded < input.source.size &&
    uploaded % DRIVE_CHUNK_MULTIPLE !== 0 &&
    input.chunkBytes % DRIVE_CHUNK_MULTIPLE === 0
  ) {
    throw new BackupRunError("resume");
  }
  if (input.source.size === 0) {
    const empty = await openVerified(input.blobs, input.source);
    await empty.cancel().catch(() => undefined);
    const result = await input.drive.writeChunk({
      backupRootId: input.backupRootId,
      resumeKey,
      parentId: input.parentId,
      path: input.source.path,
      name,
      mimeType: mimeForBackupPath(input.source.path),
      total: 0,
      start: 0,
      bytes: new Uint8Array(),
    });
    if (!result.complete || result.size !== 0 || result.md5 !== createHash("md5").digest("hex")) {
      throw new BackupRunError("verify");
    }
    await saveReceipt(input.drive, input.receiptsId, {
      path: input.source.path,
      size: 0,
      etag: input.source.etag,
      uploadedAt: input.source.uploadedAt,
      md5: result.md5,
      driveFileId: result.id,
    });
    return "done";
  }

  const stream = await openVerified(input.blobs, input.source);
  const queue = new ByteQueue(stream.getReader());
  const hash = createHash("md5");
  try {
    let hashed = 0;
    while (hashed < input.source.size) {
      const target =
        hashed < uploaded
          ? Math.min(uploaded, hashed + input.chunkBytes)
          : Math.min(input.source.size, hashed + input.chunkBytes);
      const bytes = await queue.read(target - hashed);
      hash.update(bytes);
      const start = hashed;
      hashed += bytes.length;
      if (hashed <= uploaded) {
        if (input.clock() >= input.deadline && hashed < input.source.size) return "paused";
        continue;
      }
      const result = await input.drive.writeChunk({
        backupRootId: input.backupRootId,
        resumeKey,
        parentId: input.parentId,
        path: input.source.path,
        name,
        mimeType: mimeForBackupPath(input.source.path),
        total: input.source.size,
        start,
        bytes,
      });
      if (result.complete) {
        const digest = hash.digest("hex");
        if (result.size !== input.source.size || result.md5 !== digest) {
          throw new BackupRunError("verify");
        }
        await saveReceipt(input.drive, input.receiptsId, {
          path: input.source.path,
          size: input.source.size,
          etag: input.source.etag,
          uploadedAt: input.source.uploadedAt,
          md5: digest,
          driveFileId: result.id,
        });
        return "done";
      }
      if (input.clock() >= input.deadline) return "paused";
    }
    throw new BackupRunError("verify");
  } finally {
    await queue.cancel();
  }
}

export async function advanceBackup(input: {
  destinationId: string;
  drive: BackupDrive;
  blobs: BackupBlobReader;
  backupId?: string;
  now?: Date;
  suffix?: string;
  deadline?: number;
  clock?: () => number;
  chunkBytes?: number;
}): Promise<BackupPublicStatus> {
  assertDriveId(input.destinationId);
  const clock = input.clock ?? Date.now;
  const deadline = input.deadline ?? clock() + BACKUP_SLICE_MS;
  const chunkBytes = input.chunkBytes ?? BACKUP_CHUNK_BYTES;
  if (chunkBytes < 1) throw new BackupRunError("source");
  const backupId = input.backupId
    ? input.backupId
    : backupFolderId(input.now ?? new Date(), input.suffix ?? randomBytes(4).toString("hex"));
  if (!isBackupId(backupId)) throw new BackupRunError("source");

  const destination = await input.drive.findChild(input.destinationId, backupId);
  let backupRootId: string;
  if (input.backupId) {
    if (!destination || destination.mimeType !== FOLDER_MIME) {
      throw new BackupRunError("destination");
    }
    backupRootId = destination.id;
  } else if (destination) {
    throw new BackupRunError("destination");
  } else {
    backupRootId = await input.drive.ensureFolder(input.destinationId, backupId);
  }

  const existingManifest = await input.drive.getJson(backupRootId, "manifest.json");
  if (existingManifest !== null) {
    const sealed = sealedStatus(existingManifest, backupId);
    if (!sealed) throw new BackupRunError("verify", { backupId });
    return sealed;
  }

  let sources: BackupSource[];
  try {
    sources = await readSources(input.blobs);
  } catch (error) {
    if (error instanceof BackupRunError) {
      throw new BackupRunError(error.code, { backupId });
    }
    throw new BackupRunError("source", { backupId });
  }

  const receiptsId = await input.drive.ensureFolder(backupRootId, "receipts");
  const receiptNames = new Set(
    (await input.drive.listChildren(receiptsId)).map((child) => child.name),
  );
  const verified: VerifiedFile[] = [];
  const folders = new Map<string, string>();

  for (const source of sources) {
    const receiptName = `${pathHash(source.path)}.json`;
    if (receiptNames.has(receiptName)) {
      try {
        const text = await input.drive.getJson(receiptsId, receiptName);
        if (text === null) throw new BackupRunError("verify");
        verified.push(parseReceipt(text, source));
      } catch (error) {
        const code = error instanceof BackupRunError ? error.code : "verify";
        throw new BackupRunError(code, progressFor(backupId, verified, sources));
      }
      continue;
    }
    if (clock() >= deadline) return progressFor(backupId, verified, sources);
    const parentId = await folderFor(input.drive, backupRootId, source.path, folders);
    let outcome: "done" | "paused";
    try {
      outcome = await copySource({
        drive: input.drive,
        blobs: input.blobs,
        backupRootId,
        source,
        parentId,
        receiptsId,
        deadline,
        clock,
        chunkBytes,
      });
    } catch (error) {
      const code = error instanceof BackupRunError ? error.code : "upload";
      throw new BackupRunError(code, progressFor(backupId, verified, sources));
    }
    if (outcome === "paused") return progressFor(backupId, verified, sources);
    const saved = await input.drive.getJson(receiptsId, receiptName);
    if (saved === null) throw new BackupRunError("verify", progressFor(backupId, verified, sources));
    verified.push(parseReceipt(saved, source));
  }

  const status = progressFor(backupId, verified, sources);
  let latest: BackupSource[];
  try {
    latest = await readSources(input.blobs);
  } catch (error) {
    const code = error instanceof BackupRunError ? error.code : "verify";
    throw new BackupRunError(code, status);
  }
  if (!sameBackupSources(sources, latest)) throw new BackupRunError("verify", status);
  const manifest = manifestDocument(backupId, verified, status.totalBytes);
  const current = await input.drive.getJson(backupRootId, "manifest.json");
  if (current !== null) {
    if (!manifestMatches(current, manifest)) throw new BackupRunError("verify", status);
    return { ...status, status: "complete" };
  }
  await input.drive.putJson(backupRootId, "manifest.json", JSON.stringify(manifest));
  return { ...status, status: "complete" };
}

async function readSources(blobs: BackupBlobReader) {
  const listed = await blobs.list();
  return selectBackupSources(
    listed.map((source) => ({
      pathname: source.path,
      size: source.size,
      etag: source.etag,
      uploadedAt: source.uploadedAt,
    })),
  );
}

function manifestDocument(backupId: string, verified: VerifiedFile[], totalBytes: number) {
  return {
    backupId,
    startedAt: backupStartedAt(backupId),
    status: "complete" as const,
    verification: "verified" as const,
    filesVerified: verified.length,
    totalBytes,
    sourceCheck: "etag" as const,
    files: verified.map((file) => ({
      path: file.path,
      size: file.size,
      etag: file.etag,
      uploadedAt: file.uploadedAt,
      md5: file.md5,
      driveFileId: file.driveFileId,
    })),
  };
}

function sealedStatus(text: string, backupId: string): BackupPublicStatus | null {
  const manifest = manifestDocument(backupId, [], 0);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  if (record.backupId !== backupId || record.startedAt !== manifest.startedAt) return null;
  if (record.status !== "complete" || record.verification !== "verified") return null;
  if (record.sourceCheck !== "etag" || !Array.isArray(record.files)) return null;
  if (record.filesVerified !== record.files.length) return null;
  let total = 0;
  for (const item of record.files) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    if (typeof row.path !== "string" || classifyBackupPath(row.path) !== "include") return null;
    if (typeof row.size !== "number" || !Number.isInteger(row.size) || row.size < 0) return null;
    if (!isBackupEtag(row.etag) || !isBackupTime(row.uploadedAt)) return null;
    if (typeof row.md5 !== "string" || !/^[a-f0-9]{32}$/.test(row.md5)) return null;
    if (typeof row.driveFileId !== "string") return null;
    try {
      assertDriveId(row.driveFileId);
    } catch {
      return null;
    }
    total += row.size;
  }
  if (record.totalBytes !== total) return null;
  return {
    ok: true,
    status: "complete",
    backupId,
    filesVerified: record.files.length,
    filesTotal: record.files.length,
    bytesVerified: total,
    totalBytes: total,
  };
}

function manifestMatches(
  text: string,
  expected: ReturnType<typeof manifestDocument>,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  if (!parsed || typeof parsed !== "object") return false;
  const record = parsed as Record<string, unknown>;
  if (record.backupId !== expected.backupId || record.startedAt !== expected.startedAt) return false;
  if (record.status !== "complete" || record.verification !== "verified" || record.sourceCheck !== "etag") {
    return false;
  }
  if (record.filesVerified !== expected.filesVerified || record.totalBytes !== expected.totalBytes) {
    return false;
  }
  if (!Array.isArray(record.files) || record.files.length !== expected.files.length) return false;
  const rows: unknown[] = record.files;
  return expected.files.every((file, index) => {
    const item = rows[index];
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      row.path === file.path &&
      row.size === file.size &&
      row.etag === file.etag &&
      row.uploadedAt === file.uploadedAt &&
      row.md5 === file.md5 &&
      row.driveFileId === file.driveFileId
    );
  });
}

const PUBLIC_ERROR: Record<BackupFailureCode, string> = {
  configuration: "Backup is not configured.",
  authentication: "Google authentication failed.",
  destination: "Backup folder was not found.",
  source: "The backup could not read the website files.",
  upload: "The backup could not be saved.",
  verify: "The backup could not be verified.",
  resume: "The backup could not be continued.",
};

export function toBackupFailure(error: unknown): {
  status: number;
  body: {
    ok: false;
    status: "failed";
    error: string;
    backupId?: string;
    filesVerified: number;
    filesTotal: number | null;
    bytesVerified: number;
    totalBytes: number | null;
  };
} {
  const code = error instanceof BackupRunError ? error.code : "upload";
  const body = {
    ok: false as const,
    status: "failed" as const,
    error: PUBLIC_ERROR[code],
    backupId: error instanceof BackupRunError ? error.backupId : undefined,
    filesVerified: error instanceof BackupRunError ? error.filesVerified ?? 0 : 0,
    filesTotal: error instanceof BackupRunError ? error.filesTotal ?? null : null,
    bytesVerified: error instanceof BackupRunError ? error.bytesVerified ?? 0 : 0,
    totalBytes: error instanceof BackupRunError ? error.totalBytes ?? null : null,
  };
  if (!body.backupId) delete body.backupId;
  const encoded = JSON.stringify(body);
  if (/eyJ[A-Za-z0-9_-]{8,}/.test(encoded) || /bearer\s+/i.test(encoded) || encoded.includes("ya29.")) {
    return {
      status: 500,
      body: {
        ok: false,
        status: "failed",
        error: "Backup failed.",
        filesVerified: 0,
        filesTotal: null,
        bytesVerified: 0,
        totalBytes: null,
      },
    };
  }
  return { status: code === "configuration" ? 503 : 502, body };
}
