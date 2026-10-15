"use client";

import {
  formatGameDate,
  formatGameScore,
  formatWeekdayShort,
  gameCount,
  gameResult,
  gamesForView,
  isAwayGame,
  isVarsityDistrictGame,
  masterDays,
  phaseGameCount,
  phaseLabel,
  recordForView,
  regularSeasonCount,
  scheduleNotes,
  scrimmageCount,
  versusLabel,
  type Game,
  type GamePhase,
  type ScheduleView,
} from "@/lib/schedule";
import { program, teams, type TeamId } from "@/lib/site";
import { cn } from "@/lib/utils";
import { fieldForGame, mapsUrlForField } from "@/lib/venues";
import { MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

const views: { id: ScheduleView; label: string }[] = [
  { id: "master", label: "Master" },
  ...teams.map((team) => ({ id: team.id, label: team.label })),
];

const shell = "mx-auto max-w-[1320px] px-4 sm:px-6";

function teamLabel(id: TeamId) {
  return teams.find((team) => team.id === id)?.label ?? id;
}

function matchupClass(game: Game) {
  return isAwayGame(game.location) ? "text-red-400" : "text-white";
}

function OpponentName({ game }: { game: Game }) {
  return (
    <>
      {game.opponent}
      {isVarsityDistrictGame(game) ? (
        <>
          <span className="text-[#c8102e]" title="District game" aria-hidden>
            {"\u00A0*"}
          </span>
          <span className="sr-only">, district game</span>
        </>
      ) : null}
    </>
  );
}

function GameMatchup({ game, className }: { game: Game; className?: string }) {
  const field = fieldForGame(game);
  const href = field ? mapsUrlForField(field) : undefined;
  const color = matchupClass(game);
  const opponent = (
    <span className={cn(color, "min-w-0")}>
      <OpponentName game={game} />
    </span>
  );

  return (
    <span className={cn("inline-flex min-w-0 items-baseline gap-2", className)}>
      <span className="shrink-0 text-[0.7rem] tracking-[0.16em] text-zinc-500 uppercase">
        {versusLabel(game.location)}
      </span>
      {!href || !field ? (
        opponent
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(color, "min-w-0 underline-offset-4 hover:underline")}
          aria-label={`Directions to ${field.name}`}
        >
          <OpponentName game={game} />
        </a>
      )}
    </span>
  );
}

function HomeAwayKey({
  className,
  showDistrict = false,
}: {
  className?: string;
  showDistrict?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.62rem] tracking-[0.18em] uppercase",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 text-white">
        <span className="size-1.5 rounded-full bg-white" aria-hidden />
        Home · vs
      </span>
      <span className="inline-flex items-center gap-2 text-red-400">
        <span className="size-1.5 rounded-full bg-[#c8102e]" aria-hidden />
        Away · @
      </span>
      {showDistrict ? (
        <span className="inline-flex items-center gap-1.5 text-white">
          <span className="text-[#c8102e]" aria-hidden>
            *
          </span>
          District
        </span>
      ) : null}
    </div>
  );
}

const actionLinkClass =
  "inline-flex min-h-9 items-center gap-1.5 text-[0.68rem] font-semibold tracking-[0.16em] text-red-400 uppercase transition-colors hover:text-red-300";

function BuyTicketsLink({ className }: { className?: string }) {
  return (
    <a
      href={program.ticketsUrl}
      target="_blank"
      rel="noreferrer"
      className={cn(actionLinkClass, className)}
    >
      Buy Tickets
      <span aria-hidden>→</span>
    </a>
  );
}

function SyncCalendarLink({ className }: { className?: string }) {
  return (
    <Link
      href="/schedule/instructions"
      className={cn(actionLinkClass, className)}
    >
      Sync Calendar
      <span aria-hidden>→</span>
    </Link>
  );
}

function gameMaps(game: Game) {
  const field = fieldForGame(game);
  if (!field) return undefined;
  return { field, href: mapsUrlForField(field) };
}

function MapsPin({ game }: { game: Game }) {
  const maps = gameMaps(game);
  if (!maps) {
    return <span className="size-8 shrink-0 sm:hidden" aria-hidden />;
  }

  return (
    <a
      href={maps.href}
      target="_blank"
      rel="noreferrer"
      className="flex size-8 shrink-0 items-center justify-end text-zinc-500 sm:hidden"
      aria-label={`Directions to ${maps.field.name}`}
    >
      <MapPin className="size-[1.15rem]" strokeWidth={1.5} aria-hidden />
    </a>
  );
}

