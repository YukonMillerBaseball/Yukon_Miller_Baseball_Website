import type { ArticleBlock } from "@/lib/news-blocks";
import { seniors2026Story } from "@/lib/news-2026-seniors";
import { threeMoreMillersStory } from "@/lib/news-three-more-millers";
import { carsonBengeStory } from "@/lib/news-carson-benge";
import { class2aYukonStory } from "@/lib/news-class-2a-yukon";
import { coltonStrangeStory } from "@/lib/news-colton-strange";
import { hofBanquetStory } from "@/lib/news-hof-banquet";
import { joeLytleStory } from "@/lib/news-joe-lytle";
import { schedule2027Story } from "@/lib/news-2027-schedule";
import { czechFestivalStory } from "@/lib/news-czech-festival";
import { fallCampStory } from "@/lib/news-fall-camp";
import { gunnerFletcherStory } from "@/lib/news-gunner-fletcher";
import { kamdenHotzStory } from "@/lib/news-kamden-hotz";

export type ArticleImageVariant = {
  src: string;
  width: number;
  height: number;
  focus?: string;
};

export type ArticleImage = {
  src: string;
  alt: string;
  width: number;
  height: number;
  focus?: string;
  size?: "half" | "feature";
  hero?: boolean;
  expand?: boolean;
  card?: ArticleImageVariant;
  banner?: ArticleImageVariant;
};

export type Article = {
  slug: string;
  title: string;
  date: string;
  category: "News" | "Commit" | "Update";
  excerpt: string;
  body: string[];
  image?: ArticleImage;
  blocks?: ArticleBlock[];
};

export const articles: Article[] = [
  kamdenHotzStory,
  fallCampStory,
  czechFestivalStory,
  gunnerFletcherStory,
  schedule2027Story,
  joeLytleStory,
  hofBanquetStory,
  carsonBengeStory,
  coltonStrangeStory,
  class2aYukonStory,
  {
    slug: "drake-pace-oral-roberts",
    title: "Drake Pace commits to Oral Roberts",
    date: "Program announcement",
    category: "Commit",
    excerpt:
      "Pace is headed to Oral Roberts University, the NCAA Division I Golden Eagles in Tulsa.",
    image: {
      src: "/images/news/drake-pace-oral-roberts.jpg",
      alt: "Drake Pace swinging through a pitch in a Yukon Miller uniform",
      width: 1169,
      height: 741,
      focus: "42% 28%",
    },
    body: [
      "Yukon High School Baseball announced that Drake Pace has committed to Oral Roberts University.",
      "ORU is Tulsa’s Division I club — a Summit League regular with a College World Series on the résumé, now playing at Chapman Park.",
    ],
  },
  {
    slug: "clayton-strange-hutchinson",
    title: "Clayton Strange commits to Hutchinson CC",
    date: "Posted on yukonbaseball.com",
    category: "Commit",
    excerpt:
      "Strange is the latest Miller to keep playing after high school, signing with Hutchinson Community College.",
    image: {
      src: "/images/news/clayton-strange-hutchinson.jpg",
      alt: "Clayton Strange delivering a pitch on the mound in a Yukon Miller uniform",
      width: 1179,
      height: 1580,
      focus: "48% 34%",
    },
    body: [
      "Yukon High School Baseball announced that Clayton Strange has committed to Hutchinson Community College.",
      "The Blue Dragons just finished No. 22 in NJCAA Division I at 46-15 after a record 131-homer season — two years after a 51-win Jayhawk West title.",
    ],
  },
  {
    slug: "pryce-mcclure-barton",
    title: "Pryce McClure commits to Barton CC",
    date: "Program announcement",
    category: "Commit",
    excerpt:
      "McClure will play for the Barton Cougars, NJCAA Division I baseball in Great Bend, Kansas.",
    image: {
      src: "/images/roster/pryce-mcclure-pitch.jpg",
      alt: "Pryce McClure pitching in a Yukon Miller uniform",
      width: 1320,
      height: 1419,
      focus: "center 28%",
      size: "half",
    },
    body: [
      "Yukon High School Baseball announced that Pryce McClure has committed to Barton Community College.",
      "The Cougars just knocked off No. 2 Cloud County and reached the Plains District final four — NJCAA Division I baseball in Great Bend.",
    ],
  },
  threeMoreMillersStory,
  seniors2026Story,
];

const reservedSlug = "archive";

if (articles.some((article) => article.slug === reservedSlug)) {
  throw new Error(
    `The slug "${reservedSlug}" is reserved for /news/archive and cannot be an article.`,
  );
}

export const latestNewsLimit = 8;

export function getArticle(slug: string) {
  if (slug === reservedSlug) return undefined;
  return articles.find((article) => article.slug === slug);
}

export function latestArticles(limit = 3) {
  return articles.slice(0, limit);
}

export function archivedArticles() {
  return articles.slice(latestNewsLimit);
}
