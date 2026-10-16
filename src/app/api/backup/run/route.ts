import { minutesAccess, privateJson } from "@/lib/minutes-auth";
import { mediaRequestAllowed } from "@/lib/media-origin";
import {
  DriveAccessError,
  backupAccessProduction,
  readDriveAccessConfig,
} from "@/lib/drive-access-check";
import { mintDriveAccessToken } from "@/lib/drive-access-google";
import {
  BACKUP_SLICE_MS,
  BackupRunError,
  advanceBackup,
  evaluateBackupRequest,
  toBackupFailure,
} from "@/lib/drive-backup";
import { createBackupBlobReader } from "@/lib/drive-backup-blob";
import { createBackupDrive } from "@/lib/drive-backup-drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function protect(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function denied(body: unknown, status: number) {
  return protect(privateJson(body, { status }));
}

export async function POST(request: Request) {
  const access = await minutesAccess();
  const lengthHeader = request.headers.get("content-length");
  const parsedLength = lengthHeader === null ? null : Number(lengthHeader);
  const readable =
    parsedLength !== null &&
    Number.isInteger(parsedLength) &&
    parsedLength > 0 &&
    parsedLength <= 256;
  const raw = readable ? await request.text() : "";
  const decision = evaluateBackupRequest({
    access,
    sameOrigin: mediaRequestAllowed(request),
    contentLength: parsedLength,
    body: raw,
    production: backupAccessProduction(),
  });
  if (!decision.ok) return denied(decision.body, decision.status);

  const config = readDriveAccessConfig();
  if (!config) {
    return denied({ ok: false, status: "failed", error: "Backup is not configured." }, 503);
  }

  try {
    const token = await mintDriveAccessToken(config);
    const result = await advanceBackup({
      destinationId: config.folderId,
      drive: createBackupDrive(token),
      blobs: await createBackupBlobReader(),
      backupId: "backupId" in decision ? decision.backupId : undefined,
      deadline: Date.now() + BACKUP_SLICE_MS,
    });
    return protect(privateJson(result));
  } catch (error) {
    const normalized =
      error instanceof DriveAccessError && error.code === "authentication"
        ? new BackupRunError("authentication")
        : error;
    const failure = toBackupFailure(normalized);
    console.error(`backup:${failure.body.status}`);
    return denied(failure.body, failure.status);
  }
}
