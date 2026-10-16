import "server-only";

import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { getVercelOidcToken } from "@vercel/oidc";
import { BackupRunError, isBackupEtag, isBackupTime } from "@/lib/drive-backup";
import { oidcBlobReadOptions, type OidcBlobReadOptions } from "@/lib/drive-backup-blob";

/**
 * One lease for manual and scheduled backups.
 * The private Blob store accepts compare-and-swap writes (create unless the
 * pathname exists, or replace only when the current etag matches). That is
 * the lock. Drive file creation is not, because two creates can both succeed.
 * No second database is required.
 *
 * The lease covers the route maxDuration of 300 seconds plus 60 seconds of
 * clock skew, then it is released. A second backup cannot start while the
 * lease is held. If this process stops before release, the lease expires and
 * the next backup may continue the unfinished folder.
 */

export const BACKUP_LOCK_PATH = "backup-coordination/active.json";
export const BACKUP_LOCK_LEASE_MS = 300_000 + 60_000;
export const BACKUP_BUSY_ERROR = "A backup is already running.";

const HOLDER = /^[a-f0-9]{8}$/;
const LOCK_TEXT_LIMIT = 1024;

export type BackupLockRecord = {
  holder: string;
  expiresAt: string;
  state: "held" | "released";
};

export type BackupLockHandle = {
  holder: string;
  version: string;
};

export type BackupLockSnapshot = {
  record: BackupLockRecord | null;
  version: string | null;
};

export type BackupLockStore = {
  read(): Promise<BackupLockSnapshot>;
  create(record: BackupLockRecord): Promise<{ version: string } | "conflict">;
  replace(record: BackupLockRecord, version: string): Promise<{ version: string } | "conflict">;
};

export type BackupLockRead = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  etag?: string | null;
} | null;

export type BackupLockWriteOptions = {
  access: "private";
  addRandomSuffix: false;
  contentType: "application/json";
  cacheControlMaxAge: number;
  oidcToken: string;
  storeId: string;
  allowOverwrite?: false;
  ifMatch?: string;
};

function lockRecord(holder: string, expiresAt: string, state: BackupLockRecord["state"]): BackupLockRecord {
  return { holder, expiresAt, state };
}

export function parseBackupLockRecord(text: string): BackupLockRecord | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  if (row.state !== "held" && row.state !== "released") return null;
  if (typeof row.holder !== "string" || !HOLDER.test(row.holder)) return null;
  if (!isBackupTime(row.expiresAt)) return null;
  return lockRecord(row.holder, row.expiresAt, row.state);
}

function leaseHeld(record: BackupLockRecord, now: Date) {
  return record.state === "held" && Date.parse(record.expiresAt) > now.getTime();
}

export async function acquireBackupLease(input: {
  store: BackupLockStore;
  now: Date;
  holder: string;
}): Promise<BackupLockHandle | "busy"> {
  if (!HOLDER.test(input.holder)) throw new BackupRunError("source");
  const snapshot = await input.store.read();
  if (snapshot.record && snapshot.version && leaseHeld(snapshot.record, input.now)) return "busy";
  if (!snapshot.version && snapshot.record) throw new BackupRunError("upload");
  const next = lockRecord(
    input.holder,
    new Date(input.now.getTime() + BACKUP_LOCK_LEASE_MS).toISOString(),
    "held",
  );
  const written = snapshot.version
    ? await input.store.replace(next, snapshot.version)
    : await input.store.create(next);
  if (written === "conflict") return "busy";
  if (!isBackupEtag(written.version)) throw new BackupRunError("upload");
  return { holder: input.holder, version: written.version };
}

export async function releaseBackupLease(input: { store: BackupLockStore; handle: BackupLockHandle }) {
  if (!HOLDER.test(input.handle.holder) || !isBackupEtag(input.handle.version)) return;
  try {
    await input.store.replace(
      lockRecord(input.handle.holder, new Date(0).toISOString(), "released"),
      input.handle.version,
    );
  } catch {
    // The lease remains until it expires. A mismatched etag means another
    // holder already replaced it, so this release must not overwrite that lease.
  }
}

function isConflict(error: unknown) {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error && /already exists|precondition/i.test(error.message))
  );
}

async function readLockText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > LOCK_TEXT_LIMIT) throw new BackupRunError("upload");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

function writeOptions(
  options: OidcBlobReadOptions,
  conditional: { allowOverwrite: false } | { ifMatch: string },
): BackupLockWriteOptions {
  return {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 0,
    oidcToken: options.oidcToken,
    storeId: options.storeId,
    ...conditional,
  };
}

export function createOidcBackupLockStore(
  options: OidcBlobReadOptions,
  io: {
    getLock: (pathname: string, options: OidcBlobReadOptions) => Promise<BackupLockRead>;
    putLock: (
      pathname: string,
      body: string,
      options: BackupLockWriteOptions,
    ) => Promise<{ etag?: string | null }>;
  },
): BackupLockStore {
  return {
    async read() {
      let result: BackupLockRead;
      try {
        result = await io.getLock(BACKUP_LOCK_PATH, options);
      } catch (error) {
        if (error instanceof BackupRunError) throw error;
        throw new BackupRunError("upload");
      }
      if (!result) return { record: null, version: null };
      const version = result.etag?.trim() ?? "";
      if (result.statusCode !== 200 || !result.stream || !isBackupEtag(version)) {
        throw new BackupRunError("upload");
      }
      const record = parseBackupLockRecord(await readLockText(result.stream));
      return { record, version };
    },
    async create(record) {
      try {
        const saved = await io.putLock(
          BACKUP_LOCK_PATH,
          JSON.stringify(record),
          writeOptions(options, { allowOverwrite: false }),
        );
        const version = saved.etag?.trim() ?? "";
        if (!isBackupEtag(version)) throw new BackupRunError("upload");
        return { version };
      } catch (error) {
        if (error instanceof BackupRunError) throw error;
        if (isConflict(error)) return "conflict";
        throw new BackupRunError("upload");
      }
    },
    async replace(record, version) {
      if (!isBackupEtag(version)) throw new BackupRunError("upload");
      try {
        const saved = await io.putLock(
          BACKUP_LOCK_PATH,
          JSON.stringify(record),
          writeOptions(options, { ifMatch: version }),
        );
        const next = saved.etag?.trim() ?? "";
        if (!isBackupEtag(next)) throw new BackupRunError("upload");
        return { version: next };
      } catch (error) {
        if (error instanceof BackupRunError) throw error;
        if (isConflict(error)) return "conflict";
        throw new BackupRunError("upload");
      }
    },
  };
}

export async function createBackupLockStore(): Promise<BackupLockStore> {
  let oidcToken = "";
  try {
    oidcToken = await getVercelOidcToken();
  } catch {
    throw new BackupRunError("configuration");
  }
  const options = oidcBlobReadOptions(process.env, oidcToken);
  if (!options) throw new BackupRunError("configuration");
  return createOidcBackupLockStore(options, {
    async getLock(pathname, readOptions) {
      const result = await get(pathname, readOptions);
      if (!result) return null;
      return {
        statusCode: result.statusCode,
        stream: result.stream,
        etag: result.blob.etag,
      };
    },
    async putLock(pathname, body, write) {
      const saved = await put(pathname, body, write);
      return { etag: saved.etag };
    },
  });
}
