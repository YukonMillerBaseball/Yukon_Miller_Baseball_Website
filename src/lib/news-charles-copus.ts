import type { ArticleBlock } from "@/lib/news-blocks";

export const charlesCopusStory = {
  slug: "charles-copus-noc-tonkawa",
  title: "Charles Copus commits to Northern Oklahoma College–Tonkawa",
  date: "November 25, 2026",
  category: "Commit" as const,
  excerpt:
    "Copus will continue his academic and baseball career with the Mavericks at Northern Oklahoma College–Tonkawa.",
  image: {
    src: "/images/news/charles-copus-noc-tonkawa.jpg",
    alt: "Charles Copus commitment graphic for Northern Oklahoma College–Tonkawa baseball",
    width: 986,
    height: 1190,
    focus: "center 42%",
    size: "half" as const,
    expand: true,
    banner: {
      src: "/images/news/charles-copus-noc-tonkawa-banner.jpg",
      width: 1600,
      height: 1006,
      focus: "center",
    },
    card: {
      src: "/images/news/charles-copus-noc-tonkawa-card.jpg",
      width: 800,
      height: 640,
      focus: "center 48%",
    },
  },
  body: [
    "YUKON, OK — Yukon Miller Baseball is proud to announce that Charles Copus has committed to Northern Oklahoma College–Tonkawa, where he will continue his academic and baseball career.",
    "The 2027 catcher joins the Mavericks, an NJCAA Division II program in Region 2 that plays at Maverick Field. NOC Tonkawa went 50-9 in 2025, the best overall record in program history, and finished third at the Region 2 tournament.",
    "Congratulations to Charles and his family on this outstanding accomplishment! Yukon Miller Baseball looks forward to watching his continued success at the next level!",
  ],
  blocks: [
    {
      type: "p",
      text: "YUKON, OK — Yukon Miller Baseball is proud to announce that Charles Copus has committed to Northern Oklahoma College–Tonkawa, where he will continue his academic and baseball career.",
    },
    {
      type: "p",
      text: "The 2027 catcher joins the Mavericks, an NJCAA Division II program in Region 2 that plays at Maverick Field. NOC Tonkawa went 50-9 in 2025, the best overall record in program history, and finished third at the Region 2 tournament.",
    },
    {
      type: "p",
      text: "Congratulations to Charles and his family on this outstanding accomplishment! Yukon Miller Baseball looks forward to watching his continued success at the next level!",
    },
  ] satisfies ArticleBlock[],
};
