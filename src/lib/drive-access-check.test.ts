import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  ACCESS_CHECK_FILE,
  DRIVE_SCOPE,
  DriveAccessError,
  FOLDER_MIME,
  accessCheckPayload,
  backupAccessProduction,
  parseDriveMetadata,
  readDriveAccessConfig,
  runDriveAccessCheck,
  toBackupAccessResult,
  workloadIdentityOptions,
  type DriveGateway,
  type DriveMetadata,
} from "@/lib/drive-access-check";
import { driveCreateFile, driveGetFile } from "@/lib/drive-access-http";

const FOLDER_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const NOW = new Date("2026-10-16T04:15:00.000Z");
const SUFFIX = "a1b2c3";

function configuredEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    GCP_PROJECT_ID: "yukon-baseball-website-backups",
    GCP_PROJECT_NUMBER: "879934248114",
    GCP_SERVICE_ACCOUNT_EMAIL:
      "yukon-baseball-backup@yukon-baseball-website-backups.iam.gserviceaccount.com",
    GCP_WORKLOAD_IDENTITY_POOL_ID: "yukon-baseball-github-backups",
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: "vercel",
    GOOGLE_DRIVE_FOLDER_ID: FOLDER_ID,
    ...overrides,
  };
}

function memoryDrive(options?: { md5?: string; destinationMime?: string }) {
  const calls: string[] = [];
  const files = new Map<string, DriveMetadata>();
  files.set(FOLDER_ID, {
    id: FOLDER_ID,
    name: "Backup destination",
    mimeType: options?.destinationMime ?? FOLDER_MIME,
    parents: [],
  });
  let sequence = 0;
  const drive: DriveGateway = {
    async getFile(id, operation) {
      calls.push(`GET ${operation} ${id}`);
      const file = files.get(id);
      if (!file) {
        throw new DriveAccessError(operation === "destination" ? "destination-missing" : "verify");
      }
      return file;
    },
    async createFile(input) {
      calls.push(`POST ${input.name}`);
      sequence += 1;
      const id = `created${sequence}FileAbcdefghijk`;
      const md5 = input.media
        ? (options?.md5 ?? createHash("md5").update(input.media.body).digest("hex"))
        : undefined;
      const file: DriveMetadata = {
        id,
        name: input.name,
        mimeType: input.mimeType ?? "text/plain",
        parents: [input.parents[0]],
        size: input.media ? String(input.media.body.byteLength) : undefined,
        md5Checksum: md5,
      };
      files.set(id, file);
      return file;
    },
  };
  return { drive, calls };
}

