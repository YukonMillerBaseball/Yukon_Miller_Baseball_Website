"use client";

import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:px-6">
      <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
        Something broke
      </p>
      <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
        This page did not load
      </h1>
      <p className="mt-4 text-sm leading-6 text-zinc-400">
        Try again. If it keeps failing, email the staff and tell them which
        page you were on.
      </p>
      <Button className="mt-6 h-10 px-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
