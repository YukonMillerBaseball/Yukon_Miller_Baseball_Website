import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_WINDOW_MS,
  LOGIN_WRITE_ATTEMPTS,
  LoginLimitUnavailable,
  clearLoginLimit,
  loginAttemptKey,
  loginLimitStatus,
  nextLoginFailure,
  noteLoginFailure,
  readLoginLimit,
  requestClientIp,
  type LoginAttemptSnapshot,
  type LoginAttemptState,
  type LoginAttemptStore,
} from "@/lib/minutes-login-policy";
import {
  assertLoginAllowed,
  classifyBlobRead,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginLimitsForTests,
} from "@/lib/minutes-login-limit";

function memoryStore() {
  const records = new Map<string, LoginAttemptSnapshot>();
  const store: LoginAttemptStore = {
    async read(key) {
      return records.get(key) ?? { state: null, version: null };
    },
    async write(key, state, version) {
      const current = records.get(key) ?? { state: null, version: null };
      if ((current.version ?? null) !== (version ?? null)) return "conflict";
      if (state === null) {
        records.delete(key);
        return "ok";
      }
      records.set(key, {
        state,
        version: String(Number(current.version ?? "0") + 1),
      });
      return "ok";
    },
  };
  return store;
}

function conflictingStore(conflicts: number): LoginAttemptStore {
  let state: LoginAttemptState | null = null;
  let version: string | null = null;
  let remaining = conflicts;
  return {
    async read() {
      return { state, version };
    },
    async write(_key, next, expected) {
      if ((version ?? null) !== (expected ?? null)) return "conflict";
      if (remaining > 0) {
        remaining -= 1;
        return "conflict";
      }
      if (next === null) {
        state = null;
        version = null;
        return "ok";
      }
      state = next;
      version = String(Number(version ?? "0") + 1);
      return "ok";
    },
  };
}

describe("login rate limit policy", () => {
  const previous = new Map<string, string | undefined>();
  const names = [
    "MINUTES_PASSWORD",
    "MINUTES_ADMIN_PASSWORD",
    "MINUTES_SECRET",
    "BLOB_READ_WRITE_TOKEN",
    "BLOB_STORE_ID",
    "VERCEL",
  ];

  afterEach(() => {
    for (const name of names) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    previous.clear();
    resetLoginLimitsForTests();
  });

  function rememberEnv() {
    for (const name of names) previous.set(name, process.env[name]);
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.BLOB_STORE_ID;
    delete process.env.VERCEL;
    process.env.MINUTES_PASSWORD = "viewer-test-only";
    process.env.MINUTES_ADMIN_PASSWORD = "admin-test-only";
    process.env.MINUTES_SECRET = "test-only-session-secret";
  }

  it("limits one visitor without locking a different visitor", async () => {
    const now = 1_700_000_000_000;
    const store = memoryStore();
    const first = loginAttemptKey("203.0.113.10", "test-only-session-secret");
    const second = loginAttemptKey("203.0.113.11", "test-only-session-secret");
    assert.equal(first.length, 64);
    assert.notEqual(first, second);
    assert.equal(first.includes("203.0.113.10"), false);
    assert.equal(first.includes("test-only-session-secret"), false);

    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      const status = await noteLoginFailure(store, first, now);
      assert.equal(status.limited, false);
    }
    assert.equal((await readLoginLimit(store, first, now)).limited, true);
    assert.equal((await readLoginLimit(store, second, now)).limited, false);

    const blocked = await noteLoginFailure(store, first, now);
    assert.equal(blocked.limited, true);
    assert.ok(blocked.retryAfterSeconds >= 1);
    assert.equal(
      (await readLoginLimit(store, first, now + LOGIN_WINDOW_MS)).limited,
      false,
    );
    assert.deepEqual(nextLoginFailure(null, now), { failures: 1, windowStart: now });
  });

  it("fails closed when compare-and-swap keeps conflicting", async () => {
    const store = conflictingStore(LOGIN_WRITE_ATTEMPTS);
    await assert.rejects(
      () => noteLoginFailure(store, "visitor", 1_700_000_000_000),
      LoginLimitUnavailable,
    );
    const recovered = conflictingStore(LOGIN_WRITE_ATTEMPTS - 1);
    const status = await noteLoginFailure(recovered, "visitor", 1_700_000_000_000);
    assert.equal(status.limited, false);
    assert.equal(loginLimitStatus({ failures: LOGIN_FAILURE_LIMIT, windowStart: 0 }, 1).limited, true);
  });

  it("clears one visitor counter and uses the platform client address", async () => {
    const store = memoryStore();
    const key = loginAttemptKey("198.51.100.8", "test-only-session-secret");
    await noteLoginFailure(store, key, 1_700_000_000_000);
    await clearLoginLimit(store, key);
    assert.equal((await readLoginLimit(store, key, 1_700_000_000_000)).limited, false);

    const request = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: {
        "x-real-ip": "198.51.100.8",
        "x-forwarded-for": "203.0.113.9, 198.51.100.8",
      },
    });
    assert.equal(requestClientIp(request), "198.51.100.8");
    assert.equal(new LoginLimitUnavailable().message, "Sign-in is unavailable.");
  });

  it("uses memory off Vercel and refuses a shared counter when Blob is not configured there", async () => {
    rememberEnv();
    const request = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.20" },
    });
    const now = 1_700_000_000_000;
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      const status = await recordLoginFailure(request, now);
      assert.equal(status.limited, false);
    }
    assert.equal((await assertLoginAllowed(request, now)).limited, true);

    const other = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.21" },
    });
    assert.equal((await assertLoginAllowed(other, now)).limited, false);
    await clearLoginFailures(request);
    assert.equal((await assertLoginAllowed(request, now)).limited, false);

    process.env.VERCEL = "1";
    await assert.rejects(() => assertLoginAllowed(request, now), LoginLimitUnavailable);
  });

  it("treats a missing blob counter as a new visitor", () => {
    assert.deepEqual(classifyBlobRead(null), { kind: "missing" });
    assert.deepEqual(
      classifyBlobRead({ statusCode: 304, stream: null, blob: { etag: "abc" } }),
      { kind: "unavailable" },
    );
    assert.equal(
      classifyBlobRead({
        statusCode: 200,
        stream: new ReadableStream(),
        blob: { etag: "  etag-1  " },
      }).kind,
      "ready",
    );
  });
});
