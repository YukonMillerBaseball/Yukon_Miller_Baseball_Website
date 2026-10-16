import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isIdleExpired } from "@/lib/minutes-session";

export type MinutesRole = "view" | "admin";

export const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const SESSION_VERSION = "2";

export type MinutesAccess =
  | {
      state: "active";
      role: MinutesRole;
      lastActivity: number;
      absoluteExp: number;
      sessionId: string;
    }
  | { state: "anonymous" }
  | { state: "expired"; sessionId: string | null }
  | { state: "unavailable" };

export type MinutesAuthConfig = {
  password: string;
  adminPassword: string;
  secret: string;
};

type SessionClaims = {
  role: MinutesRole;
  lastActivity: number;
  absoluteExp: number;
  sessionId: string;
};

function envValue(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function minutesAuthConfig(): MinutesAuthConfig | null {
  const password = envValue("MINUTES_PASSWORD");
  const adminPassword = envValue("MINUTES_ADMIN_PASSWORD");
  const secret = envValue("MINUTES_SECRET");
  if (!password || !adminPassword || !secret) return null;
  return { password, adminPassword, secret };
}

function passwordForRole(config: MinutesAuthConfig, role: MinutesRole) {
  return role === "admin" ? config.adminPassword : config.password;
}

/**
 * Mix the current role password into the signing key. The fingerprint stays on
 * the server, so a password change invalidates old signatures without putting
 * a password or password hash in the cookie.
 */
function signingKey(config: MinutesAuthConfig, role: MinutesRole) {
  const fingerprint = createHash("sha256")
    .update("minutes-password-v1")
    .update("\0")
    .update(role)
    .update("\0")
    .update(passwordForRole(config, role))
    .digest();
  return createHmac("sha256", config.secret).update(fingerprint).digest();
}

function sign(payload: string, config: MinutesAuthConfig, role: MinutesRole) {
  return createHmac("sha256", signingKey(config, role)).update(payload).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(right, right);
    return false;
  }
  return timingSafeEqual(left, right);
}

function passwordMatches(input: string, expected: string) {
  return safeEqual(input.normalize("NFC"), expected.normalize("NFC"));
}

function roleFrom(value: string): MinutesRole | null {
  if (value === "admin") return "admin";
  if (value === "view") return "view";
  return null;
}

export function createSessionId() {
  const sessionId = randomBytes(32).toString("base64url");
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;
  return sessionId;
}

function encodeSession(
  role: MinutesRole,
  absoluteExp: number,
  lastActivity: number,
  sessionId: string,
  config: MinutesAuthConfig,
) {
  const payload = `${SESSION_VERSION}.${role}.${absoluteExp}.${lastActivity}.${sessionId}`;
  return `${payload}.${sign(payload, config, role)}`;
}

function readClaims(value: string | undefined): SessionClaims | null {
  const config = minutesAuthConfig();
  if (!config || !value) return null;
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 1) return null;
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  const parts = payload.split(".");
  if (parts.length !== 5 || parts[0] !== SESSION_VERSION) return null;

  const role = roleFrom(parts[1] ?? "");
  const absoluteExp = Number(parts[2]);
  const lastActivity = Number(parts[3]);
  const sessionId = parts[4] ?? "";
  if (!role || !Number.isInteger(absoluteExp) || !Number.isInteger(lastActivity)) return null;
  if (!SESSION_ID_PATTERN.test(sessionId)) return null;
  if (absoluteExp - lastActivity > SESSION_MS) return null;
  if (!safeEqual(signature, sign(payload, config, role))) return null;
  return { role, absoluteExp, lastActivity, sessionId };
}

export function createMinutesSession(
  role: MinutesRole,
  sessionId: string,
  now = Date.now(),
) {
  const config = minutesAuthConfig();
  if (!config || !SESSION_ID_PATTERN.test(sessionId)) return null;
  return encodeSession(role, now + SESSION_MS, now, sessionId, config);
}

export function refreshMinutesSession(
  role: MinutesRole,
  absoluteExp: number,
  sessionId: string,
  now = Date.now(),
) {
  const config = minutesAuthConfig();
  if (!config || !SESSION_ID_PATTERN.test(sessionId) || !Number.isInteger(absoluteExp)) {
    return null;
  }
  if (now > absoluteExp || absoluteExp - now > SESSION_MS) return null;
  return encodeSession(role, absoluteExp, now, sessionId, config);
}

export function readMinutesSessionIdentity(value: string | undefined) {
  const claims = readClaims(value);
  if (!claims) return null;
  return {
    sessionId: claims.sessionId,
    role: claims.role,
    absoluteExp: claims.absoluteExp,
  };
}

export function readMinutesSession(
  value: string | undefined,
  now = Date.now(),
): MinutesAccess {
  const claims = readClaims(value);
  if (!claims) return { state: "anonymous" };
  if (now > claims.absoluteExp || isIdleExpired(claims.lastActivity, now)) {
    return { state: "expired", sessionId: claims.sessionId };
  }
  return { state: "active", ...claims };
}

export function resolveMinutesRole(input: unknown): MinutesRole | null {
  const config = minutesAuthConfig();
  if (!config || typeof input !== "string" || input.length === 0) return null;
  const admin = passwordMatches(input, config.adminPassword);
  const view = passwordMatches(input, config.password);
  if (admin) return "admin";
  if (view) return "view";
  return null;
}
