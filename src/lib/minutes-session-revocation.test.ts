import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { MINUTES_IDLE_MS } from "@/lib/minutes-session";
import {
  createMemorySessionRegistry,
  isSessionBlobPath,
  issueStoredSession,
  resolveStoredSession,
  revokePresentedSession,
  selectExpiredSessionPaths,
  sessionBlobPath,
  SESSION_PREFIX,
  SESSION_RETENTION_MS,
  type SessionRead,
  type SessionRecord,
  type SessionRegistry,
} from "@/lib/minutes-session-store";
import {
  createSessionId,
  readMinutesSession,
  refreshMinutesSession,
  SESSION_MS,
} from "@/lib/minutes-session-token";

const ENV_NAMES = ["MINUTES_PASSWORD", "MINUTES_ADMIN_PASSWORD", "MINUTES_SECRET"] as const;

function withAuthEnv() {
  process.env.MINUTES_PASSWORD = "viewer-test-only";
  process.env.MINUTES_ADMIN_PASSWORD = "admin-test-only";
  process.env.MINUTES_SECRET = "test-only-session-secret";
}

function unavailableRegistry(inner: SessionRegistry, failing: "read" | "delete"): SessionRegistry {
  return {
    read: (sessionId) =>
      failing === "read" ? Promise.resolve({ state: "unavailable" }) : inner.read(sessionId),
    write: (sessionId, record) => inner.write(sessionId, record),
    delete: (sessionId) =>
      failing === "delete" ? Promise.resolve("unavailable") : inner.delete(sessionId),
  };
}

