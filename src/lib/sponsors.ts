export type SponsorTierId =
  | "presenting"
  | "scoreboard"
  | "cycle"
  | "grand-slam"
  | "signature"
  | "home-run"
  | "triple";

export type SponsorLogo = {
  src: string;
  width: number;
  height: number;
};

export type Sponsor = {
  id: string;
  name: string;
  mark: string;
  tier: SponsorTierId;
  placement: string;
  kicker?: string;
  href?: string;
  logo?: SponsorLogo;
};

const sponsorLogos: Record<string, SponsorLogo> = {
  "amada-senior-care": { src: "/images/sponsors/logos/amada-senior-care.png", width: 900, height: 178 },
  "army-national-guard": { src: "/images/sponsors/logos/army-national-guard.png", width: 217, height: 232 },
  "asher-oilfield-services": { src: "/images/sponsors/logos/asher-oilfield-services.png", width: 900, height: 340 },
  "bad-brads": { src: "/images/sponsors/logos/bad-brads.png", width: 181, height: 113 },
  "bancfirst": { src: "/images/sponsors/logos/bancfirst.png", width: 900, height: 185 },
  "bell-carpet": { src: "/images/sponsors/logos/bell-carpet.png", width: 224, height: 224 },
  "bk-weaver": { src: "/images/sponsors/logos/bk-weaver.png", width: 220, height: 100 },
  "brady-built": { src: "/images/sponsors/logos/brady-built.png", width: 198, height: 153 },
  "browns-driving-school": { src: "/images/sponsors/logos/browns-driving-school.png", width: 780, height: 231 },
  "caseys": { src: "/images/sponsors/logos/caseys.png", width: 900, height: 351 },
  "clemens-blair": { src: "/images/sponsors/logos/clemens-blair.png", width: 900, height: 900 },
  "cooper-autogroup": { src: "/images/sponsors/logos/cooper-autogroup.png", width: 900, height: 251 },
  "crabtree": { src: "/images/sponsors/logos/crabtree.png", width: 900, height: 207 },
  "dunkin": { src: "/images/sponsors/logos/dunkin-of-yukon.png", width: 900, height: 265 },
  "cso-orthodontics": { src: "/images/sponsors/logos/cso-orthodontics.png", width: 900, height: 298 },
  "earls-rib-palace": { src: "/images/sponsors/logos/earls-rib-palace.png", width: 622, height: 420 },
  "five-iron-golf": { src: "/images/sponsors/logos/five-iron-golf.png", width: 303, height: 40 },
  "flat-top": { src: "/images/sponsors/logos/flat-top.png", width: 306, height: 134 },
  "fm-bank": { src: "/images/sponsors/logos/fm-bank.png", width: 683, height: 132 },
  "gatlin": { src: "/images/sponsors/logos/gatlin.png", width: 385, height: 130 },
  "h-spraying": { src: "/images/sponsors/logos/h-spraying.png", width: 900, height: 273 },
  "h2-health": { src: "/images/sponsors/logos/h2-health.png", width: 900, height: 517 },
  "harris-ellis": { src: "/images/sponsors/logos/harris-ellis.png", width: 300, height: 161 },
  "interbank": { src: "/images/sponsors/logos/interbank.png", width: 900, height: 164 },
  "justin-sullivan": { src: "/images/sponsors/logos/justin-sullivan.png", width: 900, height: 787 },
  "liberty-tax": { src: "/images/sponsors/logos/liberty-tax.png", width: 900, height: 521 },
  "livewell": { src: "/images/sponsors/logos/livewell.png", width: 269, height: 270 },
  "lowes": { src: "/images/sponsors/logos/lowes.png", width: 900, height: 424 },
  "noahs-7-heaven": { src: "/images/sponsors/logos/noahs-7-heaven.png", width: 600, height: 600 },
  "notable-roofing": { src: "/images/sponsors/logos/notable-roofing.png", width: 900, height: 238 },
  "oklahoma-tag-yukon": { src: "/images/sponsors/logos/oklahoma-tag-yukon.png", width: 900, height: 281 },
  "opponent-iq": { src: "/images/sponsors/logos/opponent-iq.png", width: 900, height: 340 },
  "rkpb": { src: "/images/sponsors/logos/rkpb.png", width: 373, height: 420 },
  "security-benefit": { src: "/images/sponsors/logos/security-benefit.png", width: 570, height: 112 },
  "senior-care": { src: "/images/sponsors/logos/senior-care.png", width: 200, height: 56 },
  "sod-by-sherry": { src: "/images/sponsors/logos/sod-by-sherry.png", width: 540, height: 260 },
  "surf-bar": { src: "/images/sponsors/logos/surf-bar.png", width: 900, height: 188 },
  "tfcu": { src: "/images/sponsors/logos/tfcu.png", width: 398, height: 134 },
  "the-lokal": { src: "/images/sponsors/logos/the-lokal.png", width: 237, height: 213 },
  "together-we-church": { src: "/images/sponsors/logos/together-we-church.png", width: 381, height: 420 },
  "trane": { src: "/images/sponsors/logos/trane.png", width: 389, height: 129 },
  "yukon-national-bank": { src: "/images/sponsors/logos/yukon-national-bank.png", width: 150, height: 72 },
};

