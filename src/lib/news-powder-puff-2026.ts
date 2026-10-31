import type { ArticleBlock } from "@/lib/news-blocks";

const semifinal =
  "Yukon Powder Puff 2026 was full of action, and the semifinal came down to the wire. The Sophomores and the Juniors traded chances all night. When the game ended, the Juniors won by a single run and advanced to the championship against the Seniors.";

const championship =
  "The Juniors then beat the Seniors in the championship. They are champions for the second year in a row.";

const thanks =
  "Congratulations to this year’s Home Run Queen and to our MVPs. Thank you to every participant for making it a night to remember, and to everyone who helped make the night a success.";

const gallery: ArticleBlock = {
  type: "gallery",
  photos: [
    {
      src: "/images/news/powder-puff-2026-orange.jpg",
      alt: "Powder Puff participants in matching orange shirts pose on the field at Yukon High School",
      width: 2000,
      height: 1500,
    },
    {
      src: "/images/news/powder-puff-2026-pink.jpg",
      alt: "Powder Puff participants in pink and light blue pose together on the turf",
      width: 1280,
      height: 960,
    },
    {
      src: "/images/news/powder-puff-2026-fire-truck.jpg",
      alt: "Powder Puff participants in firefighter uniforms and dalmatian-print shirts pose with a Yukon Fire-Rescue truck",
      width: 1200,
      height: 900,
    },
    {
      src: "/images/news/powder-puff-2026-pink-bats.jpg",
      alt: "A Powder Puff team in black and white poses with pink bats in front of the Yukon High School scoreboard",
      width: 2000,
      height: 1333,
    },
    {
      src: "/images/news/powder-puff-2026-celebration.jpg",
      alt: "Powder Puff players celebrate together on the infield",
      width: 1097,
      height: 761,
    },
    {
      src: "/images/news/powder-puff-2026-sideline.jpg",
      alt: "Powder Puff players clap and cheer along the sideline",
      width: 1200,
      height: 833,
    },
    {
      src: "/images/news/powder-puff-2026-queen.jpg",
      alt: "The Powder Puff queen, wearing a crown and sash, holds flowers and a pink bat on the field",
      width: 2000,
      height: 1333,
    },
    {
      src: "/images/news/powder-puff-2026-gift-basket.jpg",
      alt: "A Powder Puff participant and an adult hold a gift basket on the field",
      width: 2000,
      height: 1333,
    },
    {
      src: "/images/news/powder-puff-2026-gift-blanket.jpg",
      alt: "A Powder Puff participant in an orange shirt holds a pink blanket and a gift basket",
      width: 2000,
      height: 1333,
    },
  ],
};

export const powderPuff2026Story = {
  slug: "yukon-powder-puff-2026",
  title: "Juniors Repeat as Yukon Powder Puff Champions",
  date: "October 29, 2026",
  category: "News" as const,
  excerpt:
    "The Juniors are Powder Puff champions again. They won a one-run semifinal against the Sophomores, then beat the Seniors for back-to-back titles.",
  image: {
    src: "/images/news/yukon-powder-puff-2026.jpg",
    alt: "Yukon Powder Puff 2026 participants gathered on the field at home plate in front of the Yukon High School scoreboard",
    width: 2000,
    height: 1333,
    focus: "center 46%",
  },
  body: [semifinal, championship, thanks],
  blocks: [
    { type: "p", text: semifinal },
    { type: "p", text: championship },
    gallery,
    {
      type: "image",
      src: "/images/news/powder-puff-2026-high-five.jpg",
      alt: "Powder Puff players high-five along the baseline during the night game",
      width: 1350,
      height: 1800,
      size: "card",
    },
    { type: "p", text: thanks },
  ] satisfies ArticleBlock[],
};
