"use client";

import { PlayerBioDialog } from "@/components/player-bio-dialog";
import {
  bioValue,
  displayName,
  playersForRoster,
  rosterClassYears,
  rosterGroups,
  rosterPositions,
  type Player,
} from "@/lib/roster";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

type ClassFilter = "all" | number;
type PositionFilter = "all" | string;

export function RosterBoard() {
  const classYears = rosterClassYears();
  const positions = rosterPositions();
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("all");
  const [selected, setSelected] = useState<Player | null>(null);

  const visiblePlayers = useMemo(
    () => playersForRoster(classFilter, positionFilter),
    [classFilter, positionFilter],
  );
  const groups = rosterGroups(visiblePlayers);

  function keepSelected(list: Player[]) {
    setSelected((current) => {
      if (!current) return null;
      return list.some((player) => player.id === current.id) ? current : null;
    });
  }

  function changeClass(next: ClassFilter) {
    setClassFilter(next);
    keepSelected(playersForRoster(next, positionFilter));
  }

  function changePosition(next: PositionFilter) {
    setPositionFilter(next);
    keepSelected(playersForRoster(classFilter, next));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-white/12 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
      <header className="relative overflow-hidden border-b border-white/10 bg-[linear-gradient(180deg,#1a0a0d_0%,#0a0a0c_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(200,16,46,0.28),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#c8102e] to-transparent" />
        <div className="relative flex items-start justify-between gap-3 px-5 py-3.5 sm:items-end sm:px-7 sm:py-5">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-red-400 uppercase sm:text-[0.68rem] sm:tracking-[0.32em]">
              2027 Baseball Season
            </p>
            <h2 className="font-heading mt-1.5 text-4xl leading-none tracking-wide text-white uppercase sm:mt-2 sm:text-5xl">
              The Millers
            </h2>
            {classFilter !== "all" || positionFilter !== "all" ? (
              <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-400">
                {`${[
                  classFilter === "all" ? null : `Class of ${classFilter}`,
                  positionFilter === "all" ? null : positionFilter,
                ]
                  .filter(Boolean)
                  .join(" · ")}, listed A–Z. Select a player for the bio card.`}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 pt-0.5 text-right sm:pt-0">
            <p className="font-heading text-xl leading-none text-zinc-400 sm:text-4xl sm:text-white">
              {String(visiblePlayers.length).padStart(2, "0")}
            </p>
            <p className="mt-1 text-[0.52rem] tracking-[0.16em] text-zinc-500 uppercase sm:text-[0.65rem] sm:tracking-[0.2em]">
              Players
            </p>
          </div>
        </div>
        <div className="relative flex items-center gap-4 border-t border-white/8 px-5 py-2 text-[0.62rem] tracking-[0.2em] text-zinc-500 uppercase sm:grid sm:grid-cols-[minmax(0,1fr)_6.5rem_4.5rem_4rem] sm:px-7">
          <label className="inline-flex min-w-0 flex-wrap items-center gap-2.5 normal-case">
            <span className="relative inline-flex">
              <select
                value={classFilter === "all" ? "all" : String(classFilter)}
                onChange={(event) => {
                  const value = event.target.value;
                  changeClass(value === "all" ? "all" : Number(value));
                }}
                aria-label="Filter by graduating class"
                className="appearance-none rounded-md border border-white/15 bg-black/70 py-1 pr-6 pl-2 text-[0.62rem] tracking-[0.16em] text-zinc-200 uppercase outline-none transition-colors hover:border-white/30 focus-visible:border-[#c8102e]"
              >
                <option value="all">All classes</option>
                {classYears.map((year) => (
                  <option key={year} value={year}>
                    Class of {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-zinc-400" />
            </span>
            <span className="relative inline-flex">
              <select
                value={positionFilter}
                onChange={(event) => changePosition(event.target.value)}
                aria-label="Filter by position"
                className="appearance-none rounded-md border border-white/15 bg-black/70 py-1 pr-6 pl-2 text-[0.62rem] tracking-[0.16em] text-zinc-200 uppercase outline-none transition-colors hover:border-white/30 focus-visible:border-[#c8102e]"
              >
                <option value="all">All positions</option>
                {positions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-1.5 size-3 -translate-y-1/2 text-zinc-400" />
            </span>
          </label>
          <span className="hidden text-center sm:block">Pos</span>
          <span className="hidden text-center sm:block">Throws</span>
          <span className="hidden text-center sm:block">Bats</span>
        </div>
      </header>

      <div>
        {groups.length === 0 ? (
          <p className="px-5 py-10 text-sm text-zinc-500 sm:px-7">
            No players match those filters.
          </p>
        ) : (
          groups.map(([letter, squad]) => (
            <section
              key={letter}
              className="border-b border-white/8 last:border-b-0"
            >
              <div className="bg-zinc-950/80 px-5 py-2 sm:px-7">
                <p className="font-heading text-lg tracking-[0.2em] text-red-400">
                  {letter}
                </p>
              </div>
              <ul>
                {squad.map((player) => (
                  <li key={player.id} className="even:bg-white/[0.02]">
                    <button
                      type="button"
                      onClick={() => setSelected(player)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_2.75rem_2.25rem] items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none sm:grid-cols-[minmax(0,1fr)_6.5rem_4.5rem_4rem] sm:gap-4 sm:px-7"
                    >
                      <div className="min-w-0">
                        <p className="font-heading text-xl tracking-wide text-white uppercase">
                          {displayName(player)}
                        </p>
                        <p className="mt-1 text-[0.68rem] tracking-[0.16em] text-zinc-400 uppercase sm:hidden">
                          {bioValue(player.position)}
                        </p>
                      </div>
                      <p className="hidden text-center font-heading text-lg tracking-wide text-zinc-200 uppercase sm:block">
                        {bioValue(player.position)}
                      </p>
                      <p className="text-center font-heading text-lg text-zinc-200">
                        <span className="mr-1 text-[0.6rem] tracking-[0.16em] text-zinc-500 uppercase sm:hidden">
                          T
                        </span>
                        {bioValue(player.bats)}
                      </p>
                      <p className="text-center font-heading text-lg text-zinc-200">
                        <span className="mr-1 text-[0.6rem] tracking-[0.16em] text-zinc-500 uppercase sm:hidden">
                          B
                        </span>
                        {bioValue(player.throws)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <PlayerBioDialog
        player={selected}
        list={visiblePlayers}
        onClose={() => setSelected(null)}
        onSelect={setSelected}
      />
    </section>
  );
}
