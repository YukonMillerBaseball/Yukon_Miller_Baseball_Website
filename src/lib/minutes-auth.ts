import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_IDLE_MS } from "@/lib/minutes-session";
import {
  issueStoredSession,
  pruneExpiredSessions,
  resolveStoredSession,
  revokePresentedSession,
  sessionRegistry,
} from "@/lib/minutes-session-store";
import {
  minutesAuthConfig,
  readMinutesSession,
  refreshMinutesSession,
  resolveMinutesRole,
  type MinutesAccess,
  type MinutesRole,
} from "@/lib/minutes-session-token";

export const MINUTES_COOKIE = "ym_minutes";
export const PRIVATE_NO_STORE = "private, no-store";
export type { MinutesAccess, MinutesRole };
export { minutesAuthConfig, pruneExpiredSessions, readMinutesSession, resolveMinutesRole };

export function privateJson(
  body: unknown,
  init?: { status?: number; headers?: HeadersInit },
) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
}

export function privateNoStore<T extends Response>(response: T) {
  response.headers.set("Cache-Control", PRIVATE_NO_STORE);
  return response;
}

/** Signature check only. Access control must go through minutesAccess. */
export function minutesRoleFromSession(
  value: string | undefined,
  now = Date.now(),
): MinutesRole | null {
  const access = readMinutesSession(value, now);
  return access.state === "active" ? access.role : null;
}

export function minutesCookieOptions(maxAgeSeconds = MINUTES_IDLE_MS / 1000) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

async function cookieValue() {
  const jar = await cookies();
  return jar.get(MINUTES_COOKIE)?.value;
}

export async function minutesAccess(now = Date.now()) {
  const token = await cookieValue();
  const access = await resolveStoredSession(token, sessionRegistry(), now);
  if (access.state === "unavailable") return access;
  if (token && access.state !== "active") await clearMinutesCookie();
  return access;
}

export async function issueMinutesSession(role: MinutesRole, now = Date.now()) {
  return issueStoredSession(role, sessionRegistry(), now);
}

export async function revokeMinutesSession() {
  const revoked = await revokePresentedSession(await cookieValue(), sessionRegistry());
  if (revoked !== "ok") return "unavailable" as const;
  await clearMinutesCookie();
  return "ok" as const;
}

export async function clearMinutesCookie() {
  const jar = await cookies();
  jar.set(MINUTES_COOKIE, "", { ...minutesCookieOptions(0), maxAge: 0 });
}

export async function recordMinutesActivity(now = Date.now()) {
  const access = await minutesAccess(now);
  if (access.state !== "active") return access;
  const remainingMs = access.absoluteExp - now;
  if (remainingMs <= 0) return { state: "expired", sessionId: access.sessionId } as const;
  const session = refreshMinutesSession(
    access.role,
    access.absoluteExp,
    access.sessionId,
    now,
  );
  if (!session) return { state: "anonymous" } as const;
  const jar = await cookies();
  jar.set(
    MINUTES_COOKIE,
    session,
    minutesCookieOptions(Math.min(MINUTES_IDLE_MS, remainingMs) / 1000),
  );
  return {
    state: "active" as const,
    role: access.role,
    lastActivity: now,
    absoluteExp: access.absoluteExp,
    sessionId: access.sessionId,
  };
}

export function minutesDeniedResponse(access: MinutesAccess) {
  if (access.state === "unavailable") {
    return privateJson({ error: "Sign-in is unavailable." }, { status: 503 });
  }
  if (access.state === "expired") {
    return privateJson(
      { error: MINUTES_EXPIRED_MESSAGE, expired: true },
      { status: 401 },
    );
  }
  return privateJson({ error: "Sign in required." }, { status: 401 });
}

export async function requireMinutes(options?: {
  touch?: boolean;
  admin?: boolean;
  adminError?: string;
}) {
  let access = await minutesAccess();
  if (access.state !== "active") {
    return { access, response: minutesDeniedResponse(access) };
  }
  if (options?.admin && access.role !== "admin") {
    return {
      access,
      response: privateJson(
        { error: options.adminError ?? "Admin sign-in required." },
        { status: 403 },
      ),
    };
  }
  if (options?.touch) {
    const refreshed = await recordMinutesActivity();
    if (refreshed.state !== "active") {
      return { access: refreshed, response: minutesDeniedResponse(refreshed) };
    }
    access = refreshed;
  }
  return { access, response: null };
}

export async function minutesRole() {
  const access = await minutesAccess();
  return access.state === "active" ? access.role : null;
}

export async function minutesAuthed() {
  return (await minutesRole()) !== null;
}

export async function minutesAdmin() {
  return (await minutesRole()) === "admin";
}
