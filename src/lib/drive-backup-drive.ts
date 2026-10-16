import "server-only";

import {
  BackupRunError,
  classifyBackupPath,
  contentRange,
  driveChildQuery,
  isAllowedBackupFolderName,
  isAllowedJsonName,
  type BackupDrive,
  type ChunkResult,
  type DriveChild,
} from "@/lib/drive-backup";
import { assertDriveId, FOLDER_MIME, parseDriveMetadata } from "@/lib/drive-access-check";

const DRIVE_CHUNK_MULTIPLE = 256 * 1024;
const FILE_FIELDS = "nextPageToken,files(id,name,mimeType,size,md5Checksum)";

type SessionRecord = {
  url: string;
  total: number;
  received: number;
};

function authorization(token: string) {
  if (token.length < 20 || token.length > 8192 || /[\s]/.test(token)) {
    throw new BackupRunError("authentication");
  }
  return `Bearer ${token}`;
}

async function discard(response: Response) {
  await response.text();
}

function sessionUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BackupRunError("upload");
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith("googleapis.com")) {
    throw new BackupRunError("upload");
  }
  return url.toString();
}

function childFromMetadata(record: {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
}): DriveChild {
  const size = record.size === undefined ? undefined : Number(record.size);
  if (size !== undefined && !Number.isInteger(size)) throw new BackupRunError("verify");
  return {
    id: record.id,
    name: record.name,
    mimeType: record.mimeType,
    size,
    md5: record.md5Checksum,
  };
}

