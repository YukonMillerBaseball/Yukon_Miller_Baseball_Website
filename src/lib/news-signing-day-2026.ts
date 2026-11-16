import type { ArticleBlock } from "@/lib/news-blocks";

const lead =
  "Five Yukon High School baseball players took the next step in their athletic and academic careers on Wednesday, November 11, signing to continue playing baseball at the collegiate level.";

export const signingDay2026Story = {
  slug: "yukon-signing-day-2026",
  title: "Five Yukon Baseball Players Sign to Continue Careers at the Collegiate Level",
  date: "November 11, 2026",
  category: "News" as const,
  excerpt: lead,
  image: {
    src: "/images/news/yukon-signing-day-2026.jpg",
    alt: "Five Yukon Baseball players and the coaching staff at the November 11 signing ceremony in the Yukon High School gym",
    width: 2000,
    height: 1500,
    focus: "center 74%",
  },
  body: [lead],
  blocks: [
    {
      type: "p",
      text: "The signing ceremony celebrated the hard work, dedication, and commitment these student-athletes have demonstrated throughout their baseball careers.",
    },
    {
      type: "table",
      caption: "Yukon Baseball signees",
      headers: ["Player", "School", "Position"],
      rows: [
        ["Clayton Strange", "Hutchinson Community College", "Pitcher"],
        ["Kamden Hotz", "Kansas Wesleyan University", "Infielder"],
        ["Drake Pace", "Oral Roberts University", "Infielder"],
        ["Pryce McClure", "Barton Community College", "Pitcher"],
        ["Gunner Fletcher", "Southwestern Christian University", "Pitcher"],
      ],
    },
    {
      type: "p",
      text: "Each player has earned the opportunity to continue competing at the next level while representing the Yukon Baseball program.",
    },
    {
      type: "p",
      text: "“These five young men have put in a tremendous amount of work to earn this opportunity,” said Yukon Head Baseball Coach Ryan Phillips. “We’re proud of what they’ve accomplished, but we’re even more excited about what’s ahead of them. It’s a special day for these players and their families, and we’re thankful we get to be a part of their journey.”",
    },
    {
      type: "p",
      text: "The Yukon Baseball coaching staff congratulates these five young men and their families on this accomplishment. Their commitment to improving as players, teammates, and individuals has helped them reach an important milestone in their baseball journeys.",
    },
    {
      type: "p",
      text: "Congratulations to Clayton, Kamden, Drake, Pryce, and Gunner!",
    },
    {
      type: "note",
      text: "Once a Miller, Always a Miller.",
    },
  ] satisfies ArticleBlock[],
};
