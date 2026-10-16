import { createHash } from "crypto";

export const LOGIN_FAILURE_LIMIT = 20;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
// One compare-and-swap round commits a single reservation. A parallel burst
// needs enough retries to observe the cap instead of stopping early.
export const LOGIN_WRITE_ATTEMPTS = 64;
export const RATE_LIMIT_PREFIX = "auth-rate/v1/";
export const RATE_CURSOR_PATH = "auth-rate/v1/cursor.json";
export const RATE_PRUNE_LIMIT = 20;
export const RATE_RETENTION_MS = LOGIN_WINDOW_MS + 60 * 1000;

const RATE_COUNTER_PATH = /^auth-rate\/v1\/[0-9a-f]{64}\.json$/;

export type LoginAttemptState = {
  failures: number;
  pending: number;
  windowStart: number;
};

export type LoginReservation = {
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

function firstAddress(value: string | null) {
  if (!value) return null;
  const first = value.slice(0, 200).split(",")[0]?.trim() ?? "";
  if (!first || first.length > 45) return null;
  if (!/^[0-9A-Fa-f:.]+$/.test(first)) return null;
  if (!first.includes(".") && !first.includes(":")) return null;
  return first;
}

// On Vercel, x-vercel-forwarded-for is the platform client address. It matches
// the overwritten x-forwarded-for value and is not taken from a visitor header.
// Off Vercel, local development keeps the direct address headers.
export function requestClientIp(
  request: Request,
  options?: { platform?: boolean },
) {
  if (options?.platform) {
    return firstAddress(request.headers.get("x-vercel-forwarded-for"));
  }
  return (
    firstAddress(request.headers.get("x-real-ip")) ??
    firstAddress(request.headers.get("x-forwarded-for")) ??
    "unknown"
  );
}

function activeAttempt(state: LoginAttemptState | null, now: number) {
  if (!state || now - state.windowStart >= LOGIN_WINDOW_MS) return null;
  return state;
}

export function loginLimitStatus(
  state: LoginAttemptState | null,
  now: number,
): LoginLimitStatus {
  const active = activeAttempt(state, now);
  if (!active || active.failures + active.pending < LOGIN_FAILURE_LIMIT) {
    return { limited: false, retryAfterSeconds: 0 };
  }
  return {
    limited: true,
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((active.windowStart + LOGIN_WINDOW_MS - now) / 1000),
    ),
  };
}

export function nextLoginFailure(
  state: LoginAttemptState | null,
  now: number,
): LoginAttemptState {
  const active = activeAttempt(state, now);
  if (!active) return { failures: 1, pending: 0, windowStart: now };
  return {
    failures: active.failures + 1,
    pending: active.pending,
    windowStart: active.windowStart,
  };
}

export function nextPendingReservation(
  state: LoginAttemptState | null,
  now: number,
): LoginAttemptState {
  const active = activeAttempt(state, now);
  if (!active) return { failures: 0, pending: 1, windowStart: now };
  return {
    failures: active.failures,
    pending: active.pending + 1,
    windowStart: active.windowStart,
  };
}

export function nextSettledAttempt(
  state: LoginAttemptState,
  outcome: "failure" | "success",
): LoginAttemptState | null {
  if (state.pending < 1) return state;
  const pending = state.pending - 1;
  const failures = outcome === "failure" ? state.failures + 1 : state.failures;
  if (failures === 0 && pending === 0) return null;
  return { failures, pending, windowStart: state.windowStart };
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
    if (status.limited) return { ...status, reservation: null };
    const next = nextPendingReservation(current.state, now);
    const result = await store.write(key, next, current.version);
    if (result === "ok") {
      return {
        limited: false,
        retryAfterSeconds: 0,
        reservation: { windowStart: next.windowStart } satisfies LoginReservation,
      };
    }
  }
  throw new LoginLimitUnavailable();
}

// Convert one in-flight reservation into a recorded failure, or release it
// after a successful password check. A success never decreases `failures`.
// The compare-and-swap retries so parallel requests cannot pass the cap.
export async function settleLoginAttempt(
  store: LoginAttemptStore,
  key: string,
  reservation: LoginReservation,
  outcome: "failure" | "success",
  now: number,
) {
  for (let attempt = 0; attempt < LOGIN_WRITE_ATTEMPTS; attempt += 1) {
    const current = await store.read(key);
    const state = current.state;
    if (
      !state ||
      state.windowStart !== reservation.windowStart ||
      now - state.windowStart >= LOGIN_WINDOW_MS ||
      state.pending < 1
    ) {
      return;
    }
    const next = nextSettledAttempt(state, outcome);
    if (next !== null && next.failures < state.failures) return;
    const result = await store.write(key, next, current.version);
    if (result === "ok") return;
  }
  throw new LoginLimitUnavailable();
}

// Removes one visitor counter. Sign-in must not call this after a correct password.
export async function clearLoginLimit(store: LoginAttemptStore, key: string) {
  for (let attempt = 0; attempt < LOGIN_WRITE_ATTEMPTS; attempt += 1) {
    const current = await store.read(key);
    if (!current.state) return;
    const result = await store.write(key, null, current.version);
    if (result === "ok") return;
  }
}
