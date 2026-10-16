import { backupAccessProduction, readDriveAccessConfig } from "@/lib/drive-access-check";
import { mintDriveAccessToken } from "@/lib/drive-access-google";
import { createBackupBlobReader } from "@/lib/drive-backup-blob";
import { createBackupDrive } from "@/lib/drive-backup-drive";
import { createBackupLockStore } from "@/lib/drive-backup-lock";
import { evaluateScheduleRequest, runScheduledBackup, scheduleFailure } from "@/lib/drive-backup-schedule";
import { privateJson } from "@/lib/minutes-auth";

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

export async function GET(request: Request) {
  const decision = evaluateScheduleRequest({
    production: backupAccessProduction(),
    authorization: request.headers.get("authorization"),
    secret: process.env.CRON_SECRET,
    enabled: process.env.BACKUP_SCHEDULE_ENABLED === "true",
  });
  if (!decision.ok) return denied(decision.body, decision.status);
  if (decision.status === "disabled") {
    return protect(privateJson({ ok: true, status: "disabled" }));
  }

  const config = readDriveAccessConfig();
  if (!config) {
    return denied({ ok: false, status: "failed", error: "Backup is not configured." }, 503);
  }

  try {
    const token = await mintDriveAccessToken(config);
    const result = await runScheduledBackup({
      destinationId: config.folderId,
      drive: createBackupDrive(token),
      blobs: await createBackupBlobReader(),
      lock: await createBackupLockStore(),
      now: new Date(),
      enabled: true,
    });
    if (!result.ok) {
      console.error("backup-schedule:failed");
      const { httpStatus, ...body } = result;
      return denied(body, httpStatus);
    }
    return protect(privateJson(result));
  } catch (error) {
    const failure = scheduleFailure(error);
    console.error("backup-schedule:failed");
    return denied(failure.body, failure.status);
  }
}
