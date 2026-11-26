import type { ArticleBlock } from "@/lib/news-blocks";

export const cadeParentStory = {
  slug: "cade-parent-arizona-diamondbacks-area-scout",
  title:
    "Former Yukon Miller Cade Parent Joins Arizona Diamondbacks as Area Scout",
  date: "November 26, 2026",
  category: "News" as const,
  excerpt:
    "The former Miller has joined the Diamondbacks as an Area Scout after Yukon, Oklahoma Christian, the Cape Cod Baseball League, and Baylor.",
  image: {
    src: "/images/news/cade-parent-arizona-diamondbacks-area-scout.jpg",
    alt: "Cade Parent in an Oklahoma Christian baseball staff portrait",
    width: 1600,
    height: 2000,
    focus: "center 30%",
    size: "feature" as const,
    banner: {
      src: "/images/news/cade-parent-arizona-diamondbacks-area-scout-banner.jpg",
      width: 1600,
      height: 1280,
      focus: "center",
    },
    card: {
      src: "/images/news/cade-parent-arizona-diamondbacks-area-scout-card.jpg",
      width: 800,
      height: 640,
      focus: "center",
    },
  },
  body: [
    "Former Yukon Miller Cade Parent has joined the Arizona Diamondbacks as an Area Scout, taking the next step in a baseball career that began with the Millers.",
  ],
  blocks: [
    {
      type: "p",
      text: "Former Yukon Miller Cade Parent has joined the Arizona Diamondbacks as an Area Scout, taking the next step in a baseball career that began with the Millers.",
    },
    {
      type: "p",
      text: "Parent, Class of 2022, pitched at Yukon High School. At Oklahoma Christian, an injury ended his playing career. He went on to serve as the Eagles’ Director of Baseball Operations, overseeing the program’s camps, analytics, equipment, travel, and game-day operations.",
    },
    {
      type: "p",
      text: "He spent this past summer as Director of Baseball Operations for the Cape Cod Baseball League, then worked on Baylor’s baseball staff in August and September. He is now an Area Scout for the Arizona Diamondbacks.",
    },
    {
      type: "p",
      text: "Congratulations to Cade Parent. Yukon Miller Baseball is proud to see a former Miller working in Major League Baseball.",
    },
    {
      type: "note",
      text: "Once a Miller, Always a Miller!",
    },
  ] satisfies ArticleBlock[],
};