export const sponsorTiers: {
  id: SponsorTierId;
  label: string;
  kicker: string;
  blurb: string;
}[] = [
  {
    id: "presenting",
    label: "Presenting",
    kicker: "Program partner",
    blurb: "The largest 2026 program gift on the Home Run Club sheet.",
  },
  {
    id: "scoreboard",
    label: "Scoreboard",
    kicker: "Title partner",
    blurb: "The name on the Miller Field scoreboard — a two-year Yukon Baseball partner through 2027.",
  },
  {
    id: "cycle",
    label: "The Cycle",
    kicker: "Top club",
    blurb: "The Cycle package: outfield presence, home-game recognition, and four tickets to home games at the main field.",
  },
  {
    id: "grand-slam",
    label: "Grand Slam Club",
    kicker: "Outfield",
    blurb: "Grand Slam partners own the big outfield banners and get a table at a home game.",
  },
  {
    id: "signature",
    label: "Signature",
    kicker: "Game night",
    blurb: "In-game partners — foul balls, starting lineups, and the moments between pitches.",
  },
  {
    id: "home-run",
    label: "Home Run Club",
    kicker: "Outfield wall",
    blurb: "The 8′ × 7′ outfield banners that wrap Miller Field.",
  },
  {
    id: "triple",
    label: "Triple Club",
    kicker: "Entry gate",
    blurb: "3′ × 3′ signs at the Miller Field entry.",
  },
];

