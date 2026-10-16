import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";
import { DriveAccessError, FOLDER_MIME } from "@/lib/drive-access-check";
import {
  BackupRunError,
  SCHEDULE_RECORD_FOLDER,
  advanceBackup,
  backupFolderId,
  backupStartedAt,
  isAllowedJsonName,
  isBackupId,
  readVerifiedManifestSources,
  sameBackupSources,
  toBackupFailure,
  type BackupBlobReader,
  type BackupDrive,
  type BackupSource,
} from "@/lib/drive-backup";
import {
  acquireBackupLease,
  releaseBackupLease,
  type BackupLockHandle,
  type BackupLockStore,
} from "@/lib/drive-backup-lock";

/**
 * Weekly automation for the existing backup engine.
 * One Vercel cron runs at 08:00 UTC every Sunday. Hobby may start it later
 * in that window; the route does not require a Chicago hour. Manual and
 * scheduled runs share one Blob lease. Retention is calculated and never deletes.
 */

export const SCHEDULE_CONTINUE_MS = 8 * 24 * 60 * 60 * 1000;
export const SCHEDULE_BUDGET_MS = 270_000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const CHICAGO = "America/Chicago";

export type BackupInventoryItem = {
  backupId: string;
  startedAt: string;
  verified: boolean;
};

export type RetentionReport = {
  protected: string[];
  annual: string[];
  routine: string[];
  olderThan90Days: string[];
  eligible: string[];
  incomplete: string[];
};

export type ScheduleRunResult =
  | { ok: true; status: "disabled" }
  | {
      ok: true;
      status: "unchanged";
      checkedAt: string;
      recorded: boolean;
      retention: RetentionReport;
    }
  | { ok: true; status: "in_progress"; retention: RetentionReport | null }
  | {
      ok: true;
      status: "continuation";
      continuation: true;
      backupId: string;
      filesVerified: number;
      filesTotal: number;
      bytesVerified: number;
      totalBytes: number;
      recorded: boolean;
      retention: RetentionReport;
    }
  | {
      ok: true;
      status: "complete";
      backupId: string;
      filesVerified: number;
      filesTotal: number;
      bytesVerified: number;
      totalBytes: number;
      recorded: boolean;
      retention: RetentionReport;
    }
  | {
      ok: false;
      status: "failed";
      httpStatus: number;
      error: string;
      backupId?: string;
      filesVerified: number;
      filesTotal: number | null;
      bytesVerified: number;
      totalBytes: number | null;
      recorded: boolean;
      retention: RetentionReport | null;
    };

export function chicagoYear(now: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: CHICAGO, year: "numeric" }).format(now),
  );
}

export function cronSecretMatches(authorization: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 200) return false;
  const match = /^Bearer (\S+)$/i.exec(authorization ?? "");
  if (!match) return false;
  const provided = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

export function evaluateScheduleRequest(input: {
  production: boolean;
  authorization: string | null;
  secret: string | undefined;
  enabled: boolean;
}) {
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
  if (!input.secret || input.secret.length < 32) {
    return {
      ok: false as const,
      status: 503,
      body: {
        ok: false as const,
        status: "failed" as const,
        error: "Backup is not configured.",
      },
    };
  }
  if (!cronSecretMatches(input.authorization, input.secret)) {
    return {
      ok: false as const,
      status: 401,
      body: {
        ok: false as const,
        status: "failed" as const,
        error: "Backup automation was not authorized.",
      },
    };
  }
  if (!input.enabled) return { ok: true as const, status: "disabled" as const };
  return { ok: true as const, status: "authorized" as const };
}

export function scheduleFailure(error: unknown) {
  const normalized =
    error instanceof DriveAccessError && error.code === "authentication"
      ? new BackupRunError("authentication")
      : error;
  return toBackupFailure(normalized);
}

export function sourcesChanged(current: BackupSource[], previous: BackupSource[]) {
  const byPath = (left: BackupSource, right: BackupSource) => left.path.localeCompare(right.path);
  return !sameBackupSources([...current].sort(byPath), [...previous].sort(byPath));
}

function compareInventory(left: BackupInventoryItem, right: BackupInventoryItem) {
  if (left.startedAt !== right.startedAt) return left.startedAt < right.startedAt ? -1 : 1;
  if (left.backupId < right.backupId) return -1;
  if (left.backupId > right.backupId) return 1;
  return 0;
}

/**
 * Annual keepers are chosen only after a Chicago calendar year has ended.
 * The keeper is the latest verified backup that started in that year, so the
 * only recovery point for a year is never eligible for cleanup. The current
 * year has no annual keeper yet; its newest verified backup is already
 * protected as the latest backup. The earliest verified backup is always kept.
 */
