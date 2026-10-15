import type { TeamId } from "./site";

export type GamePhase = "scrimmage" | "regular" | "postseason";
export type GameLocation = "home" | "away" | "neutral";
export type GameStatus = "scheduled" | "final";
export type GameResultMark = "W" | "L" | "T";
export type ScheduleView = "master" | TeamId;

export type TeamRecord = {
  wins: number;
  losses: number;
  ties: number;
};

export type Game = {
  id: string;
  date: string;
  weekday: string;
  team: TeamId;
  opponent: string;
  location: GameLocation;
  time?: string;
  phase: GamePhase;
  venue?: string;
  /** Set with `status: "final"` to show W/L and update the record. */
  yukonScore?: number;
  opponentScore?: number;
  status?: GameStatus;
  /** Defaults to true for regular/postseason finals. Scrimmages never count. */
  countsTowardRecord?: boolean;
};

type GameDraft = Omit<Game, "id">;

const drafts: GameDraft[] = [
  { date: "2027-02-15", weekday: "Monday", team: "varsity", opponent: "Choctaw", location: "away", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-16", weekday: "Tuesday", team: "varsity", opponent: "Santa Fe", location: "home", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-16", weekday: "Tuesday", team: "jv-red", opponent: "Santa Fe", location: "away", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-16", weekday: "Tuesday", team: "jv-white", opponent: "Santa Fe", location: "away", time: "7:00", phase: "scrimmage" },
  { date: "2027-02-19", weekday: "Friday", team: "varsity", opponent: "Scrimmage Festival", location: "home", phase: "scrimmage" },
  { date: "2027-02-19", weekday: "Friday", team: "jv-white", opponent: "Norman North", location: "away", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-20", weekday: "Saturday", team: "varsity", opponent: "Scrimmage Festival", location: "home", phase: "scrimmage" },
  { date: "2027-02-20", weekday: "Saturday", team: "jv-red", opponent: "Piedmont", location: "away", time: "1:00", phase: "scrimmage", venue: "Old HS Field" },
  { date: "2027-02-22", weekday: "Monday", team: "varsity", opponent: "Blanchard", location: "home", time: "4:30", phase: "scrimmage" },
  { date: "2027-02-22", weekday: "Monday", team: "jv-red", opponent: "Blanchard", location: "home", time: "6:30", phase: "scrimmage" },
  { date: "2027-02-23", weekday: "Tuesday", team: "varsity", opponent: "Enid", location: "home", time: "5:30", phase: "scrimmage" },
  { date: "2027-02-25", weekday: "Thursday", team: "varsity", opponent: "Norman North", location: "away", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-25", weekday: "Thursday", team: "jv-red", opponent: "Norman North", location: "home", time: "5:00", phase: "scrimmage" },
  { date: "2027-02-26", weekday: "Friday", team: "jv-white", opponent: "Piedmont", location: "home", time: "4:30", phase: "scrimmage" },
  { date: "2027-02-27", weekday: "Saturday", team: "varsity", opponent: "Bixby", location: "away", time: "1:00", phase: "scrimmage" },

  { date: "2027-03-01", weekday: "Monday", team: "varsity", opponent: "Mustang", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-03-02", weekday: "Tuesday", team: "varsity", opponent: "Mustang", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-03-02", weekday: "Tuesday", team: "jv-white", opponent: "Choctaw", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-04", weekday: "Thursday", team: "varsity", opponent: "Bethany", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-03-04", weekday: "Thursday", team: "jv-red", opponent: "Memorial", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-04", weekday: "Thursday", team: "jv-white", opponent: "Santa Fe Festival", location: "away", phase: "regular" },
  { date: "2027-03-05", weekday: "Friday", team: "varsity", opponent: "Carl Albert", location: "neutral", time: "7:30", phase: "regular", venue: "Bricktown Ballpark" },
  { date: "2027-03-05", weekday: "Friday", team: "jv-white", opponent: "Santa Fe Festival", location: "away", phase: "regular" },
  { date: "2027-03-06", weekday: "Saturday", team: "varsity", opponent: "Edmond North", location: "away", time: "1:00", phase: "regular" },
  { date: "2027-03-06", weekday: "Saturday", team: "jv-red", opponent: "Choctaw", location: "home", time: "12:00 / 2:00", phase: "regular" },
  { date: "2027-03-06", weekday: "Saturday", team: "jv-white", opponent: "Santa Fe Festival", location: "away", phase: "regular" },
  { date: "2027-03-08", weekday: "Monday", team: "varsity", opponent: "Capital Hill", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-08", weekday: "Monday", team: "jv-red", opponent: "Edmond North", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-09", weekday: "Tuesday", team: "jv-white", opponent: "Edmond North", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-11", weekday: "Thursday", team: "varsity", opponent: "Battle At the Beach-Biloxi", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-11", weekday: "Thursday", team: "jv-red", opponent: "Westmoore", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-11", weekday: "Thursday", team: "jv-white", opponent: "Piedmont JV Festival", location: "away", phase: "regular" },
  { date: "2027-03-12", weekday: "Friday", team: "varsity", opponent: "Battle At the Beach-Biloxi", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-12", weekday: "Friday", team: "jv-white", opponent: "Piedmont JV Festival", location: "away", phase: "regular" },
  { date: "2027-03-13", weekday: "Saturday", team: "varsity", opponent: "Battle At the Beach-Biloxi", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-13", weekday: "Saturday", team: "jv-white", opponent: "Piedmont JV Festival", location: "away", phase: "regular" },
  { date: "2027-03-19", weekday: "Friday", team: "varsity", opponent: "TBD", location: "home", time: "TBD", phase: "regular" },
  { date: "2027-03-22", weekday: "Monday", team: "varsity", opponent: "Memorial", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-03-22", weekday: "Monday", team: "jv-white", opponent: "Edmond Memorial", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-03-23", weekday: "Tuesday", team: "varsity", opponent: "Memorial", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-03-25", weekday: "Thursday", team: "varsity", opponent: "Choctaw Tournament", location: "away", phase: "regular" },
  { date: "2027-03-25", weekday: "Thursday", team: "jv-red", opponent: "Edmond Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-25", weekday: "Thursday", team: "jv-white", opponent: "Yukon/Mustang Freshman Tournament", location: "home", phase: "regular" },
  { date: "2027-03-26", weekday: "Friday", team: "varsity", opponent: "Choctaw Tournament", location: "away", phase: "regular" },
  { date: "2027-03-26", weekday: "Friday", team: "jv-red", opponent: "Edmond Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-26", weekday: "Friday", team: "jv-white", opponent: "Yukon/Mustang Freshman Tournament", location: "home", phase: "regular" },
  { date: "2027-03-27", weekday: "Saturday", team: "varsity", opponent: "Choctaw Tournament", location: "away", phase: "regular" },
  { date: "2027-03-27", weekday: "Saturday", team: "jv-red", opponent: "Edmond Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-03-27", weekday: "Saturday", team: "jv-white", opponent: "Yukon/Mustang Freshman Tournament", location: "home", phase: "regular" },
  { date: "2027-03-29", weekday: "Monday", team: "varsity", opponent: "Moore", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-03-30", weekday: "Tuesday", team: "varsity", opponent: "Moore", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-03-30", weekday: "Tuesday", team: "jv-white", opponent: "Moore", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-01", weekday: "Thursday", team: "varsity", opponent: "Enid Festival", location: "away", phase: "regular" },
  { date: "2027-04-01", weekday: "Thursday", team: "jv-red", opponent: "North Rock Creek", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-02", weekday: "Friday", team: "varsity", opponent: "Enid Festival", location: "away", phase: "regular" },
  { date: "2027-04-02", weekday: "Friday", team: "jv-red", opponent: "Cashion", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-03", weekday: "Saturday", team: "varsity", opponent: "Enid Festival", location: "away", phase: "regular" },
  { date: "2027-04-05", weekday: "Monday", team: "varsity", opponent: "Putnam City North", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-06", weekday: "Tuesday", team: "varsity", opponent: "Putnam City North", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-04-06", weekday: "Tuesday", team: "jv-white", opponent: "Southmoore", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-08", weekday: "Thursday", team: "varsity", opponent: "Enid", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-08", weekday: "Thursday", team: "jv-red", opponent: "Union Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-08", weekday: "Thursday", team: "jv-white", opponent: "Kingfisher JV Festival", location: "away", phase: "regular" },
  { date: "2027-04-09", weekday: "Friday", team: "varsity", opponent: "Santa Fe", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-09", weekday: "Friday", team: "jv-red", opponent: "Union Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-09", weekday: "Friday", team: "jv-white", opponent: "Kingfisher JV Festival", location: "away", phase: "regular" },
  { date: "2027-04-10", weekday: "Saturday", team: "jv-red", opponent: "Union Festival", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-12", weekday: "Monday", team: "varsity", opponent: "Westmoore", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-04-12", weekday: "Monday", team: "jv-white", opponent: "Westmoore", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-13", weekday: "Tuesday", team: "varsity", opponent: "Westmoore", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-15", weekday: "Thursday", team: "varsity", opponent: "Union", location: "away", time: "12:30", phase: "regular", venue: "ORU" },
  { date: "2027-04-15", weekday: "Thursday", team: "jv-red", opponent: "Yukon/Mustang JV Tournament", location: "home", phase: "regular" },
  { date: "2027-04-15", weekday: "Thursday", team: "jv-white", opponent: "Carl Albert Tournament", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-16", weekday: "Friday", team: "varsity", opponent: "Southmoore", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-04-16", weekday: "Friday", team: "jv-red", opponent: "Yukon/Mustang JV Tournament", location: "home", phase: "regular" },
  { date: "2027-04-16", weekday: "Friday", team: "jv-white", opponent: "Carl Albert Tournament", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-17", weekday: "Saturday", team: "jv-red", opponent: "Yukon/Mustang JV Tournament", location: "home", phase: "regular" },
  { date: "2027-04-17", weekday: "Saturday", team: "jv-white", opponent: "Carl Albert Tournament", location: "away", time: "TBD", phase: "regular" },
  { date: "2027-04-19", weekday: "Monday", team: "varsity", opponent: "Deer Creek", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-04-20", weekday: "Tuesday", team: "varsity", opponent: "Deer Creek", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-20", weekday: "Tuesday", team: "jv-white", opponent: "Deer Creek", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-22", weekday: "Thursday", team: "jv-red", opponent: "Santa Fe", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-23", weekday: "Friday", team: "varsity", opponent: "Southmoore", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-23", weekday: "Friday", team: "jv-white", opponent: "Southmoore", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-24", weekday: "Saturday", team: "varsity", opponent: "Choctaw", location: "home", time: "1:00", phase: "regular" },
  { date: "2027-04-24", weekday: "Saturday", team: "jv-red", opponent: "Choctaw", location: "home", time: "11:00", phase: "regular" },
  { date: "2027-04-26", weekday: "Monday", team: "varsity", opponent: "PCO", location: "away", time: "6:00", phase: "regular" },
  { date: "2027-04-27", weekday: "Tuesday", team: "varsity", opponent: "PCO", location: "home", time: "6:00", phase: "regular" },
  { date: "2027-04-27", weekday: "Tuesday", team: "jv-white", opponent: "PCO", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-29", weekday: "Thursday", team: "jv-red", opponent: "Moore", location: "away", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-29", weekday: "Thursday", team: "jv-white", opponent: "Piedmont", location: "home", time: "5:00 / 7:00", phase: "regular" },
  { date: "2027-04-30", weekday: "Friday", team: "varsity", opponent: "Jenks", location: "home", time: "6:00", phase: "regular" },

  { date: "2027-05-06", weekday: "Thursday", team: "varsity", opponent: "OSSAA Regionals", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
  { date: "2027-05-07", weekday: "Friday", team: "varsity", opponent: "OSSAA Regionals", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
  { date: "2027-05-08", weekday: "Saturday", team: "varsity", opponent: "OSSAA Regionals", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
  { date: "2027-05-13", weekday: "Thursday", team: "varsity", opponent: "OSSAA State Tournament", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
  { date: "2027-05-14", weekday: "Friday", team: "varsity", opponent: "OSSAA State Tournament", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
  { date: "2027-05-15", weekday: "Saturday", team: "varsity", opponent: "OSSAA State Tournament", location: "neutral", time: "TBD", phase: "postseason", venue: "TBD" },
];

function calendarSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const games: Game[] = (() => {
  const seen = new Map<string, number>();
  return drafts.map((game) => {
    const base = [
      game.team,
      game.location,
      game.phase,
      calendarSlug(game.opponent),
      game.venue ? calendarSlug(game.venue) : "na",
    ].join("-");
    const next = (seen.get(base) ?? 0) + 1;
    seen.set(base, next);
    return { ...game, id: `${base}-${next}` };
  });
})();

export const scheduleNotes = [
  "Monday, February 15 — scrimmages can start",
  "Spring break — March 15–19",
  "Saturday, May 3 — district completion date",
] as const;

/** 2027 varsity district. Schedule spellings stay as entered, including Capital Hill and PCO. */
const varsityDistrictOpponents = new Set([
  "capital hill",
  "capitol hill",
  "deer creek",
  "edmond memorial",
  "memorial",
  "putnam city",
  "pco",
  "putnam city north",
  "moore",
  "westmoore",
]);

export function isVarsityDistrictGame(game: Game) {
  return (
    game.team === "varsity" &&
    game.phase === "regular" &&
    varsityDistrictOpponents.has(game.opponent.trim().toLowerCase())
  );
}

export const phaseLabel: Record<GamePhase, string> = {
  scrimmage: "Scrimmages",
  regular: "Regular season",
  postseason: "Postseason",
};

export function formatGameDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatWeekdayShort(weekday: string) {
  return weekday.slice(0, 3).toUpperCase();
}

export function versusLabel(location: GameLocation) {
  if (location === "away") return "@";
  if (location === "neutral") return "vs";
  return "vs";
}

export function isAwayGame(location: GameLocation) {
  return location === "away";
}

export function gamesForView(view: ScheduleView) {
  if (view === "master") return games;
  return games.filter((game) => game.team === view);
}

function listedSlotCount(game: Pick<Game, "time">) {
  if (!game.time) return 1;
  const times = game.time
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return times.length > 1 ? times.length : 1;
}

export function listedGameCount(game: Pick<Game, "time" | "phase">) {
  if (game.phase === "scrimmage") return 0;
  return listedSlotCount(game);
}

export function gameCount(list: Game[]) {
  return list.reduce((total, game) => total + listedGameCount(game), 0);
}

export function phaseGameCount(list: Game[], phase: GamePhase) {
  return list
    .filter((game) => game.phase === phase)
    .reduce((total, game) => total + listedSlotCount(game), 0);
}

export function regularSeasonCount(list: Game[]) {
  return phaseGameCount(list, "regular");
}

export function scrimmageCount(list: Game[]) {
  return phaseGameCount(list, "scrimmage");
}

export function isFinalGame(
  game: Pick<Game, "status" | "yukonScore" | "opponentScore">,
) {
  return (
    game.status === "final" &&
    typeof game.yukonScore === "number" &&
    typeof game.opponentScore === "number"
  );
}

export function gameResult(game: Game): GameResultMark | undefined {
  if (!isFinalGame(game)) return undefined;
  if (game.yukonScore! > game.opponentScore!) return "W";
  if (game.yukonScore! < game.opponentScore!) return "L";
  return "T";
}

export function formatGameScore(game: Game) {
  if (!isFinalGame(game)) return undefined;
  return `${game.yukonScore}–${game.opponentScore}`;
}

export function formatGameResult(game: Game) {
  const mark = gameResult(game);
  const score = formatGameScore(game);
  if (!mark || !score) return undefined;
  return `${mark} ${score}`;
}

export function gameCountsTowardRecord(game: Game) {
  if (!isFinalGame(game)) return false;
  if (game.countsTowardRecord === false) return false;
  if (game.phase === "scrimmage") return false;
  return true;
}

export function teamRecord(team: TeamId, list: Game[] = games): TeamRecord {
  return list.reduce<TeamRecord>(
    (record, game) => {
      if (game.team !== team || !gameCountsTowardRecord(game)) return record;
      const mark = gameResult(game);
      if (mark === "W") record.wins += 1;
      else if (mark === "L") record.losses += 1;
      else if (mark === "T") record.ties += 1;
      return record;
    },
    { wins: 0, losses: 0, ties: 0 },
  );
}

export function formatTeamRecord(record: TeamRecord) {
  if (record.ties > 0) {
    return `${record.wins}–${record.losses}–${record.ties}`;
  }
  return `${record.wins}–${record.losses}`;
}

const recordLabels: Record<TeamId, string> = {
  varsity: "Varsity Record",
  "jv-red": "JV Red Record",
  "jv-white": "JV White Record",
};

export function recordForView(view: ScheduleView, list: Game[] = games) {
  const team: TeamId = view === "master" ? "varsity" : view;
  const record = teamRecord(team, list);
  return {
    team,
    label: recordLabels[team],
    record,
    display: formatTeamRecord(record),
  };
}

export function masterDays(list: Game[] = games) {
  const byDate = new Map<
    string,
    { date: string; weekday: string; phase: GamePhase; games: Game[] }
  >();
  for (const game of list) {
    const row = byDate.get(game.date) ?? {
      date: game.date,
      weekday: game.weekday,
      phase: game.phase,
      games: [],
    };
    row.games.push(game);
    byDate.set(game.date, row);
  }
  return [...byDate.values()];
}
