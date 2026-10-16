import "server-only";

import { createHash } from "crypto";
import { BlobNotFoundError, del, get, list, put } from "@vercel/blob";
import {
  createMinutesSession,
  createSessionId,
  readMinutesSession,
  readMinutesSessionIdentity,
  SESSION_ID_PATTERN,
  SESSION_MS,
  type MinutesAccess,
  type MinutesRole,
} from "@/lib/minutes-session-token";

export const SESSION_PREFIX = "auth-sessions/v1/";
export const SESSION_CURSOR_PATH = "auth-sessions/v1/cursor.json";
export const SESSION_RETENTION_MS = SESSION_MS + 60 * 60 * 1000;
const SESSION_PATH = /^auth-sessions\/v1\/[0-9a-f]{64}\.json$/;
const PRUNE_LIMIT = 20;

export type SessionRecord = {
  role: MinutesRole;
  absoluteExp: number;
};

export type SessionRead =
  | { state: "present"; record: SessionRecord }
  | { state: "missing" }
  | { state: "unavailable" };

export type SessionRegistry = {
  read(sessionId: string): Promise<SessionRead>;
  write(sessionId: string, record: SessionRecord): Promise<"ok" | "unavailable">;
  delete(sessionId: string): Promise<"ok" | "unavailable">;
};

function runtimeEnv(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function blobConfigured() {
  return Boolean(runtimeEnv("BLOB_READ_WRITE_TOKEN") || runtimeEnv("BLOB_STORE_ID"));
}

async function blobAuth() {
  const token = runtimeEnv("BLOB_READ_WRITE_TOKEN");
  if (token) return { token };
  const storeId = runtimeEnv("BLOB_STORE_ID");
  return storeId ? { storeId } : {};
}

export function sessionBlobPath(sessionId: string) {
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;
  const digest = createHash("sha256").update(sessionId).digest("hex");
  const path = `${SESSION_PREFIX}${digest}.json`;
  if (!SESSION_PATH.test(path) || path.includes(sessionId)) return null;
  return path;
}

export function isSessionBlobPath(pathname: string) {
  return SESSION_PATH.test(pathname);
}

export function selectExpiredSessionPaths(
  blobs: { pathname: string; uploadedAtMs: number }[],
  now: number,
) {
  return blobs.filter(
    (blob) =>
      isSessionBlobPath(blob.pathname) &&
      Number.isFinite(blob.uploadedAtMs) &&
      now - blob.uploadedAtMs >= SESSION_RETENTION_MS,
  );
}

function parseRecord(value: string): SessionRecord | null {
  let parsed: { role?: unknown; absoluteExp?: unknown };
  try {
    parsed = JSON.parse(value) as { role?: unknown; absoluteExp?: unknown };
  } catch {
    return null;
  }
  if (parsed.role !== "view" && parsed.role !== "admin") return null;
  if (typeof parsed.absoluteExp !== "number" || !Number.isInteger(parsed.absoluteExp)) return null;
  return { role: parsed.role, absoluteExp: parsed.absoluteExp };
}

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > 1_000) return null;
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return Buffer.from(bytes).toString("utf8");
}

export function createMemorySessionRegistry(): SessionRegistry {
  const records = new Map<string, SessionRecord>();
  return {
    async read(sessionId) {
      if (!sessionBlobPath(sessionId)) return { state: "unavailable" };
      const record = records.get(sessionId);
      return record ? { state: "present", record: { ...record } } : { state: "missing" };
    },
    async write(sessionId, record) {
      if (!sessionBlobPath(sessionId)) return "unavailable";
      if (records.has(sessionId)) return "unavailable";
      records.set(sessionId, { ...record });
      return "ok";
    },
    async delete(sessionId) {
      if (!sessionBlobPath(sessionId)) return "unavailable";
      records.delete(sessionId);
      return "ok";
    },
  };
}

function closedRegistry(): SessionRegistry {
  return {
    async read() {
      return { state: "unavailable" };
    },
    async write() {
      return "unavailable";
    },
    async delete() {
      return "unavailable";
    },
  };
}

