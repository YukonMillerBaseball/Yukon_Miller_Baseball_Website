export const MEDIA_CATALOG_PATH = "media-library/catalog.json";
export const MEDIA_COVER_PREFIX = "media-library/covers/";
export const MEDIA_CONFLICT_MESSAGE =
  "The library changed. Reload and try again.";
export const MAX_MEDIA_COLLECTIONS = 1000;
export const MAX_COVER_BYTES = 2 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 120;
export const MAX_DESCRIPTION_LENGTH = 500;
export const MAX_SEASON_LENGTH = 40;
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_URL_LENGTH = 2000;
export const MEDIA_SEASON_START = 2025;
export const MEDIA_SEASON_END = 2035;
export const MEDIA_SEASONS = Array.from(
  { length: MEDIA_SEASON_END - MEDIA_SEASON_START + 1 },
  (_, index) => {
    const year = MEDIA_SEASON_START + index;
    return `${year}-${year + 1}`;
  },
);

export function isListedMediaSeason(season: string) {
  return MEDIA_SEASONS.includes(season);
}

export function selectedMediaSeason(current?: string | null, now = new Date()) {
  if (current && isListedMediaSeason(current)) return current;
  const year = current?.match(/\d{4}/)?.[0];
  if (year) {
    const start = Number(year);
    const forward = `${start}-${start + 1}`;
    if (isListedMediaSeason(forward)) return forward;
    const previous = `${start - 1}-${start}`;
    if (isListedMediaSeason(previous)) return previous;
  }
  return defaultMediaSeason(now);
}

export function defaultMediaSeason(now = new Date()) {
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const season = `${start}-${start + 1}`;
  return isListedMediaSeason(season) ? season : MEDIA_SEASONS[0];
}

const COVER_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;
const COLLECTION_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export type MediaLinkKind = "photos" | "video" | "collection";

/** How the stored cover is framed inside the 16:9 card. Missing values mean fill and center. */
export type CoverFit = "cover" | "contain";

export type CoverFrame = {
  fit: CoverFit;
  x: number;
  y: number;
};

export const DEFAULT_COVER_FRAME: CoverFrame = { fit: "cover", x: 50, y: 50 };

export function isDefaultCoverFrame(frame: CoverFrame) {
  return frame.fit === DEFAULT_COVER_FRAME.fit && frame.x === DEFAULT_COVER_FRAME.x && frame.y === DEFAULT_COVER_FRAME.y;
}

export type MediaCollection = {
  id: string;
  title: string;
  description: string;
  season: string;
  category: string;
  url: string;
  linkKind: MediaLinkKind;
  coverFile: string | null;
  /** Omitted when the cover uses the default fill-and-center frame. */
  coverFit?: CoverFit;
  coverX?: number;
  coverY?: number;
  order: number;
  /** Set once when a collection is created. Missing on records saved before this field existed. */
  createdAt?: string;
  updatedAt: string;
};

export type MediaCatalog = {
  version: number;
  items: MediaCollection[];
};

export type MediaCollectionInput = {
  title: string;
  description: string;
  season: string;
  category: string;
  url: string;
  linkKind: MediaLinkKind;
};

export type MediaCard = {
  id: string;
  title: string;
  description: string;
  season: string;
  category: string;
  url: string;
  linkKind: MediaLinkKind;
  coverUrl: string | null;
  coverFit: CoverFit;
  coverX: number;
  coverY: number;
  order: number;
  createdAt: string | null;
};

export class MediaCatalogConflict extends Error {
  constructor() {
    super(MEDIA_CONFLICT_MESSAGE);
    this.name = "MediaCatalogConflict";
  }
}

export function emptyCatalog(): MediaCatalog {
  return { version: 0, items: [] };
}

export function mediaLinkLabel(kind: MediaLinkKind) {
  if (kind === "photos") return "View Photos";
  if (kind === "video") return "View Video";
  return "Open Collection";
}

export type MediaSort = "newest" | "oldest" | "title-asc" | "title-desc" | "custom";

export function browseSeasons(seasons: Iterable<string>) {
  return [...new Set(seasons)].filter((season) => season.trim()).sort(compareSeasons);
}

