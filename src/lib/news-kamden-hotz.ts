import type { ArticleBlock } from "@/lib/news-blocks";

export const kamdenHotzStory = {
  slug: "kamden-hotz-kansas-wesleyan",
  title: "Kamden Hotz commits to Kansas Wesleyan University",
  date: "October 15, 2026",
  category: "Commit" as const,
  excerpt:
    "Hotz will continue his academic and baseball career with the Coyotes at Kansas Wesleyan University in Salina, Kansas.",
  image: {
    src: "/images/news/kamden-hotz-kansas-wesleyan.jpg",
    alt: "Kamden Hotz commitment graphic for Kansas Wesleyan University baseball",
    width: 1127,
    height: 1396,
    focus: "center 42%",
    size: "half" as const,
    expand: true,
    banner: {
      src: "/images/news/kamden-hotz-kansas-wesleyan-banner.jpg",
      width: 1600,
      height: 680,
      focus: "center",
    },
    card: {
      src: "/images/news/kamden-hotz-kansas-wesleyan-card.jpg",
      width: 800,
      height: 640,
      focus: "center",
    },
  },
  body: [
    "YUKON, OK — Yukon Miller Baseball is proud to announce that Kamden Hotz has committed to Kansas Wesleyan University in Salina, Kansas, where he will continue his academic and baseball career.",
    "Hotz joins a successful Coyotes program coming off its fourth consecutive KCAC regular-season championship and second straight conference tournament title in 2026. Kansas Wesleyan has also made five consecutive NAIA National Championship Opening Round appearances.",
    "Congratulations to Kamden and his family on this outstanding accomplishment! Yukon Miller Baseball looks forward to watching his continued success at the next level!",
  ],
  blocks: [
    {
      type: "p",
      text: "YUKON, OK — Yukon Miller Baseball is proud to announce that Kamden Hotz has committed to Kansas Wesleyan University in Salina, Kansas, where he will continue his academic and baseball career.",
    },
    {
      type: "p",
      text: "Hotz joins a successful Coyotes program coming off its fourth consecutive KCAC regular-season championship and second straight conference tournament title in 2026. Kansas Wesleyan has also made five consecutive NAIA National Championship Opening Round appearances.",
    },
    {
      type: "p",
      text: "Congratulations to Kamden and his family on this outstanding accomplishment! Yukon Miller Baseball looks forward to watching his continued success at the next level!",
    },
  ] satisfies ArticleBlock[],
};
