import { commits } from "@/lib/commits";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export function CommitBoard() {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <header className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#1a0a0d_0%,#0a0a0c_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(200,16,46,0.28),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8102e] to-transparent" />
        <div className="relative flex items-start justify-between gap-3 px-5 py-3.5 sm:items-end sm:px-7 sm:py-6">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-red-400 uppercase sm:text-[0.68rem] sm:tracking-[0.32em]">
              Yukon Miller Baseball
            </p>
            <h2 className="font-heading mt-1.5 text-4xl leading-none tracking-wide text-white uppercase sm:mt-2 sm:text-5xl">
              Commit Board
            </h2>
          </div>
          <div className="shrink-0 pt-0.5 text-right sm:pt-0">
            <p className="font-heading text-xl leading-none text-zinc-400 sm:text-4xl sm:text-white">
              {String(commits.length).padStart(2, "0")}
            </p>
            <p className="mt-1 text-[0.52rem] tracking-[0.16em] text-zinc-500 uppercase sm:text-[0.65rem] sm:tracking-[0.2em]">
              Committed
            </p>
          </div>
        </div>
        <div className="relative hidden grid-cols-[4.5rem_minmax(0,1fr)_14rem] gap-4 border-t border-white/8 px-7 py-2 text-[0.62rem] tracking-[0.2em] text-zinc-500 uppercase md:grid">
          <span>Slot</span>
          <span>Player / School</span>
          <span className="text-right">Baseball mark</span>
        </div>
      </header>

      <ol>
        {commits.map((commit, index) => {
          const body = (
            <div
              className={cn(
                "relative grid gap-5 px-5 py-6 sm:px-7 md:grid-cols-[4.5rem_minmax(0,1fr)_14rem] md:items-center",
                index < commits.length - 1 && "border-b border-white/8",
              )}
            >
              <div
                className="absolute inset-y-0 left-0 w-1.5"
                style={{
                  background: `linear-gradient(180deg, ${commit.colors.secondary}, ${commit.colors.primary})`,
                }}
                aria-hidden
              />
              <p className="font-heading text-4xl leading-none tracking-wide text-white/20">
                {commit.pick}
              </p>
              <div className="min-w-0">
                <p className="inline-flex items-center rounded-full border border-[#c8102e]/50 bg-[#c8102e]/15 px-2.5 py-0.5 text-[0.62rem] font-semibold tracking-[0.18em] text-red-300 uppercase">
                  Committed
                </p>
                <h3 className="font-heading mt-2 text-3xl leading-none tracking-wide text-white uppercase sm:text-4xl">
                  {commit.player}
                </h3>
                <p className="mt-3 text-base font-medium text-[#f4f1ea]">
                  {commit.school}
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  {commit.mascot} · {commit.division}
                </p>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {commit.conference} · {commit.city}
                </p>
                <p className="mt-0.5 text-xs tracking-wide text-zinc-600 uppercase">
                  Home field · {commit.stadium}
                </p>
              </div>
              <div className="flex justify-start md:justify-end">
                <div className="flex h-24 w-52 items-center justify-center rounded-xl bg-[#f4f1ea] p-3 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]">
                  <Image
                    src={commit.logo.src}
                    alt={commit.logo.alt}
                    width={commit.logo.width}
                    height={commit.logo.height}
                    className="h-full w-auto max-w-full object-contain"
                  />
                </div>
              </div>
            </div>
          );

          return (
            <li
              key={commit.id}
              className="bg-zinc-950 transition-colors hover:bg-zinc-900/80"
            >
              {commit.newsSlug ? (
                <Link href={`/news/${commit.newsSlug}`} className="block">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
