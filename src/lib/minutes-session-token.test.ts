import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { MINUTES_IDLE_MS } from "@/lib/minutes-session";
import { createHash } from "node:crypto";
import {
  createMinutesSession,
  createSessionId,
  minutesAuthConfig,
  readMinutesSession,
  refreshMinutesSession,
  resolveMinutesRole,
  SESSION_MS,
} from "@/lib/minutes-session-token";

const VIEWER = "viewer-test-only";
const ADMIN = "admin-test-only";
const SECRET = "test-only-session-secret";

function sessionId() {
  const value = createSessionId();
  if (!value) throw new Error("Could not create a session id.");
  return value;
}
const ENV_NAMES = ["MINUTES_PASSWORD", "MINUTES_ADMIN_PASSWORD", "MINUTES_SECRET"] as const;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function withAuthEnv() {
  process.env.MINUTES_PASSWORD = VIEWER;
  process.env.MINUTES_ADMIN_PASSWORD = ADMIN;
  process.env.MINUTES_SECRET = SECRET;
}

describe("minutes auth configuration", () => {
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const name of ENV_NAMES) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
  });

  function rememberEnv() {
    for (const name of ENV_NAMES) previous.set(name, process.env[name]);
  }

  it("fails closed when any required variable is missing or blank", () => {
    rememberEnv();
    for (const name of ENV_NAMES) delete process.env[name];
    assert.equal(minutesAuthConfig(), null);
    assert.equal(resolveMinutesRole(VIEWER), null);
    assert.equal(resolveMinutesRole(ADMIN), null);
    assert.equal(createMinutesSession("view", sessionId()), null);
    assert.equal(readMinutesSession("view.1.1.forged").state, "anonymous");

    withAuthEnv();
    for (const name of ENV_NAMES) {
      process.env[name] = "   ";
      assert.equal(minutesAuthConfig(), null);
      assert.equal(resolveMinutesRole("   "), null);
      process.env[name] = name === "MINUTES_SECRET" ? SECRET : name === "MINUTES_PASSWORD" ? VIEWER : ADMIN;
    }

    delete process.env.MINUTES_SECRET;
    assert.equal(minutesAuthConfig(), null);
    assert.equal(createMinutesSession("admin", sessionId()), null);
  });

  it("keeps viewer access read-only and administrator access separate", () => {
    rememberEnv();
    withAuthEnv();
    assert.equal(resolveMinutesRole(VIEWER), "view");
    assert.equal(resolveMinutesRole(ADMIN), "admin");
    assert.equal(resolveMinutesRole(` ${VIEWER}`), null);
    assert.equal(resolveMinutesRole(""), null);
    assert.equal(resolveMinutesRole(1), null);
    assert.equal(resolveMinutesRole("not-a-password"), null);

    const now = 1_700_000_000_000;
    const viewerId = sessionId();
    const adminId = sessionId();
    const viewer = createMinutesSession("view", viewerId, now);
    const admin = createMinutesSession("admin", adminId, now);
    assert.equal(viewer?.split(".")[1], "view");
    assert.equal(admin?.split(".")[1], "admin");
    assert.equal(viewer?.includes(VIEWER), false);
    assert.equal(admin?.includes(ADMIN), false);
    assert.equal(viewer?.includes(createHash("sha256").update(VIEWER).digest("hex")), false);
    assert.deepEqual(readMinutesSession(viewer ?? "", now), {
      state: "active",
      role: "view",
      lastActivity: now,
      absoluteExp: now + SESSION_MS,
      sessionId: viewerId,
    });
    const adminAccess = readMinutesSession(admin ?? "", now);
    assert.equal(adminAccess.state, "active");
    if (adminAccess.state === "active") assert.equal(adminAccess.role, "admin");
  });

  it("rejects forged, resigned, idle, and absolute-expired sessions", () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const id = sessionId();
    const session = createMinutesSession("admin", id, now);
    assert.ok(session);

    assert.equal(readMinutesSession(`${session}x`, now).state, "anonymous");
    assert.equal(readMinutesSession("admin.1.1.not-a-signature", now).state, "anonymous");

    const payload = session.slice(0, session.lastIndexOf("."));
    const otherSecret = sign(payload, "different-test-secret");
    assert.equal(readMinutesSession(`${payload}.${otherSecret}`, now).state, "anonymous");

    const tampered = `view.${payload.slice(payload.indexOf(".") + 1)}.${session.slice(session.lastIndexOf(".") + 1)}`;
    assert.equal(readMinutesSession(tampered, now).state, "anonymous");

    const idle = readMinutesSession(session, now + MINUTES_IDLE_MS);
    assert.equal(idle.state, "expired");
    if (idle.state === "expired") assert.equal(idle.sessionId, id);
    const absolute = readMinutesSession(session, now + SESSION_MS + 1);
    assert.equal(absolute.state, "expired");
    if (absolute.state === "expired") assert.equal(absolute.sessionId, id);

    const legacyPayload = `view.${now + 60_000}`;
    const legacy = `${legacyPayload}.${sign(legacyPayload, SECRET)}`;
    assert.equal(readMinutesSession(legacy, now).state, "anonymous");
    assert.equal(
      readMinutesSession(`view.${now - 1}.${sign(`view.${now - 1}`, SECRET)}`, now).state,
      "anonymous",
    );
    assert.equal(readMinutesSession(`ok.${now + SESSION_MS}.${now}.${id}.${session.slice(session.lastIndexOf(".") + 1)}`, now).state, "anonymous");
  });

  it("refreshes activity without extending the absolute session", () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const id = sessionId();
    const session = createMinutesSession("view", id, now);
    assert.ok(session);
    const access = readMinutesSession(session, now);
    assert.equal(access.state, "active");
    if (access.state !== "active") return;

    const refreshed = refreshMinutesSession(access.role, access.absoluteExp, access.sessionId, now + 5_000);
    assert.ok(refreshed);
    const next = readMinutesSession(refreshed ?? "", now + 5_000);
    assert.deepEqual(next, {
      state: "active",
      role: "view",
      lastActivity: now + 5_000,
      absoluteExp: access.absoluteExp,
      sessionId: id,
    });
    assert.equal(
      refreshMinutesSession(access.role, now + 5_000 + SESSION_MS + 1, id, now + 5_000),
      null,
    );

    delete process.env.MINUTES_SECRET;
    assert.equal(refreshMinutesSession("view", access.absoluteExp, id, now + 5_000), null);
  });

  it("invalidates only the role whose password changed", () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const viewer = createMinutesSession("view", sessionId(), now);
    const admin = createMinutesSession("admin", sessionId(), now);
    assert.equal(readMinutesSession(viewer ?? "", now).state, "active");
    assert.equal(readMinutesSession(admin ?? "", now).state, "active");

    process.env.MINUTES_PASSWORD = "rotated-viewer-test-only";
    assert.equal(readMinutesSession(viewer ?? "", now).state, "anonymous");
    assert.equal(readMinutesSession(admin ?? "", now).state, "active");

    process.env.MINUTES_PASSWORD = VIEWER;
    process.env.MINUTES_ADMIN_PASSWORD = "rotated-admin-test-only";
    assert.equal(readMinutesSession(viewer ?? "", now).state, "active");
    assert.equal(readMinutesSession(admin ?? "", now).state, "anonymous");
  });

  it("does not keep published password fallbacks in the auth source", () => {
    const root = path.resolve(import.meta.dirname, "../..");
    const files = [
      "src/lib/minutes-auth.ts",
      "src/lib/minutes-session-token.ts",
      "src/lib/minutes-login-limit.ts",
      "src/app/api/minutes/auth/route.ts",
      "src/lib/minutes-session-store.ts",
    ];
    for (const file of files) {
      const source = readFileSync(path.join(root, file), "utf8");
      assert.equal(source.includes("DEFAULT_PASSWORD"), false, file);
      assert.equal(source.includes("DEFAULT_ADMIN_PASSWORD"), false, file);
      assert.equal(source.includes("ym-minutes:"), false, file);
    }
  });
});