/** Current school year when that season has collections; otherwise the newest season in use. */
export function defaultBrowseSeason(seasons: Iterable<string>, now = new Date()) {
  const options = browseSeasons(seasons);
  if (options.length === 0) return "all";
  const current = defaultMediaSeason(now);
  return options.includes(current) ? current : options[0];
}

function createdTime(value: string | null | undefined) {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function sortMediaCards(items: MediaCard[], sort: MediaSort) {
  const ordered = [...items].sort(
    (left, right) => left.order - right.order || left.title.localeCompare(right.title),
  );
  if (sort === "custom") return ordered;
  if (sort === "title-asc" || sort === "title-desc") {
    const direction = sort === "title-asc" ? 1 : -1;
    return ordered.slice().sort((left, right) => {
      const byTitle = left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
      if (byTitle !== 0) return byTitle * direction;
      return left.order - right.order;
    });
  }
  const dated: MediaCard[] = [];
  const undated: MediaCard[] = [];
  for (const item of ordered) {
    if (createdTime(item.createdAt) === null) undated.push(item);
    else dated.push(item);
  }
  dated.sort((left, right) => {
    const difference =
      sort === "newest"
        ? createdTime(right.createdAt)! - createdTime(left.createdAt)!
        : createdTime(left.createdAt)! - createdTime(right.createdAt)!;
    if (difference !== 0) return difference;
    return left.order - right.order;
  });
  // Records saved before createdAt existed are older than every timestamped record.
  // Their relative order stays as stored. No historical dates are invented.
  return sort === "oldest" ? [...undated, ...dated] : [...dated, ...undated];
}

export function mediaCoverUrl(coverFile: string) {
  return `/api/media/cover?id=${encodeURIComponent(coverFile)}`;
}

export function isSafeCoverName(value: string) {
  return COVER_NAME.test(value);
}

export function coverBlobPath(filename: string) {
  if (!isSafeCoverName(filename)) throw new Error("Invalid cover.");
  return `${MEDIA_COVER_PREFIX}${filename}`;
}

export function compareSeasons(a: string, b: string) {
  const year = (value: string) => {
    const match = value.match(/\d{4}/);
    return match ? Number(match[0]) : -1;
  };
  const difference = year(b) - year(a);
  if (difference !== 0) return difference;
  return a.localeCompare(b);
}

export function parseMediaUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

function cleanText(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (text.length > max) return null;
  return text;
}

export function parseVersion(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) return null;
  return number;
}

export function parseCollectionInput(value: {
  title?: unknown;
  description?: unknown;
  season?: unknown;
  category?: unknown;
  url?: unknown;
  linkKind?: unknown;
}): { input: MediaCollectionInput } | { error: string } {
  const title = cleanText(value.title, MAX_TITLE_LENGTH);
  if (!title) return { error: "Enter a title." };
  const description = cleanText(value.description ?? "", MAX_DESCRIPTION_LENGTH);
  if (description === null) return { error: "Enter a shorter description." };
  const season = cleanText(value.season, MAX_SEASON_LENGTH);
  if (!season) return { error: "Choose a season." };
  const category = cleanText(value.category ?? "", MAX_CATEGORY_LENGTH);
  if (category === null) return { error: "Enter a shorter category." };
  if (typeof value.url !== "string") return { error: "Enter an https link." };
  const url = parseMediaUrl(value.url);
  if (!url) return { error: "Enter an https link." };
  const linkKind = value.linkKind;
  if (linkKind !== "photos" && linkKind !== "video" && linkKind !== "collection") {
    return { error: "Choose a link type." };
  }
  return {
    input: { title, description, season, category, url, linkKind },
  };
}

function parseSubmittedAxis(value: unknown) {
  if (value === undefined || value === null || value === "") return 50;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

/** Reads the cover frame submitted with a collection form. Blank values keep the centered fill. */
export function parseCoverFrame(value: {
  coverFit?: unknown;
  coverX?: unknown;
  coverY?: unknown;
}): CoverFrame | { error: string } {
  const fitValue = value.coverFit;
  const fit =
    fitValue === undefined || fitValue === "" || fitValue === "cover"
      ? "cover"
      : fitValue === "contain"
        ? "contain"
        : null;
  if (!fit) return { error: "Choose how the cover fits the card." };
  const x = parseSubmittedAxis(value.coverX);
  const y = parseSubmittedAxis(value.coverY);
  if (x === null || y === null) return { error: "Choose a cover position from 0 to 100." };
  return { fit, x, y };
}

function storedAxis(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) return null;
  return rounded;
}

