import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { isIdleExpired } from "@/lib/minutes-session";

export type MinutesRole = "view" | "admin";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export type MinutesAccess =
  | {
      state: "active";
      role: MinutesRole;
      lastActivity: number;
      absoluteExp: number;
    }
  | { state: "anonymous" }
  | { state: "expired" };

export type MinutesAuthConfig = {
  password: string;
  adminPassword: string;
  secret: string;
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

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
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
  if (value === "view" || value === "ok") return "view";
  return null;
}

function encodeSession(
  role: MinutesRole,
  absoluteExp: number,
  lastActivity: number,
  secret: string,
) {
  const payload = `${role}.${absoluteExp}.${lastActivity}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function createMinutesSession(role: MinutesRole, now = Date.now()) {
  const config = minutesAuthConfig();
  if (!config) return null;
  return encodeSession(role, now + SESSION_MS, now, config.secret);
}

export function refreshMinutesSession(
  role: MinutesRole,
  absoluteExp: number,
  now = Date.now(),
) {
  const config = minutesAuthConfig();
  if (!config || !Number.isFinite(absoluteExp)) return null;
  return encodeSession(role, absoluteExp, now, config.secret);
}

export function readMinutesSession(
  value: string | undefined,
  now = Date.now(),
): MinutesAccess {
  const config = minutesAuthConfig();
  if (!config || !value) return { state: "anonymous" };
  const lastDot = value.lastIndexOf(".");
  if (lastDot < 1) return { state: "anonymous" };
  const payload = value.slice(0, lastDot);
  const signature = value.slice(lastDot + 1);
  if (!safeEqual(signature, sign(payload, config.secret))) return { state: "anonymous" };

  const parts = payload.split(".");
  if (parts.length === 2) {
    const role = roleFrom(parts[0] ?? "");
    const exp = Number(parts[1]);
    if (!role || !Number.isFinite(exp) || now > exp) return { state: "anonymous" };
    return { state: "expired" };
  }
  if (parts.length !== 3) return { state: "anonymous" };

  const role = roleFrom(parts[0] ?? "");
  const absoluteExp = Number(parts[1]);
  const lastActivity = Number(parts[2]);
  if (!role || !Number.isFinite(absoluteExp) || !Number.isFinite(lastActivity)) {
    return { state: "anonymous" };
  }
  if (now > absoluteExp || isIdleExpired(lastActivity, now)) return { state: "expired" };
  return { state: "active", role, lastActivity, absoluteExp };
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
