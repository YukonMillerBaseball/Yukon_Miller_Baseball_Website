export const MEDIA_CATALOG_PATH = "media-library/catalog.json";
export const MEDIA_COVER_PREFIX = "media-library/covers/";
export const MEDIA_CONFLICT_MESSAGE =
  "The library changed. Reload and try again.";
export const MAX_MEDIA_COLLECTIONS = 200;
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

export type MediaCollection = {
  id: string;
  title: string;
  description: string;
  season: string;
  category: string;
  url: string;
  linkKind: MediaLinkKind;
  coverFile: string | null;
  order: number;
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
  order: number;
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
  if (kind === "video") return "Watch Video";
  return "Open Collection";
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
  now = new Date().toISOString(),
) {
  assertVersion(catalog, expectedVersion);
  if (catalog.items.length >= MAX_MEDIA_COLLECTIONS) {
    return { error: "The library can hold 200 collections." } as const;
  }
  const order = catalog.items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
  const item: MediaCollection = {
    id: crypto.randomUUID(),
    ...input,
    coverFile,
    order,
    updatedAt: now,
  };
  return { catalog: nextCatalog(catalog, [...catalog.items, item]) };
}

export function editCollection(
  catalog: MediaCatalog,
  expectedVersion: number,
  id: string,
  input: MediaCollectionInput,
  coverFile: string | null | undefined,
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
      ? {
          ...item,
          ...input,
          category: input.category || current.category,
          coverFile: nextCover,
          updatedAt: now,
        }
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
    items.push({
      id: entry.id,
      ...parsed.input,
      coverFile: entry.coverFile,
      order: entry.order,
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
    order: item.order,
  }));
}