/** Optional catalog fields. Invalid or default frames are omitted so older catalogs stay unchanged. */
function readStoredCoverFrame(entry: Record<string, unknown>): CoverFrame | undefined {
  if (entry.coverFit === undefined && entry.coverX === undefined && entry.coverY === undefined) {
    return undefined;
  }
  const fit =
    entry.coverFit === undefined || entry.coverFit === "cover"
      ? "cover"
      : entry.coverFit === "contain"
        ? "contain"
        : null;
  const x = entry.coverX === undefined ? 50 : storedAxis(entry.coverX);
  const y = entry.coverY === undefined ? 50 : storedAxis(entry.coverY);
  if (!fit || x === null || y === null) return undefined;
  const frame = { fit, x, y } satisfies CoverFrame;
  return isDefaultCoverFrame(frame) ? undefined : frame;
}

function withoutCoverFrame(item: MediaCollection): MediaCollection {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    season: item.season,
    category: item.category,
    url: item.url,
    linkKind: item.linkKind,
    coverFile: item.coverFile,
    order: item.order,
    ...(item.createdAt ? { createdAt: item.createdAt } : {}),
    updatedAt: item.updatedAt,
  };
}

function applyCoverFrame(item: MediaCollection, frame: CoverFrame): MediaCollection {
  const rest = withoutCoverFrame(item);
  if (!rest.coverFile || isDefaultCoverFrame(frame)) return rest;
  return { ...rest, coverFit: frame.fit, coverX: frame.x, coverY: frame.y };
}

export function inspectCover(bytes: Uint8Array): {
  extension: "jpg" | "png" | "webp";
  contentType: string;
} | null {
  if (bytes.byteLength < 12 || bytes.byteLength > MAX_COVER_BYTES) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { extension: "png", contentType: "image/png" };
  }
  const riff = String.fromCharCode(...bytes.subarray(0, 4));
  const webp = String.fromCharCode(...bytes.subarray(8, 12));
  if (riff === "RIFF" && webp === "WEBP") {
    return { extension: "webp", contentType: "image/webp" };
  }
  return null;
}

function assertVersion(catalog: MediaCatalog, expectedVersion: number) {
  if (catalog.version !== expectedVersion) throw new MediaCatalogConflict();
}

function normalize(items: MediaCollection[]) {
  return items
    .slice()
    .sort((left, right) => left.order - right.order || left.title.localeCompare(right.title))
    .map((item, index) => ({ ...item, order: index }));
}

function nextCatalog(catalog: MediaCatalog, items: MediaCollection[]): MediaCatalog {
  return { version: catalog.version + 1, items: normalize(items) };
}

export function addCollection(
  catalog: MediaCatalog,
  expectedVersion: number,
  input: MediaCollectionInput,
  coverFile: string | null,
  coverFrame: CoverFrame = DEFAULT_COVER_FRAME,
  now = new Date().toISOString(),
) {
  assertVersion(catalog, expectedVersion);
  if (catalog.items.length >= MAX_MEDIA_COLLECTIONS) {
    return { error: `The library can hold ${MAX_MEDIA_COLLECTIONS} collections.` } as const;
  }
  const order = catalog.items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  const item = applyCoverFrame(
    {
      id: crypto.randomUUID(),
      ...input,
      coverFile,
      order,
      createdAt: now,
      updatedAt: now,
    },
    coverFrame,
  );
  return { catalog: nextCatalog(catalog, [...catalog.items, item]) };
}

