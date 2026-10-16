import { privateJson, requireMinutes } from "@/lib/minutes-auth";
import { mediaRequestAllowed } from "@/lib/media-origin";
import {
  backupAccessProduction,
  readDriveAccessConfig,
  runDriveAccessCheck,
  toBackupAccessResult,
} from "@/lib/drive-access-check";
import { googleDriveGateway } from "@/lib/drive-access-http";
import { mintDriveAccessToken } from "@/lib/drive-access-google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function protect(response: Response) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function denied(body: { ok: false; step: string; error: string }, status: number) {
  return protect(privateJson(body, { status }));
}

function emptyRequest(request: Request) {
  if (request.headers.get("content-type")) return false;
  return (request.headers.get("content-length") ?? "0") === "0";
}

export async function POST(request: Request) {
  const { response } = await requireMinutes({
    admin: true,
    adminError: "Admin sign-in required.",
  });
  if (response) return protect(response);
  if (!mediaRequestAllowed(request) || !emptyRequest(request)) {
    return denied(
      { ok: false, step: "request", error: "Could not run the access check." },
      403,
    );
  }
  if (!backupAccessProduction()) {
    return denied(
      {
        ok: false,
        step: "environment",
        error: "This access check runs only in production.",
      },
      404,
    );
  }

  const config = readDriveAccessConfig();
  if (!config) {
    return denied(
      { ok: false, step: "configuration", error: "Backup access is not configured." },
      503,
    );
  }

  try {
    const token = await mintDriveAccessToken(config);
    const result = await runDriveAccessCheck(config, googleDriveGateway(token));
    return protect(privateJson(result));
  } catch (error) {
    const result = toBackupAccessResult(error);
    console.error(`backup-access-check:${result.body.step}`);
    return denied(result.body, result.status);
  }
}