function PhaseHeader({
  phase,
  count,
  compact,
  collapsible,
  open,
  onToggle,
  unit = "games",
}: {
  phase: GamePhase;
  count: number;
  compact?: boolean;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
  unit?: "games" | "events";
}) {
  const title = (
    <p className="flex items-baseline gap-3 text-[0.68rem] font-semibold tracking-[0.28em] text-red-400 uppercase">
      <span>{phaseLabel[phase]}</span>
      {collapsible ? (
        <span className="scrimmage-show">
          {open ? "Hide" : "Show"}
        </span>
      ) : null}
    </p>
  );
  const meta = (
    <p className="text-[0.62rem] tracking-[0.2em] text-zinc-500 uppercase">
      {count}{" "}
      {unit === "events"
        ? count === 1
          ? "Event"
          : "Events"
        : count === 1
          ? "Game"
          : "Games"}
    </p>
  );
  const rowClass = cn(
    "flex w-full items-end justify-between gap-4 border-b border-white/10 pb-2 text-left",
    compact ? "pt-3" : "pt-6",
  );

  if (collapsible && onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={cn(rowClass, "cursor-pointer")}
        aria-expanded={open}
      >
        {title}
        {meta}
      </button>
    );
  }

  return (
    <div className={rowClass}>
      {title}
      {meta}
    </div>
  );
}

function DateStamp({ weekday, date }: { weekday: string; date: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.58rem] tracking-[0.18em] text-zinc-500 uppercase">
        {formatWeekdayShort(weekday)}
      </p>
      <p className="font-heading text-base leading-tight tracking-wide text-white uppercase sm:text-lg">
        {formatGameDate(date)}
      </p>
    </div>
  );
}

function GameDetail({
  game,
  className,
}: {
  game: Game;
  className?: string;
}) {
  const mark = gameResult(game);
  const score = formatGameScore(game);
  if (mark && score) {
    return (
      <p className={cn("text-sm tracking-wide uppercase", className)}>
        <span className={mark === "W" ? "text-red-400" : "text-zinc-400"}>
          {mark}
        </span>{" "}
        <span className="text-zinc-300">{score}</span>
      </p>
    );
  }

  return (
    <div className={cn("text-sm tracking-wide text-zinc-400 uppercase", className)}>
      <p>{game.time ?? "TBA"}</p>
      {game.venue ? (
        <p className="mt-0.5 text-[0.7rem] tracking-[0.12em] text-zinc-500">
          {game.venue}
        </p>
      ) : null}
    </div>
  );
}

function GameCopy({ game }: { game: Game }) {
  return (
    <div className="min-w-0">
      <p className="font-heading text-xl leading-none tracking-wide uppercase">
        <GameMatchup game={game} />
      </p>
      <GameDetail game={game} className="mt-1.5" />
    </div>
  );
}

function StatBlock({
  value,
  label,
  align = "right",
}: {
  value: string;
  label: string;
  align?: "left" | "center" | "right";
}) {
  return (
    <div
      className={cn(
        "min-w-0 sm:min-w-[4.5rem]",
        align === "left" && "text-left",
        align === "center" && "text-center",
        align === "right" && "text-left sm:text-right",
      )}
    >
      <p className="font-heading text-3xl leading-none text-white sm:text-4xl">
        {value}
      </p>
      <p className="mt-1 text-[0.52rem] tracking-[0.14em] text-zinc-500 uppercase sm:text-[0.58rem] sm:tracking-[0.18em]">
        {label}
      </p>
    </div>
  );
}

