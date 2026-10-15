export type Hand = "L" | "R";

export type Player = {
  id: string;
  firstName: string;
  lastName: string;
  bats?: Hand;
  throws?: Hand;
  gradYear?: number;
  position?: string;
  photo?: string;
};

const programPlayers: Omit<Player, "id">[] = [
  { firstName: "Kooper", lastName: "Allen", bats: "L", throws: "L", gradYear: 2029, position: "OF/P" },
  { firstName: "Gabriel", lastName: "Alvarado Holland", bats: "R", throws: "L", gradYear: 2030, position: "INF/P" },
  { firstName: "Colten", lastName: "Bentley", bats: "L", throws: "L", gradYear: 2030, position: "1B/P" },
  { firstName: "Graham", lastName: "Blair", bats: "R", throws: "R", gradYear: 2029, position: "OF" },
  { firstName: "Owen", lastName: "Blair", bats: "R", throws: "R", gradYear: 2027, position: "Util/P", photo: "/images/roster/owen-blair-throw.jpg" },
  { firstName: "Boston", lastName: "Campeotto", bats: "R", throws: "R", gradYear: 2028, position: "OF/P", photo: "/images/roster/boston-campeotto.jpg" },
  { firstName: "Nathan", lastName: "Clark", bats: "L", throws: "L", gradYear: 2027, position: "1B", photo: "/images/roster/nathan-clark.jpg" },
  { firstName: "Charles", lastName: "Copus", bats: "R", throws: "R", gradYear: 2027, position: "C", photo: "/images/roster/charles-copus.jpg" },
  { firstName: "Kamron", lastName: "Cox", bats: "R", throws: "R", gradYear: 2029, position: "1B" },
  { firstName: "Canon", lastName: "Dekinder", bats: "R", throws: "R", gradYear: 2030, position: "OF" },
  { firstName: "Eli", lastName: "Downing", bats: "R", throws: "R", gradYear: 2028, position: "Util", photo: "/images/roster/eli-downing.jpg" },
  { firstName: "Julian", lastName: "Escobar", bats: "R", throws: "R", gradYear: 2028, position: "INF/P" },
  { firstName: "Cooper", lastName: "Ferrell", bats: "R", throws: "R", gradYear: 2030, position: "C" },
  { firstName: "Gunner", lastName: "Fletcher", bats: "L", throws: "L", gradYear: 2027, position: "P", photo: "/images/roster/gunner-fletcher.jpg" },
  { firstName: "Cade", lastName: "Geiger", bats: "L", throws: "L", gradYear: 2027, position: "OF", photo: "/images/roster/cade-geiger-run.jpg" },
  { firstName: "Brennan", lastName: "Gray", bats: "R", throws: "R", gradYear: 2028, position: "Util/P", photo: "/images/roster/brennan-gray.jpg" },
  { firstName: "Nicolas", lastName: "Guerrero", bats: "L", throws: "L", gradYear: 2029, position: "Util/P" },
  { firstName: "Sutton", lastName: "Hall", bats: "R", throws: "R", gradYear: 2028, position: "INF/P" },
  { firstName: "Jayden", lastName: "Henderson", bats: "R", throws: "R", gradYear: 2027, position: "P", photo: "/images/roster/jayden-henderson.jpg" },
  { firstName: "Greyson", lastName: "Henley", bats: "R", throws: "R", gradYear: 2030, position: "C" },
  { firstName: "Carlos", lastName: "Hernandez", bats: "R", throws: "R", gradYear: 2030, position: "Util/P" },
  { firstName: "Jude", lastName: "Hinten", bats: "R", throws: "R", gradYear: 2029, position: "Util/P" },
  { firstName: "Blaine", lastName: "Hollingshead", bats: "L", throws: "R", gradYear: 2028, position: "OF/P" },
  { firstName: "Kamden", lastName: "Hotz", bats: "R", throws: "R", gradYear: 2027, position: "Util", photo: "/images/roster/kamden-hotz.jpg" },
  { firstName: "Payson", lastName: "Jarvis", bats: "R", throws: "R", gradYear: 2027, position: "OF/P", photo: "/images/roster/payson-jarvis.jpg" },
  { firstName: "Lucas", lastName: "Jellison", bats: "L", throws: "R", gradYear: 2029, position: "OF/P" },
  { firstName: "Jake", lastName: "Johnson", bats: "R", throws: "R", gradYear: 2030, position: "OF/P" },
  { firstName: "Wyatt", lastName: "Jones", bats: "R", throws: "R", gradYear: 2027, position: "OF/P", photo: "/images/roster/wyatt-jones-rail.jpg" },
  { firstName: "Zayden", lastName: "Khalil", bats: "R", throws: "R", gradYear: 2028, position: "INF", photo: "/images/roster/zayden-khalil.jpg" },
  { firstName: "Preston", lastName: "Klose", bats: "R", throws: "R", gradYear: 2027, position: "1B/P", photo: "/images/roster/preston-klose.jpg" },
  { firstName: "Damien", lastName: "Leal", bats: "R", throws: "R", gradYear: 2028, position: "INF/P" },
  { firstName: "Jackson", lastName: "Martinez", bats: "R", throws: "R", gradYear: 2030, position: "OF/P" },
  { firstName: "Jackson", lastName: "Massar", bats: "R", throws: "R", gradYear: 2029, position: "OF" },
  { firstName: "Jordan", lastName: "Massar", bats: "L", throws: "L", gradYear: 2030, position: "OF/P" },
  { firstName: "MJ", lastName: "McAlister Jr.", bats: "R", throws: "R", gradYear: 2029, position: "INF/P" },
  { firstName: "Pryce", lastName: "McClure", bats: "R", throws: "R", gradYear: 2027, position: "INF/P", photo: "/images/roster/pryce-mcclure-mound.jpg" },
  { firstName: "Chance", lastName: "McPherson", bats: "R", throws: "R", gradYear: 2030, position: "1B" },
  { firstName: "Wiley", lastName: "Moery", bats: "R", throws: "R", gradYear: 2030, position: "OF/P" },
  { firstName: "Riley", lastName: "Molloy", bats: "R", throws: "R", gradYear: 2030, position: "INF" },
  { firstName: "Luke", lastName: "Moy", bats: "R", throws: "R", gradYear: 2030, position: "OF" },
  { firstName: "Kyson", lastName: "Nemecek", bats: "R", throws: "R", gradYear: 2030, position: "1B/P" },
  { firstName: "Brantley", lastName: "Odom", bats: "R", throws: "R", gradYear: 2029, position: "INF/P" },
  { firstName: "Drake", lastName: "Pace", bats: "R", throws: "L", gradYear: 2027, position: "INF", photo: "/images/roster/drake-pace.jpg" },
  { firstName: "Daxton", lastName: "Pierson", bats: "L", throws: "L", gradYear: 2027, position: "1B", photo: "/images/roster/daxton-pierson.jpg" },
  { firstName: "Jacoby", lastName: "Prentice", bats: "R", throws: "R", gradYear: 2030, position: "Util/P" },
  { firstName: "Hunter", lastName: "Rule", bats: "R", throws: "R", gradYear: 2029, position: "1B/P" },
  { firstName: "Cade", lastName: "Rush", bats: "R", throws: "R", gradYear: 2027, position: "P", photo: "/images/roster/cade-rush.jpg" },
  { firstName: "Cole", lastName: "Schmidt", bats: "R", throws: "R", gradYear: 2028, position: "Util/P", photo: "/images/roster/cole-schmidt.jpg" },
  { firstName: "Caleb", lastName: "Schneider", bats: "R", throws: "R", gradYear: 2027, position: "Util", photo: "/images/roster/caleb-schneider.jpg" },
  { firstName: "Jackson", lastName: "Sevier", bats: "R", throws: "R", gradYear: 2030, position: "INF/P" },
  { firstName: "Jake", lastName: "Stein", bats: "R", throws: "R", gradYear: 2030, position: "INF" },
  { firstName: "Clayton", lastName: "Strange", bats: "R", throws: "R", gradYear: 2027, position: "OF/P", photo: "/images/roster/clayton-strange-walk.jpg" },
  { firstName: "Raden", lastName: "Warford", bats: "R", throws: "R", gradYear: 2030, position: "Util/P" },
  { firstName: "Koda", lastName: "Fish", bats: "R", throws: "R", gradYear: 2030, position: "INF/P" },
  { firstName: "Vince", lastName: "Yanda", bats: "R", throws: "R", gradYear: 2030, position: "1B/P" },
  { firstName: "Rhys", lastName: "Hampton", bats: "R", throws: "R", gradYear: 2030, position: "Util/P" },
];

