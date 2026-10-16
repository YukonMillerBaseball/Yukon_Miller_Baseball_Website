import "server-only";

import { createHash, randomBytes } from "crypto";

/**
 * Production access check for the Google Drive backup folder.
 * This module lists no Blob objects and has no Drive delete or update call.
 */

export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const FOLDER_MIME = "application/vnd.google-apps.folder";
export const ACCESS_CHECK_FILE = "access-check.txt" as const;
export const ACCESS_TOKEN_LIFETIME_SECONDS = 600;

const EXPECTED_PROJECT_ID = "yukon-baseball-website-backups";
const EXPECTED_PROJECT_NUMBER = "879934248114";
const EXPECTED_SERVICE_ACCOUNT =
  "yukon-baseball-backup@yukon-baseball-website-backups.iam.gserviceaccount.com";
const EXPECTED_POOL_ID = "yukon-baseball-github-backups";
const EXPECTED_PROVIDER_ID = "vercel";

const DRIVE_ID = /^[A-Za-z0-9_-]{10,128}$/;
const FOLDER_NAME = /^access-check-\d{8}T\d{6}Z-[a-f0-9]{6}$/;
const HEX_MD5 = /^[a-f0-9]{32}$/;
const BYTE_SIZE = /^\d{1,12}$/;

export type DriveAccessCode =
  | "configuration"
  | "authentication"
  | "destination-missing"
  | "destination-denied"
  | "create-folder"
  | "upload"
  | "verify";

export class DriveAccessError extends Error {
  readonly code: DriveAccessCode;

  constructor(code: DriveAccessCode) {
    super("Backup access check failed.");
    this.name = "DriveAccessError";
    this.code = code;
  }
}

export type DriveAccessConfig = {
  projectId: string;
  projectNumber: string;
  serviceAccountEmail: string;
  poolId: string;
  providerId: string;
  folderId: string;
};

export type DriveMetadata = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  size?: string;
  md5Checksum?: string;
};

export type DriveCreateInput = {
  name: string;
  mimeType?: string;
  parents: [string];
  media?: { mimeType: "text/plain"; body: Uint8Array };
};

export type DriveGateway = {
  getFile(id: string, operation: "destination" | "read"): Promise<DriveMetadata>;
  createFile(input: DriveCreateInput): Promise<DriveMetadata>;
};

export type BackupAccessSuccess = {
  ok: true;
  step: "verified";
  folder: string;
  file: typeof ACCESS_CHECK_FILE;
  bytes: number;
  sizeMatches: true;
  md5Matches: true;
};

export type BackupAccessFailure = {
  ok: false;
  step: string;
  error: string;
};

export function backupAccessProduction(env: NodeJS.Dict<string> = process.env) {
  return env.VERCEL_ENV === "production";
}

export function assertDriveId(value: string) {
  if (!DRIVE_ID.test(value)) throw new DriveAccessError("verify");
  return value;
}

export function readDriveAccessConfig(
  env: NodeJS.Dict<string> = process.env,
): DriveAccessConfig | null {
  const projectId = env.GCP_PROJECT_ID?.trim();
  const projectNumber = env.GCP_PROJECT_NUMBER?.trim();
  const serviceAccountEmail = env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  const poolId = env.GCP_WORKLOAD_IDENTITY_POOL_ID?.trim();
  const providerId = env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID?.trim();
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID?.trim() ?? "";
  if (projectId !== EXPECTED_PROJECT_ID) return null;
  if (projectNumber !== EXPECTED_PROJECT_NUMBER) return null;
  if (serviceAccountEmail !== EXPECTED_SERVICE_ACCOUNT) return null;
  if (poolId !== EXPECTED_POOL_ID) return null;
  if (providerId !== EXPECTED_PROVIDER_ID) return null;
  if (!DRIVE_ID.test(folderId)) return null;
  return {
    projectId,
    projectNumber,
    serviceAccountEmail,
    poolId,
    providerId,
    folderId,
  };
}

