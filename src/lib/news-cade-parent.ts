import type { ArticleBlock } from "@/lib/news-blocks";

export const cadeParentStory = {
  slug: "cade-parent-arizona-diamondbacks-area-scout",
  title:
    "Former Yukon Pitcher Cade Parent Joins Arizona Diamondbacks as Area Scout",
  date: "November 26, 2026",
  category: "News" as const,
  excerpt:
    "The former Miller has joined the Diamondbacks as an Area Scout after pitching at Yukon and Oklahoma Christian and working in college baseball operations.",
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
    "Former Yukon High School pitcher Cade Parent has joined the Arizona Diamondbacks as an Area Scout, taking the next step in a baseball career that began on the mound for the Millers.",
  ],
  blocks: [
    {
      type: "p",
      text: "Former Yukon High School pitcher Cade Parent has joined the Arizona Diamondbacks as an Area Scout, taking the next step in a baseball career that began on the mound for the Millers.",
    },
    {
      type: "p",
      text: "Parent, a Class of 2022 right-hander, pitched at Yukon and then for Oklahoma Christian from 2022 to 2023. He went on to serve as the Eagles’ Director of Baseball Operations, overseeing the program’s camps, analytics, equipment, travel, and game-day operations.",
    },
    {
      type: "p",
      text: "This year, that work moved from a college staff toward Major League Baseball. In an update shared by his father, Matt Parent, Cade spent the summer as Director of Baseball Operations for the Cape Cod Baseball League and worked on Baylor’s baseball staff in August and September. His public profile lists his role as Area Scout for the Arizona Diamondbacks.",
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
