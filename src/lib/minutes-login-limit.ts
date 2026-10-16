import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  list,
  put,
} from "@vercel/blob";
import {
  LOGIN_WINDOW_MS,
  LoginLimitUnavailable,
  RATE_CURSOR_PATH,
  RATE_LIMIT_PREFIX,
  RATE_PRUNE_LIMIT,
  isRateCounterPath,
  loginAttemptKey,
  reserveLoginAttempt,
  requestClientIp,
  selectExpiredRateCounters,
  settleLoginAttempt,
  type LoginAttemptSnapshot,
  type LoginAttemptState,
  type LoginAttemptStore,
  type LoginReservation,
} from "@/lib/minutes-login-policy";
import { minutesAuthConfig } from "@/lib/minutes-session-token";

const KEY = /^[0-9a-f]{64}$/;
const memory = new Map<string, LoginAttemptSnapshot>();

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

function pathname(key: string) {
  if (!KEY.test(key)) throw new LoginLimitUnavailable();
  const path = `${RATE_LIMIT_PREFIX}${key}.json`;
  if (!isRateCounterPath(path)) throw new LoginLimitUnavailable();
  return path;
}

function isConflict(error: unknown) {
  return (
    error instanceof BlobPreconditionFailedError ||
    (error instanceof Error && /already exists|precondition/i.test(error.message))
  );
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
    if (total > 1_000) throw new LoginLimitUnavailable();
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

function parseState(value: string): LoginAttemptState {
  let parsed: { failures?: unknown; pending?: unknown; windowStart?: unknown };
  try {
    parsed = JSON.parse(value) as {
      failures?: unknown;
      pending?: unknown;
      windowStart?: unknown;
    };
  } catch {
    throw new LoginLimitUnavailable();
  }
  const pending = parsed.pending === undefined ? 0 : parsed.pending;
  if (
    typeof parsed.failures !== "number" ||
    !Number.isInteger(parsed.failures) ||
    parsed.failures < 0 ||
    typeof pending !== "number" ||
    !Number.isInteger(pending) ||
    pending < 0 ||
    (parsed.failures < 1 && pending < 1) ||
    typeof parsed.windowStart !== "number" ||
    !Number.isFinite(parsed.windowStart)
  ) {
    throw new LoginLimitUnavailable();
  }
  return { failures: parsed.failures, pending, windowStart: parsed.windowStart };
}

export function classifyBlobRead(
  result: {
    statusCode: number;
    stream: ReadableStream<Uint8Array> | null;
    blob: { etag?: string | null };
  } | null,
) {
  if (!result) return { kind: "missing" as const };
  const version = result.blob.etag?.trim() || "";
  if (result.statusCode !== 200 || !result.stream || !version) {
    return { kind: "unavailable" as const };
  }
  return { kind: "ready" as const, version, stream: result.stream };
}

function blobStore(): LoginAttemptStore {
  return {
    async read(key) {
      try {
        const result = await get(pathname(key), {
          access: "private",
          useCache: false,
          ...(await blobAuth()),
        });
        const classified = classifyBlobRead(result);
        if (classified.kind === "missing") return { state: null, version: null };
        if (classified.kind === "unavailable") throw new LoginLimitUnavailable();
        return {
          state: parseState(await readStream(classified.stream)),
          version: classified.version,
        };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return { state: null, version: null };
        if (error instanceof LoginLimitUnavailable) throw error;
        throw new LoginLimitUnavailable();
      }
    },
    async write(key, state, version) {
      const path = pathname(key);
      const auth = await blobAuth();
      try {
        if (state === null) {
          if (!version) return "ok";
          await del(path, { ...auth, ifMatch: version });
          return "ok";
        }
        await put(path, JSON.stringify(state), {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: Boolean(version),
          contentType: "application/json",
          cacheControlMaxAge: 60,
          ...(version ? { ifMatch: version } : {}),
          ...auth,
        });
        return "ok";
      } catch (error) {
        if (state === null && error instanceof BlobNotFoundError) return "ok";
        if (isConflict(error)) return "conflict";
        throw new LoginLimitUnavailable();
      }
    },
  };
}

function memoryStore(): LoginAttemptStore {
  return {
    async read(key) {
      return memory.get(key) ?? { state: null, version: null };
    },
    async write(key, state, version) {
      const current = memory.get(key) ?? { state: null, version: null };
      if ((current.version ?? null) !== (version ?? null)) return "conflict";
      if (state === null) {
        memory.delete(key);
        return "ok";
      }
      const nextVersion = String(Number(current.version ?? "0") + 1);
      memory.set(key, { state, version: nextVersion });
      return "ok";
    },
  };
}

function storeForRuntime() {
  if (blobConfigured()) return blobStore();
  if (runtimeEnv("VERCEL")) return null;
  return memoryStore();
}

export { LoginLimitUnavailable };

function attemptKey(request: Request) {
  const config = minutesAuthConfig();
  if (!config) throw new LoginLimitUnavailable();
  const ip = requestClientIp(request, { platform: Boolean(runtimeEnv("VERCEL")) });
  if (!ip) throw new LoginLimitUnavailable();
  return loginAttemptKey(ip, config.secret);
}

function attemptStore() {
  const store = storeForRuntime();
  if (!store) throw new LoginLimitUnavailable();
  return store;
}

export async function reserveLoginSlot(request: Request, now = Date.now()) {
  return reserveLoginAttempt(attemptStore(), attemptKey(request), now);
}

export async function settleLoginSlot(
  request: Request,
  reservation: LoginReservation,
  outcome: "failure" | "success",
  now = Date.now(),
) {
  await settleLoginAttempt(
    attemptStore(),
    attemptKey(request),
    reservation,
    outcome,
    now,
  );
}

function sweepMemory(now: number) {
  for (const [key, snapshot] of memory) {
    const start = snapshot.state?.windowStart;
    if (typeof start === "number" && now - start >= LOGIN_WINDOW_MS) memory.delete(key);
  }
}

async function readCursor() {
  const result = await get(RATE_CURSOR_PATH, {
    access: "private",
    useCache: false,
    ...(await blobAuth()),
  });
  if (!result || result.statusCode !== 200 || !result.stream) return undefined;
  try {
    const parsed = JSON.parse(await readStream(result.stream)) as { cursor?: unknown };
    return typeof parsed.cursor === "string" && parsed.cursor ? parsed.cursor : undefined;
  } catch {
    return undefined;
  }
}

async function writeCursor(cursor: string | undefined) {
  await put(RATE_CURSOR_PATH, JSON.stringify({ cursor: cursor ?? null }), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...(await blobAuth()),
  });
}

