import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { DriveAccessError, FOLDER_MIME } from "@/lib/drive-access-check";
import {
  BackupRunError,
  backupFolderId,
  backupStartedAt,
  classifyBackupPath,
  isAllowedBackupFolderName,
  isAllowedJsonName,
  type BackupBlobReader,
  type BackupDrive,
  type ChunkResult,
} from "@/lib/drive-backup";
import {
  BACKUP_LOCK_LEASE_MS,
  BACKUP_LOCK_PATH,
  acquireBackupLease,
  createOidcBackupLockStore,
  parseBackupLockRecord,
  releaseBackupLease,
  type BackupLockRecord,
  type BackupLockStore,
} from "@/lib/drive-backup-lock";
import {
  analyzeRetention,
  cronSecretMatches,
  evaluateScheduleRequest,
  runScheduledBackup,
  scheduleFailure,
  scheduleRecordName,
  sourcesChanged,
  type BackupInventoryItem,
} from "@/lib/drive-backup-schedule";

const DEST = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const SECRET = "abcdefghijklmnopqrstuvwxyz0123456789";
const MINUTES = "minutes/Coach's Notes.pdf";
const CATALOG = "media-library/catalog.json";
const UPLOADED = "2026-10-01T12:00:00.000Z";
const SUNDAY_2AM = new Date("2026-10-18T07:00:00.000Z");
const SUNDAY_UTC = new Date("2026-10-18T08:00:00.000Z");
const MONDAY_UTC = new Date("2026-10-19T02:30:00.000Z");
const MINUTES_BYTES = new Uint8Array([1, 2, 3]);
const CATALOG_BYTES = new Uint8Array([4, 5]);

type StoredFile = {
  id: string;
  name: string;
  mimeType: string;
  parentId: string;
  text?: string;
};

function memoryDrive() {
  let sequence = 0;
  const files = new Map<string, StoredFile>();
  const writes: string[] = [];
  const drive: BackupDrive = {
    async ensureFolder(parentId, name) {
      const found = [...files.values()].find((file) => file.parentId === parentId && file.name === name);
      if (found) {
        if (found.mimeType !== FOLDER_MIME) throw new BackupRunError("destination");
        return found.id;
      }
      sequence += 1;
      const id = `folder${String(sequence).padStart(8, "0")}id`;
      files.set(id, { id, name, mimeType: FOLDER_MIME, parentId });
      return id;
    },
    async findChild(parentId, name) {
      const matches = [...files.values()].filter((file) => file.parentId === parentId && file.name === name);
      if (matches.length > 1) throw new BackupRunError("verify");
      return matches[0]
        ? { id: matches[0].id, name: matches[0].name, mimeType: matches[0].mimeType }
        : null;
    },
    async listChildren(parentId) {
      return [...files.values()]
        .filter((file) => file.parentId === parentId)
        .map((file) => ({ id: file.id, name: file.name, mimeType: file.mimeType }));
    },
    async received() {
      return 0;
    },
    async writeChunk(input): Promise<ChunkResult> {
      writes.push(input.path);
      const md5 = createHash("md5").update(input.bytes).digest("hex");
      sequence += 1;
      const id = `upload${String(sequence).padStart(8, "0")}id`;
      files.set(id, {
        id,
        name: input.name,
        mimeType: input.mimeType,
        parentId: input.parentId,
      });
      return { complete: true, id, size: input.total, md5 };
    },
    async putJson(parentId, name, text) {
      if ([...files.values()].some((file) => file.parentId === parentId && file.name === name)) {
        throw new BackupRunError("upload");
      }
      sequence += 1;
      const id = `json${String(sequence).padStart(10, "0")}id`;
      files.set(id, { id, name, mimeType: "application/json", parentId, text });
    },
    async getJson(parentId, name) {
      return [...files.values()].find((file) => file.parentId === parentId && file.name === name)?.text ?? null;
    },
  };
  return { drive, files, writes };
}

