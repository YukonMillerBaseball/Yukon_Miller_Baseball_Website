export const campRegistrationUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSe0XUBtP7f2KoVQCCuArpfWgZ2QXNKkm77Ifhi8rwu5QAMxEg/viewform?usp=header";

export const campsPageKicker = "Player development";
export const campsPageTitle = "Camps";

/** Shown on /camps while activeCamp is null. */
export const campsComingSoon = {
  headline: "Winter Baseball Camp information coming soon.",
  detail:
    "Check back for upcoming Yukon Miller Baseball camps and registration details.",
} as const;

export type CampSeason = {
  title: string;
  ages: string;
  lede: string;
  shareDescription: string;
  shareImage: string;
  shareImageAlt: string;
  note: string;
  twoCampNote: string;
  coachEmail: string;
  registrationUrl: string;
  flyerSrc: string;
  flyerAlt: string;
  qrSrc: string;
  qrAlt: string;
  pdfHref: string;
  location: {
    name: string;
    street: string;
    cityStateZip: string;
    detail: string;
  };
  payment: {
    venmo: string;
    checkTo: string;
    methods: readonly string[];
  };
  sessions: readonly {
    id: string;
    name: string;
    dates: string;
    time: string;
    price: string;
    cap: string;
  }[];
};

/**
 * Archived October 12–13 Fall Baseball Camp.
 * Historical reference only. Do not assign this to activeCamp.
 */
export const fallCamps = {
  title: "Yukon Miller Fall Baseball Camps",
  ages: "Ages 7–12",
  lede: "Yukon Miller Fall Baseball Camps are posted. Ages 7–12 work infield, outfield, pitching, and hitting at Miller Field. Register with the form or the QR code — a spot is not held until payment lands.",
  shareDescription:
    "Ages 7–12 at Miller Field. Infield/outfield, pitching, and hitting on October 12–13. A spot is not held until payment lands.",
  shareImage: "/images/camps/fall-camps-opengraph.jpg",
  // The same card is also stored at /images/camps/fall-camps-twitter.jpg.
  shareImageAlt:
    "Yukon Miller Fall Baseball Camps flyer for ages 7–12, October 12–13 at Miller Field",
  note: "A spot is not secure until payment is made. Camp capacity is limited.",
  twoCampNote:
    "Registering for two camps? Fill out a second registration. The all-three price is the only package discount. Sessions that stack have a 30-minute gap for lunch — no concession stand.",
  coachEmail: "ryan.phillips@yukonps.com",
  registrationUrl: campRegistrationUrl,
  flyerSrc: "/images/camps/fall-camps-flyer.jpg",
  flyerAlt:
    "Yukon Miller Fall Baseball Camps flyer for ages 7–12, October 12–13 at Miller Field",
  qrSrc: "/images/camps/fall-register-qr.png",
  qrAlt: "QR code that opens the Yukon Miller Fall Baseball Camps registration form",
  pdfHref: "/yukon-fall-baseball-camps.pdf",
  location: {
    name: "Miller Field",
    street: "1777 S Yukon Parkway",
    cityStateZip: "Yukon, OK 73099",
    detail: "Behind Yukon High School",
  },
  payment: {
    venmo: "@ryanphillipsBC",
    checkTo: "Ryan Phillips Baseball Camps",
    methods: [
      "Venmo @ryanphillipsBC",
      "Cash",
      "Check payable to Ryan Phillips Baseball Camps",
    ],
  },
  sessions: [
    {
      id: "infield-outfield",
      name: "Infield / Outfield Camp",
      dates: "October 12",
      time: "10:00–11:30 a.m.",
      price: "$40",
      cap: "Limited to 20 players",
    },
    {
      id: "pitching",
      name: "Pitching Camp",
      dates: "October 13",
      time: "10:00–11:30 a.m.",
      price: "$40",
      cap: "Limited to 20 players",
    },
    {
      id: "hitting",
      name: "Hitting Camp",
      dates: "October 12 & 13",
      time: "12:00–1:30 p.m.",
      price: "$70",
      cap: "Limited to 30 players",
    },
    {
      id: "all-three",
      name: "All Three Camps",
      dates: "October 12 & 13",
      time: "Both sessions each day",
      price: "$130",
      cap: "Package price — register once",
    },
  ],
} as const satisfies CampSeason;

/** Past seasons kept in the repo. The public page does not render this list. */
export const archivedCamps = [fallCamps] as const;

/**
 * Camp posted on /camps.
 * Leave null to show the coming-soon message and hide registration and cards.
 * To open Winter Camp, add a CampSeason (copy fallCamps and replace the
 * dates, prices, flyer, and registrationUrl) and assign it here:
 *
 * export const activeCamp: CampSeason | null = winterCamps;
 */
export const activeCamp: CampSeason | null = null;
