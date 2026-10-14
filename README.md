# Yukon Miller Baseball

Program site for Yukon High School baseball — Home of the Millers. Built to replace the live Wix site at [yukonbaseball.com](https://www.yukonbaseball.com) when Ryan is ready. Wix and DNS stay untouched until then.

## Run locally

```bash
npm install
npm run dev
```

Dev server defaults to **http://127.0.0.1:43217**.

```bash
npm run build
npm start
```

## What is live in this first slice

- Brand start is the Yukon Baseball lockup (Oklahoma outline, YM mark, Yukon Baseball wordmark)
- Home, schedule, roster, coaches, news, recruiting, camps, alumni, Home Run Club, fan info, facilities, records, media, and contact
- Real program copy from the current public site (staff names, fields, HRC officers, sponsorships, commit board, TCA store code)
- 2027 master / Varsity / JV Red / JV White schedules posted from the program sheet
- Empty states for photos, alumni, records, and media — no fake games or fake player photos
- Program roster posted A–Z with bats and throws, no numbers
- Fall baseball camps posted on `/camps` with the flyer, QR, and live registration form
- 2026 HRC sponsors posted on `/sponsors` from the sign sheet

## Adding content later

Edit the typed files in `src/lib/`:

- `schedule.ts` — 2027 master, Varsity, JV Red, and JV White games
- `roster.ts` — program roster names, bats, and throws
- `coaches.ts` — coaching staff, managers, student staff, and optional `photo` paths under `/public/images`
- `commits.ts` — commit board names, schools, and baseball logos
- `news.ts` — articles and commit announcements
- `support.ts` — HRC and sponsorship packages
- `sponsors.ts` — 2026 partner names and tiers from the HRC sign sheet
- `camps.ts` — camp sessions, payment, flyer, and the registration form URL. Set `activeCamp` to a `CampSeason` to publish it. Leave `activeCamp` as `null` to show the coming-soon message. Past seasons stay in `archivedCamps`.

Drop images in `public/images/` and point the `photo` fields at them.