function blobsFrom(
  items: { path: string; bytes: Uint8Array; etag: string; uploadedAt?: string }[],
  open: BackupBlobReader["open"] | undefined = undefined,
) {
  let listed = 0;
  const blobs: BackupBlobReader = {
    async list() {
      listed += 1;
      return items.map((item) => ({
        path: item.path,
        size: item.bytes.byteLength,
        etag: item.etag,
        uploadedAt: item.uploadedAt ?? UPLOADED,
      }));
    },
    async open(path) {
      if (open) return open(path);
      const item = items.find((entry) => entry.path === path);
      if (!item) throw new BackupRunError("source");
      return {
        stream: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(item.bytes);
            controller.close();
          },
        }),
        etag: item.etag,
        size: item.bytes.byteLength,
      };
    },
  };
  return { blobs, listed: () => listed };
}

function source(path: string, bytes: Uint8Array, etag: string, uploadedAt = UPLOADED) {
  return { path, bytes, etag, uploadedAt };
}

function verifiedManifest(
  backupId: string,
  files: { path: string; size: number; etag: string; uploadedAt?: string }[],
) {
  const total = files.reduce((sum, file) => sum + file.size, 0);
  return JSON.stringify({
    backupId,
    startedAt: backupStartedAt(backupId),
    status: "complete",
    verification: "verified",
    filesVerified: files.length,
    totalBytes: total,
    sourceCheck: "etag",
    files: files.map((file, index) => ({
      path: file.path,
      size: file.size,
      etag: file.etag,
      uploadedAt: file.uploadedAt ?? UPLOADED,
      md5: "ab".repeat(16),
      driveFileId: `drivefile${String(index).padStart(4, "0")}id`,
    })),
  });
}

async function seedVerified(
  stored: ReturnType<typeof memoryDrive>,
  backupId: string,
  files: { path: string; size: number; etag: string; uploadedAt?: string }[],
) {
  const folderId = await stored.drive.ensureFolder(DEST, backupId);
  await stored.drive.putJson(folderId, "manifest.json", verifiedManifest(backupId, files));
  return folderId;
}

function backupNames(stored: ReturnType<typeof memoryDrive>) {
  return [...stored.files.values()]
    .filter((file) => file.parentId === DEST && file.name.startsWith("website-backup-"))
    .map((file) => file.name)
    .sort();
}

function recordTexts(stored: ReturnType<typeof memoryDrive>) {
  return [...stored.files.values()].filter((file) => file.name.startsWith("record-")).map((file) => file.text ?? "");
}

function memoryLock() {
  let current: { record: BackupLockRecord; version: string } | null = null;
  let sequence = 0;
  const store: BackupLockStore = {
    async read() {
      if (!current) return { record: null, version: null };
      return { record: { ...current.record }, version: current.version };
    },
    async create(record) {
      if (current) return "conflict";
      sequence += 1;
      current = { record: { ...record }, version: `v${sequence}` };
      return { version: current.version };
    },
    async replace(record, version) {
      if (!current || current.version !== version) return "conflict";
      sequence += 1;
      current = { record: { ...record }, version: `v${sequence}` };
      return { version: current.version };
    },
  };
  return {
    store,
    snapshot: () => (current ? { ...current.record, version: current.version } : null),
  };
}

function run(
  stored: ReturnType<typeof memoryDrive>,
  blobs: BackupBlobReader,
  overrides: Partial<Parameters<typeof runScheduledBackup>[0]> = {},
) {
  const { lock, ...rest } = overrides;
  return runScheduledBackup({
    destinationId: DEST,
    drive: stored.drive,
    blobs,
    lock: lock ?? memoryLock().store,
    now: SUNDAY_2AM,
    enabled: true,
    suffix: "abc12345",
    ...rest,
  });
}

function inventory(iso: string, suffix: string, verified = true): BackupInventoryItem {
  const backupId = backupFolderId(new Date(iso), suffix);
  return { backupId, startedAt: backupStartedAt(backupId), verified };
}

