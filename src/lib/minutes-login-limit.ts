import "server-only";

import {
  BlobNotFoundError,
  BlobPreconditionFailedError,
  del,
  get,
  put,
} from "@vercel/blob";
import {
  LoginLimitUnavailable,
  clearLoginLimit,
  loginAttemptKey,
  noteLoginFailure,
  readLoginLimit,
  requestClientIp,
  type LoginAttemptSnapshot,
  type LoginAttemptState,
  type LoginAttemptStore,
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
  return `auth-rate/v1/${key}.json`;
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
  let parsed: { failures?: unknown; windowStart?: unknown };
  try {
    parsed = JSON.parse(value) as { failures?: unknown; windowStart?: unknown };
  } catch {
    throw new LoginLimitUnavailable();
  }
  if (
    typeof parsed.failures !== "number" ||
    !Number.isInteger(parsed.failures) ||
    parsed.failures < 1 ||
    typeof parsed.windowStart !== "number" ||
    !Number.isFinite(parsed.windowStart)
  ) {
    throw new LoginLimitUnavailable();
  }
  return { failures: parsed.failures, windowStart: parsed.windowStart };
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
  return loginAttemptKey(requestClientIp(request), config.secret);
}

export async function assertLoginAllowed(request: Request, now = Date.now()) {
  const store = storeForRuntime();
  if (!store) throw new LoginLimitUnavailable();
  return readLoginLimit(store, attemptKey(request), now);
}

export async function recordLoginFailure(request: Request, now = Date.now()) {
  const store = storeForRuntime();
  if (!store) throw new LoginLimitUnavailable();
  return noteLoginFailure(store, attemptKey(request), now);
}

export async function clearLoginFailures(request: Request) {
  const store = storeForRuntime();
  if (!store) return;
  try {
    await clearLoginLimit(store, attemptKey(request));
  } catch {
    // The password was accepted. A missed reset only keeps this visitor's own counter.
  }
}

export function resetLoginLimitsForTests() {
  memory.clear();
}
