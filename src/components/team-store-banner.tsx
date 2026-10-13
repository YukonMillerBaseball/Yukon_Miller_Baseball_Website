"use client";

import { buttonVariants } from "@/components/ui/button";
import { gaEvent } from "@/lib/ga";
import { teamStoreIsOpen, teamStorePromotion } from "@/lib/team-store";
import { cn } from "@/lib/utils";

export function TeamStoreBanner() {
  if (!teamStoreIsOpen()) return null;

  const { headline, description, closingLabel, href } = teamStorePromotion;

  return (
    <section aria-label="2027 team store" className="border-y border-white/10 bg-[#121214]">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:gap-8 sm:px-6 sm:py-5">
        <div className="min-w-0 flex-1 border-l-4 border-[#c8102e] pl-4">
          <h2 className="font-heading text-[1.65rem] leading-none tracking-wide text-white uppercase sm:text-[2rem]">
            {headline}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#f4f1ea]/85">
            {description}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:shrink-0 sm:items-end">
          <p className="text-center font-heading text-lg tracking-[0.08em] text-[#c8102e] uppercase sm:text-right sm:text-xl">
            {closingLabel}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => gaEvent("team_store_click")}
            className={cn(
              buttonVariants(),
              "h-11 w-full px-5 text-xs uppercase sm:w-auto",
            )}
          >
            Shop team store →
          </a>
        </div>
      </div>
    </section>
  );
}