export function analyzeRetention(items: BackupInventoryItem[], now: Date): RetentionReport {
  const verified = items.filter((item) => item.verified).sort(compareInventory);
  const incomplete = items
    .filter((item) => !item.verified)
    .map((item) => item.backupId)
    .sort();
  const first = verified[0];
  const latest = verified.at(-1);
  const currentYear = chicagoYear(now);
  const annualByYear = new Map<number, BackupInventoryItem>();
  for (const item of verified) {
    const year = chicagoYear(new Date(item.startedAt));
    if (year >= currentYear) continue;
    const existing = annualByYear.get(year);
    if (!existing || compareInventory(existing, item) < 0) annualByYear.set(year, item);
  }
  const annual = [...annualByYear.values()].map((item) => item.backupId).sort();
  const protectedIds = new Set<string>(annual);
  if (first) protectedIds.add(first.backupId);
  if (latest) protectedIds.add(latest.backupId);
  const cutoff = now.getTime() - NINETY_DAYS_MS;
  const olderThan90Days = verified
    .filter((item) => Date.parse(item.startedAt) < cutoff)
    .map((item) => item.backupId);
  const routine = verified
    .filter((item) => !protectedIds.has(item.backupId))
    .map((item) => item.backupId);
  const older = new Set(olderThan90Days);
  return {
    protected: [...protectedIds].sort(),
    annual,
    routine,
    olderThan90Days,
    eligible: routine.filter((backupId) => older.has(backupId)),
    incomplete,
  };
}

function stampedName(prefix: "record" | "attention", now: Date, suffix: string) {
  if (!/^[a-f0-9]{8}$/.test(suffix)) throw new BackupRunError("source");
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, "Z").replace(/[-:]/g, "");
  const name = `${prefix}-${stamp}-${suffix}.json`;
  if (!isAllowedJsonName(name)) throw new BackupRunError("source");
  return name;
}

export function scheduleRecordName(now: Date, suffix: string) {
  return stampedName("record", now, suffix);
}

function attentionName(now: Date, suffix: string) {
  return stampedName("attention", now, suffix);
}

async function loadInventory(drive: BackupDrive, destinationId: string) {
  const children = await drive.listChildren(destinationId);
  const items: BackupInventoryItem[] = [];
  const verifiedFiles = new Map<string, BackupSource[]>();
  for (const child of children) {
    if (child.mimeType !== FOLDER_MIME || !isBackupId(child.name)) continue;
    const text = await drive.getJson(child.id, "manifest.json");
    const files = text === null ? null : readVerifiedManifestSources(text, child.name);
    const startedAt = backupStartedAt(child.name);
    if (!files) {
      items.push({ backupId: child.name, startedAt, verified: false });
      continue;
    }
    items.push({ backupId: child.name, startedAt, verified: true });
    verifiedFiles.set(child.name, files);
  }
  return { items, verifiedFiles };
}

async function writeAttention(
  drive: BackupDrive,
  destinationId: string,
  now: Date,
  suffix: string,
  record: { backupId?: string; error: string },
) {
  try {
    const body: Record<string, string> = {
      status: "failed",
      at: now.toISOString(),
      error: record.error,
    };
    if (record.backupId && isBackupId(record.backupId)) body.backupId = record.backupId;
    await drive.putJson(destinationId, attentionName(now, suffix), JSON.stringify(body));
    return true;
  } catch {
    return false;
  }
}

async function writeScheduleRecord(
  drive: BackupDrive,
  destinationId: string,
  now: Date,
  suffix: string,
  record: { status: string; backupId?: string; error?: string },
) {
  try {
    const folderId = await drive.ensureFolder(destinationId, SCHEDULE_RECORD_FOLDER);
    const body: Record<string, string> = { status: record.status, at: now.toISOString() };
    if (record.backupId && isBackupId(record.backupId)) body.backupId = record.backupId;
    if (record.error) body.error = record.error;
    await drive.putJson(folderId, scheduleRecordName(now, suffix), JSON.stringify(body));
    return true;
  } catch {
    return false;
  }
}

function counts(status: {
  backupId: string;
  filesVerified: number;
  filesTotal: number;
  bytesVerified: number;
  totalBytes: number;
}) {
  return {
    backupId: status.backupId,
    filesVerified: status.filesVerified,
    filesTotal: status.filesTotal,
    bytesVerified: status.bytesVerified,
    totalBytes: status.totalBytes,
  };
}

