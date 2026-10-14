import { createHash } from "crypto";

export const LOGIN_FAILURE_LIMIT = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// One compare-and-swap round commits a single reservation. A parallel burst
// needs enough retries to observe the cap instead of stopping early.
export const LOGIN_WRITE_ATTEMPTS = 24;
export const RATE_LIMIT_PREFIX = "auth-rate/v1/";
export const RATE_CURSOR_PATH = "auth-rate/v1/cursor.json";
export const RATE_PRUNE_LIMIT = 20;
export const RATE_RETENTION_MS = LOGIN_WINDOW_MS + 60 * 1000;

const RATE_COUNTER_PATH = /^auth-rate\/v1\/[0-9a-f]{64}\.json$/;

export type LoginAttemptState = {
  failures: number;
  windowStart: number;
};

export type LoginLimitStatus = {
  limited: boolean;
  retryAfterSeconds: number;
};

export type LoginAttemptSnapshot = {
  state: LoginAttemptState | null;
  version: string | null;
};

export type LoginAttemptStore = {
  read(key: string): Promise<LoginAttemptSnapshot>;
  write(
    key: string,
    state: LoginAttemptState | null,
    version: string | null,
  ): Promise<"ok" | "conflict">;
};

export class LoginLimitUnavailable extends Error {
  constructor() {
    super("Sign-in is unavailable.");
    this.name = "LoginLimitUnavailable";
  }
}

export function loginAttemptKey(ip: string, secret: string) {
  return createHash("sha256").update(`minutes-login:${secret}:${ip}`).digest("hex");
}

export function requestClientIp(request: Request) {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

export function loginLimitStatus(
  state: LoginAttemptState | null,
  now: number,
): LoginLimitStatus {
  if (!state || now - state.windowStart >= LOGIN_WINDOW_MS) {
    return { limited: false, retryAfterSeconds: 0 };
  }
  if (state.failures < LOGIN_FAILURE_LIMIT) {
    return { limited: false, retryAfterSeconds: 0 };
  }
  return {
    limited: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((state.windowStart + LOGIN_WINDOW_MS - now) / 1000),
    ),
  };
}

export function nextLoginFailure(
  state: LoginAttemptState | null,
  now: number,
): LoginAttemptState {
  if (!state || now - state.windowStart >= LOGIN_WINDOW_MS) {
    return { failures: 1, windowStart: now };
  }
  return { failures: state.failures + 1, windowStart: state.windowStart };
}

export async function readLoginLimit(
  store: LoginAttemptStore,
  key: string,
  now: number,
) {
  const current = await store.read(key);
  return loginLimitStatus(current.state, now);
}

export function isRateCounterPath(pathname: string) {
  return RATE_COUNTER_PATH.test(pathname);
}

export function selectExpiredRateCounters(
  blobs: { pathname: string; uploadedAtMs: number }[],
  now: number,
) {
  return blobs.filter(
    (blob) =>
      isRateCounterPath(blob.pathname) &&
      Number.isFinite(blob.uploadedAtMs) &&
      now - blob.uploadedAtMs >= RATE_RETENTION_MS,
  );
}

export async function reserveLoginAttempt(
  store: LoginAttemptStore,
  key: string,
  now: number,
) {
  for (let attempt = 0; attempt < LOGIN_WRITE_ATTEMPTS; attempt += 1) {
    const current = await store.read(key);
    const status = loginLimitStatus(current.state, now);
    if (status.limited) return status;
    const next = nextLoginFailure(current.state, now);
    const result = await store.write(key, next, current.version);
    if (result === "ok") return { limited: false, retryAfterSeconds: 0 };
  }
  throw new LoginLimitUnavailable();
}

export async function clearLoginLimit(store: LoginAttemptStore, key: string) {
  for (let attempt = 0; attempt < LOGIN_WRITE_ATTEMPTS; attempt += 1) {
    const current = await store.read(key);
    if (!current.state) return;
    const result = await store.write(key, null, current.version);
    if (result === "ok") return;
  }
}
