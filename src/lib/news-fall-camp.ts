import type { ArticleBlock } from "@/lib/news-blocks";

const photos = {
  hitting: {
    src: "/images/news/fall-camp-2026-hitting.jpg",
    alt: "A Fall Camp camper takes a swing inside the batting cage",
    width: 3984,
    height: 2656,
  },
  grace: {
    src: "/images/news/fall-camp-2026-grace.jpg",
    alt: "A Fall Camp player in a light blue Grace No. 13 jersey and batting helmet",
    width: 1024,
    height: 1536,
  },
  huddle: {
    src: "/images/news/fall-camp-2026-huddle.jpg",
    alt: "Fall Camp players gathered on the infield, with Grace No. 13 sitting in front",
    width: 1024,
    height: 1536,
  },
  pitching: {
    src: "/images/news/fall-camp-2026-pitching.jpg",
    alt: "A Fall Camp camper throwing a pitch during a fielding drill",
    width: 1024,
    height: 1536,
  },
  running: {
    src: "/images/news/fall-camp-2026-running.jpg",
    alt: "A Fall Camp camper runs across the grass during a drill",
    width: 1024,
    height: 1536,
  },
  dugout: {
    src: "/images/news/fall-camp-2026-dugout.jpg",
    alt: "Bats, gloves, and Fall Camp players along the dugout bench",
    width: 3984,
    height: 2656,
  },
  stateBound: {
    src: "/images/news/fall-camp-2026-state-bound.jpg",
    alt: "A camper in a Yukon Miller Baseball shirt sits on the dugout bench",
    width: 6000,
    height: 4000,
  },
  glove: {
    src: "/images/news/fall-camp-2026-glove.jpg",
    alt: "A Fall Camp camper stands ready with a glove at Miller Field",
    width: 6000,
    height: 4000,
  },
} as const;

export const fallCampStory = {
  slug: "yukon-baseball-fall-camp",
  title: "Yukon Baseball Fall Camp Brings Fun and Learning to the Field",
  date: "October 13, 2026",
  category: "News" as const,
  excerpt:
    "Campers ages 7–12 spent October 12–13 at the ballpark working on hitting, pitching, and defense.",
  image: {
    ...photos.hitting,
    focus: "36% 42%",
    expand: true,
  },
  body: [
    "Yukon Baseball welcomed young athletes to the ballpark October 12–13 for two days of baseball, learning, and fun!",
  ],
  blocks: [
    {
      type: "p",
      text: "Yukon Baseball welcomed young athletes to the ballpark October 12–13 for two days of baseball, learning, and fun!",
    },
    {
      type: "p",
      text: "Campers ages 7–12 spent time developing their skills in hitting, pitching, and defense while learning from the Yukon Baseball program. From working on fundamentals to making new friends, the camp was filled with energy, excitement, and plenty of smiles.",
    },
    {
      type: "gallery",
      expand: true,
      photos: [
        photos.huddle,
        photos.pitching,
        photos.running,
        photos.dugout,
        photos.stateBound,
        photos.glove,
      ],
    },
    {
      type: "p",
      text: "A huge thank-you to all the campers, families, and coaches who helped make this year’s Fall Camp a success! We loved seeing the next generation of baseball players enjoying the game.",
    },
    {
      type: "p",
      text: "COMING SOON: Be on the lookout for our Winter Baseball Camp featuring hitting and catching instruction! Dates and times will be announced later.",
    },
    {
      type: "image",
      ...photos.grace,
      caption: "Grace No. 13",
      expand: true,
    },
  ] satisfies ArticleBlock[],
};
