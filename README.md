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

Point `photo` fields at files in `public/images/`. Logos, sponsor art, and other branding stay as they are.

## Photographic images

New JPEG photographs in `public/images/news/`, `public/images/roster/`, and `public/images/facilities/` are optimized before they are committed. The optimizer limits the longest side to 2,000 pixels, saves JPEG at quality 80, keeps the aspect ratio, does not enlarge, applies the EXIF orientation, and leaves the file untouched when the result would not be smaller. Filenames and paths stay the same.

Logos, sponsor art, PNG graphics, icons, and transparent assets are excluded, including a JPEG whose filename contains `logo`, `wordmark`, `brand`, `swoosh`, `sponsor`, or `icon`. Photographs already in Git are not processed unless a path is passed explicitly.

```bash
npm run images:optimize
npm run images:check
```

`images:check` only reports newly added photographs. It flags a longest side over 2,000 pixels or a file over 1 MB, and it does not edit files. To optimize or check specific files:

```bash
npm run images:optimize -- --files public/images/news/example.jpg
npm run images:check -- --files public/images/news/example.jpg
```

Cursor is instructed to run both commands before committing a new photograph. The repository already uses Cursor's Git hooks, so this check is not installed as another hook.
