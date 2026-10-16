import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { FOLDER_MIME } from "@/lib/drive-access-check";
import {
  BACKUP_CHUNK_BYTES,
  BackupRunError,
  advanceBackup,
  backupActorDecision,
  backupFolderId,
  backupStartedAt,
  classifyBackupPath,
  contentRange,
  driveChildQuery,
  evaluateBackupRequest,
  isAllowedBackupFolderName,
  selectBackupSources,
  toBackupFailure,
  type BackupBlobReader,
  type BackupDrive,
  type ChunkResult,
  type DriveChild,
} from "@/lib/drive-backup";
import { createBackupDrive } from "@/lib/drive-backup-drive";
import { backupBlobRecord, createOidcBackupBlobReader, oidcBlobReadOptions } from "@/lib/drive-backup-blob";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_UNAVAILABLE_MESSAGE } from "@/lib/minutes-session";

const DEST = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const NOW = new Date("2026-10-16T13:00:00.000Z");
const SUFFIX = "ab12cd34";
const BACKUP_ID = "website-backup-2026-10-16T130000Z-ab12cd34";
const COVER = "media-library/covers/12345678-1234-4234-8234-123456789abc.jpg";
const MINUTES = "minutes/Coach's Notes.pdf";
const CATALOG = "media-library/catalog.json";
const SECRET = "SECRET-PDF-BODY";
const UPLOADED = "2026-10-16T13:00:00.000Z";
const TOKEN = "ya29.test-token-value-ok";

type StoredFile = {
  id: string;
  name: string;
  mimeType: string;
  parentId: string;
  size?: number;
  md5?: string;
  text?: string;
};

function memoryDrive() {
  let sequence = 0;
  const files = new Map<string, StoredFile>();
  const sessions = new Map<string, { received: number; chunks: Uint8Array[] }>();
  const writes: { path: string; start: number; length: number }[] = [];
  const jsonNames: string[] = [];

  function nextId() {
    sequence += 1;
    return `bk${String(sequence).padStart(10, "0")}fileid`;
  }

  function children(parentId: string) {
    return [...files.values()].filter((file) => file.parentId === parentId);
  }

  function childOf(file: StoredFile): DriveChild {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size,
      md5: file.md5,
    };
  }

  const drive: BackupDrive = {
    async ensureFolder(parentId, name) {
      const found = children(parentId).find((file) => file.name === name);
      if (found) {
        if (found.mimeType !== FOLDER_MIME) throw new BackupRunError("destination");
        return found.id;
      }
      const id = nextId();
      files.set(id, { id, name, mimeType: FOLDER_MIME, parentId });
      return id;
    },
    async findChild(parentId, name) {
      const matches = children(parentId).filter((file) => file.name === name);
      if (matches.length > 1) throw new BackupRunError("verify");
      return matches[0] ? childOf(matches[0]) : null;
    },
    async listChildren(parentId) {
      return children(parentId).map(childOf);
    },
    async received(backupRootId, resumeKey) {
      return sessions.get(`${backupRootId}:${resumeKey}`)?.received ?? 0;
    },
    async writeChunk(input): Promise<ChunkResult> {
      const key = `${input.backupRootId}:${input.resumeKey}`;
      const session = sessions.get(key) ?? { received: 0, chunks: [] };
      if (input.start !== session.received || input.total < session.received) {
        throw new BackupRunError("resume");
      }
      writes.push({ path: input.path, start: input.start, length: input.bytes.length });
      session.chunks.push(input.bytes);
      session.received += input.bytes.length;
      sessions.set(key, session);
      if (session.received < input.total) return { complete: false };
      const merged = Buffer.concat(session.chunks.map((chunk) => Buffer.from(chunk)));
      const md5 = createHash("md5").update(merged).digest("hex");
      const id = nextId();
      files.set(id, {
        id,
        name: input.name,
        mimeType: input.mimeType,
        parentId: input.parentId,
        size: input.total,
        md5,
      });
      return { complete: true, id, size: input.total, md5 };
    },
    async putJson(parentId, name, text) {
      if (children(parentId).some((file) => file.name === name)) throw new BackupRunError("upload");
      const id = nextId();
      files.set(id, {
        id,
        name,
        mimeType: "application/json",
        parentId,
        size: Buffer.byteLength(text),
        text,
      });
      jsonNames.push(name);
    },
    async getJson(parentId, name) {
      return children(parentId).find((file) => file.name === name)?.text ?? null;
    },
  };

  function locate(names: string[]) {
    let parentId = DEST;
    const chain: StoredFile[] = [];
    for (const name of names) {
      const file = children(parentId).find((item) => item.name === name);
      assert.ok(file, name);
      chain.push(file);
      parentId = file.id;
    }
    return chain.at(-1);
  }

  return { drive, files, writes, jsonNames, locate };
}

function memoryBlobs(
  items: {
    path: string;
    bytes: Uint8Array;
    etag?: string;
    uploadedAt?: string;
    stream?: () => ReadableStream<Uint8Array>;
  }[],
) {
  const opened: string[] = [];
  function version(item: (typeof items)[number]) {
    return {
      etag: item.etag ?? `etag-${item.path.length}`,
      uploadedAt: item.uploadedAt ?? UPLOADED,
    };
  }
  const blobs: BackupBlobReader = {
    async list() {
      return items.map((item) => ({
        path: item.path,
        size: item.bytes.byteLength,
        ...version(item),
      }));
    },
    async open(path) {
      opened.push(path);
      const item = items.find((entry) => entry.path === path);
      if (!item) throw new BackupRunError("source");
      const current = version(item);
      const stream = item.stream
        ? item.stream()
        : new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(item.bytes);
              controller.close();
            },
          });
      return { stream, etag: current.etag, size: item.bytes.byteLength };
    },
  };
  return { blobs, opened, items };
}

