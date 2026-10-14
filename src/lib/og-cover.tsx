export const ogImageSize = {
  width: 1200,
  height: 630,
};

export const defaultOgImage = "/images/og/default.jpg";
export const homeOgImage = "/images/og/home.jpg";
export const newsIndexOgImage = "/images/og/news.jpg";
export const campsOgImage = "/images/og/camps.jpg";

const articleOgSlugs = new Set([
  "once-a-miller-always-a-miller",
  "from-yukon-to-the-big-leagues",
  "from-yukon-to-a-national-championship",
  "drake-pace-oral-roberts",
  "clayton-strange-hutchinson",
  "2026-seniors-next-level",
  "three-more-millers-next-level",
  "road-to-state-runs-through-yukon",
  "joe-lytle-banana-ball-all-star",
  "yukon-millers-release-2027-schedule",
  "gunner-fletcher-southwestern-christian",
  "czech-festival-parade-2026",
  "yukon-baseball-fall-camp",
]);

const articleOgFiles: Record<string, string> = {
  "gunner-fletcher-southwestern-christian":
    "/images/og/gunner-fletcher-southwestern-christian-eagle.jpg",
  "czech-festival-parade-2026":
    "/images/og/czech-festival-parade-2026-balance.jpg",
};

export function ogShareImage(
  slug?: string,
  alt = "Yukon Miller Baseball",
) {
  const url =
    slug && articleOgSlugs.has(slug)
      ? (articleOgFiles[slug] ?? `/images/og/${slug}.jpg`)
      : defaultOgImage;
  return {
    url,
    width: ogImageSize.width,
    height: ogImageSize.height,
    alt,
  };
}
