"use client";

import { buttonVariants } from "@/components/ui/button";
import { MINUTES_EXPIRED_MESSAGE, MINUTES_EXPIRED_NOTICE_KEY } from "@/lib/minutes-session";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";

function storedExpiryNotice() {
  return sessionStorage.getItem(MINUTES_EXPIRED_NOTICE_KEY) ?? "";
}

function useStoredExpiryNotice() {
  return useSyncExternalStore(
    () => () => {},
    storedExpiryNotice,
    () => "",
  );
}

export function MinutesLogin({
  notice,
  description = "Meeting minutes are for YUKON HS HOME RUN CLUB officers and coaching staff.",
  submitLabel = "Open minutes",
}: {
  notice?: string;
  description?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const storedNotice = useStoredExpiryNotice();
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const sessionNotice = dismissed ? "" : notice || storedNotice;

  useEffect(() => {
    if (sessionNotice !== MINUTES_EXPIRED_MESSAGE) return;
    void fetch("/api/minutes/auth", { method: "DELETE" });
  }, [sessionNotice]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(
      new FormData(event.currentTarget).get("password") ?? "",
    );
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/minutes/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "Wrong password.");
        return;
      }
      sessionStorage.removeItem(MINUTES_EXPIRED_NOTICE_KEY);
      setDismissed(true);
      router.refresh();
    } catch {
      setError("Could not sign in. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full min-w-0 max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-4 sm:p-8"
    >
      <h2 className="font-heading text-2xl tracking-wide text-white uppercase">
        Enter password
      </h2>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>
      <label className="mt-6 block">
        <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-red-400 uppercase">
          Password
        </span>
        {/* 16px on phones so iOS Safari does not zoom and clip the page. */}
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          className="mt-2 h-11 w-full min-w-0 max-w-full rounded-lg border border-white/15 bg-black px-3 text-base text-white outline-none focus:border-red-500 sm:h-10 sm:text-sm"
          required
        />
      </label>
      {sessionNotice ? (
        <p className="mt-4 text-sm leading-6 text-amber-200" role="status">
          {sessionNotice}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className={cn(buttonVariants(), "mt-6 h-10 px-4 uppercase")}
      >
        {pending ? "Checking…" : submitLabel}
      </button>
    </form>
  );
}