function runBackup(input: {
  drive: BackupDrive;
  blobs: BackupBlobReader;
  backupId?: string;
  clock?: () => number;
  deadline?: number;
  chunkBytes?: number;
}) {
  return advanceBackup({
    destinationId: DEST,
    drive: input.drive,
    blobs: input.blobs,
    now: NOW,
    suffix: SUFFIX,
    backupId: input.backupId,
    clock: input.clock,
    deadline: input.deadline,
    chunkBytes: input.chunkBytes,
  });
}

function adminRequest(overrides: Partial<Parameters<typeof evaluateBackupRequest>[0]> = {}) {
  return evaluateBackupRequest({
    access: { state: "active", role: "admin" },
    sameOrigin: true,
    contentLength: null,
    body: "",
    production: true,
    ...overrides,
  });
}

describe("manual backup authorization", () => {
  it("allows an administrator to start or continue a production backup", () => {
    assert.equal(backupActorDecision({ state: "active", role: "admin" }), null);
    const start = adminRequest();
    assert.deepEqual(start, { ok: true });
    const resume = adminRequest({
      contentLength: JSON.stringify({ backupId: BACKUP_ID }).length,
      body: JSON.stringify({ backupId: BACKUP_ID }),
    });
    assert.deepEqual(resume, { ok: true, backupId: BACKUP_ID });
  });

  it("denies anonymous, expired, unavailable, and view-only access", () => {
    assert.deepEqual(adminRequest({ access: { state: "anonymous" } }), {
      ok: false,
      status: 401,
      body: { error: "Sign in required." },
    });
    assert.deepEqual(adminRequest({ access: { state: "expired" } }), {
      ok: false,
      status: 401,
      body: { error: MINUTES_EXPIRED_MESSAGE, expired: true },
    });
    assert.deepEqual(adminRequest({ access: { state: "unavailable" } }), {
      ok: false,
      status: 503,
      body: { error: MINUTES_UNAVAILABLE_MESSAGE },
    });
    const view = adminRequest({ access: { state: "active", role: "view" } });
    assert.equal(view.ok, false);
    if (!view.ok) {
      assert.equal(view.status, 403);
      assert.equal("error" in view.body && view.body.error, "Admin sign-in required.");
    }
  });

  it("rejects cross-origin, oversized, and malformed commands before production work", () => {
    const cross = adminRequest({ sameOrigin: false });
    assert.equal(cross.ok, false);
    if (!cross.ok) assert.equal(cross.status, 403);
    const huge = adminRequest({ contentLength: 257, body: "" });
    assert.equal(huge.ok, false);
    if (!huge.ok) assert.equal(huge.status, 400);
    const extra = adminRequest({
      contentLength: 20,
      body: JSON.stringify({ backupId: BACKUP_ID, force: true }),
    });
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.equal(extra.status, 400);
  });

  it("runs only in production", () => {
    const preview = adminRequest({ production: false });
    assert.deepEqual(preview, {
      ok: false,
      status: 404,
      body: { ok: false, status: "failed", error: "This backup runs only in production." },
    });
  });
});