describe("backup schedule authorization", () => {
  it("accepts only a long bearer secret in production", () => {
    assert.equal(cronSecretMatches(`Bearer ${SECRET}`, SECRET), true);
    assert.equal(cronSecretMatches(`Bearer ${SECRET}x`, SECRET), false);
    assert.equal(cronSecretMatches("Bearer short", "short-secret-value-not-valid"), false);
    assert.equal(evaluateScheduleRequest({
      production: false,
      authorization: `Bearer ${SECRET}`,
      secret: SECRET,
      enabled: true,
    }).status, 404);
    const missing = evaluateScheduleRequest({
      production: true,
      authorization: `Bearer ${SECRET}`,
      secret: undefined,
      enabled: true,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 503);
    const denied = evaluateScheduleRequest({
      production: true,
      authorization: "Bearer not-the-cron-secret-value-here-ok",
      secret: SECRET,
      enabled: true,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) {
      assert.equal(denied.status, 401);
      assert.equal(JSON.stringify(denied.body).includes(SECRET), false);
    }
    assert.equal(evaluateScheduleRequest({
      production: true,
      authorization: `Bearer ${SECRET}`,
      secret: SECRET,
      enabled: false,
    }).status, "disabled");
    assert.equal(evaluateScheduleRequest({
      production: true,
      authorization: `Bearer ${SECRET}`,
      secret: SECRET,
      enabled: true,
    }).status, "authorized");
  });

  it("reports Google authentication failure without token text", () => {
    const failure = scheduleFailure(new DriveAccessError("authentication"));
    assert.equal(failure.status, 502);
    assert.equal(failure.body.error, "Google authentication failed.");
    const scrubbed = scheduleFailure(new Error("Bearer ya29.secret-token"));
    assert.equal(JSON.stringify(scrubbed.body).includes("ya29"), false);
  });

  it("keeps the manual route closed and the schedule route separately authorized", () => {
    const manual = readFileSync(new URL("../app/api/backup/run/route.ts", import.meta.url), "utf8");
    const schedule = readFileSync(new URL("../app/api/backup/schedule/route.ts", import.meta.url), "utf8");
    const crons = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
      crons: { path: string; schedule: string }[];
    };
    assert.equal(manual.includes("export async function GET"), false);
    assert.equal(manual.includes("minutesAccess"), true);
    assert.equal(schedule.includes("export async function GET"), true);
    assert.equal(schedule.includes("export async function POST"), false);
    assert.equal(schedule.includes("minutesAccess"), false);
    assert.equal(schedule.includes("BLOB_READ_WRITE_TOKEN"), false);
    assert.equal(schedule.includes("CRON_SECRET"), true);
    assert.equal(schedule.includes("BACKUP_SCHEDULE_ENABLED"), true);
    assert.deepEqual(crons.crons.map((cron) => cron.schedule), ["0 8 * * 0"]);
    assert.equal(crons.crons.every((cron) => cron.path === "/api/backup/schedule"), true);
    assert.equal(manual.includes("acquireBackupLease"), true);
    assert.equal(manual.includes("releaseBackupLease"), true);
    assert.equal(manual.includes("BACKUP_BUSY_ERROR"), true);
    assert.equal(manual.includes("backup-locks"), false);
    assert.equal(schedule.includes("createBackupLockStore"), true);
    const scheduleLib = readFileSync(new URL("./drive-backup-schedule.ts", import.meta.url), "utf8");
    const lock = readFileSync(new URL("./drive-backup-lock.ts", import.meta.url), "utf8");
    assert.equal(scheduleLib.includes("acquireBackupLock"), false);
    assert.equal(scheduleLib.includes("BACKUP_LOCK_TTL_MS"), false);
    assert.equal(scheduleLib.includes("backup-locks"), false);
    assert.equal(lock.includes("BLOB_READ_WRITE_TOKEN"), false);
    assert.equal(lock.includes("del("), false);
    assert.equal(/(^|[^A-Za-z])token\s*:/.test(lock), false);
    assert.equal(lock.includes("allowOverwrite: false"), true);
    assert.equal(lock.includes("ifMatch"), true);
    assert.equal(lock.includes("oidcToken"), true);
    const manualDuration = /export const maxDuration = (\d+)/.exec(manual);
    const scheduleDuration = /export const maxDuration = (\d+)/.exec(schedule);
    assert.ok(manualDuration);
    assert.ok(scheduleDuration);
    const durationMs = Math.max(Number(manualDuration[1]), Number(scheduleDuration[1])) * 1000;
    assert.equal(BACKUP_LOCK_LEASE_MS >= durationMs + 60_000, true);
    assert.equal(isAllowedBackupFolderName("schedule-records"), true);
    assert.equal(isAllowedJsonName(scheduleRecordName(SUNDAY_2AM, "abc12345")), true);
    assert.equal(schedule.includes("files.delete"), false);
    assert.equal(readFileSync(new URL("./drive-backup-schedule.ts", import.meta.url), "utf8").includes("files.delete"), false);
  });
});

describe("backup schedule change detection", () => {
  it("does not create a folder when paths, sizes, etags, and upload times match", async () => {
    const stored = memoryDrive();
    const backupId = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00001");
    await seedVerified(stored, backupId, [{ path: MINUTES, size: MINUTES_BYTES.length, etag: "v1" }]);
    const sourceBlobs = blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]);
    const result = await run(stored, sourceBlobs.blobs);
    assert.equal(result.status, "unchanged");
    assert.deepEqual(backupNames(stored), [backupId]);
    assert.equal(stored.writes.length, 0);
    const recorded = recordTexts(stored).join("\n");
    assert.equal(recorded.includes("\"status\":\"unchanged\""), true);
    assert.equal(recorded.includes("minutes/"), false);
    assert.equal(recorded.includes("Coach"), false);
  });

  it("starts a full backup when a file is added, modified, or removed", async () => {
    const added = memoryDrive();
    const previous = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00002");
    await seedVerified(added, previous, [{ path: CATALOG, size: CATALOG_BYTES.length, etag: "catalog-v1" }]);
    const addedResult = await run(
      added,
      blobsFrom([
        source(CATALOG, CATALOG_BYTES, "catalog-v1"),
        source(MINUTES, MINUTES_BYTES, "minutes-v1"),
      ]).blobs,
      { suffix: "abc12346" },
    );
    assert.equal(addedResult.status, "complete");
    if (addedResult.status !== "complete") return;
    assert.equal(addedResult.filesVerified, 2);
    assert.equal(backupNames(added).includes(previous), true);
    assert.equal(backupNames(added).length, 2);

    const modified = memoryDrive();
    const modifiedId = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00003");
    await seedVerified(modified, modifiedId, [{ path: MINUTES, size: MINUTES_BYTES.length, etag: "v1" }]);
    const modifiedResult = await run(
      modified,
      blobsFrom([source(MINUTES, MINUTES_BYTES, "v2")]).blobs,
      { suffix: "abc12347" },
    );
    assert.equal(modifiedResult.status, "complete");
    assert.equal(sourcesChanged(
      [{ path: MINUTES, size: 3, etag: "v1", uploadedAt: UPLOADED }],
      [{ path: MINUTES, size: 3, etag: "v1", uploadedAt: UPLOADED }],
    ), false);
    assert.equal(sourcesChanged(
      [{ path: MINUTES, size: 3, etag: "v2", uploadedAt: UPLOADED }],
      [{ path: MINUTES, size: 3, etag: "v1", uploadedAt: UPLOADED }],
    ), true);

    const removed = memoryDrive();
    const removedId = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00004");
    await seedVerified(removed, removedId, [
      { path: CATALOG, size: CATALOG_BYTES.length, etag: "catalog-v1" },
      { path: MINUTES, size: MINUTES_BYTES.length, etag: "minutes-v1" },
    ]);
    const removedResult = await run(
      removed,
      blobsFrom([source(CATALOG, CATALOG_BYTES, "catalog-v1")]).blobs,
      { suffix: "abc12348" },
    );
    assert.equal(removedResult.status, "complete");
    if (removedResult.status !== "complete") return;
    const created = backupNames(removed).find((name) => name !== removedId);
    assert.ok(created);
    const folder = [...removed.files.values()].find((file) => file.name === created);
    const manifest = [...removed.files.values()].find(
      (file) => file.parentId === folder?.id && file.name === "manifest.json",
    );
    assert.equal(manifest?.text?.includes(MINUTES), false);
    assert.equal(manifest?.text?.includes("\"sourceCheck\":\"etag\""), true);
    assert.equal(manifest?.text?.includes("\"md5\""), true);
    const previousManifest = [...removed.files.values()].find(
      (file) => file.parentId !== folder?.id && file.name === "manifest.json",
    );
    assert.equal(previousManifest?.text?.includes(MINUTES), true);
  });

  it("verifies a completed backup and pauses an unfinished one for continuation", async () => {
    const stored = memoryDrive();
    const paused = await run(stored, blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]).blobs, {
      suffix: "abc12349",
      deadline: 0,
      clock: () => 1,
    });
    assert.equal(paused.status, "continuation");
    if (paused.status !== "continuation") return;
    assert.equal(paused.continuation, true);
    assert.equal(paused.filesVerified, 0);
    assert.equal(backupNames(stored).length, 1);
    const names = backupNames(stored);
    const resumed = await run(stored, blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]).blobs, {
      suffix: "abc12350",
      now: SUNDAY_UTC,
      deadline: 10_000_000,
      clock: () => 0,
    });
    assert.equal(resumed.status, "complete");
    if (resumed.status !== "complete") return;
    assert.equal(resumed.backupId, names[0]);
    assert.equal(resumed.filesVerified, 1);
    assert.deepEqual(backupNames(stored), names);
    const manifest = [...stored.files.values()].find((file) => file.name === "manifest.json");
    assert.equal(manifest?.text?.includes("\"verification\":\"verified\""), true);
  });

  it("keeps the previous backup when an upload fails", async () => {
    const stored = memoryDrive();
    const backupId = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00005");
    await seedVerified(stored, backupId, [{ path: MINUTES, size: MINUTES_BYTES.length, etag: "v1" }]);
    const before = [...stored.files.values()].find((file) => file.name === "manifest.json")?.text;
    const failing = blobsFrom([source(MINUTES, MINUTES_BYTES, "v2")], async () => {
      throw new BackupRunError("upload");
    });
    const result = await run(stored, failing.blobs, { suffix: "abc12351" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, "failed");
    assert.equal(result.error, "The backup could not be saved.");
    const attention = [...stored.files.values()].find((file) => file.name.startsWith("attention-"));
    assert.equal(attention?.parentId, DEST);
    assert.equal(attention?.text?.includes("The backup could not be saved."), true);
    assert.equal(attention?.text?.includes("minutes/"), false);
    assert.equal([...stored.files.values()].some((file) => file.name === "manifest.json" && file.text === before), true);
    assert.equal(recordTexts(stored).some((text) => text.includes("minutes/")), false);
    assert.equal(JSON.stringify(result).includes(MINUTES), false);
  });

  it("lets one held lease stop a scheduled run and a second claim", async () => {
    const stored = memoryDrive();
    const lock = memoryLock();
    const held = await acquireBackupLease({
      store: lock.store,
      now: SUNDAY_UTC,
      holder: "00000001",
    });
    assert.equal(held === "busy", false);
    const sourceBlobs = blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]);
    const scheduled = await run(stored, sourceBlobs.blobs, {
      suffix: "abc12352",
      nonce: "abc12352",
      lock: lock.store,
    });
    assert.equal(scheduled.status, "in_progress");
    assert.equal(sourceBlobs.listed(), 0);
    assert.equal(stored.writes.length, 0);
    assert.deepEqual(backupNames(stored), []);
    assert.equal([...stored.files.values()].some((file) => file.name.startsWith("lock-")), false);

    const second = await acquireBackupLease({
      store: lock.store,
      now: new Date(SUNDAY_UTC.getTime() + 60_000),
      holder: "00000002",
    });
    assert.equal(second, "busy");
    if (held === "busy") return;
    await releaseBackupLease({ store: lock.store, handle: held });
    const afterRelease = await acquireBackupLease({
      store: lock.store,
      now: new Date(SUNDAY_UTC.getTime() + 61_000),
      holder: "00000003",
    });
    assert.equal(afterRelease === "busy", false);

    const expired = memoryLock();
    const expiredHandle = await acquireBackupLease({
      store: expired.store,
      now: new Date(SUNDAY_UTC.getTime() - BACKUP_LOCK_LEASE_MS - 1000),
      holder: "00000004",
    });
    const takeover = await acquireBackupLease({
      store: expired.store,
      now: SUNDAY_UTC,
      holder: "00000005",
    });
    assert.equal(expiredHandle === "busy", false);
    assert.equal(takeover === "busy", false);
    if (expiredHandle === "busy" || takeover === "busy") return;
    assert.equal(takeover.holder, "00000005");
    await releaseBackupLease({ store: expired.store, handle: expiredHandle });
    assert.equal(expired.snapshot()?.holder, "00000005");
    assert.equal(expired.snapshot()?.state, "held");
  });

  it("continues an unfinished backup and still checks after the cron hour", async () => {
    const stored = memoryDrive();
    const active = backupFolderId(new Date(SUNDAY_UTC.getTime() - 60 * 60 * 1000), "abc00007");
    await stored.drive.ensureFolder(DEST, active);
    const continued = await run(stored, blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]).blobs, {
      now: SUNDAY_UTC,
      suffix: "abc12353",
    });
    assert.equal(continued.status, "complete");
    if (continued.status !== "complete") return;
    assert.equal(continued.backupId, active);
    assert.deepEqual(backupNames(stored), [active]);

    const later = memoryDrive();
    const backupId = backupFolderId(new Date("2026-09-01T15:00:00.000Z"), "abc00008");
    await seedVerified(later, backupId, [{ path: MINUTES, size: MINUTES_BYTES.length, etag: "v1" }]);
    const delayed = await run(later, blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]).blobs, {
      now: MONDAY_UTC,
      suffix: "abc12354",
    });
    assert.equal(delayed.status, "unchanged");
    assert.deepEqual(backupNames(later), [backupId]);
  });

  it("does not call Drive when the schedule is disabled", async () => {
    const stored = memoryDrive();
    stored.drive.listChildren = async () => {
      throw new Error("listed");
    };
    const lock: BackupLockStore = {
      async read() {
        throw new Error("read");
      },
      async create() {
        throw new Error("create");
      },
      async replace() {
        throw new Error("replace");
      },
    };
    const result = await run(stored, blobsFrom([]).blobs, { enabled: false, lock });
    assert.deepEqual(result, { ok: true, status: "disabled" });
  });

  it("releases the lease when a run finishes or fails", async () => {
    const stored = memoryDrive();
    const lock = memoryLock();
    const finished = await run(stored, blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]).blobs, {
      lock: lock.store,
      suffix: "abc12355",
    });
    assert.equal(finished.status, "complete");
    assert.equal(lock.snapshot()?.state, "released");
    const next = await acquireBackupLease({
      store: lock.store,
      now: new Date(SUNDAY_2AM.getTime() + 1000),
      holder: "00000006",
    });
    assert.equal(next === "busy", false);

    const failingLock = memoryLock();
    const failing = blobsFrom([source(MINUTES, MINUTES_BYTES, "v2")], async () => {
      throw new BackupRunError("upload");
    });
    const failed = await run(memoryDrive(), failing.blobs, {
      lock: failingLock.store,
      suffix: "abc12356",
    });
    assert.equal(failed.status, "failed");
    assert.equal(failingLock.snapshot()?.state, "released");
  });
});

