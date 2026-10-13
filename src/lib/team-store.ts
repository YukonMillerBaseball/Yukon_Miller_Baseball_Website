/**
 * 2027 team store promotion.
 *
 * Change `closingLabel` to update the date visitors see.
 * Leave `closesAt` null until the exact closing time is confirmed.
 * Then set an ISO timestamp that includes a timezone, for example
 * "2026-10-27T05:00:00.000Z", and deploy. The banner stays visible
 * until that instant. No closing time is assumed while `closesAt` is null.
 */
export const teamStorePromotion = {
  headline: "2027 Team Store is open!",
  description:
    "Get your official Yukon Miller Baseball gear! Orders ship directly to you.",
  closingLabel: "Store closes October 26!",
  href: "https://bsnteamsports.com/shop/YMILBSB27",
  closesAt: null as string | null,
};

export function teamStoreIsOpen(now = Date.now()) {
  const closesAt = teamStorePromotion.closesAt;
  if (!closesAt) return true;
  const closes = Date.parse(closesAt);
  if (Number.isNaN(closes)) return true;
  return now < closes;
}