describe("manual backup selection", () => {
  it("keeps minutes documents, the media catalog, and covers", () => {
    assert.equal(classifyBackupPath(MINUTES), "include");
    assert.equal(classifyBackupPath("minutes/Board Meeting (Oct).docx"), "include");
    assert.equal(classifyBackupPath(CATALOG), "include");
    assert.equal(classifyBackupPath(COVER), "include");
    assert.equal(classifyBackupPath("auth-sessions/v1/session.json"), "exclude");
    assert.equal(classifyBackupPath("auth-rate/v1/counter.json"), "exclude");
    assert.equal(classifyBackupPath("minutes/notes.txt"), "reject");
    assert.equal(classifyBackupPath("minutes/../secret.pdf"), "reject");
    assert.equal(classifyBackupPath("media-library/covers/not-a-cover.jpg"), "reject");
    const selected = selectBackupSources([
      { pathname: "auth-sessions/v1/a.json", size: 4 },
      { pathname: "auth-rate/v1/b.json", size: 4 },
      { pathname: CATALOG, size: 2, etag: "etag-catalog", uploadedAt: UPLOADED },
      { pathname: MINUTES, size: 3, etag: "etag-minutes", uploadedAt: UPLOADED },
    ]);
    assert.deepEqual(
      selected.map((item) => item.path),
      [CATALOG, MINUTES],
    );
    assert.equal(selected[1]?.etag, "etag-minutes");
    assert.throws(
      () => selectBackupSources([{ pathname: "minutes/notes.txt", size: 1, etag: "etag", uploadedAt: UPLOADED }]),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
    assert.throws(
      () => selectBackupSources([{ pathname: MINUTES, size: 3, uploadedAt: UPLOADED }]),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
  });

  it("builds a new timestamped folder id and escapes Drive names", () => {
    assert.equal(backupFolderId(NOW, SUFFIX), BACKUP_ID);
    assert.equal(backupStartedAt(BACKUP_ID), "2026-10-16T13:00:00.000Z");
    assert.equal(BACKUP_CHUNK_BYTES % (256 * 1024), 0);
    assert.equal(contentRange(0, 4, 8), "bytes 0-3/8");
    assert.equal(contentRange(0, 0, 0), "bytes */0");
    assert.equal(
      driveChildQuery(DEST, "Coach's Notes.pdf"),
      `'${DEST}' in parents and name = 'Coach\\'s Notes.pdf' and trashed = false`,
    );
    assert.equal(isAllowedBackupFolderName("auth-sessions"), false);
    assert.equal(isAllowedBackupFolderName(BACKUP_ID), true);
  });
});

describe("manual backup copy", () => {
  const minutes = new TextEncoder().encode(SECRET);
  const catalog = new TextEncoder().encode('{"collections":[]}');
  const cover = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  function library() {
    return memoryBlobs([
      { path: MINUTES, bytes: minutes },
      { path: CATALOG, bytes: catalog },
      { path: COVER, bytes: cover, stream: () => byteStream(cover) },
      { path: "auth-sessions/v1/session.json", bytes: new Uint8Array([9]) },
      { path: "auth-rate/v1/counter.json", bytes: new Uint8Array([8]) },
    ]);
  }

  it("copies included files into the original folder structure and verifies them", async () => {
    const stored = memoryDrive();
    const source = library();
    const result = await runBackup({ drive: stored.drive, blobs: source.blobs, chunkBytes: 4 });
    assert.equal(result.status, "complete");
    assert.equal(result.backupId, BACKUP_ID);
    assert.equal(result.filesVerified, 3);
    assert.equal(result.filesTotal, 3);
    assert.equal(result.bytesVerified, minutes.length + catalog.length + cover.length);
    assert.equal(result.totalBytes, result.bytesVerified);
    assert.equal(JSON.stringify(result).includes(SECRET), false);
    assert.equal(JSON.stringify(result).includes("Coach"), false);
    assert.equal(JSON.stringify(result).includes("catalog"), false);
    stored.locate([BACKUP_ID, "minutes", "Coach's Notes.pdf"]);
    stored.locate([BACKUP_ID, "media-library", "catalog.json"]);
    stored.locate([BACKUP_ID, "media-library", "covers", "12345678-1234-4234-8234-123456789abc.jpg"]);
    const manifestFile = stored.locate([BACKUP_ID, "manifest.json"]);
    assert.ok(manifestFile?.text);
    const manifest = JSON.parse(manifestFile.text) as {
      startedAt: string;
      verification: string;
      filesVerified: number;
      totalBytes: number;
      files: { path: string; size: number; md5: string; driveFileId: string }[];
    };
    assert.equal(manifest.startedAt, "2026-10-16T13:00:00.000Z");
    assert.equal(manifest.verification, "verified");
    assert.equal(manifestFile.text.includes("\"sourceCheck\":\"etag\""), true);
    assert.equal(manifest.filesVerified, 3);
    assert.equal(manifest.totalBytes, result.totalBytes);
    assert.deepEqual(
      manifest.files.map((file) => file.path),
      [CATALOG, COVER, MINUTES],
    );
    assert.equal(manifestFile.text.includes(SECRET), false);
    assert.equal(manifest.files.some((file) => file.path.startsWith("auth-")), false);
    assert.equal(source.opened.includes("auth-sessions/v1/session.json"), false);
    assert.equal(source.opened.includes("auth-rate/v1/counter.json"), false);
    const minutesCopy = manifest.files.find((file) => file.path === MINUTES);
    assert.equal(minutesCopy?.size, minutes.length);
    assert.equal(minutesCopy?.md5, createHash("md5").update(minutes).digest("hex"));
    assert.equal(stored.writes.filter((write) => write.path === COVER).every((write) => write.length <= 4), true);
  });

  it("continues after a pause without uploading completed bytes again", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }, { path: CATALOG, bytes: catalog }]);
    let ticks = 0;
    const paused = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      chunkBytes: 64,
      deadline: 5_000,
      clock: () => {
        ticks += 1;
        return ticks >= 2 ? 5_000 : 0;
      },
    });
    assert.equal(paused.status, "running");
    assert.equal(paused.filesVerified, 1);
    assert.equal(paused.filesTotal, 2);
    assert.equal(stored.jsonNames.includes("manifest.json"), false);
    const firstWrites = stored.writes.map((write) => write.path);
    const resumed = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      backupId: paused.backupId,
      chunkBytes: 64,
      clock: () => 0,
      deadline: 5_000,
    });
    assert.equal(resumed.status, "complete");
    assert.equal(resumed.filesVerified, 2);
    assert.equal(resumed.bytesVerified, resumed.totalBytes);
    const secondWrites = stored.writes.slice(firstWrites.length);
    assert.equal(secondWrites.some((write) => firstWrites.includes(write.path)), false);
    assert.equal(stored.jsonNames.filter((name) => name === "manifest.json").length, 1);
    const again = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      backupId: paused.backupId,
      clock: () => 0,
    });
    assert.equal(again.status, "complete");
    assert.equal(stored.writes.length, firstWrites.length + secondWrites.length);
  });

  it("resumes a partial file from the uploaded offset", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) }]);
    let ticks = 0;
    const paused = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      chunkBytes: 4,
      deadline: 5_000,
      clock: () => {
        ticks += 1;
        return ticks >= 2 ? 5_000 : 0;
      },
    });
    assert.equal(paused.status, "running");
    assert.deepEqual(stored.writes, [{ path: MINUTES, start: 0, length: 4 }]);
    const resumed = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      backupId: BACKUP_ID,
      chunkBytes: 4,
      clock: () => 0,
      deadline: 5_000,
    });
    assert.equal(resumed.status, "complete");
    assert.deepEqual(stored.writes, [
      { path: MINUTES, start: 0, length: 4 },
      { path: MINUTES, start: 4, length: 4 },
    ]);
    assert.equal(resumed.bytesVerified, 8);
  });

  it("does not upload again when the Drive file already matches", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }]);
    await runBackup({ drive: stored.drive, blobs: source.blobs });
    for (const file of [...stored.files.values()]) {
      if (file.name === "manifest.json" || /^[a-f0-9]{64}\.json$/.test(file.name)) {
        stored.files.delete(file.id);
      }
    }
    stored.jsonNames.splice(0, stored.jsonNames.length);
    const writes = stored.writes.length;
    const verified = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      backupId: BACKUP_ID,
    });
    assert.equal(verified.status, "complete");
    assert.equal(stored.writes.length, writes);
    assert.equal(stored.jsonNames.some((name) => name.endsWith(".json") && name !== "manifest.json"), true);
  });

  it("fails verification when an existing Drive file does not match", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }]);
    const drive: BackupDrive = {
      ...stored.drive,
      async findChild(parentId, name) {
        const found = await stored.drive.findChild(parentId, name);
        if (!found && name === "Coach's Notes.pdf") {
          return {
            id: "existing01abcdefghijk",
            name,
            mimeType: "application/pdf",
            size: minutes.length,
            md5: "ab".repeat(16),
          };
        }
        return found;
      },
    };
    await assert.rejects(
      () => runBackup({ drive, blobs: source.blobs }),
      (error: unknown) => error instanceof BackupRunError && error.code === "verify",
    );
    assert.equal(stored.writes.length, 0);
    assert.equal(stored.jsonNames.includes("manifest.json"), false);
  });

  it("fails closed when a required path is unsafe or the upload stops", async () => {
    const stored = memoryDrive();
    const rejected = memoryBlobs([{ path: "minutes/notes.txt", bytes: new Uint8Array([1]) }]);
    await assert.rejects(
      () => runBackup({ drive: stored.drive, blobs: rejected.blobs }),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
    assert.equal(stored.jsonNames.includes("manifest.json"), false);

    const uploadDrive = memoryDrive();
    const failing: BackupDrive = {
      ...uploadDrive.drive,
      async writeChunk() {
        throw new BackupRunError("upload");
      },
    };
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }]);
    const error = await runBackup({ drive: failing, blobs: source.blobs }).catch((caught: unknown) => caught);
    assert.ok(error instanceof BackupRunError);
    assert.equal(error.code, "upload");
    const failure = toBackupFailure(error);
    assert.equal(failure.status, 502);
    assert.equal(failure.body.status, "failed");
    assert.equal(failure.body.backupId, BACKUP_ID);
    assert.equal(failure.body.filesVerified, 0);
    assert.equal(JSON.stringify(failure).includes(SECRET), false);
    assert.equal(JSON.stringify(failure).includes("Coach"), false);
  });

  it("refuses to continue an unaligned production upload or a changed source", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: new Uint8Array(200) }]);
    const drive: BackupDrive = {
      ...stored.drive,
      async received() {
        return 100;
      },
      async writeChunk() {
        throw new Error("uploaded");
      },
    };
    await assert.rejects(
      () => runBackup({ drive, blobs: source.blobs, chunkBytes: BACKUP_CHUNK_BYTES }),
      (error: unknown) => error instanceof BackupRunError && error.code === "resume",
    );

    const first = memoryDrive();
    const mutable = memoryBlobs([{ path: MINUTES, bytes: minutes, etag: "v1" }]);
    await runBackup({ drive: first.drive, blobs: mutable.blobs });
    const writes = first.writes.length;
    mutable.items[0].etag = "v2";
    mutable.items[0].bytes = new Uint8Array(minutes.length + 1);
    const sealed = await runBackup({ drive: first.drive, blobs: mutable.blobs, backupId: BACKUP_ID });
    assert.equal(sealed.status, "complete");
    assert.equal(first.writes.length, writes);
  });

  it("refuses to seal a backup after a same-size source change", async () => {
    const stored = memoryDrive();
    const catalogItem = { path: CATALOG, bytes: catalog, etag: "catalog-v1" };
    const source = memoryBlobs([catalogItem, { path: MINUTES, bytes: minutes, etag: "minutes-v1" }]);
    let ticks = 0;
    const paused = await runBackup({
      drive: stored.drive,
      blobs: source.blobs,
      chunkBytes: 64,
      deadline: 5_000,
      clock: () => {
        ticks += 1;
        return ticks >= 2 ? 5_000 : 0;
      },
    });
    assert.equal(paused.status, "running");
    catalogItem.etag = "catalog-v2";
    await assert.rejects(
      () =>
        runBackup({
          drive: stored.drive,
          blobs: source.blobs,
          backupId: paused.backupId,
          chunkBytes: 64,
          clock: () => 0,
          deadline: 5_000,
        }),
      (error: unknown) => error instanceof BackupRunError && error.code === "verify",
    );
    assert.equal(stored.jsonNames.includes("manifest.json"), false);
    assert.equal(stored.writes.filter((write) => write.path === CATALOG).length, 1);
  });

  it("does not seal when the source etag changes after the bytes were copied", async () => {
    const stored = memoryDrive();
    let listed = 0;
    const blobs: BackupBlobReader = {
      async list() {
        listed += 1;
        return [
          {
            path: MINUTES,
            size: minutes.length,
            etag: listed === 1 ? "v1" : "v2",
            uploadedAt: UPLOADED,
          },
        ];
      },
      async open() {
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue(minutes);
              controller.close();
            },
          }),
          etag: "v1",
          size: minutes.length,
        };
      },
    };
    await assert.rejects(
      () => runBackup({ drive: stored.drive, blobs }),
      (error: unknown) => error instanceof BackupRunError && error.code === "verify",
    );
    assert.equal(stored.jsonNames.includes("manifest.json"), false);
    assert.equal(stored.writes.length, 1);
  });

  it("recovers the interruption points without a second completed copy", async () => {
    const total = 80 * 1024 * 1024;
    const chunk = 8 * 1024 * 1024;
    const stored = memoryDrive();
    const large: BackupBlobReader = {
      async list() {
        return [{ path: MINUTES, size: total, etag: "large-v1", uploadedAt: UPLOADED }];
      },
      async open() {
        return { stream: zeroStream(total), etag: "large-v1", size: total };
      },
    };
    const notStarted = await runBackup({
      drive: stored.drive,
      blobs: large,
      clock: () => 0,
      deadline: 0,
    });
    assert.equal(notStarted.status, "running");
    assert.equal(notStarted.filesVerified, 0);
    assert.equal(stored.writes.length, 0);

    let ticks = 0;
    const paused = await runBackup({
      drive: stored.drive,
      blobs: large,
      backupId: notStarted.backupId,
      chunkBytes: chunk,
      deadline: 5_000,
      clock: () => {
        ticks += 1;
        return ticks >= 2 ? 5_000 : 0;
      },
    });
    assert.equal(paused.status, "running");
    assert.deepEqual(stored.writes, [{ path: MINUTES, start: 0, length: chunk }]);
    const resumed = await runBackup({
      drive: stored.drive,
      blobs: large,
      backupId: paused.backupId,
      chunkBytes: chunk,
      clock: () => 0,
      deadline: 5_000,
    });
    assert.equal(resumed.status, "complete");
    assert.equal(resumed.bytesVerified, total);
    const starts = stored.writes.map((write) => write.start);
    assert.deepEqual(
      starts,
      Array.from({ length: total / chunk }, (_, index) => index * chunk),
    );

    const hidden = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }]);
    let manifestFailed = false;
    const drive: BackupDrive = {
      ...hidden.drive,
      async putJson(parentId, name, text) {
        if (name === "manifest.json" && !manifestFailed) {
          manifestFailed = true;
          throw new BackupRunError("upload");
        }
        return hidden.drive.putJson(parentId, name, text);
      },
      async received() {
        return minutes.length;
      },
      async findChild(parentId, name) {
        if (name === "Coach's Notes.pdf") return null;
        return hidden.drive.findChild(parentId, name);
      },
      async writeChunk() {
        throw new Error("duplicate upload");
      },
    };
    await assert.rejects(
      () => runBackup({ drive, blobs: source.blobs }),
      (error: unknown) => error instanceof BackupRunError && error.code === "verify",
    );
  });

  it("completes an empty library without copying session data", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([
      { path: "auth-sessions/v1/session.json", bytes: new Uint8Array([1]) },
      { path: "auth-rate/v1/counter.json", bytes: new Uint8Array([1]) },
    ]);
    const result = await runBackup({ drive: stored.drive, blobs: source.blobs });
    assert.equal(result.status, "complete");
    assert.equal(result.filesVerified, 0);
    assert.equal(result.totalBytes, 0);
    assert.equal(stored.writes.length, 0);
    assert.equal(source.opened.length, 0);
    const manifest = stored.locate([BACKUP_ID, "manifest.json"]);
    assert.equal(manifest?.text?.includes("auth-sessions"), false);
  });

  it("retries manifest creation without uploading the file again", async () => {
    const stored = memoryDrive();
    const source = memoryBlobs([{ path: MINUTES, bytes: minutes }]);
    let manifestFailed = false;
    const drive: BackupDrive = {
      ...stored.drive,
      async putJson(parentId, name, text) {
        if (name === "manifest.json" && !manifestFailed) {
          manifestFailed = true;
          throw new BackupRunError("upload");
        }
        return stored.drive.putJson(parentId, name, text);
      },
    };
    await assert.rejects(
      () => runBackup({ drive, blobs: source.blobs }),
      (error: unknown) => error instanceof BackupRunError && error.code === "upload",
    );
    const writes = stored.writes.length;
    const sealed = await runBackup({ drive, blobs: source.blobs, backupId: BACKUP_ID });
    assert.equal(sealed.status, "complete");
    assert.equal(stored.writes.length, writes);
    assert.equal(stored.jsonNames.filter((name) => name === "manifest.json").length, 1);
  });

  it("drops credential text from a failure response", () => {
    const hidden = toBackupFailure(
      new Error("Bearer ya29.secret-token eyJhbGciOiJIUzI1NiJ9.payload.signature"),
    );
    assert.equal(hidden.status, 502);
    assert.equal(hidden.body.error, "The backup could not be saved.");
    assert.equal(JSON.stringify(hidden).includes("ya29"), false);
    assert.equal(JSON.stringify(hidden).includes("eyJ"), false);
    const scrubbed = toBackupFailure(new BackupRunError("upload", { backupId: "ya29.secret-token" }));
    assert.equal(scrubbed.status, 500);
    assert.equal(scrubbed.body.error, "Backup failed.");
    assert.equal(JSON.stringify(scrubbed).includes("ya29"), false);
    assert.equal(toBackupFailure(new BackupRunError("configuration")).status, 503);
  });
});