export function workloadIdentityOptions(config: DriveAccessConfig) {
  return {
    type: "external_account" as const,
    audience: `//iam.googleapis.com/projects/${config.projectNumber}/locations/global/workloadIdentityPools/${config.poolId}/providers/${config.providerId}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt" as const,
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
    service_account_impersonation: {
      token_lifetime_seconds: ACCESS_TOKEN_LIFETIME_SECONDS,
    },
    scopes: [DRIVE_SCOPE],
  };
}

export function accessCheckPayload(now: Date, suffix: string) {
  if (!/^[a-f0-9]{6}$/.test(suffix)) throw new DriveAccessError("verify");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const folderName = `access-check-${stamp}-${suffix}`;
  if (!FOLDER_NAME.test(folderName)) throw new DriveAccessError("verify");
  const body = new TextEncoder().encode(
    `Yukon Baseball website backup access check\ncreated: ${now.toISOString()}\n`,
  );
  const md5 = createHash("md5").update(body).digest("hex");
  return { folderName, fileName: ACCESS_CHECK_FILE, body, md5 };
}

export function accessCheckSuffix() {
  return randomBytes(3).toString("hex");
}

export async function runDriveAccessCheck(
  config: DriveAccessConfig,
  drive: DriveGateway,
  now = new Date(),
  suffix = accessCheckSuffix(),
): Promise<BackupAccessSuccess> {
  const destination = await drive.getFile(config.folderId, "destination");
  if (destination.id !== config.folderId || destination.mimeType !== FOLDER_MIME) {
    throw new DriveAccessError("destination-denied");
  }

  const payload = accessCheckPayload(now, suffix);
  const folder = await drive.createFile({
    name: payload.folderName,
    mimeType: FOLDER_MIME,
    parents: [config.folderId],
  });
  const createdFolder = await drive.getFile(folder.id, "read");
  if (
    createdFolder.id !== folder.id ||
    createdFolder.name !== payload.folderName ||
    createdFolder.mimeType !== FOLDER_MIME ||
    !createdFolder.parents.includes(config.folderId)
  ) {
    throw new DriveAccessError("verify");
  }

  const uploaded = await drive.createFile({
    name: ACCESS_CHECK_FILE,
    parents: [folder.id],
    media: { mimeType: "text/plain", body: payload.body },
  });
  const verified = await drive.getFile(uploaded.id, "read");
  const sizeMatches = verified.size === String(payload.body.byteLength);
  const md5Matches = verified.md5Checksum === payload.md5;
  if (
    verified.id !== uploaded.id ||
    verified.name !== ACCESS_CHECK_FILE ||
    !verified.mimeType.startsWith("text/plain") ||
    !verified.parents.includes(folder.id) ||
    !sizeMatches ||
    !md5Matches
  ) {
    throw new DriveAccessError("verify");
  }

  return {
    ok: true,
    step: "verified",
    folder: payload.folderName,
    file: ACCESS_CHECK_FILE,
    bytes: payload.body.byteLength,
    sizeMatches: true,
    md5Matches: true,
  };
}

const PUBLIC_STEP: Record<DriveAccessCode | "access-check", string> = {
  configuration: "configuration",
  authentication: "authentication",
  "destination-missing": "destination",
  "destination-denied": "destination",
  "create-folder": "create",
  upload: "upload",
  verify: "verify",
  "access-check": "access-check",
};

const PUBLIC_ERROR: Record<DriveAccessCode | "access-check", string> = {
  configuration: "Backup access is not configured.",
  authentication: "Google authentication failed.",
  "destination-missing": "Backup folder was not found.",
  "destination-denied": "Backup folder is not accessible.",
  "create-folder": "Could not create the access-check folder.",
  upload: "Could not upload access-check.txt.",
  verify: "The uploaded access check could not be verified.",
  "access-check": "Backup access check failed.",
};

function httpStatus(code: DriveAccessCode | "access-check") {
  if (code === "configuration") return 503;
  if (code === "access-check") return 500;
  return 502;
}

export function toBackupAccessResult(error: unknown): {
  status: number;
  body: BackupAccessFailure;
} {
  const code = error instanceof DriveAccessError ? error.code : "access-check";
  const body: BackupAccessFailure = {
    ok: false,
    step: PUBLIC_STEP[code],
    error: PUBLIC_ERROR[code],
  };
  const encoded = JSON.stringify(body);
  if (/eyJ[A-Za-z0-9_-]{8,}/.test(encoded) || /bearer\s+/i.test(encoded)) {
    return {
      status: 500,
      body: {
        ok: false,
        step: "access-check",
        error: PUBLIC_ERROR["access-check"],
      },
    };
  }
  return { status: httpStatus(code), body };
}

export function parseDriveMetadata(value: unknown): DriveMetadata {
  if (!value || typeof value !== "object") throw new DriveAccessError("verify");
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.mimeType !== "string"
  ) {
    throw new DriveAccessError("verify");
  }
  const id = assertDriveId(record.id);
  if (record.name.length === 0 || record.name.length > 200 || /[\r\n]/.test(record.name)) {
    throw new DriveAccessError("verify");
  }
  const parents = Array.isArray(record.parents)
    ? record.parents.map((parent) => {
        if (typeof parent !== "string") throw new DriveAccessError("verify");
        return assertDriveId(parent);
      })
    : [];
  const size = typeof record.size === "string" ? record.size : undefined;
  const md5Checksum = typeof record.md5Checksum === "string" ? record.md5Checksum : undefined;
  if (size !== undefined && !BYTE_SIZE.test(size)) throw new DriveAccessError("verify");
  if (md5Checksum !== undefined && !HEX_MD5.test(md5Checksum)) {
    throw new DriveAccessError("verify");
  }
  return {
    id,
    name: record.name,
    mimeType: record.mimeType,
    parents,
    size,
    md5Checksum,
  };
}

export function isAccessCheckCreateName(name: string) {
  return name === ACCESS_CHECK_FILE || FOLDER_NAME.test(name);
}