describe("minutes session revocation", () => {
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

  it("keeps view and admin sessions separate until logout", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const registry = createMemorySessionRegistry();
    const viewer = await issueStoredSession("view", registry, now);
    const admin = await issueStoredSession("admin", registry, now);
    assert.ok(viewer);
    assert.ok(admin);

    const viewerAccess = await resolveStoredSession(viewer, registry, now);
    const adminAccess = await resolveStoredSession(admin, registry, now);
    assert.equal(viewerAccess.state, "active");
    assert.equal(adminAccess.state, "active");
    if (viewerAccess.state !== "active" || adminAccess.state !== "active") return;
    assert.equal(viewerAccess.role, "view");
    assert.equal(adminAccess.role, "admin");
    assert.equal(viewerAccess.absoluteExp, now + SESSION_MS);
    assert.equal(adminAccess.absoluteExp, now + SESSION_MS);

    assert.equal(await revokePresentedSession(viewer, registry), "ok");
    assert.equal((await resolveStoredSession(viewer, registry, now)).state, "anonymous");
    assert.equal((await resolveStoredSession(admin, registry, now)).state, "active");
    assert.equal(await revokePresentedSession(viewer, registry), "ok");
    assert.equal((await resolveStoredSession(viewer, registry, now)).state, "anonymous");
  });

  it("rejects a copied session after logout and keeps idle and absolute limits", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const registry = createMemorySessionRegistry();
    const token = await issueStoredSession("view", registry, now);
    assert.ok(token);
    const copy = token.slice();
    const current = readMinutesSession(token, now);
    assert.equal(current.state, "active");
    if (current.state !== "active") return;
    const refreshed = refreshMinutesSession(
      "view",
      current.absoluteExp,
      current.sessionId,
      now + 60_000,
    );
    assert.ok(refreshed);
    assert.equal((await resolveStoredSession(refreshed, registry, now + 60_000)).state, "active");

    assert.equal(await revokePresentedSession(token, registry), "ok");
    assert.equal((await resolveStoredSession(copy, registry, now)).state, "anonymous");
    assert.equal((await resolveStoredSession(refreshed, registry, now + 60_000)).state, "anonymous");

    const replacement = await issueStoredSession("admin", registry, now);
    assert.ok(replacement);
    const idle = await resolveStoredSession(replacement, registry, now + MINUTES_IDLE_MS);
    assert.equal(idle.state, "expired");
    assert.equal((await resolveStoredSession(replacement, registry, now + 1_000)).state, "anonymous");

    const durable = await issueStoredSession("view", registry, now);
    assert.ok(durable);
    const absolute = await resolveStoredSession(durable, registry, now + SESSION_MS + 1);
    assert.equal(absolute.state, "expired");
    assert.equal(await revokePresentedSession("not-a-session", registry), "ok");
    assert.equal((await resolveStoredSession(durable, registry, now)).state, "anonymous");
  });

  it("fails closed when session storage cannot be read or revoked", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const registry = createMemorySessionRegistry();
    const token = await issueStoredSession("admin", registry, now);
    assert.ok(token);

    const unreadable = unavailableRegistry(registry, "read");
    assert.equal((await resolveStoredSession(token, unreadable, now)).state, "unavailable");
    assert.equal((await resolveStoredSession(token, registry, now)).state, "active");

    const stuck = unavailableRegistry(registry, "delete");
    assert.equal(await revokePresentedSession(token, stuck), "unavailable");
    assert.equal((await resolveStoredSession(token, registry, now)).state, "active");

    assert.equal(await revokePresentedSession(token, registry), "ok");
    assert.equal((await resolveStoredSession(token, unreadable, now)).state, "unavailable");
    assert.equal((await resolveStoredSession(token, registry, now)).state, "anonymous");
  });

  it("does not revoke a live session when a forged cookie is presented", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const registry = createMemorySessionRegistry();
    const token = await issueStoredSession("view", registry, now);
    assert.ok(token);
    const forged = `${token.slice(0, token.lastIndexOf("."))}.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
    assert.equal((await resolveStoredSession(forged, registry, now)).state, "anonymous");
    assert.equal(await revokePresentedSession(forged, registry), "ok");
    assert.equal((await resolveStoredSession(token, registry, now)).state, "active");
  });

  it("drops existing sessions when that role password changes", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const registry = createMemorySessionRegistry();
    const viewer = await issueStoredSession("view", registry, now);
    const admin = await issueStoredSession("admin", registry, now);
    assert.ok(viewer);
    assert.ok(admin);

    process.env.MINUTES_PASSWORD = "rotated-viewer-test-only";
    assert.equal((await resolveStoredSession(viewer, registry, now)).state, "anonymous");
    assert.equal((await resolveStoredSession(admin, registry, now)).state, "active");
  });

  it("rejects a record whose role or expiry does not match the cookie", async () => {
    rememberEnv();
    withAuthEnv();
    const now = 1_700_000_000_000;
    const token = await issueStoredSession("view", createMemorySessionRegistry(), now);
    assert.ok(token);
    const access = readMinutesSession(token, now);
    assert.equal(access.state, "active");
    if (access.state !== "active") return;

    const mismatched: SessionRegistry = {
      async read(): Promise<SessionRead> {
        const record: SessionRecord = { role: "admin", absoluteExp: access.absoluteExp };
        return { state: "present", record };
      },
      async write() {
        return "ok";
      },
      async delete() {
        return "ok";
      },
    };
    assert.equal((await resolveStoredSession(token, mismatched, now)).state, "anonymous");
  });

  it("stores session ids outside the cookie path and ignores document blobs", () => {
    const sessionId = createSessionId();
    assert.ok(sessionId);
    const path = sessionBlobPath(sessionId ?? "");
    assert.ok(path);
    assert.equal(path?.startsWith(SESSION_PREFIX), true);
    assert.equal(path?.endsWith(".json"), true);
    assert.equal(path?.includes(sessionId ?? "missing"), false);
    assert.equal(
      path,
      `${SESSION_PREFIX}${createHash("sha256").update(sessionId ?? "").digest("hex")}.json`,
    );
    assert.equal(isSessionBlobPath("minutes/notes.pdf"), false);
    assert.equal(isSessionBlobPath("media-library/catalog.json"), false);
    assert.equal(isSessionBlobPath("media-library/covers/photo.jpg"), false);
    assert.equal(isSessionBlobPath("auth-rate/v1/cursor.json"), false);
    assert.equal(isSessionBlobPath(`${SESSION_PREFIX}cursor.json`), false);

    const now = 1_700_000_000_000;
    const selected = selectExpiredSessionPaths(
      [
        { pathname: path ?? "", uploadedAtMs: now - SESSION_RETENTION_MS },
        { pathname: path ?? "", uploadedAtMs: now - SESSION_MS },
        { pathname: "minutes/notes.pdf", uploadedAtMs: now - SESSION_RETENTION_MS },
        { pathname: "media-library/catalog.json", uploadedAtMs: now - SESSION_RETENTION_MS },
        { pathname: `${SESSION_PREFIX}cursor.json`, uploadedAtMs: now - SESSION_RETENTION_MS },
      ],
      now,
    );
    assert.deepEqual(selected.map((blob) => blob.pathname), [path]);
  });
});
