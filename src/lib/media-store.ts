import "server-only";

import { del, get, put, BlobNotFoundError, BlobPreconditionFailedError } from "@vercel/blob";
import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import {
  MEDIA_CATALOG_PATH,
  MediaCatalogConflict,
  coverBlobPath,
  emptyCatalog,
  isSafeCoverName,
  parseCatalog,
  type MediaCatalog,
} from "@/lib/media-catalog";

const MAX_CATALOG_BYTES = 2_000_000;

export type MediaCatalogRead =
  | { status: "ready"; catalog: MediaCatalog; etag: string | null }
  | { status: "unavailable" };

function mediaUsesBlob() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN?.trim() ||
      process.env.BLOB_STORE_ID?.trim(),
  );
}

async function blobAuth() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };
  const storeId = process.env.BLOB_STORE_ID?.trim();
  return storeId ? { storeId } : {};
}

function localRoot() {
  return path.join(process.cwd(), "data", "media");
}

function localCatalogPath() {
  return path.join(localRoot(), "catalog.json");
}

function localCoverPath(filename: string) {
  if (!isSafeCoverName(filename)) throw new Error("Invalid cover.");
  return path.join(localRoot(), "covers", filename);
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_CATALOG_BYTES) throw new Error("Catalog is too large.");
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function catalogFromBytes(bytes: Uint8Array) {
  if (bytes.byteLength > MAX_CATALOG_BYTES) return null;
  try {
    return parseCatalog(JSON.parse(Buffer.from(bytes).toString("utf8")));
  } catch {
    return null;
  }
}

async function readBlobCatalog(): Promise<MediaCatalogRead> {
  const result = await get(MEDIA_CATALOG_PATH, {
    access: "private",
    useCache: false,
    ...(await blobAuth()),
  });
  if (!result || result.statusCode !== 200) {
    return { status: "ready", catalog: emptyCatalog(), etag: null };
  }
  const catalog = catalogFromBytes(await readStream(result.stream));
  if (!catalog) return { status: "unavailable" };
  return { status: "ready", catalog, etag: result.blob.etag };
}

async function readLocalCatalog(): Promise<MediaCatalogRead> {
  try {
    const bytes = new Uint8Array(await readFile(localCatalogPath()));
    const catalog = catalogFromBytes(bytes);
    if (!catalog) return { status: "unavailable" };
    return { status: "ready", catalog, etag: null };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { status: "ready", catalog: emptyCatalog(), etag: null };
    }
    return { status: "unavailable" };
  }
}

export async function readMediaCatalog(): Promise<MediaCatalogRead> {
  try {
    if (mediaUsesBlob()) return await readBlobCatalog();
    if (process.env.VERCEL) return { status: "unavailable" };
    return await readLocalCatalog();
  } catch {
    return { status: "unavailable" };
  }
}

function isConflict(error: unknown) {
  return (
    error instanceof BlobPreconditionFailedError ||
    error instanceof BlobNotFoundError ||
    (error instanceof Error && /already exists|precondition/i.test(error.message))
  );
}

export async function saveMediaCatalog(
  catalog: MediaCatalog,
  basis: { version: number; etag: string | null },
) {
  if (catalog.version !== basis.version + 1) {
    throw new MediaCatalogConflict();
  }
  const body = Buffer.from(JSON.stringify(catalog));

  if (mediaUsesBlob()) {
    const match = typeof basis.etag === "string" ? basis.etag.trim() : "";
    const creating = basis.etag === null;
    // An existing blob with no etag must not be overwritten unconditionally.
    if (!creating && !match) throw new MediaCatalogConflict();
    try {
      await put(MEDIA_CATALOG_PATH, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: !creating,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(match ? { ifMatch: match } : {}),
        ...(await blobAuth()),
      });
      return;
    } catch (error) {
      if (isConflict(error)) throw new MediaCatalogConflict();
      throw new Error("Could not save the library.");
    }
  }

  if (process.env.VERCEL) {
    throw new Error("Media storage is not available.");
  }

  const current = await readLocalCatalog();
  if (current.status !== "ready" || current.catalog.version !== basis.version) {
    throw new MediaCatalogConflict();
  }
  const directory = localRoot();
  await mkdir(directory, { recursive: true });
  const destination = localCatalogPath();
  const temporary = `${destination}.${process.pid}.tmp`;
  await writeFile(temporary, body);
  await rename(temporary, destination);
}

export async function saveMediaCover(
  bytes: Uint8Array,
  contentType: string,
  extension: "jpg" | "png" | "webp",
) {
  const filename = `${crypto.randomUUID()}.${extension}`;
  if (mediaUsesBlob()) {
    await put(coverBlobPath(filename), Buffer.from(bytes), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: false,
      contentType,
      cacheControlMaxAge: 60,
      ...(await blobAuth()),
    });
    return filename;
  }
  if (process.env.VERCEL) {
    throw new Error("Media storage is not available.");
  }
  const filePath = localCoverPath(filename);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, bytes);
  return filename;
}

export async function openMediaCover(filename: string) {
  if (!isSafeCoverName(filename)) return null;
  if (mediaUsesBlob()) {
    const result = await get(coverBlobPath(filename), {
      access: "private",
      useCache: false,
      ...(await blobAuth()),
    });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return {
      body: result.stream,
      size: result.blob.size,
      contentType: result.blob.contentType || "application/octet-stream",
    };
  }
  if (process.env.VERCEL) return null;
  try {
    const bytes = new Uint8Array(await readFile(localCoverPath(filename)));
    const contentType =
      filename.endsWith(".png")
        ? "image/png"
        : filename.endsWith(".webp")
          ? "image/webp"
          : "image/jpeg";
    return { body: bytes, size: bytes.byteLength, contentType };
  } catch {
    return null;
  }
}

export async function deleteMediaCover(filename: string | null) {
  if (!filename || !isSafeCoverName(filename)) return;
  try {
    if (mediaUsesBlob()) {
      await del(coverBlobPath(filename), await blobAuth());
      return;
    }
    if (process.env.VERCEL) return;
    await unlink(localCoverPath(filename));
  } catch {
    // The catalog no longer points at this file.
  }
}
