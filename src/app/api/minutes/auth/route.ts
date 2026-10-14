import {
  clearMinutesCookie,
  createMinutesSession,
  MINUTES_COOKIE,
  minutesAccess,
  minutesAuthConfig,
  minutesCookieOptions,
  privateJson,
  resolveMinutesRole,
} from "@/lib/minutes-auth";
import {
  LoginLimitUnavailable,
  pruneExpiredRateLimits,
  reserveLoginSlot,
} from "@/lib/minutes-login-limit";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_IDLE_MS } from "@/lib/minutes-session";
import { cookies } from "next/headers";
import { after } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return privateJson({ error: "Sign-in is unavailable." }, { status: 503 });
}

function tooMany(retryAfterSeconds: number) {
  const response = privateJson(
    { error: "Too many attempts. Try again later." },
    { status: 429 },
  );
  response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

export async function GET() {
  const access = await minutesAccess();
  if (access.state === "expired") {
    await clearMinutesCookie();
    return privateJson(
      { ok: false, admin: false, expired: true, error: MINUTES_EXPIRED_MESSAGE },
      { status: 401 },
    );
  }
  if (access.state !== "active") {
    return privateJson({ ok: false, admin: false });
  }
  return privateJson({
    ok: true,
    admin: access.role === "admin",
    lastActivity: access.lastActivity,
  });
}

export async function POST(request: Request) {
  let password: unknown;
  try {
    const body = (await request.json()) as { password?: unknown };
    password = body.password;
  } catch {
    return privateJson({ error: "Password required." }, { status: 400 });
  }

  if (!minutesAuthConfig()) return unavailable();
  after(() => pruneExpiredRateLimits());

  let slot;
  try {
    slot = await reserveLoginSlot(request);
  } catch (error) {
    if (error instanceof LoginLimitUnavailable) return unavailable();
    throw error;
  }
  if (slot.limited) return tooMany(slot.retryAfterSeconds);

  const role = resolveMinutesRole(password);
  if (!role) {
    return privateJson({ error: "Wrong password." }, { status: 401 });
  }

  const session = createMinutesSession(role);
  if (!session) return unavailable();

  const jar = await cookies();
  jar.set(MINUTES_COOKIE, session, minutesCookieOptions(MINUTES_IDLE_MS / 1000));
  return privateJson({ ok: true, admin: role === "admin" });
}

export async function DELETE() {
  await clearMinutesCookie();
  return privateJson({ ok: true });
}