export function editCollection(
  catalog: MediaCatalog,
  expectedVersion: number,
  id: string,
  input: MediaCollectionInput,
  coverFile: string | null | undefined,
  coverFrame: CoverFrame = DEFAULT_COVER_FRAME,
  now = new Date().toISOString(),
) {
  assertVersion(catalog, expectedVersion);
  if (!COLLECTION_ID.test(id)) return "missing" as const;
  const current = catalog.items.find((item) => item.id === id);
  if (!current) return "missing" as const;
  const nextCover = coverFile === undefined ? current.coverFile : coverFile;
  const retiredCover =
    current.coverFile && current.coverFile !== nextCover ? current.coverFile : null;
  const items = catalog.items.map((item) =>
    item.id === id
      ? applyCoverFrame(
          {
            ...item,
            ...input,
            category: input.category || current.category,
            coverFile: nextCover,
            createdAt: current.createdAt,
            updatedAt: now,
          },
          coverFrame,
        )
      : item,
  );
  return { catalog: nextCatalog(catalog, items), retiredCover };
}

export function removeCollection(
  catalog: MediaCatalog,
  expectedVersion: number,
  id: string,
) {
  assertVersion(catalog, expectedVersion);
  if (!COLLECTION_ID.test(id)) return "missing" as const;
  const current = catalog.items.find((item) => item.id === id);
  if (!current) return "missing" as const;
  return {
    catalog: nextCatalog(
      catalog,
      catalog.items.filter((item) => item.id !== id),
    ),
    retiredCover: current.coverFile,
  };
}

export function reorderCollections(
  catalog: MediaCatalog,
  expectedVersion: number,
  ids: string[],
) {
  assertVersion(catalog, expectedVersion);
  if (ids.length !== catalog.items.length) return "invalid" as const;
  const unique = new Set(ids);
  if (unique.size !== ids.length) return "invalid" as const;
  const byId = new Map(catalog.items.map((item) => [item.id, item]));
  const items: MediaCollection[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) return "invalid" as const;
    items.push(item);
  }
  return {
    catalog: nextCatalog(
      catalog,
      items.map((item, index) => ({ ...item, order: index })),
    ),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCreatedAt(value: unknown) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || text.length > 40) return undefined;
  return text;
}

export function parseCatalog(value: unknown): MediaCatalog | null {
  if (!isRecord(value)) return null;
  const version = parseVersion(value.version);
  if (version === null || !Array.isArray(value.items)) return null;
  if (value.items.length > MAX_MEDIA_COLLECTIONS) return null;
  const items: MediaCollection[] = [];
  const seen = new Set<string>();
  for (const entry of value.items) {
    if (!isRecord(entry)) return null;
    if (typeof entry.id !== "string" || !COLLECTION_ID.test(entry.id)) return null;
    if (seen.has(entry.id)) return null;
    seen.add(entry.id);
    const parsed = parseCollectionInput(entry);
    if ("error" in parsed) return null;
    if (entry.coverFile !== null && typeof entry.coverFile !== "string") return null;
    if (typeof entry.coverFile === "string" && !isSafeCoverName(entry.coverFile)) return null;
    if (typeof entry.order !== "number" || !Number.isInteger(entry.order)) return null;
    if (typeof entry.updatedAt !== "string" || entry.updatedAt.length > 40) return null;
    const createdAt = readCreatedAt(entry.createdAt);
    const coverFrame = readStoredCoverFrame(entry);
    items.push({
      id: entry.id,
      ...parsed.input,
      coverFile: entry.coverFile,
      ...(entry.coverFile && coverFrame
        ? { coverFit: coverFrame.fit, coverX: coverFrame.x, coverY: coverFrame.y }
        : {}),
      order: entry.order,
      ...(createdAt ? { createdAt } : {}),
      updatedAt: entry.updatedAt,
    });
  }
  return { version, items: normalize(items) };
}

export function toMediaCards(catalog: MediaCatalog): MediaCard[] {
  return normalize(catalog.items).map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    season: item.season,
    category: item.category,
    url: item.url,
    linkKind: item.linkKind,
    coverUrl: item.coverFile ? mediaCoverUrl(item.coverFile) : null,
    coverFit: item.coverFile && item.coverFit === "contain" ? "contain" : "cover",
    coverX: item.coverFile ? (item.coverX ?? 50) : 50,
    coverY: item.coverFile ? (item.coverY ?? 50) : 50,
    order: item.order,
    createdAt: item.createdAt ?? null,
  }));
}