describe("backup retention reporting", () => {
  it("protects the first, latest, and one finished-year backup without deleting anything", () => {
    const now = SUNDAY_2AM;
    const earlier2024 = inventory("2024-06-15T18:00:00.000Z", "aaa00001");
    const annual2024 = inventory("2024-12-15T18:00:00.000Z", "aaa00002");
    const routine2025 = inventory("2025-02-01T18:00:00.000Z", "aaa00003");
    const annual2025 = inventory("2025-11-15T18:00:00.000Z", "aaa00004");
    const oldCurrent = inventory("2026-01-10T18:00:00.000Z", "aaa00005");
    const latest = inventory("2026-09-01T18:00:00.000Z", "aaa00006");
    const incomplete = inventory("2026-04-01T18:00:00.000Z", "aaa00007", false);
    const only2023 = inventory("2023-08-01T18:00:00.000Z", "aaa00008");
    const report = analyzeRetention(
      [latest, earlier2024, incomplete, annual2025, oldCurrent, routine2025, annual2024, only2023],
      now,
    );
    assert.equal(report.protected.includes(only2023.backupId), true);
    assert.equal(report.protected.includes(latest.backupId), true);
    assert.equal(report.protected.includes(annual2024.backupId), true);
    assert.equal(report.protected.includes(annual2025.backupId), true);
    assert.equal(report.protected.includes(only2023.backupId), true);
    assert.equal(report.annual.includes(annual2024.backupId), true);
    assert.equal(report.annual.includes(earlier2024.backupId), false);
    assert.equal(report.eligible.includes(routine2025.backupId), true);
    assert.equal(report.eligible.includes(oldCurrent.backupId), true);
    assert.equal(report.eligible.includes(earlier2024.backupId), true);
    assert.equal(report.eligible.includes(only2023.backupId), false);
    assert.equal(report.eligible.includes(latest.backupId), false);
    assert.equal(report.eligible.includes(annual2024.backupId), false);
    assert.equal(report.eligible.includes(annual2025.backupId), false);
    assert.equal(report.eligible.includes(only2023.backupId), false);
    assert.equal(report.eligible.includes(incomplete.backupId), false);
    assert.equal(report.incomplete.includes(incomplete.backupId), true);
    assert.equal(report.olderThan90Days.includes(latest.backupId), false);
    assert.equal(report.routine.includes(latest.backupId), false);
    const boundary = inventory("2026-01-01T05:30:00.000Z", "aaa00009");
    const boundaryReport = analyzeRetention([boundary], new Date("2026-06-01T17:00:00.000Z"));
    assert.equal(boundaryReport.annual.includes(boundary.backupId), true);
    assert.equal(boundaryReport.eligible.includes(boundary.backupId), false);
  });
});