describe("Google Drive backup access check", () => {
  it("accepts only the configured production backup identity", () => {
    const config = readDriveAccessConfig(configuredEnv());
    assert.ok(config);
    assert.equal(config.folderId, FOLDER_ID);
    assert.equal(readDriveAccessConfig(configuredEnv({ GCP_PROJECT_ID: "other" })), null);
    assert.equal(
      readDriveAccessConfig(configuredEnv({ GCP_SERVICE_ACCOUNT_EMAIL: "other@example.com" })),
      null,
    );
    assert.equal(readDriveAccessConfig(configuredEnv({ GOOGLE_DRIVE_FOLDER_ID: "../minutes" })), null);
    assert.equal(readDriveAccessConfig({}), null);
  });

  it("builds a short-lived workload identity request without a service account key", () => {
    const config = readDriveAccessConfig(configuredEnv());
    assert.ok(config);
    const options = workloadIdentityOptions(config);
    assert.equal(options.type, "external_account");
    assert.equal("private_key" in options, false);
    assert.equal("credential_source" in options, false);
    assert.deepEqual(options.scopes, [DRIVE_SCOPE]);
    assert.equal(options.service_account_impersonation.token_lifetime_seconds, 600);
    assert.equal(
      options.audience,
      "//iam.googleapis.com/projects/879934248114/locations/global/workloadIdentityPools/yukon-baseball-github-backups/providers/vercel",
    );
    assert.equal(
      options.service_account_impersonation_url,
      "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/yukon-baseball-backup@yukon-baseball-website-backups.iam.gserviceaccount.com:generateAccessToken",
    );
  });

  it("runs only in the Vercel production environment", () => {
    assert.equal(backupAccessProduction({ VERCEL_ENV: "production" }), true);
    assert.equal(backupAccessProduction({ VERCEL_ENV: "preview" }), false);
    assert.equal(backupAccessProduction({ VERCEL_ENV: "development" }), false);
    assert.equal(backupAccessProduction({}), false);
  });

  it("creates one folder and access-check.txt, then verifies the read-back", async () => {
    const config = readDriveAccessConfig(configuredEnv());
    assert.ok(config);
    const { drive, calls } = memoryDrive();
    const result = await runDriveAccessCheck(config, drive, NOW, SUFFIX);
    const payload = accessCheckPayload(NOW, SUFFIX);
    assert.deepEqual(result, {
      ok: true,
      step: "verified",
      folder: "access-check-20261016T041500Z-a1b2c3",
      file: ACCESS_CHECK_FILE,
      bytes: payload.body.byteLength,
      sizeMatches: true,
      md5Matches: true,
    });
    assert.deepEqual(calls, [
      `GET destination ${FOLDER_ID}`,
      "POST access-check-20261016T041500Z-a1b2c3",
      "GET read created1FileAbcdefghijk",
      "POST access-check.txt",
      "GET read created2FileAbcdefghijk",
    ]);
    assert.equal(calls.some((call) => call.startsWith("DELETE") || call.startsWith("PATCH")), false);
  });

  it("stops before creating anything when the destination is not a folder", async () => {
    const config = readDriveAccessConfig(configuredEnv());
    assert.ok(config);
    const { drive, calls } = memoryDrive({ destinationMime: "text/plain" });
    await assert.rejects(
      () => runDriveAccessCheck(config, drive, NOW, SUFFIX),
      (error: unknown) => error instanceof DriveAccessError && error.code === "destination-denied",
    );
    assert.deepEqual(calls, [`GET destination ${FOLDER_ID}`]);
  });

  it("reports a verification failure without a delete call when the checksum differs", async () => {
    const config = readDriveAccessConfig(configuredEnv());
    assert.ok(config);
    const { drive, calls } = memoryDrive({ md5: "0".repeat(32) });
    await assert.rejects(
      () => runDriveAccessCheck(config, drive, NOW, SUFFIX),
      (error: unknown) => error instanceof DriveAccessError && error.code === "verify",
    );
    assert.equal(calls.includes("POST access-check.txt"), true);
    assert.equal(calls.some((call) => call.startsWith("DELETE")), false);
  });

  it("returns a fixed failure and drops upstream token text", () => {
    const leaked = new Error(
      "Bearer ya29.secret-token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig",
    );
    const result = toBackupAccessResult(leaked);
    assert.equal(result.status, 500);
    assert.equal(result.body.error, "Backup access check failed.");
    assert.equal(JSON.stringify(result).includes("ya29"), false);
    assert.equal(JSON.stringify(result).includes("eyJ"), false);
    const missing = toBackupAccessResult(new DriveAccessError("destination-missing"));
    assert.equal(missing.status, 502);
    assert.deepEqual(missing.body, {
      ok: false,
      step: "destination",
      error: "Backup folder was not found.",
    });
  });

  it("reads Drive metadata without keeping unrecognized fields", () => {
    const metadata = parseDriveMetadata({
      id: FOLDER_ID,
      name: "Backup destination",
      mimeType: FOLDER_MIME,
      parents: [FOLDER_ID],
      size: "12",
      md5Checksum: "a".repeat(32),
      description: "album link https://photos.example/private",
    });
    assert.deepEqual(metadata, {
      id: FOLDER_ID,
      name: "Backup destination",
      mimeType: FOLDER_MIME,
      parents: [FOLDER_ID],
      size: "12",
      md5Checksum: "a".repeat(32),
    });
    assert.throws(() => parseDriveMetadata({ id: "../minutes/file.pdf", name: "x", mimeType: "text/plain" }));
  });
});

