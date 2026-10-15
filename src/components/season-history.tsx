import {
  formatHistoryDate,
  formatHistoryScore,
  formatHistoryWeekday,
  historyResult,
  historyVersus,
  orderedGames,
  seasonRecord,
} from "@/lib/history/record";
import type { HistoricalGame, HistoricalSeason } from "@/lib/history/types";
import { historicalSeasons } from "@/lib/history/seasons";
import { cn } from "@/lib/utils";
import Link from "next/link";

const shell = "mx-auto max-w-[1320px] px-4 sm:px-6";

const backLinkClass =
  "inline-flex items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.16em] text-zinc-500 uppercase transition-colors hover:text-white";

function StatBlock({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="min-w-0 text-left sm:text-right">
      <p className="font-heading text-3xl leading-none text-white sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-[0.52rem] tracking-[0.14em] text-zinc-500 uppercase sm:text-[0.58rem] sm:tracking-[0.18em]">
        {label}
      </p>
    </div>
  );
}

function HomeAwayKey() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.62rem] tracking-[0.18em] uppercase">
      <span className="inline-flex items-center gap-2 text-white">
        <span className="size-1.5 rounded-full bg-white" aria-hidden />
        Home · vs
      </span>
      <span className="inline-flex items-center gap-2 text-red-400">
        <span className="size-1.5 rounded-full bg-[#c8102e]" aria-hidden />
        Away · @
      </span>
    </div>
  );
}

function ResultLine({ game }: { game: HistoricalGame }) {
  const mark = historyResult(game);
  return (
    <p className="mt-1.5 text-sm tracking-wide uppercase sm:mt-0 sm:text-right">
      <span className={mark === "W" ? "text-red-400" : "text-zinc-400"}>
        {mark}
      </span>{" "}
      <span className="text-zinc-300">{formatHistoryScore(game)}</span>
    </p>
  );
}

export function SeasonHistoryIndex() {
  return (
    <section className="bg-black">
      <header className="border-b border-white/10">
        <div className={cn(shell, "py-8 sm:py-10")}>
          <Link href="/schedule" className={backLinkClass}>
            <span aria-hidden>←</span>
            Current schedule
          </Link>
          <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
            Schedule
          </p>
          <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
            Season history
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">
            Completed Yukon Millers seasons.
          </p>
        </div>
      </header>
      <div className={shell}>
        <ul>
          {historicalSeasons.map((season) => {
            const record = seasonRecord(season.games);
            return (
              <li key={season.year} className="border-b border-white/8">
                <Link
                  href={`/schedule/history/${season.year}`}
                  className="group flex flex-col gap-4 py-5 transition-colors hover:bg-white/[0.045] sm:flex-row sm:items-end sm:justify-between sm:py-6"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-6 lg:gap-8">
                      <p className="font-heading text-4xl leading-none tracking-wide text-white uppercase sm:text-5xl">
                        {season.year}
                      </p>
                      <span className="hidden shrink-0 items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.16em] text-red-400 uppercase transition-colors group-hover:text-red-300 lg:inline-flex">
                        View results
                        <span aria-hidden>→</span>
                      </span>
                    </div>
                    <p className="mt-2 text-[0.68rem] tracking-[0.22em] text-zinc-500 uppercase">
                      {season.teamLabel}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-x-8 gap-y-3 sm:gap-x-16">
                    <StatBlock value={record.display} label="Record" />
                    <StatBlock value={String(record.games)} label="Games" />
                    <span className="inline-flex items-center gap-1.5 pb-0.5 text-[0.68rem] font-semibold tracking-[0.16em] text-red-400 uppercase transition-colors group-hover:text-red-300 lg:hidden">
                      View results
                      <span aria-hidden>→</span>
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function SeasonResults({ season }: { season: HistoricalSeason }) {
  const games = orderedGames(season.games);
  const record = seasonRecord(games);

  return (
    <section className="bg-black">
      <header className="border-b border-white/10">
        <div className={cn(shell, "pt-4 sm:pt-5")}>
          <Link href="/schedule/history" className={backLinkClass}>
            <span aria-hidden>←</span>
            Season history
          </Link>
        </div>
        <div
          className={cn(
            shell,
            "flex flex-col gap-4 pt-3 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8 sm:pt-4 sm:pb-5",
          )}
        >
          <div>
            <p className="text-[0.7rem] font-semibold tracking-[0.24em] text-red-400 uppercase">
              {season.year}
            </p>
            <h1 className="font-heading mt-2 text-4xl tracking-wide text-white uppercase sm:text-5xl">
              {season.teamLabel}
            </h1>
            <HomeAwayKey />
          </div>
          <div className="grid grid-cols-2 items-end gap-6 sm:flex sm:gap-16">
            <StatBlock value={record.display} label="Record" />
            <StatBlock value={String(record.games)} label="Games" />
          </div>
        </div>
      </header>
      <div className={shell}>
        <ol>
          {games.map((game, index) => (
            <li
              key={game.number}
              className={cn(
                "grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-3 border-b border-white/8 py-3.5 sm:grid-cols-[5.75rem_minmax(0,1fr)_auto] sm:gap-4",
                index % 2 === 1 && "bg-white/[0.015]",
              )}
            >
              <div className="min-w-0">
                <p className="text-[0.58rem] tracking-[0.18em] text-zinc-500 uppercase">
                  {formatHistoryWeekday(game.date)}
                </p>
                <p className="font-heading text-base leading-tight tracking-wide text-white uppercase sm:text-lg">
                  {formatHistoryDate(game.date)}
                </p>
              </div>
              <div className="min-w-0 sm:contents">
                <p className="font-heading min-w-0 text-[1.35rem] leading-none tracking-wide uppercase sm:text-xl">
                  <span className="inline-flex min-w-0 items-baseline gap-2">
                    <span className="shrink-0 text-[0.7rem] tracking-[0.16em] text-zinc-500 uppercase">
                      {historyVersus(game.location)}
                    </span>
                    <span
                      className={cn(
                        "min-w-0 break-words",
                        game.location === "away" ? "text-red-400" : "text-white",
                      )}
                    >
                      {game.opponent}
                    </span>
                  </span>
                </p>
                <ResultLine game={game} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