export async function runScheduledBackup(input: {
  destinationId: string;
  drive: BackupDrive;
  blobs: BackupBlobReader;
  lock: BackupLockStore;
  now: Date;
  enabled: boolean;
  suffix?: string;
  nonce?: string;
  deadline?: number;
  clock?: () => number;
}): Promise<ScheduleRunResult> {
  if (!input.enabled) return { ok: true, status: "disabled" };
  const suffix = input.suffix ?? randomBytes(4).toString("hex");
  const holder = input.nonce ?? suffix;
  const clock = input.clock ?? Date.now;
  const deadline = input.deadline ?? clock() + SCHEDULE_BUDGET_MS;
  let retention: RetentionReport | null = null;
  let held: BackupLockHandle | null = null;
  try {
    const lease = await acquireBackupLease({ store: input.lock, now: input.now, holder });
    if (lease === "busy") return { ok: true, status: "in_progress", retention: null };
    held = lease;
    const inventory = await loadInventory(input.drive, input.destinationId);
    retention = analyzeRetention(inventory.items, input.now);
    const newestIncomplete = inventory.items
      .filter((item) => !item.verified)
      .sort(compareInventory)
      .at(-1);
    if (newestIncomplete) {
      const age = input.now.getTime() - Date.parse(newestIncomplete.startedAt);
      if (age <= SCHEDULE_CONTINUE_MS) {
        return await finishBackup(input, suffix, deadline, clock, newestIncomplete.backupId, retention);
      }
    }
    const current = await input.blobs.list();
    const latest = inventory.items.filter((item) => item.verified).sort(compareInventory).at(-1);
    const previous = latest ? inventory.verifiedFiles.get(latest.backupId) : undefined;
    if (previous && !sourcesChanged(current, previous)) {
      const recorded = await writeScheduleRecord(input.drive, input.destinationId, input.now, suffix, {
        status: "unchanged",
      });
      return {
        ok: true,
        status: "unchanged",
        checkedAt: input.now.toISOString(),
        recorded,
        retention,
      };
    }
    const backupId = backupFolderId(input.now, suffix);
    return await finishBackup(input, suffix, deadline, clock, backupId, retention, true);
  } catch (error) {
    const failure = scheduleFailure(error);
    const recorded = await writeScheduleRecord(input.drive, input.destinationId, input.now, suffix, {
      status: "failed",
      backupId: failure.body.backupId,
      error: failure.body.error,
    });
    await writeAttention(input.drive, input.destinationId, input.now, suffix, {
      backupId: failure.body.backupId,
      error: failure.body.error,
    });
    return {
      ok: false,
      status: "failed",
      httpStatus: failure.status,
      error: failure.body.error,
      backupId: failure.body.backupId,
      filesVerified: failure.body.filesVerified,
      filesTotal: failure.body.filesTotal,
      bytesVerified: failure.body.bytesVerified,
      totalBytes: failure.body.totalBytes,
      recorded,
      retention,
    };
  } finally {
    if (held) await releaseBackupLease({ store: input.lock, handle: held });
  }
}

async function finishBackup(
  input: {
    destinationId: string;
    drive: BackupDrive;
    blobs: BackupBlobReader;
    now: Date;
    clock?: () => number;
  },
  suffix: string,
  deadline: number,
  clock: () => number,
  backupId: string,
  earlier: RetentionReport,
  creating = false,
): Promise<ScheduleRunResult> {
  try {
    const status = await advanceBackup({
      destinationId: input.destinationId,
      drive: input.drive,
      blobs: input.blobs,
      backupId: creating ? undefined : backupId,
      now: creating ? input.now : undefined,
      suffix: creating ? suffix : undefined,
      deadline,
      clock,
    });
    const inventory = await loadInventory(input.drive, input.destinationId);
    const retention = analyzeRetention(inventory.items, input.now);
    if (status.status === "complete") {
      const recorded = await writeScheduleRecord(input.drive, input.destinationId, input.now, suffix, {
        status: "complete",
        backupId: status.backupId,
      });
      return { ok: true, status: "complete", ...counts(status), recorded, retention };
    }
    const recorded = await writeScheduleRecord(input.drive, input.destinationId, input.now, suffix, {
      status: "continuation",
      backupId: status.backupId,
    });
    return {
      ok: true,
      status: "continuation",
      continuation: true,
      ...counts(status),
      recorded,
      retention,
    };
  } catch (error) {
    const failure = scheduleFailure(error);
    const recorded = await writeScheduleRecord(input.drive, input.destinationId, input.now, suffix, {
      status: "failed",
      backupId: failure.body.backupId ?? backupId,
      error: failure.body.error,
    });
    await writeAttention(input.drive, input.destinationId, input.now, suffix, {
      backupId: failure.body.backupId ?? backupId,
      error: failure.body.error,
    });
    return {
      ok: false,
      status: "failed",
      httpStatus: failure.status,
      error: failure.body.error,
      backupId: failure.body.backupId ?? backupId,
      filesVerified: failure.body.filesVerified,
      filesTotal: failure.body.filesTotal,
      bytesVerified: failure.body.bytesVerified,
      totalBytes: failure.body.totalBytes,
      recorded,
      retention: earlier,
    };
  }
}
