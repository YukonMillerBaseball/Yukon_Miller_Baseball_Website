import "server-only";

import {
  ACCESS_CHECK_FILE,
  DriveAccessError,
  FOLDER_MIME,
  type DriveCreateInput,
  type DriveGateway,
  type DriveMetadata,
  assertDriveId,
  isAccessCheckCreateName,
  parseDriveMetadata,
} from "@/lib/drive-access-check";

const DRIVE_FIELDS = "id,name,mimeType,parents,size,md5Checksum";

function authorization(token: string) {
  if (token.length < 20 || token.length > 8192 || /[\s]/.test(token)) {
    throw new DriveAccessError("authentication");
  }
  return `Bearer ${token}`;
}

async function discard(response: Response) {
  await response.text();
}

function failureCode(
  operation: "destination" | "read" | "create-folder" | "upload",
  status: number,
) {
  if (operation === "destination" && status === 404) return "destination-missing" as const;
  if (operation === "destination") return "destination-denied" as const;
  if (operation === "create-folder") return "create-folder" as const;
  if (operation === "upload") return "upload" as const;
  return "verify" as const;
}

async function readMetadata(
  response: Response,
  operation: "destination" | "read" | "create-folder" | "upload",
): Promise<DriveMetadata> {
  if (!response.ok) {
    await discard(response);
    throw new DriveAccessError(failureCode(operation, response.status));
  }
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new DriveAccessError("verify");
  }
  return parseDriveMetadata(parsed);
}

export function driveFileUrl(id: string) {
  const safeId = assertDriveId(id);
  const url = new URL(`https://www.googleapis.com/drive/v3/files/${safeId}`);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", DRIVE_FIELDS);
  return url;
}

export async function driveGetFile(
  fetchImpl: typeof fetch,
  token: string,
  id: string,
  operation: "destination" | "read",
): Promise<DriveMetadata> {
  const response = await fetchImpl(driveFileUrl(id), {
    method: "GET",
    headers: { Authorization: authorization(token) },
  });
  return readMetadata(response, operation);
}

export async function driveCreateFile(
  fetchImpl: typeof fetch,
  token: string,
  input: DriveCreateInput,
): Promise<DriveMetadata> {
  if (!isAccessCheckCreateName(input.name)) throw new DriveAccessError("verify");
  const parent = assertDriveId(input.parents[0]);
  if (input.parents.length !== 1) throw new DriveAccessError("verify");
  const auth = authorization(token);
  const folder = input.name !== ACCESS_CHECK_FILE;
  if (folder) {
    if (input.media || input.mimeType !== FOLDER_MIME) throw new DriveAccessError("verify");
    const response = await fetchImpl(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=" +
        encodeURIComponent(DRIVE_FIELDS),
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: input.name,
          mimeType: FOLDER_MIME,
          parents: [parent],
        }),
      },
    );
    return readMetadata(response, "create-folder");
  }

  if (!input.media || input.media.mimeType !== "text/plain") {
    throw new DriveAccessError("verify");
  }
  const boundary = `yukon-access-${parent.slice(0, 12)}`;
  const metadata = JSON.stringify({
    name: ACCESS_CHECK_FILE,
    parents: [parent],
  });
  const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n`;
  const ending = `\r\n--${boundary}--`;
  const encoder = new TextEncoder();
  const head = encoder.encode(preamble);
  const tail = encoder.encode(ending);
  const bytes = new Uint8Array(head.length + input.media.body.length + tail.length);
  bytes.set(head, 0);
  bytes.set(input.media.body, head.length);
  bytes.set(tail, head.length + input.media.body.length);
  const response = await fetchImpl(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=" +
      encodeURIComponent(DRIVE_FIELDS),
    {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: bytes,
    },
  );
  return readMetadata(response, "upload");
}

export function googleDriveGateway(
  token: string,
  fetchImpl: typeof fetch = fetch,
): DriveGateway {
  return {
    getFile(id, operation) {
      return driveGetFile(fetchImpl, token, id, operation);
    },
    createFile(input) {
      return driveCreateFile(fetchImpl, token, input);
    },
  };
}