describe("manual backup blob reads", () => {
  const blobEnv = {
    BLOB_STORE_ID: "store_minutes",
    BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_should_not_be_used",
  };
  const options = oidcBlobReadOptions(blobEnv, "oidc-token-value-ok");

  it("uses the OIDC store id and never accepts the read-write token", () => {
    assert.ok(options);
    assert.equal(options.oidcToken, "oidc-token-value-ok");
    assert.equal(options.storeId, "store_minutes");
    assert.equal("token" in options, false);
    assert.equal(JSON.stringify(options).includes("vercel_blob_rw"), false);
    assert.equal(oidcBlobReadOptions({ BLOB_STORE_ID: "store_minutes" }, ""), null);
    assert.equal(oidcBlobReadOptions({}, "oidc-token-value-ok"), null);
  });

  it("lists only minutes and media prefixes and does not open excluded paths", async () => {
    assert.ok(options);
    const prefixes: string[] = [];
    const gets: string[] = [];
    const reader = createOidcBackupBlobReader(options, {
      async listPage(args) {
        prefixes.push(args.prefix);
        assert.equal("token" in args, false);
        assert.equal(args.oidcToken, options.oidcToken);
        assert.equal(args.storeId, options.storeId);
        const blobs =
          args.prefix === "minutes/"
            ? [
                { pathname: MINUTES, size: 2, etag: "etag-minutes", uploadedAt: UPLOADED },
                { pathname: "auth-sessions/v1/session.json", size: 2 },
              ]
            : [{ pathname: "auth-rate/v1/counter.json", size: 2 }];
        return { blobs, hasMore: false };
      },
      async getBlob(pathname, readOptions) {
        gets.push(pathname);
        assert.equal("token" in readOptions, false);
        assert.equal(readOptions.access, "private");
        assert.equal(readOptions.useCache, false);
        return {
          statusCode: 200,
          stream: byteStream(new Uint8Array([1, 2])),
          blob: { etag: "etag-minutes", size: 2 },
        };
      },
    });
    const listed = await reader.list();
    assert.deepEqual(prefixes, ["minutes/", "media-library/"]);
    assert.deepEqual(listed.map((item) => item.path), [MINUTES]);
    await assert.rejects(
      () => reader.open("auth-sessions/v1/session.json"),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
    assert.deepEqual(gets, []);
    const opened = await reader.open(MINUTES);
    assert.equal(opened.etag, "etag-minutes");
    assert.equal(opened.size, 2);
    assert.deepEqual(gets, [MINUTES]);
    const record = backupBlobRecord({
      pathname: MINUTES,
      size: 4,
      etag: " etag-minutes ",
      uploadedAt: new Date(UPLOADED),
      url: "https://private.example/minutes/secret.pdf",
      downloadUrl: "https://private.example/download",
    });
    assert.deepEqual(record, {
      pathname: MINUTES,
      size: 4,
      etag: "etag-minutes",
      uploadedAt: UPLOADED,
    });
    assert.equal(JSON.stringify(record).includes("private.example"), false);
  });

  it("stops listing after the page cap and hides storage errors", async () => {
    assert.ok(options);
    let pages = 0;
    const reader = createOidcBackupBlobReader(options, {
      async listPage() {
        pages += 1;
        return { blobs: [], hasMore: true, cursor: `page-${pages}` };
      },
      async getBlob() {
        throw new Error("Bearer ya29.secret https://private.example/minutes/secret.pdf");
      },
    });
    await assert.rejects(
      () => reader.list(),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
    assert.equal(pages, 50);
    const readerWithGet = createOidcBackupBlobReader(options, {
      async listPage() {
        return { blobs: [], hasMore: false };
      },
      async getBlob() {
        throw new Error("Bearer ya29.secret https://private.example/minutes/secret.pdf");
      },
    });
    const error = await readerWithGet.open(MINUTES).catch((caught: unknown) => caught);
    assert.ok(error instanceof BackupRunError);
    assert.equal(error.message.includes("ya29"), false);
    assert.equal(error.message.includes("secret.pdf"), false);
  });
});

describe("manual backup Drive uploads", () => {
  it("creates folders and resumable uploads without deleting or patching", async () => {
    const http = memoryGoogleDrive();
    const drive = createBackupDrive(TOKEN, http.fetchImpl);
    const root = await drive.ensureFolder(DEST, BACKUP_ID);
    const minutesId = await drive.ensureFolder(root, "minutes");
    assert.equal(await drive.ensureFolder(root, "minutes"), minutesId);
    const bytes = new Uint8Array([1, 2, 3]);
    const first = await drive.writeChunk({
      backupRootId: root,
      resumeKey: "a".repeat(64),
      parentId: minutesId,
      path: MINUTES,
      name: "Coach's Notes.pdf",
      mimeType: "application/pdf",
      total: bytes.length,
      start: 0,
      bytes,
    });
    assert.equal(first.complete, true);
    if (first.complete) {
      assert.equal(first.size, 3);
      assert.equal(first.md5, createHash("md5").update(bytes).digest("hex"));
      assert.equal("url" in first, false);
    }
    assert.equal(http.resumablePosts, 1);
    assert.equal(http.methods.includes("DELETE"), false);
    assert.equal(http.methods.includes("PATCH"), false);
    assert.equal(http.urls.every((url) => !url.includes(TOKEN)), true);
    assert.equal(http.urls.some((url) => url.includes("fields=id%2Cname%2CmimeType%2Csize%2Cmd5Checksum") || url.includes("fields=id,name,mimeType,size,md5Checksum")), true);
    await assert.rejects(
      () => drive.ensureFolder(root, "auth-sessions"),
      (error: unknown) => error instanceof BackupRunError && error.code === "source",
    );
    await assert.rejects(
      () =>
        drive.writeChunk({
          backupRootId: root,
          resumeKey: "b".repeat(64),
          parentId: minutesId,
          path: MINUTES,
          name: "Coach's Notes.pdf",
          mimeType: "application/pdf",
          total: 10,
          start: 0,
          bytes: new Uint8Array(4),
        }),
      (error: unknown) => error instanceof BackupRunError && error.code === "upload",
    );
    assert.equal(http.resumablePosts, 1);
  });

  it("continues one resumable session across invocations", async () => {
    const http = memoryGoogleDrive();
    const chunk = 256 * 1024;
    const bytes = new Uint8Array(chunk * 2);
    bytes[0] = 7;
    bytes[chunk] = 9;
    const firstDrive = createBackupDrive(TOKEN, http.fetchImpl);
    const root = await firstDrive.ensureFolder(DEST, BACKUP_ID);
    const parentId = await firstDrive.ensureFolder(root, "minutes");
    const resumeKey = "c".repeat(64);
    const partial = await firstDrive.writeChunk({
      backupRootId: root,
      resumeKey,
      parentId,
      path: MINUTES,
      name: "Coach's Notes.pdf",
      mimeType: "application/pdf",
      total: bytes.length,
      start: 0,
      bytes: bytes.subarray(0, chunk),
    });
    assert.equal(partial.complete, false);
    const secondDrive = createBackupDrive(TOKEN, http.fetchImpl);
    assert.equal(await secondDrive.received(root, resumeKey), chunk);
    const finished = await secondDrive.writeChunk({
      backupRootId: root,
      resumeKey,
      parentId,
      path: MINUTES,
      name: "Coach's Notes.pdf",
      mimeType: "application/pdf",
      total: bytes.length,
      start: chunk,
      bytes: bytes.subarray(chunk),
    });
    assert.equal(finished.complete, true);
    if (finished.complete) {
      assert.equal(finished.size, bytes.length);
      assert.equal(finished.md5, createHash("md5").update(bytes).digest("hex"));
    }
    assert.equal(http.resumablePosts, 1);
    await assert.rejects(
      () =>
        secondDrive.writeChunk({
          backupRootId: root,
          resumeKey,
          parentId,
          path: MINUTES,
          name: "Coach's Notes.pdf",
          mimeType: "application/pdf",
          total: bytes.length,
          start: 0,
          bytes: bytes.subarray(0, chunk),
        }),
      (error: unknown) => error instanceof BackupRunError && error.code === "resume",
    );
    assert.equal(http.resumablePosts, 1);
    assert.equal(http.methods.includes("DELETE"), false);
    assert.equal(http.methods.includes("PATCH"), false);
  });

  it("discards a Drive error body that contains a token", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json({ error: `Bearer ${TOKEN} eyJhbGciOiJIUzI1NiJ9.payload.sig` }, { status: 500 });
    const drive = createBackupDrive(TOKEN, fetchImpl);
    const error = await drive.ensureFolder(DEST, BACKUP_ID).catch((caught: unknown) => caught);
    assert.ok(error instanceof BackupRunError);
    assert.equal(error.code, "upload");
    assert.equal(error.message.includes(TOKEN), false);
    assert.equal(error.message.includes("eyJ"), false);
  });
});

describe("manual backup route source", () => {
  it("exposes one production POST and does not read Blob with the static token", () => {
    const route = readFileSync(new URL("../app/api/backup/run/route.ts", import.meta.url), "utf8");
    const blob = readFileSync(new URL("./drive-backup-blob.ts", import.meta.url), "utf8");
    const drive = readFileSync(new URL("./drive-backup-drive.ts", import.meta.url), "utf8");
    assert.equal(route.includes("export async function GET"), false);
    assert.equal(route.includes("export function GET"), false);
    assert.equal(route.includes("maxDuration = 300"), true);
    assert.equal(route.includes("evaluateBackupRequest"), true);
    assert.equal(route.includes("backupAccessProduction"), true);
    assert.equal(route.includes("@vercel/blob"), false);
    assert.equal(route.includes("BLOB_READ_WRITE_TOKEN"), false);
    assert.equal(route.includes("cron"), false);
    assert.match(route, /console\.error\(`backup:\$\{failure\.body\.status\}`\)/);
    assert.equal(blob.includes("BLOB_READ_WRITE_TOKEN"), false);
    assert.equal(/(^|[^A-Za-z])token\s*:/.test(blob), false);
    assert.equal(blob.includes("put("), false);
    assert.equal(blob.includes("del("), false);
    assert.equal(blob.includes('prefix: "minutes/"') || blob.includes('"minutes/"'), true);
    assert.equal(blob.includes('"media-library/"'), true);
    assert.equal(drive.includes('method: "DELETE"'), false);
    assert.equal(drive.includes('method: "PATCH"'), false);
    assert.equal(drive.includes("mintDriveAccessToken"), false);
    assert.equal(drive.includes("getVercelOidcToken"), false);
  });
});

function zeroStream(total: number) {
  const slice = 1024 * 1024;
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= total) {
        controller.close();
        return;
      }
      const length = Math.min(slice, total - sent);
      controller.enqueue(new Uint8Array(length));
      sent += length;
    },
  });
}