const sponsorList: Sponsor[] = [
  {
    id: "cooper-autogroup",
    name: "Cooper Autogroup",
    mark: "CA",
    tier: "presenting",
    placement: "Presenting partner · 2026 program sponsorship",
    href: "https://cooperautogroup.com",
  },
  {
    id: "browns-driving-school",
    name: "Brown's Driving School",
    mark: "BD",
    tier: "scoreboard",
    placement: "Scoreboard · two-year partner through 2027",
    href: "https://brownsdrivingschools.com",
  },
  {
    id: "fm-bank",
    name: "F&M Bank",
    mark: "F&M",
    tier: "cycle",
    placement: "The Cycle · Miller Field",
    href: "https://www.fmbankok.com",
  },
  {
    id: "tfcu",
    name: "TFCU",
    mark: "TF",
    tier: "grand-slam",
    placement: "Grand Slam · outfield banner",
    href: "https://www.tinkerfcu.org",
  },
  {
    id: "together-we-church",
    name: "Together We Church",
    mark: "TW",
    tier: "grand-slam",
    placement: "Grand Slam · outfield banner",
    href: "https://togetherwechurch.com",
  },
  {
    id: "clemens-blair",
    name: "Clemens & Blair",
    mark: "CB",
    tier: "grand-slam",
    placement: "Grand Slam · outfield banner",
    href: "https://www.cbklawfirm.com",
  },
  {
    id: "the-lokal",
    name: "The Lokal",
    mark: "LK",
    tier: "signature",
    placement: "Home Run Club banner · first foul ball of every inning",
    kicker: "Foul Ball Sponsor",
    href: "https://thelokalrestaurant.com",
  },
  {
    id: "noahs-7-heaven",
    name: "Noah's 7 Heaven",
    mark: "N7",
    tier: "signature",
    placement: "Sign plus starting lineups",
    kicker: "Starting Lineups and Ingame Sponsor",
    href: "https://www.noahsheaven7.org",
  },
  {
    id: "liberty-tax",
    name: "Liberty Tax",
    mark: "LT",
    tier: "signature",
    placement: "Signature · Grandstand Sponsor",
    kicker: "Grandstand Sponsor",
    href: "https://www.libertytax.com/income-tax-preparation-locations/oklahoma/yukon/16314",
  },
  {
    id: "five-iron-golf",
    name: "Five Iron Golf",
    mark: "FI",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://fiveirongolf.com/locations/oklahoma-city-yukon",
  },
  {
    id: "dunkin",
    name: "Dunkin' of Yukon",
    mark: "D",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.dunkindonuts.com/locations/us/ok/yukon/717-north-mustang-road/store-363907/",
  },
  {
    id: "earls-rib-palace",
    name: "Earl's Rib Palace",
    mark: "ER",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://earlsribpalace.com/locations/yukon/",
  },
  {
    id: "h2-health",
    name: "H2 Health",
    mark: "H2",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.h2health.com/locations/valir-physical-therapy/yukon-ok/",
  },
  {
    id: "amada-senior-care",
    name: "Amada Senior Care",
    mark: "AS",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.amadaseniorcare.com/oklahoma-city-senior-care/",
  },
  {
    id: "senior-care",
    name: "Senior Care",
    mark: "SC",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.seniorlivingok.com",
  },
  {
    id: "yukon-national-bank",
    name: "Yukon National Bank",
    mark: "YN",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.ynbok.com",
  },
  {
    id: "livewell",
    name: "LiveWell",
    mark: "LW",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.livewellpcp.com",
  },
  {
    id: "lowes",
    name: "Lowe's of Yukon",
    mark: "LO",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.lowes.com/store/OK-Yukon/1134",
  },
  {
    id: "security-benefit",
    name: "Security Benefit",
    mark: "SB",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
  },
  {
    id: "bancfirst",
    name: "BancFirst",
    mark: "BF",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.bancfirst.bank",
  },
  {
    id: "caseys",
    name: "Casey's General Store",
    mark: "CG",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.caseys.com",
  },
  {
    id: "notable-roofing",
    name: "Notable Roofing",
    mark: "NR",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.notableroofing.com",
  },
  {
    id: "oklahoma-tag-yukon",
    name: "Oklahoma Tag of Yukon",
    mark: "OT",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://oktagyukon.com/index.htm",
  },
  {
    id: "h-spraying",
    name: "H Spraying",
    mark: "HS",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://hspraying.com",
  },
  {
    id: "flat-top",
    name: "Flat Top Lawn & Landscape",
    mark: "FT",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
  },
  {
    id: "bell-carpet",
    name: "Bell Carpet Cleaning",
    mark: "BC",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://bellccs.com",
  },
  {
    id: "interbank",
    name: "Interbank",
    mark: "IB",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.interbank.com/branch/yukon/",
  },
  {
    id: "bad-brads",
    name: "Bad Brad's BBQ",
    mark: "BB",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://yukon.badbrads.com",
  },
  {
    id: "sod-by-sherry",
    name: "Sod by Sherry",
    mark: "SS",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.sodbysherry.com",
  },
  {
    id: "surf-bar",
    name: "The Surf Bar",
    mark: "SB",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://surfbar.com",
  },
  {
    id: "trane",
    name: "Trane",
    mark: "TR",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
  },
  {
    id: "bk-weaver",
    name: "BK Weaver",
    mark: "BK",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
  },
  {
    id: "cso-orthodontics",
    name: "CSO Orthodontics",
    mark: "CSO",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://osobraces.com/locations/yukon/",
  },
  {
    id: "crabtree",
    name: "Crabtree Custom Homes",
    mark: "CC",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.homesbycrabtree.com",
  },
  {
    id: "army-national-guard",
    name: "Army National Guard",
    mark: "NG",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://goguardok.com",
  },
  {
    id: "asher-oilfield-services",
    name: "Asher Oilfield Services",
    mark: "AO",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
  },
  {
    id: "harris-ellis",
    name: "Harris-Ellis Equipment",
    mark: "HE",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://harrisellisequipment.com",
  },
  {
    id: "justin-sullivan",
    name: "Justin Sullivan",
    mark: "JS",
    tier: "home-run",
    placement: "Outfield banner · in memory",
  },
  {
    id: "rkpb",
    name: "Roberson Kolker Prentice Burns",
    mark: "RK",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://www.oktriallawyers.com",
  },
  {
    id: "gatlin",
    name: "Gatlin Heat & Air",
    mark: "GH",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://gatlinheatandair.com",
  },
  {
    id: "opponent-iq",
    name: "Opponent IQ",
    mark: "OI",
    tier: "home-run",
    placement: "Home Run Club · outfield banner",
    href: "https://app.opponentiq.com",
  },
  {
    id: "brady-built",
    name: "Brady Built Homes",
    mark: "BB",
    tier: "triple",
    placement: "Triple Club · entry-gate sign",
    href: "https://bradybuilt.com",
  },
];

export const sponsors: Sponsor[] = sponsorList.map((sponsor) => ({
  ...sponsor,
  logo: sponsorLogos[sponsor.id],
}));

export function sponsorsByTier(tier: SponsorTierId) {
  return sponsors
    .filter((sponsor) => sponsor.tier === tier)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const featuredSponsors = [
  ...sponsorsByTier("presenting"),
  ...sponsorsByTier("scoreboard"),
  ...sponsorsByTier("cycle"),
  ...sponsorsByTier("grand-slam"),
  ...sponsorsByTier("signature"),
];

export const sponsorCount = sponsors.length;

export const sponsorshipForm = {
  href: "/2026-2027-sponsorship-packet.pdf",
  title: "2026–27 Sponsorship Packet",
} as const;