async function pruneBlobPage(now: number) {
  const cursor = await readCursor();
  const page = await list({
    prefix: RATE_LIMIT_PREFIX,
    limit: RATE_PRUNE_LIMIT,
    ...(cursor ? { cursor } : {}),
    ...(await blobAuth()),
  });
  const expired = new Set(
    selectExpiredRateCounters(
      page.blobs.map((blob) => ({
        pathname: blob.pathname,
        uploadedAtMs: blob.uploadedAt.getTime(),
      })),
      now,
    ).map((blob) => blob.pathname),
  );
  for (const blob of page.blobs) {
    if (!expired.has(blob.pathname) || !isRateCounterPath(blob.pathname) || !blob.etag?.trim()) {
      continue;
    }
    try {
      await del(blob.pathname, { ...(await blobAuth()), ifMatch: blob.etag });
    } catch (error) {
      if (isConflict(error) || error instanceof BlobNotFoundError) continue;
      throw error;
    }
  }
  await writeCursor(page.hasMore ? page.cursor : undefined);
}

export async function pruneExpiredRateLimits(now = Date.now()) {
  try {
    if (!storeForRuntime()) return;
    if (!blobConfigured()) {
      sweepMemory(now);
      return;
    }
    await pruneBlobPage(now);
  } catch {
    // Cleanup must not change the sign-in result.
  }
}

export function rateLimitEntryCountForTests() {
  return memory.size;
}

export function resetLoginLimitsForTests() {
  memory.clear();
}