export function ScheduleBoard() {
  const [view, setView] = useState<ScheduleView>("varsity");
  const [scrimmagesOpen, setScrimmagesOpen] = useState(false);
  const visible = useMemo(() => gamesForView(view), [view]);
  const days = useMemo(() => masterDays(visible), [visible]);
  const listedGames = useMemo(() => gameCount(visible), [visible]);
  const standing = useMemo(() => recordForView(view), [view]);
  const regularGames = useMemo(() => regularSeasonCount(visible), [visible]);
  const scrimmages = useMemo(() => scrimmageCount(visible), [visible]);
  const phaseCounts = useMemo(
    () => ({
      scrimmage: phaseGameCount(visible, "scrimmage"),
      regular: phaseGameCount(visible, "regular"),
      postseason: phaseGameCount(visible, "postseason"),
    }),
    [visible],
  );

  return (
    <section>
      <header className="border-b border-white/10">
        <div
          className={cn(
            shell,
            "flex flex-col gap-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:pt-5",
          )}
        >
          <div>
            <p className="text-[0.68rem] font-semibold tracking-[0.32em] text-red-400 uppercase">
              2027
            </p>
            <h1 className="font-heading mt-1.5 text-4xl leading-none tracking-wide text-white uppercase sm:text-6xl">
              {view === "master" ? "Schedule" : teamLabel(view)}
            </h1>
            <HomeAwayKey
              className="mt-3"
              showDistrict={view === "varsity" || view === "master"}
            />
          </div>
          <div className="flex flex-col items-start gap-2.5 sm:items-end sm:pt-7">
            <div
              className={cn(
                "grid w-full items-end gap-3 sm:flex sm:w-auto sm:justify-end sm:gap-16",
                view === "master" ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {view === "master" ? (
                <>
                  <StatBlock
                    value={String(listedGames).padStart(2, "0")}
                    label="Total Events"
                    align="center"
                  />
                  <StatBlock
                    value={standing.display}
                    label={teamLabel(standing.team)}
                    align="center"
                  />
                </>
              ) : (
                <>
                  <StatBlock value={standing.display} label="Record" />
                  <StatBlock
                    value={String(regularGames)}
                    label="Regular Season"
                  />
                  <StatBlock value={String(scrimmages)} label="Scrimmages" />
                </>
              )}
            </div>
            <BuyTicketsLink className="hidden sm:inline-flex" />
          </div>
        </div>
        <div
          className={cn(
            shell,
            "flex items-center justify-between gap-6 pt-3 sm:hidden",
          )}
        >
          <BuyTicketsLink />
          <SyncCalendarLink />
        </div>
        <div className={cn(shell, "hidden pt-3 sm:block")}>
          <p className="max-w-4xl text-[0.8rem] leading-6 text-zinc-500 sm:text-sm sm:leading-6">
            Never miss a game. Sync the Yukon Baseball schedule to your
            calendar.{" "}
            <SyncCalendarLink className="inline min-h-0" />
          </p>
        </div>
        <div
          className={cn(
            shell,
            "mt-2.5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between",
          )}
        >
          <div className="flex justify-between gap-1 overflow-x-auto sm:justify-start sm:gap-0.5">
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  "relative shrink-0 px-1 py-2 text-[0.68rem] font-medium tracking-[0.16em] uppercase transition-colors sm:px-2.5 sm:text-[0.72rem]",
                  view === item.id ? "text-white" : "text-zinc-500 hover:text-white",
                  view === item.id &&
                    "after:absolute after:right-1 after:bottom-0 after:left-1 after:h-0.5 after:bg-[#c8102e] sm:after:right-2.5 sm:after:left-2.5",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Link
            href="/schedule/history"
            className="inline-flex shrink-0 items-center gap-1.5 self-end py-2 text-[0.68rem] font-medium tracking-[0.16em] text-red-400 uppercase transition-colors hover:text-red-300 sm:self-auto sm:text-[0.72rem]"
          >
            Past seasons
            <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      <div className={shell}>
        {view === "master" ? (
          <MasterTable
            days={days}
            phaseCounts={phaseCounts}
            scrimmagesOpen={scrimmagesOpen}
            onToggleScrimmages={() => setScrimmagesOpen((open) => !open)}
          />
        ) : (
          <TeamList
            days={days}
            phaseCounts={phaseCounts}
            scrimmagesOpen={scrimmagesOpen}
            onToggleScrimmages={() => setScrimmagesOpen((open) => !open)}
          />
        )}

        <footer className="space-y-1 border-t border-white/8 py-5">
          {scheduleNotes.map((note) => (
            <p key={note} className="text-xs tracking-wide text-zinc-500 uppercase">
              {note}
            </p>
          ))}
        </footer>
      </div>
    </section>
  );
}

function MasterTable({
  days,
  phaseCounts,
  scrimmagesOpen,
  onToggleScrimmages,
}: {
  days: ReturnType<typeof masterDays>;
  phaseCounts: Record<GamePhase, number>;
  scrimmagesOpen: boolean;
  onToggleScrimmages: () => void;
}) {
  return (
    <div>
      <div className="hidden grid-cols-[5.75rem_1fr_1fr_1fr] gap-4 border-b border-white/8 py-2.5 text-[0.62rem] tracking-[0.2em] text-zinc-500 uppercase lg:grid">
        <span>Date</span>
        <span>Varsity</span>
        <span>JV Red</span>
        <span>JV White</span>
      </div>
      {days.map((day, index) => {
        const showPhase = index === 0 || day.phase !== days[index - 1]?.phase;
        const hideRow = day.phase === "scrimmage" && !scrimmagesOpen;
        const byTeam = {
          varsity: day.games.filter((game) => game.team === "varsity"),
          "jv-red": day.games.filter((game) => game.team === "jv-red"),
          "jv-white": day.games.filter((game) => game.team === "jv-white"),
        };
        return (
          <div key={day.date}>
            {showPhase ? (
              <PhaseHeader
                phase={day.phase}
                count={phaseCounts[day.phase]}
                compact={index === 0}
                collapsible={day.phase === "scrimmage"}
                open={scrimmagesOpen}
                onToggle={onToggleScrimmages}
                unit={day.phase === "regular" ? "events" : "games"}
              />
            ) : null}
            {hideRow ? null : (
              <div
                className={cn(
                  "grid gap-4 border-b border-white/8 py-3 lg:grid-cols-[5.75rem_1fr_1fr_1fr] lg:items-start",
                  index % 2 === 1 && "bg-white/[0.015]",
                )}
              >
                <DateStamp weekday={day.weekday} date={day.date} />
                <MasterCell label="Varsity" games={byTeam.varsity} />
                <MasterCell label="JV Red" games={byTeam["jv-red"]} />
                <MasterCell label="JV White" games={byTeam["jv-white"]} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MasterCell({
  label,
  games: cellGames,
}: {
  label: string;
  games: Game[];
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[0.62rem] tracking-[0.16em] text-zinc-500 uppercase lg:hidden">
        {label}
      </p>
      {cellGames.length === 0 ? (
        <p className="text-sm text-zinc-600">—</p>
      ) : (
        <div className="space-y-3">
          {cellGames.map((game) => (
            <GameCopy key={game.id} game={game} />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamList({
  days,
  phaseCounts,
  scrimmagesOpen,
  onToggleScrimmages,
}: {
  days: ReturnType<typeof masterDays>;
  phaseCounts: Record<GamePhase, number>;
  scrimmagesOpen: boolean;
  onToggleScrimmages: () => void;
}) {
  return (
    <ol>
      {days.map((day, index) => {
        const showPhase = index === 0 || day.phase !== days[index - 1]?.phase;
        const hideRow = day.phase === "scrimmage" && !scrimmagesOpen;
        return (
          <li key={day.date}>
            {showPhase ? (
              <PhaseHeader
                phase={day.phase}
                count={phaseCounts[day.phase]}
                compact={index === 0}
                collapsible={day.phase === "scrimmage"}
                open={scrimmagesOpen}
                onToggle={onToggleScrimmages}
              />
            ) : null}
            {hideRow
              ? null
              : day.games.map((game) => (
                  <div
                    key={game.id}
                    className={cn(
                      "grid grid-cols-[4.75rem_minmax(0,1fr)_2rem] items-center gap-3 border-b border-white/8 py-3.5 sm:grid-cols-[5.75rem_minmax(0,1fr)_auto] sm:gap-4",
                      index % 2 === 1 && "bg-white/[0.015]",
                    )}
                  >
                    <DateStamp weekday={day.weekday} date={day.date} />
                    <div className="min-w-0 overflow-hidden sm:contents">
                      <p className="font-heading min-w-0 text-[1.35rem] leading-none tracking-wide uppercase sm:text-xl">
                        <GameMatchup game={game} />
                      </p>
                      <GameDetail
                        game={game}
                        className="mt-1.5 sm:mt-0 sm:text-right"
                      />
                    </div>
                    <MapsPin game={game} />
                  </div>
                ))}
          </li>
        );
      })}
    </ol>
  );
}
