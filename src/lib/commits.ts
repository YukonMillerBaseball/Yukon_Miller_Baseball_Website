export type SchoolLogo = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

export type Commit = {
  id: string;
  pick: string;
  player: string;
  school: string;
  mascot: string;
  division: string;
  conference: string;
  city: string;
  stadium: string;
  colors: {
    primary: string;
    secondary: string;
  };
  logo: SchoolLogo;
  newsSlug?: string;
};

export const commits: Commit[] = [
  {
    id: "drake-pace",
    pick: "01",
    player: "Drake Pace",
    school: "Oral Roberts University",
    mascot: "Golden Eagles",
    division: "NCAA Division I",
    conference: "Summit League",
    city: "Tulsa, Oklahoma",
    stadium: "J.L. Johnson Stadium",
    colors: { primary: "#091F40", secondary: "#C6B784" },
    logo: {
      src: "/images/schools/oru-golden-eagles.png",
      width: 200,
      height: 200,
      alt: "Oral Roberts Golden Eagles baseball logo",
    },
    newsSlug: "drake-pace-oral-roberts",
  },
  {
    id: "clayton-strange",
    pick: "02",
    player: "Clayton Strange",
    school: "Hutchinson Community College",
    mascot: "Blue Dragons",
    division: "NJCAA Division I",
    conference: "Kansas Jayhawk Community College Conference",
    city: "Hutchinson, Kansas",
    stadium: "Hobart–Detter Field",
    colors: { primary: "#0033A0", secondary: "#C8102E" },
    logo: {
      src: "/images/schools/hutchinson-blue-dragons.png",
      width: 800,
      height: 341,
      alt: "Hutchinson Blue Dragons baseball logo",
    },
    newsSlug: "clayton-strange-hutchinson",
  },
  {
    id: "pryce-mcclure",
    pick: "03",
    player: "Pryce McClure",
    school: "Barton Community College",
    mascot: "Cougars",
    division: "NJCAA Division I",
    conference: "Kansas Jayhawk Community College Conference",
    city: "Great Bend, Kansas",
    stadium: "Lawson-Biggs Field",
    colors: { primary: "#0057B8", secondary: "#D4AF37" },
    logo: {
      src: "/images/schools/barton-cougars-baseball.png",
      width: 510,
      height: 141,
      alt: "Barton Cougars baseball logo",
    },
    newsSlug: "pryce-mcclure-barton",
  },
  {
    id: "gunner-fletcher",
    pick: "04",
    player: "Gunner Fletcher",
    school: "Southwestern Christian University",
    mascot: "Eagles",
    division: "NAIA",
    conference: "Sooner Athletic Conference",
    city: "Bethany, Oklahoma",
    stadium: "Eagle Field at Dolese Park",
    colors: { primary: "#0B1E4A", secondary: "#E36C1A" },
    logo: {
      src: "/images/schools/southwestern-christian-eagles.png",
      width: 458,
      height: 320,
      alt: "Southwestern Christian University Eagles baseball logo",
    },
    newsSlug: "gunner-fletcher-southwestern-christian",
  },
  {
    id: "kamden-hotz",
    pick: "05",
    player: "Kamden Hotz",
    school: "Kansas Wesleyan University",
    mascot: "Coyotes",
    division: "NAIA",
    conference: "Kansas Collegiate Athletic Conference",
    city: "Salina, Kansas",
    stadium: "Dean Evans Stadium",
    colors: { primary: "#5829B6", secondary: "#E8B923" },
    logo: {
      src: "/images/schools/kansas-wesleyan-coyotes.png",
      width: 754,
      height: 240,
      alt: "Kansas Wesleyan Coyotes wordmark",
    },
    newsSlug: "kamden-hotz-kansas-wesleyan",
  },
];
