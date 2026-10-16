import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  LOGIN_FAILURE_LIMIT,
  LOGIN_WINDOW_MS,
  LOGIN_WRITE_ATTEMPTS,
  LoginLimitUnavailable,
  clearLoginLimit,
  isRateCounterPath,
  loginAttemptKey,
  loginLimitStatus,
  nextLoginFailure,
  RATE_RETENTION_MS,
  readLoginLimit,
  requestClientIp,
  reserveLoginAttempt,
  selectExpiredRateCounters,
  settleLoginAttempt,
  type LoginAttemptSnapshot,
  type LoginAttemptState,
  type LoginAttemptStore,
} from "@/lib/minutes-login-policy";
import {
  classifyBlobRead,
  pruneExpiredRateLimits,
  rateLimitEntryCountForTests,
  reserveLoginSlot,
  resetLoginLimitsForTests,
  settleLoginSlot,
} from "@/lib/minutes-login-limit";
import { resolveMinutesRole } from "@/lib/minutes-session-token";

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
      const status = await reserveLoginAttempt(store, first, now);
      assert.equal(status.limited, false);
    }
    assert.equal((await readLoginLimit(store, first, now)).limited, true);
    assert.equal((await readLoginLimit(store, second, now)).limited, false);

    const blocked = await reserveLoginAttempt(store, first, now);
    assert.equal(blocked.limited, true);
    assert.ok(blocked.retryAfterSeconds >= 1);
    assert.equal(
      (await readLoginLimit(store, first, now + LOGIN_WINDOW_MS)).limited,
      false,
    );
    assert.deepEqual(nextLoginFailure(null, now), {
      failures: 1,
      pending: 0,
      windowStart: now,
    });
  });

  it("fails closed when compare-and-swap keeps conflicting", async () => {
    const store = conflictingStore(LOGIN_WRITE_ATTEMPTS);
    await assert.rejects(
      () => reserveLoginAttempt(store, "visitor", 1_700_000_000_000),
      LoginLimitUnavailable,
    );
    const recovered = conflictingStore(LOGIN_WRITE_ATTEMPTS - 1);
    const status = await reserveLoginAttempt(recovered, "visitor", 1_700_000_000_000);
    assert.equal(status.limited, false);
    assert.equal(
      loginLimitStatus({ failures: LOGIN_FAILURE_LIMIT, pending: 0, windowStart: 0 }, 1).limited,
      true,
    );
  });

  it("clears one visitor counter and uses the platform client address", async () => {
    const store = memoryStore();
    const key = loginAttemptKey("198.51.100.8", "test-only-session-secret");
    await reserveLoginAttempt(store, key, 1_700_000_000_000);
    await clearLoginLimit(store, key);
    assert.equal((await readLoginLimit(store, key, 1_700_000_000_000)).limited, false);

    const request = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: {
        "x-vercel-forwarded-for": "192.0.2.9",
        "x-real-ip": "198.51.100.8",
        "x-forwarded-for": "203.0.113.9, 198.51.100.8",
      },
    });
    assert.equal(requestClientIp(request), "198.51.100.8");
    assert.equal(
      requestClientIp(request, { platform: true }),
      "192.0.2.9",
    );
    assert.equal(
      requestClientIp(
        new Request("https://www.yukonbaseball.com/api/minutes/auth", {
          headers: {
            "x-real-ip": "198.51.100.8",
            "x-forwarded-for": "203.0.113.9",
          },
        }),
        { platform: true },
      ),
      null,
    );
    assert.equal(new LoginLimitUnavailable().message, "Sign-in is unavailable.");
  });

  it("uses memory off Vercel and refuses a shared counter when Blob is not configured there", async () => {
    rememberEnv();
    const request = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.20" },
    });
    const now = 1_700_000_000_000;
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      const status = await reserveLoginSlot(request, now);
      assert.equal(status.limited, false);
    }
    assert.equal((await reserveLoginSlot(request, now)).limited, true);

    const other = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.21" },
    });
    assert.equal((await reserveLoginSlot(other, now)).limited, false);
    assert.equal((await reserveLoginSlot(request, now)).limited, true);
    const renewed = await reserveLoginSlot(request, now + LOGIN_WINDOW_MS);
    assert.equal(renewed.limited, false);

    process.env.VERCEL = "1";
    let comparisons = 0;
    try {
      const slot = await reserveLoginSlot(request, now);
      if (!slot.limited) comparisons += 1;
    } catch (error) {
      assert.equal(error instanceof LoginLimitUnavailable, true);
    }
    assert.equal(comparisons, 0);
  });

  it("allows at most 20 password checks in a 40-request burst", async () => {
    const now = 1_700_000_000_000;
    const records = new Map<string, LoginAttemptSnapshot>();
    const store: LoginAttemptStore = {
      async read(key) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const current = records.get(key) ?? { state: null, version: null };
        return {
          state: current.state ? { ...current.state } : null,
          version: current.version,
        };
      },
      async write(key, state, version) {
        await new Promise((resolve) => setTimeout(resolve, 1));
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

    async function attempt(key: string, correct: boolean) {
      try {
        const slot = await reserveLoginAttempt(store, key, now);
        if (slot.limited || !slot.reservation) return { compared: false, status: 429 as const };
        await settleLoginAttempt(
          store,
          key,
          slot.reservation,
          correct ? "success" : "failure",
          now,
        );
        return { compared: true, status: (correct ? 200 : 401) as 200 | 401 };
      } catch (error) {
        assert.equal(error instanceof LoginLimitUnavailable, true);
        return { compared: false, status: 503 as const };
      }
    }

    const [burst, other] = await Promise.all([
      Promise.all(
        Array.from({ length: 40 }, () => attempt("visitor-a", false)),
      ),
      Promise.all(Array.from({ length: 5 }, () => attempt("visitor-b", false))),
    ]);
    const compared = burst.filter((result) => result.compared);
    const blocked = burst.filter((result) => result.status === 429);
    assert.equal(compared.length <= LOGIN_FAILURE_LIMIT, true);
    assert.equal(compared.length + blocked.length, 40);
    assert.equal(burst.some((result) => result.status === 503), false);
    assert.equal(burst.every((result) => result.status !== 200 || result.compared), true);
    const failedComparisons = compared.filter((result) => result.status === 401).length;
    assert.equal(failedComparisons, LOGIN_FAILURE_LIMIT);
    assert.equal(records.get("visitor-a")?.state?.pending ?? 0, 0);
    assert.equal(records.get("visitor-a")?.state?.failures, LOGIN_FAILURE_LIMIT);
    assert.equal(records.get("visitor-b")?.state?.failures, 5);
    assert.equal(records.get("visitor-b")?.state?.pending, 0);
    assert.equal(other.every((result) => result.status === 401), true);
    const again = await reserveLoginAttempt(store, "visitor-a", now);
    assert.equal(again.limited, true);
    assert.equal(records.get("visitor-a")?.state?.failures, LOGIN_FAILURE_LIMIT);
  });

  it("counts failed passwords and leaves the counter unchanged after success", async () => {
    rememberEnv();
    const now = 1_700_000_000_000;
    const request = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.40" },
    });
    assert.equal(resolveMinutesRole("viewer-test-only"), "view");
    assert.equal(resolveMinutesRole("admin-test-only"), "admin");
    assert.equal(resolveMinutesRole(""), null);
    assert.equal(resolveMinutesRole(undefined), null);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slot = await reserveLoginSlot(request, now);
      assert.equal(slot.limited, false);
      assert.ok(slot.reservation);
      await settleLoginSlot(request, slot.reservation, "failure", now);
    }
    const viewSuccess = await reserveLoginSlot(request, now);
    assert.equal(viewSuccess.limited, false);
    assert.ok(viewSuccess.reservation);
    await settleLoginSlot(request, viewSuccess.reservation, "success", now);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const slot = await reserveLoginSlot(request, now);
      assert.equal(slot.limited, false);
      assert.ok(slot.reservation);
      await settleLoginSlot(request, slot.reservation, "failure", now);
    }
    const locked = await reserveLoginSlot(request, now);
    assert.equal(locked.limited, true);
    assert.equal(locked.reservation, null);
    const adminAttempt = await reserveLoginSlot(request, now);
    assert.equal(adminAttempt.limited, true);

    const fresh = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.41" },
    });
    const adminSuccess = await reserveLoginSlot(fresh, now);
    assert.ok(adminSuccess.reservation);
    await settleLoginSlot(fresh, adminSuccess.reservation, "success", now);
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      const slot = await reserveLoginSlot(fresh, now);
      assert.equal(slot.limited, false);
      assert.ok(slot.reservation);
      await settleLoginSlot(fresh, slot.reservation, "failure", now);
    }
    assert.equal((await reserveLoginSlot(fresh, now)).limited, true);
  });

  it("does not let a stored success reservation erase earlier failures", async () => {
    const now = 1_700_000_000_000;
    const store = memoryStore();
    const key = "visitor";
    for (let attempt = 0; attempt < LOGIN_FAILURE_LIMIT; attempt += 1) {
      const slot = await reserveLoginAttempt(store, key, now);
      assert.ok(slot.reservation);
      await settleLoginAttempt(store, key, slot.reservation, "failure", now);
    }
    const blocked = await reserveLoginAttempt(store, key, now);
    assert.equal(blocked.limited, true);
    await settleLoginAttempt(
      store,
      key,
      { windowStart: now },
      "success",
      now,
    );
    const status = await readLoginLimit(store, key, now);
    assert.equal(status.limited, true);
    const current = await store.read(key);
    assert.equal(current.state?.failures, LOGIN_FAILURE_LIMIT);
    assert.equal(current.state?.pending, 0);
  });

  it("fails closed when a reserved failure cannot be stored", async () => {
    const now = 1_700_000_000_000;
    const state: LoginAttemptState = { failures: 0, pending: 1, windowStart: now };
    const store: LoginAttemptStore = {
      async read() {
        return { state, version: "1" };
      },
      async write() {
        return "conflict";
      },
    };
    await assert.rejects(
      () => settleLoginAttempt(store, "visitor", { windowStart: now }, "failure", now),
      LoginLimitUnavailable,
    );
    assert.equal(state?.failures, 0);
    assert.equal(state?.pending, 1);
  });

  it("removes only expired counters under auth-rate/v1", async () => {
    const now = 1_700_000_000_000;
    const counter = `${"ab".repeat(32)}`;
    assert.equal(counter.length, 64);
    assert.equal(isRateCounterPath(`auth-rate/v1/${counter}.json`), true);
    assert.equal(isRateCounterPath("auth-rate/v1/cursor.json"), false);
    assert.equal(isRateCounterPath("minutes/notes.pdf"), false);
    assert.equal(isRateCounterPath("media-library/catalog.json"), false);
    const selected = selectExpiredRateCounters(
      [
        { pathname: `auth-rate/v1/${counter}.json`, uploadedAtMs: now - RATE_RETENTION_MS },
        {
          pathname: `auth-rate/v1/${"cd".repeat(32)}.json`,
          uploadedAtMs: now - 60_000,
        },
        { pathname: "minutes/notes.pdf", uploadedAtMs: now - RATE_RETENTION_MS },
        { pathname: "media-library/catalog.json", uploadedAtMs: now - RATE_RETENTION_MS },
        { pathname: "media-library/covers/photo.jpg", uploadedAtMs: now - RATE_RETENTION_MS },
        { pathname: "auth-rate/v1/cursor.json", uploadedAtMs: now - RATE_RETENTION_MS },
      ],
      now,
    );
    assert.deepEqual(selected.map((blob) => blob.pathname), [`auth-rate/v1/${counter}.json`]);

    rememberEnv();
    const active = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.30" },
    });
    const stale = new Request("https://www.yukonbaseball.com/api/minutes/auth", {
      headers: { "x-real-ip": "198.51.100.31" },
    });
    await reserveLoginSlot(active, now);
    await reserveLoginSlot(stale, now - LOGIN_WINDOW_MS);
    assert.equal(rateLimitEntryCountForTests(), 2);
    await pruneExpiredRateLimits(now);
    assert.equal(rateLimitEntryCountForTests(), 1);
    const renewed = await reserveLoginSlot(stale, now);
    assert.equal(renewed.limited, false);
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