describe("Google Drive HTTP access check", () => {
  const token = "ya29.test-token-value-ok";

  it("gets a file with GET and keeps the access token out of the URL", async () => {
    let method = "";
    let url = "";
    let auth = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      method = init?.method ?? "";
      url = String(input);
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return Response.json({
        id: FOLDER_ID,
        name: "Backup destination",
        mimeType: FOLDER_MIME,
        parents: [],
      });
    };
    const file = await driveGetFile(fetchImpl, token, FOLDER_ID, "destination");
    assert.equal(file.id, FOLDER_ID);
    assert.equal(method, "GET");
    assert.equal(url.includes("supportsAllDrives=true"), true);
    assert.equal(url.includes(token), false);
    assert.equal(auth, `Bearer ${token}`);
  });

  it("discards a Drive error body that contains a token", async () => {
    const fetchImpl: typeof fetch = async () =>
      Response.json(
        { error: { message: `Bearer ${token} eyJhbGciOiJIUzI1NiJ9.payload.sig` } },
        { status: 404 },
      );
    await assert.rejects(
      () => driveGetFile(fetchImpl, token, FOLDER_ID, "destination"),
      (error: unknown) => {
        assert.ok(error instanceof DriveAccessError);
        assert.equal(error.code, "destination-missing");
        assert.equal(error.message.includes(token), false);
        assert.equal(error.message.includes("eyJ"), false);
        return true;
      },
    );
  });

  it("creates the test folder and file with POST only", async () => {
    const methods: string[] = [];
    const urls: string[] = [];
    const bodies: string[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      methods.push(init?.method ?? "");
      urls.push(String(input));
      const body = init?.body;
      bodies.push(typeof body === "string" ? body : Buffer.from(body as Uint8Array).toString("utf8"));
      const folder = String(input).includes("/upload/") ? false : true;
      return Response.json(
        folder
          ? {
              id: "created1FileAbcdefghijk",
              name: "access-check-20261016T041500Z-a1b2c3",
              mimeType: FOLDER_MIME,
              parents: [FOLDER_ID],
            }
          : {
              id: "created2FileAbcdefghijk",
              name: ACCESS_CHECK_FILE,
              mimeType: "text/plain",
              parents: ["created1FileAbcdefghijk"],
              size: "4",
              md5Checksum: "a".repeat(32),
            },
      );
    };
    await driveCreateFile(fetchImpl, token, {
      name: "access-check-20261016T041500Z-a1b2c3",
      mimeType: FOLDER_MIME,
      parents: [FOLDER_ID],
    });
    await driveCreateFile(fetchImpl, token, {
      name: ACCESS_CHECK_FILE,
      parents: ["created1FileAbcdefghijk"],
      media: { mimeType: "text/plain", body: new TextEncoder().encode("test") },
    });
    assert.deepEqual(methods, ["POST", "POST"]);
    assert.equal(urls[0].includes("/upload/"), false);
    assert.equal(urls[1].includes("uploadType=multipart"), true);
    assert.equal(urls.every((item) => !item.includes(token)), true);
    assert.equal(bodies[0].includes(`"parents":["${FOLDER_ID}"]`), true);
    assert.equal(bodies[1].includes("access-check.txt"), true);
    await assert.rejects(
      () =>
        driveCreateFile(fetchImpl, token, {
          name: "minutes/private.pdf",
          parents: [FOLDER_ID],
          media: { mimeType: "text/plain", body: new Uint8Array([1]) },
        }),
      (error: unknown) => error instanceof DriveAccessError,
    );
  });
});

describe("backup access route source", () => {
  it("exposes POST only and does not touch Blob or Drive deletion", () => {
    const route = readFileSync(
      new URL("../app/api/backup/access-check/route.ts", import.meta.url),
      "utf8",
    );
    const http = readFileSync(new URL("./drive-access-http.ts", import.meta.url), "utf8");
    const google = readFileSync(new URL("./drive-access-google.ts", import.meta.url), "utf8");
    assert.equal(route.includes("export async function GET"), false);
    assert.equal(route.includes("export function GET"), false);
    assert.equal(route.includes("@vercel/blob"), false);
    assert.equal(route.includes("maxDuration = 30"), true);
    assert.equal(http.includes('method: "DELETE"'), false);
    assert.equal(http.includes('method: "PATCH"'), false);
    assert.equal(http.includes('method: "PUT"'), false);
    assert.equal(google.includes("private_key"), false);
    assert.equal(google.includes("credential_source"), false);
    assert.equal(google.includes("getVercelOidcToken"), true);
  });
});
