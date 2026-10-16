"use client";

import { MinutesLogin } from "@/components/minutes-login";
import {
  MINUTES_ACTIVITY_STORAGE_KEY,
  MINUTES_EXPIRED_MESSAGE,
  MINUTES_EXPIRED_NOTICE_KEY,
  MINUTES_IDLE_MS,
  MINUTES_LOGOUT_STORAGE_KEY,
  isIdleExpired,
} from "@/lib/minutes-session";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type LogoutNotice = { at: number; reason: "idle" | "lock" };

const ACTIVITY_THROTTLE_MS = 5_000;

const MinutesSessionEndContext = createContext<(reason: "idle" | "lock") => void>(
  () => {},
);

export function useEndMinutesSession() {
  return useContext(MinutesSessionEndContext);
}

function readStoredActivity() {
  const stored = Number(localStorage.getItem(MINUTES_ACTIVITY_STORAGE_KEY));
  return Number.isFinite(stored) ? stored : 0;
}

function readLogout(): LogoutNotice | null {
  const raw = localStorage.getItem(MINUTES_LOGOUT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LogoutNotice;
    if (parsed?.reason !== "idle" && parsed?.reason !== "lock") return null;
    if (!Number.isFinite(parsed.at)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function publishActivity(time: number) {
  localStorage.setItem(MINUTES_ACTIVITY_STORAGE_KEY, String(time));
}

export function MinutesSessionGuard({
  lastActivity,
  children,
  loginDescription,
  loginSubmitLabel,
}: {
  lastActivity: number;
  children: ReactNode;
  loginDescription?: string;
  loginSubmitLabel?: string;
}) {
  const router = useRouter();
  const [ended, setEnded] = useState<null | "idle" | "lock">(null);
  const lastServerTouch = useRef(lastActivity);
  const ending = useRef(false);

  const endSession = useCallback(
    async (reason: "idle" | "lock") => {
      if (ending.current) return;
      ending.current = true;
      const response = await fetch("/api/minutes/auth", { method: "DELETE" }).catch(
        () => null,
      );
      if (!response?.ok) {
        ending.current = false;
        return;
      }
      if (reason === "idle") {
        sessionStorage.setItem(MINUTES_EXPIRED_NOTICE_KEY, MINUTES_EXPIRED_MESSAGE);
        localStorage.setItem(
          MINUTES_LOGOUT_STORAGE_KEY,
          JSON.stringify({ at: Date.now(), reason: "idle" } satisfies LogoutNotice),
        );
      }
      setEnded(reason);
      router.refresh();
    },
    [router],
  );

  useEffect(() => {
    if (ended) return;
    let timer = 0;
    let disposed = false;

    const schedule = (from: number) => {
      window.clearTimeout(timer);
      const delay = Math.max(0, from + MINUTES_IDLE_MS - Date.now());
      timer = window.setTimeout(() => {
        void evaluate(true);
      }, delay);
    };

    const trustedActivity = (serverLast: number, stored: number) => {
      if (
        stored > serverLast &&
        stored <= Date.now() + 1000 &&
        stored - serverLast <= ACTIVITY_THROTTLE_MS
      ) {
        return stored;
      }
      return serverLast;
    };

    const applyServerActivity = (serverLast: number) => {
      const trusted = trustedActivity(serverLast, readStoredActivity());
      lastServerTouch.current = serverLast;
      publishActivity(trusted);
      if (isIdleExpired(trusted, Date.now())) return false;
      schedule(trusted);
      return true;
    };

    const confirmServer = async () => {
      const response = await fetch("/api/minutes/auth");
      if (response.status === 503) return "unavailable" as const;
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        expired?: boolean;
        lastActivity?: number;
      };
      if (response.ok && data.ok && typeof data.lastActivity === "number") {
        return data.lastActivity;
      }
      return null;
    };

    const evaluate = async (confirmWithServer: boolean) => {
      if (disposed || ending.current) return;
      const logout = readLogout();
      const stored = readStoredActivity();
      const last = trustedActivity(lastServerTouch.current, stored);
      if (logout && logout.at >= last) {
        await endSession(logout.reason);
        return;
      }
      if (!confirmWithServer && !isIdleExpired(last, Date.now())) {
        schedule(last);
        return;
      }
      try {
        const serverLast = await confirmServer();
        if (serverLast === "unavailable") {
          if (!isIdleExpired(last, Date.now())) schedule(last);
          return;
        }
        if (serverLast !== null) {
          if (!applyServerActivity(serverLast)) await endSession("idle");
          return;
        }
      } catch {
        if (!isIdleExpired(last, Date.now())) {
          schedule(last);
          return;
        }
      }
      await endSession("idle");
    };

    const onActivity = () => {
      if (disposed || ending.current) return;
      const now = Date.now();
      publishActivity(now);
      schedule(now);
      if (now - lastServerTouch.current < ACTIVITY_THROTTLE_MS) return;
      void fetch("/api/minutes/activity", { method: "POST" })
        .then(async (response) => {
          const data = (await response.json().catch(() => ({}))) as {
            expired?: boolean;
            lastActivity?: number;
          };
          if (disposed || ending.current) return;
          if (data.expired || response.status === 401) {
            await endSession("idle");
            return;
          }
          if (response.ok && typeof data.lastActivity === "number") {
            lastServerTouch.current = data.lastActivity;
            publishActivity(data.lastActivity);
            schedule(data.lastActivity);
          }
        })
        .catch(() => undefined);
    };

    const onStorage = (event: StorageEvent) => {
      if (
        event.key !== MINUTES_ACTIVITY_STORAGE_KEY &&
        event.key !== MINUTES_LOGOUT_STORAGE_KEY
      ) {
        return;
      }
      const logout = readLogout();
      if (logout && logout.at >= Math.max(lastServerTouch.current, readStoredActivity())) {
        void endSession(logout.reason);
        return;
      }
      const stored = readStoredActivity();
      if (stored > lastServerTouch.current) void evaluate(true);
      else schedule(Math.max(lastServerTouch.current, stored));
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void evaluate(true);
    };
    const onPageShow = () => {
      void evaluate(true);
    };

    schedule(trustedActivity(lastActivity, readStoredActivity()));
    const events = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
      "input",
      "change",
    ] as const;
    for (const type of events) {
      window.addEventListener(type, onActivity, { capture: true, passive: true });
    }
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      for (const type of events) window.removeEventListener(type, onActivity, true);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [ended, endSession, lastActivity]);

  if (ended === "idle") {
    return (
      <MinutesLogin
        notice={MINUTES_EXPIRED_MESSAGE}
        description={loginDescription}
        submitLabel={loginSubmitLabel}
      />
    );
  }
  if (ended === "lock") {
    return (
      <MinutesLogin
        description={loginDescription}
        submitLabel={loginSubmitLabel}
      />
    );
  }

  return (
    <MinutesSessionEndContext.Provider value={endSession}>
      {children}
    </MinutesSessionEndContext.Provider>
  );
}