export function createBackupDrive(token: string, fetchImpl: typeof fetch = fetch): BackupDrive {
  const auth = authorization(token);
  const sessions = new Map<string, SessionRecord>();

  async function driveJson(url: string, method: "GET" | "POST", body?: string) {
    const response = await fetchImpl(url, {
      method,
      headers: {
        Authorization: auth,
        ...(body ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
      },
      body,
    });
    if (!response.ok) {
      await discard(response);
      throw new BackupRunError(response.status === 404 ? "destination" : "upload");
    }
    return response.json() as Promise<unknown>;
  }

  async function listPage(query: string, pageToken?: string) {
    const url = new URL("https://www.googleapis.com/drive/v3/files");
    url.searchParams.set("q", query);
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("fields", FILE_FIELDS);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const parsed = await driveJson(url.toString(), "GET");
    if (!parsed || typeof parsed !== "object") throw new BackupRunError("upload");
    const record = parsed as { nextPageToken?: unknown; files?: unknown };
    const files = Array.isArray(record.files) ? record.files : [];
    const children = files.map((file) => {
      try {
        return childFromMetadata(parseDriveMetadata(file));
      } catch {
        throw new BackupRunError("verify");
      }
    });
    const next = typeof record.nextPageToken === "string" ? record.nextPageToken : undefined;
    return { children, next };
  }

  async function listChildren(parentId: string): Promise<DriveChild[]> {
    assertDriveId(parentId);
    const children: DriveChild[] = [];
    let pageToken: string | undefined;
    do {
      if (children.length > 5000) throw new BackupRunError("source");
      const page = await listPage(`'${parentId}' in parents and trashed = false`, pageToken);
      children.push(...page.children);
      pageToken = page.next;
    } while (pageToken);
    return children;
  }

  async function findChild(parentId: string, name: string) {
    const matches: DriveChild[] = [];
    let pageToken: string | undefined;
    do {
      const page = await listPage(driveChildQuery(parentId, name), pageToken);
      matches.push(...page.children);
      pageToken = page.next;
    } while (pageToken);
    if (matches.length > 1) throw new BackupRunError("verify");
    return matches[0] ?? null;
  }

  async function ensureFolder(parentId: string, name: string) {
    if (!isAllowedBackupFolderName(name)) throw new BackupRunError("source");
    const existing = await findChild(parentId, name);
    if (existing) {
      if (existing.mimeType !== FOLDER_MIME) throw new BackupRunError("destination");
      return existing.id;
    }
    const created = await driveJson(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,mimeType,parents",
      "POST",
      JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [assertDriveId(parentId)] }),
    );
    try {
      return parseDriveMetadata(created).id;
    } catch {
      throw new BackupRunError("upload");
    }
  }

  async function getJson(parentId: string, name: string) {
    if (!isAllowedJsonName(name)) throw new BackupRunError("source");
    const existing = await findChild(parentId, name);
    if (!existing) return null;
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${assertDriveId(existing.id)}`);
    url.searchParams.set("alt", "media");
    url.searchParams.set("supportsAllDrives", "true");
    const response = await fetchImpl(url, { method: "GET", headers: { Authorization: auth } });
    if (!response.ok) {
      await discard(response);
      throw new BackupRunError("verify");
    }
    return response.text();
  }

  async function putJson(parentId: string, name: string, text: string) {
    if (!isAllowedJsonName(name)) throw new BackupRunError("source");
    if (text.length > 2_000_000) throw new BackupRunError("upload");
    const boundary = "yukon-backup-json";
    const metadata = JSON.stringify({
      name,
      parents: [assertDriveId(parentId)],
    });
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${boundary}--`;
    const response = await fetchImpl(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: auth,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!response.ok) {
      await discard(response);
      throw new BackupRunError("upload");
    }
    await discard(response);
  }

  function sessionKey(backupRootId: string, resumeKey: string) {
    assertDriveId(backupRootId);
    if (!/^[a-f0-9]{64}$/.test(resumeKey)) throw new BackupRunError("source");
    return `${backupRootId}:${resumeKey}`;
  }

  async function loadSession(backupRootId: string, resumeKey: string) {
    const key = sessionKey(backupRootId, resumeKey);
    const cached = sessions.get(key);
    if (cached) return cached;
    const sessionsId = await ensureFolder(backupRootId, "sessions");
    const text = await getJson(sessionsId, `${resumeKey}.json`);
    if (text === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new BackupRunError("resume");
    }
    if (!parsed || typeof parsed !== "object") throw new BackupRunError("resume");
    const record = parsed as { url?: unknown; total?: unknown };
    if (typeof record.url !== "string" || typeof record.total !== "number") {
      throw new BackupRunError("resume");
    }
    const session = { url: sessionUrl(record.url), total: record.total, received: 0 };
    sessions.set(key, session);
    return session;
  }

  async function queryReceived(session: SessionRecord) {
    if (session.total === 0) return session.received;
    const response = await fetchImpl(session.url, {
      method: "PUT",
      headers: {
        "Content-Length": "0",
        "Content-Range": `bytes */${session.total}`,
      },
    });
    if (response.status === 308) {
      await discard(response);
      const range = response.headers.get("range");
      const match = range?.match(/^bytes=0-(\d+)$/);
      session.received = match ? Number(match[1]) + 1 : session.received;
      return session.received;
    }
    if (response.ok) {
      await discard(response);
      session.received = session.total;
      return session.received;
    }
    await discard(response);
    throw new BackupRunError("resume");
  }

  async function received(backupRootId: string, resumeKey: string) {
    const session = await loadSession(backupRootId, resumeKey);
    if (!session) return 0;
    return queryReceived(session);
  }

  async function writeChunk(input: {
    backupRootId: string;
    resumeKey: string;
    parentId: string;
    path: string;
    name: string;
    mimeType: string;
    total: number;
    start: number;
    bytes: Uint8Array;
  }): Promise<ChunkResult> {
    if (classifyBackupPath(input.path) !== "include") throw new BackupRunError("source");
    if (input.path.split("/").pop() !== input.name) throw new BackupRunError("source");
    const end = input.start + input.bytes.length;
    if (end > input.total) throw new BackupRunError("upload");
    if (end < input.total && input.bytes.length % DRIVE_CHUNK_MULTIPLE !== 0) {
      throw new BackupRunError("upload");
    }
    assertDriveId(input.parentId);
    const key = sessionKey(input.backupRootId, input.resumeKey);
    let session = sessions.get(key) ?? (await loadSession(input.backupRootId, input.resumeKey));
    if (!session) {
      const started = await fetchImpl(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,md5Checksum",
        {
          method: "POST",
          headers: {
            Authorization: auth,
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": input.mimeType,
            "X-Upload-Content-Length": String(input.total),
          },
          body: JSON.stringify({ name: input.name, parents: [input.parentId] }),
        },
      );
      const location = started.headers.get("location");
      if (!started.ok || !location) {
        await discard(started);
        throw new BackupRunError("upload");
      }
      await discard(started);
      session = { url: sessionUrl(location), total: input.total, received: 0 };
      sessions.set(key, session);
      const sessionsId = await ensureFolder(input.backupRootId, "sessions");
      await putJson(
        sessionsId,
        `${input.resumeKey}.json`,
        JSON.stringify({ url: session.url, total: input.total }),
      );
    }
    if (session.total !== input.total || input.start !== session.received) {
      throw new BackupRunError("resume");
    }
    const response = await fetchImpl(session.url, {
      method: "PUT",
      headers: {
        "Content-Length": String(input.bytes.length),
        "Content-Range": contentRange(input.start, input.bytes.length, input.total),
      },
      body: Buffer.from(input.bytes),
    });
    if (response.status === 308) {
      await discard(response);
      session.received = end;
      return { complete: false };
    }
    if (!response.ok) {
      await discard(response);
      throw new BackupRunError("upload");
    }
    const metadata = await response.json();
    let parsed;
    try {
      parsed = childFromMetadata(parseDriveMetadata(metadata));
    } catch {
      throw new BackupRunError("verify");
    }
    session.received = input.total;
    if (parsed.size === undefined || parsed.md5 === undefined) throw new BackupRunError("verify");
    return { complete: true, id: parsed.id, size: parsed.size, md5: parsed.md5 };
  }

  return { ensureFolder, findChild, listChildren, received, writeChunk, putJson, getJson };
}