function playerId(player: Omit<Player, "id">) {
  return `${player.lastName}-${player.firstName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const players: Player[] = programPlayers
  .map((player) => ({ ...player, id: playerId(player) }))
  .sort((a, b) => {
    const last = a.lastName.localeCompare(b.lastName, "en", {
      sensitivity: "base",
    });
    if (last !== 0) return last;
    return a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" });
  });

export function displayName(player: Player) {
  return `${player.lastName}, ${player.firstName}`;
}

export function fullName(player: Player) {
  return `${player.firstName} ${player.lastName}`;
}

export function playerIndex(id: string, list: Player[] = players) {
  return list.findIndex((player) => player.id === id);
}

export function adjacentPlayer(
  id: string,
  direction: -1 | 1,
  list: Player[] = players,
) {
  const index = playerIndex(id, list);
  if (index < 0 || list.length === 0) return undefined;
  return list[(index + direction + list.length) % list.length];
}

export function bioValue(value?: string | number) {
  if (value === undefined || value === "") return "—";
  return String(value);
}

export function rosterGroups(list: Player[] = players) {
  const groups = new Map<string, Player[]>();
  for (const player of list) {
    const letter = player.lastName[0]?.toUpperCase() ?? "#";
    const bucket = groups.get(letter) ?? [];
    bucket.push(player);
    groups.set(letter, bucket);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function rosterClassYears(list: Player[] = players) {
  return [
    ...new Set(
      list
        .map((player) => player.gradYear)
        .filter((year): year is number => year !== undefined),
    ),
  ].sort((a, b) => a - b);
}

export function playersForClass(
  year: number | "all",
  list: Player[] = players,
) {
  if (year === "all") return list;
  return list.filter((player) => player.gradYear === year);
}

export const rosterPositionOrder = [
  "C",
  "P",
  "1B",
  "INF",
  "OF",
  "Util",
] as const;

export type RosterPosition = (typeof rosterPositionOrder)[number];

export function playerPositions(player: Player) {
  return (player.position ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function playerPlaysPosition(
  player: Player,
  position: string | "all",
) {
  if (position === "all") return true;
  return playerPositions(player).includes(position);
}

export function rosterPositions(list: Player[] = players) {
  const present = new Set(list.flatMap(playerPositions));
  return rosterPositionOrder.filter((position) => present.has(position));
}

export function playersForRoster(
  year: number | "all",
  position: string | "all" = "all",
  list: Player[] = players,
) {
  return playersForClass(year, list).filter((player) =>
    playerPlaysPosition(player, position),
  );
}