describe("backup lease coordination", () => {
  it("keeps the coordination record out of website backups and Drive lock files", () => {
    assert.equal(classifyBackupPath(BACKUP_LOCK_PATH), "exclude");
    assert.equal(isAllowedBackupFolderName("backup-locks"), false);
    assert.equal(isAllowedJsonName("lock-20261018T080000Z-abc12345.json"), false);
    assert.equal(parseBackupLockRecord("{"), null);
  });

  it("lets only one of two simultaneous creates hold the lease", async () => {
    const lock = memoryLock();
    let waiting = 0;
    let openGate = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const original = lock.store.create.bind(lock.store);
    lock.store.create = async (record) => {
      waiting += 1;
      await gate;
      return original(record);
    };
    const first = acquireBackupLease({ store: lock.store, now: SUNDAY_UTC, holder: "0000000a" });
    const second = acquireBackupLease({ store: lock.store, now: SUNDAY_UTC, holder: "0000000b" });
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        if (waiting < 2) return;
        clearInterval(timer);
        clearTimeout(timeout);
        resolve();
      }, 1);
      const timeout = setTimeout(() => {
        clearInterval(timer);
        reject(new Error("Both lease claims did not reach the conditional create."));
      }, 1000);
    });
    openGate();
    const results = await Promise.all([first, second]);
    assert.equal(results.filter((result) => result === "busy").length, 1);
    assert.equal(results.filter((result) => result !== "busy").length, 1);
    assert.equal(lock.snapshot()?.state, "held");
  });

  it("uses a conditional Blob write and does not keep a token option", async () => {
    const writes: { body: string; options: BackupLockWrite }[] = [];
    let saved: { text: string; etag: string } | null = null;
    const store = createOidcBackupLockStore(
      {
        storeId: "store_test",
        oidcToken: "oidc-token",
        access: "private",
        useCache: false,
      },
      {
        async getLock() {
          if (!saved) return null;
          const text = saved.text;
          return {
            statusCode: 200,
            etag: saved.etag,
            stream: new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(text));
                controller.close();
              },
            }),
          };
        },
        async putLock(_pathname, body, options) {
          writes.push({ body, options });
          if (options.allowOverwrite === false && saved) throw new Error("The blob already exists");
          if (options.ifMatch && saved && options.ifMatch !== saved.etag) {
            throw new Error("precondition failed");
          }
          saved = { text: body, etag: `etag-${writes.length}` };
          return { etag: saved.etag };
        },
      },
    );
    const handle = await acquireBackupLease({ store, now: SUNDAY_UTC, holder: "abc12345" });
    assert.equal(handle === "busy", false);
    assert.equal(writes[0]?.options.allowOverwrite, false);
    assert.equal(Object.hasOwn(writes[0]?.options ?? {}, "token"), false);
    assert.equal(writes[0]?.options.oidcToken, "oidc-token");
    assert.equal(writes[0]?.options.storeId, "store_test");
    assert.equal(JSON.stringify(writes[0]?.options).includes("read-write"), false);
    if (handle === "busy") return;
    await releaseBackupLease({ store, handle });
    assert.equal(writes[1]?.options.ifMatch, "etag-1");
    assert.equal(Object.hasOwn(writes[1]?.options ?? {}, "allowOverwrite"), false);
    assert.equal(parseBackupLockRecord(writes[1]?.body ?? "")?.state, "released");

    const stale = createOidcBackupLockStore(
      {
        storeId: "store_test",
        oidcToken: "oidc-token",
        access: "private",
        useCache: false,
      },
      {
        async getLock() {
          return null;
        },
        async putLock() {
          throw new Error("already exists");
        },
      },
    );
    assert.equal(
      await acquireBackupLease({ store: stale, now: SUNDAY_UTC, holder: "abc12346" }),
      "busy",
    );

    const broken = createOidcBackupLockStore(
      {
        storeId: "store_test",
        oidcToken: "oidc-token",
        access: "private",
        useCache: false,
      },
      {
        async getLock() {
          throw new Error("Bearer ya29.secret-token");
        },
        async putLock() {
          throw new Error("put");
        },
      },
    );
    const error = await acquireBackupLease({
      store: broken,
      now: SUNDAY_UTC,
      holder: "abc12347",
    }).catch((caught: unknown) => caught);
    assert.ok(error instanceof BackupRunError);
    assert.equal(error.code, "upload");
    assert.equal(error.message.includes("ya29"), false);
  });

  it("does not run a scheduled backup when the lease cannot be read", async () => {
    const stored = memoryDrive();
    const sourceBlobs = blobsFrom([source(MINUTES, MINUTES_BYTES, "v1")]);
    const lock: BackupLockStore = {
      async read() {
        throw new Error("Bearer ya29.secret-token");
      },
      async create() {
        throw new Error("create");
      },
      async replace() {
        throw new Error("replace");
      },
    };
    const result = await run(stored, sourceBlobs.blobs, { lock, suffix: "abc12357" });
    assert.equal(result.status, "failed");
    assert.equal(sourceBlobs.listed(), 0);
    assert.equal(stored.writes.length, 0);
    assert.equal(JSON.stringify(result).includes("ya29"), false);
    const attention = [...stored.files.values()].find((file) => file.name.startsWith("attention-"));
    assert.equal(attention?.text?.includes("ya29"), false);
    assert.equal(attention?.text?.includes(MINUTES), false);
  });
});

type BackupLockWrite = {
  allowOverwrite?: false;
  ifMatch?: string;
  oidcToken?: string;
  storeId?: string;
  token?: string;
};