function blobRegistry(): SessionRegistry {
  return {
    async read(sessionId) {
      const path = sessionBlobPath(sessionId);
      if (!path) return { state: "unavailable" };
      try {
        const result = await get(path, {
          access: "private",
          useCache: false,
          ...(await blobAuth()),
        });
        if (!result) return { state: "missing" };
        if (result.statusCode !== 200 || !result.stream) return { state: "unavailable" };
        const text = await readStream(result.stream);
        if (!text) return { state: "unavailable" };
        const record = parseRecord(text);
        if (!record) return { state: "unavailable" };
        return { state: "present", record };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return { state: "missing" };
        return { state: "unavailable" };
      }
    },
    async write(sessionId, record) {
      const path = sessionBlobPath(sessionId);
      if (!path) return "unavailable";
      try {
        await put(path, JSON.stringify(record), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(await blobAuth()),
        });
        return "ok";
      } catch {
        return "unavailable";
      }
    },
    async delete(sessionId) {
      const path = sessionBlobPath(sessionId);
      if (!path) return "unavailable";
      try {
        await del(path, await blobAuth());
        return "ok";
      } catch (error) {
        if (error instanceof BlobNotFoundError) return "ok";
        return "unavailable";
      }
    },
  };
}

const localRegistry = createMemorySessionRegistry();

export function sessionRegistry(): SessionRegistry {
  if (blobConfigured()) return blobRegistry();
  if (runtimeEnv("VERCEL")) return closedRegistry();
  return localRegistry;
}

export async function issueStoredSession(
  role: MinutesRole,
  registry: SessionRegistry,
  now = Date.now(),
) {
  const sessionId = createSessionId();
  if (!sessionId) return null;
  const absoluteExp = now + SESSION_MS;
  const saved = await registry.write(sessionId, { role, absoluteExp });
  if (saved !== "ok") return null;
  const token = createMinutesSession(role, sessionId, now);
  if (!token) {
    await registry.delete(sessionId);
    return null;
  }
  return token;
}

export async function resolveStoredSession(
  token: string | undefined,
  registry: SessionRegistry,
  now = Date.now(),
): Promise<MinutesAccess> {
  const decoded = readMinutesSession(token, now);
  if (decoded.state === "anonymous") return decoded;
  if (decoded.state === "expired") {
    if (!decoded.sessionId) return decoded;
    const removed = await registry.delete(decoded.sessionId);
    if (removed !== "ok") return { state: "unavailable" };
    return decoded;
  }
  if (decoded.state !== "active") return { state: "unavailable" };
  const loaded = await registry.read(decoded.sessionId);
  if (loaded.state === "unavailable") return { state: "unavailable" };
  if (loaded.state !== "present") return { state: "anonymous" };
  if (
    loaded.record.role !== decoded.role ||
    loaded.record.absoluteExp !== decoded.absoluteExp
  ) {
    return { state: "anonymous" };
  }
  return decoded;
}

export async function revokePresentedSession(
  token: string | undefined,
  registry: SessionRegistry,
) {
  const identity = readMinutesSessionIdentity(token);
  if (!identity) return "ok" as const;
  return registry.delete(identity.sessionId);
}

async function readCursor() {
  const result = await get(SESSION_CURSOR_PATH, {
    access: "private",
    useCache: false,
    ...(await blobAuth()),
  });
  if (!result || result.statusCode !== 200 || !result.stream) return undefined;
  const text = await readStream(result.stream);
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { cursor?: unknown };
    return typeof parsed.cursor === "string" && parsed.cursor ? parsed.cursor : undefined;
  } catch {
    return undefined;
  }
}

async function writeCursor(cursor: string | undefined) {
  await put(SESSION_CURSOR_PATH, JSON.stringify({ cursor: cursor ?? null }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(await blobAuth()),
  });
}

export async function pruneExpiredSessions(now = Date.now()) {
  try {
    if (!blobConfigured()) return;
    const cursor = await readCursor();
    const page = await list({
      prefix: SESSION_PREFIX,
      limit: PRUNE_LIMIT,
      ...(cursor ? { cursor } : {}),
      ...(await blobAuth()),
    });
    const expired = new Set(
      selectExpiredSessionPaths(
        page.blobs.map((blob) => ({
          pathname: blob.pathname,
          uploadedAtMs: blob.uploadedAt.getTime(),
        })),
        now,
      ).map((blob) => blob.pathname),
    );
    for (const blob of page.blobs) {
      if (!expired.has(blob.pathname)) continue;
      try {
        await del(blob.pathname, await blobAuth());
      } catch (error) {
        if (error instanceof BlobNotFoundError) continue;
        return;
      }
    }
    await writeCursor(page.hasMore ? page.cursor : undefined);
  } catch {
    // Cleanup must not change the sign-in result or delete unrelated files.
  }
}