function byteStream(bytes: Uint8Array) {
  let index = 0;
  let primed = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!primed) {
        primed = true;
        controller.enqueue(new Uint8Array());
        return;
      }
      if (index >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.subarray(index, index + 1));
      index += 1;
    },
  });
}

type GoogleFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  size?: string;
  md5Checksum?: string;
  text?: string;
};

function memoryGoogleDrive() {
  let sequence = 0;
  const files = new Map<string, GoogleFile>();
  const uploads = new Map<
    string,
    { parentId: string; name: string; mimeType: string; total: number; received: number; parts: Buffer[] }
  >();
  const methods: string[] = [];
  const urls: string[] = [];
  let resumablePosts = 0;
  files.set(DEST, { id: DEST, name: "Backup destination", mimeType: FOLDER_MIME, parents: [] });

  function nextId() {
    sequence += 1;
    return `gd${String(sequence).padStart(12, "0")}x`;
  }

  function unescapeName(value: string) {
    return value.replace(/\\'/g, "'").replace(/\\\\/g, "\\");
  }

  function matches(query: string) {
    const named = query.match(/^'([^']+)' in parents and name = '((?:\\'|[^'])*)' and trashed = false$/);
    if (named) {
      const parentId = named[1];
      const name = unescapeName(named[2]);
      return [...files.values()].filter((file) => file.parents.includes(parentId) && file.name === name);
    }
    const all = query.match(/^'([^']+)' in parents and trashed = false$/);
    if (!all) throw new Error(`Unexpected query ${query}`);
    return [...files.values()].filter((file) => file.parents.includes(all[1]));
  }

  function metadata(file: GoogleFile) {
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      parents: file.parents,
      size: file.size,
      md5Checksum: file.md5Checksum,
    };
  }

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    methods.push(method);
    urls.push(url.toString());
    if (method === "DELETE" || method === "PATCH") {
      return Response.json({ error: "unsupported" }, { status: 405 });
    }
    const upload = uploads.get(url.toString());
    if (upload && method === "PUT") {
      const range = new Headers(init?.headers).get("content-range") ?? "";
      if (range === `bytes */${upload.total}`) {
        if (upload.received === 0) return new Response(null, { status: 308 });
        if (upload.received < upload.total) {
          return new Response(null, {
            status: 308,
            headers: { Range: `bytes=0-${upload.received - 1}` },
          });
        }
        const file = finishUpload(upload);
        return Response.json(metadata(file));
      }
      const piece = range.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
      if (!piece) return Response.json({ error: "range" }, { status: 400 });
      const start = Number(piece[1]);
      const end = Number(piece[2]);
      if (start !== upload.received) return Response.json({ error: "offset" }, { status: 400 });
      const body = await bodyBytes(init?.body);
      upload.parts.push(body);
      upload.received += body.length;
      if (upload.received < upload.total) {
        return new Response(null, {
          status: 308,
          headers: { Range: `bytes=0-${end}` },
        });
      }
      return Response.json(metadata(finishUpload(upload)));
    }
    if (url.pathname === "/upload/drive/v3/files" && url.searchParams.get("uploadType") === "resumable") {
      resumablePosts += 1;
      const header = new Headers(init?.headers);
      const raw = JSON.parse(await bodyText(init?.body)) as { name: string; parents: string[] };
      const location = new URL(
        `https://www.googleapis.com/upload/drive/v3/files?upload_id=session${sequence + 1}`,
      ).toString();
      uploads.set(location, {
        parentId: raw.parents[0],
        name: raw.name,
        mimeType: header.get("x-upload-content-type") ?? "application/octet-stream",
        total: Number(header.get("x-upload-content-length")),
        received: 0,
        parts: [],
      });
      return new Response(null, { status: 200, headers: { Location: location } });
    }
    if (url.pathname === "/upload/drive/v3/files" && url.searchParams.get("uploadType") === "multipart") {
      const raw = await bodyText(init?.body);
      const parts = raw.split("\r\n\r\n");
      const meta = JSON.parse(parts[1].split("\r\n")[0]) as { name: string; parents: string[] };
      const text = parts[2].replace(/\r\n--yukon-backup-json--$/, "");
      const file: GoogleFile = {
        id: nextId(),
        name: meta.name,
        mimeType: "application/json",
        parents: meta.parents,
        size: String(Buffer.byteLength(text)),
        text,
      };
      files.set(file.id, file);
      return Response.json({ id: file.id });
    }
    if (url.pathname === "/drive/v3/files" && method === "POST") {
      const raw = JSON.parse(await bodyText(init?.body)) as {
        name: string;
        mimeType: string;
        parents: string[];
      };
      const file: GoogleFile = {
        id: nextId(),
        name: raw.name,
        mimeType: raw.mimeType,
        parents: raw.parents,
      };
      files.set(file.id, file);
      return Response.json(metadata(file));
    }
    if (url.pathname === "/drive/v3/files" && method === "GET") {
      return Response.json({ files: matches(url.searchParams.get("q") ?? "").map(metadata) });
    }
    const media = url.pathname.match(/^\/drive\/v3\/files\/([^/]+)$/);
    if (media && url.searchParams.get("alt") === "media") {
      const file = files.get(media[1]);
      if (!file?.text) return Response.json({ error: "missing" }, { status: 404 });
      return new Response(file.text, { status: 200 });
    }
    return Response.json({ error: "unhandled" }, { status: 500 });
  };

  function finishUpload(upload: {
    parentId: string;
    name: string;
    mimeType: string;
    total: number;
    parts: Buffer[];
  }) {
    const merged = Buffer.concat(upload.parts);
    const file: GoogleFile = {
      id: nextId(),
      name: upload.name,
      mimeType: upload.mimeType,
      parents: [upload.parentId],
      size: String(merged.length),
      md5Checksum: createHash("md5").update(merged).digest("hex"),
    };
    files.set(file.id, file);
    return file;
  }

  return {
    fetchImpl,
    methods,
    urls,
    get resumablePosts() {
      return resumablePosts;
    },
  };
}

async function bodyText(body: BodyInit | null | undefined) {
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");
  return "";
}

async function bodyBytes(body: BodyInit | null | undefined) {
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (typeof body === "string") return Buffer.from(body);
  return Buffer.alloc(0);
}
