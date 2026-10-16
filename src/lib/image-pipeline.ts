import { readFile, writeFile } from "fs/promises";
import sharp from "sharp";

export const PHOTO_DIRECTORIES = [
  "public/images/news/",
  "public/images/roster/",
  "public/images/facilities/",
] as const;

export const MAX_EDGE = 2000;
export const JPEG_QUALITY = 80;
export const LARGE_PHOTO_BYTES = 1_000_000;

const PROTECTED_NAME = /logo|wordmark|brand|swoosh|sponsor|icon/i;

export function normalizeRepoPath(filePath: string) {
  let path = filePath.replaceAll("\\", "/").trim();
  if (path.startsWith("./")) path = path.slice(2);
  const cwd = process.cwd().replaceAll("\\", "/").replace(/\/$/, "");
  if (path.startsWith(`${cwd}/`)) path = path.slice(cwd.length + 1);
  if (!path || path.split("/").includes("..")) return "";
  return path;
}

/** JPEG photos in the news, roster, and facility folders. Logos and other graphics are excluded. */
export function isOptimizablePhoto(filePath: string) {
  const path = normalizeRepoPath(filePath);
  const name = path.split("/").pop() ?? "";
  if (!PHOTO_DIRECTORIES.some((directory) => path.startsWith(directory))) return false;
  if (!/\.jpe?g$/i.test(name)) return false;
  if (PROTECTED_NAME.test(name)) return false;
  return true;
}

export function selectNewPhotos(added: readonly string[], untracked: readonly string[]) {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const file of [...added, ...untracked]) {
    const path = normalizeRepoPath(file.trim());
    if (!path || seen.has(path) || !isOptimizablePhoto(path)) continue;
    seen.add(path);
    selected.push(path);
  }
  return selected;
}

export type PhotoIssue = "dimension" | "size";

/** Orientations 5–8 swap the stored width and height. */
function orientedSize(meta: { width?: number; height?: number; orientation?: number }) {
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const orientation = meta.orientation ?? 1;
  if (orientation >= 5 && orientation <= 8) return { width: height, height: width };
  return { width, height };
}

export async function inspectPhoto(bytes: Buffer) {
  const { width, height } = orientedSize(await sharp(bytes).metadata());
  const issues: PhotoIssue[] = [];
  if (Math.max(width, height) > MAX_EDGE) issues.push("dimension");
  if (bytes.length > LARGE_PHOTO_BYTES) issues.push("size");
  return { width, height, bytes: bytes.length, issues };
}

export type OptimizedPhoto =
  | { status: "skipped"; reason: string }
  | { status: "unchanged"; reason: string; width: number; height: number }
  | { status: "optimized"; bytes: Buffer; width: number; height: number; before: number };

export async function optimizePhotoBuffer(bytes: Buffer): Promise<OptimizedPhoto> {
  const meta = await sharp(bytes).metadata();
  if (meta.format !== "jpeg") {
    return { status: "skipped", reason: "Only JPEG photographs are optimized." };
  }
  if (meta.hasAlpha) {
    return { status: "skipped", reason: "Transparent images are left unchanged." };
  }

  const { width, height } = orientedSize(meta);
  const needsResize = Math.max(width, height) > MAX_EDGE;
  const needsCompress = bytes.length > LARGE_PHOTO_BYTES;
  if (!needsResize && !needsCompress) {
    return { status: "unchanged", reason: "Already within the size limits.", width, height };
  }

  let pipeline = sharp(bytes).rotate();
  if (needsResize) {
    pipeline = pipeline.resize({
      width: width >= height ? MAX_EDGE : undefined,
      height: height > width ? MAX_EDGE : undefined,
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  const output = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
  if (output.length >= bytes.length) {
    return {
      status: "unchanged",
      reason: "Optimized file would not be smaller.",
      width,
      height,
    };
  }
  const saved = await sharp(output).metadata();
  return {
    status: "optimized",
    bytes: output,
    width: saved.width ?? width,
    height: saved.height ?? height,
    before: bytes.length,
  };
}

export async function optimizePhotoFile(filePath: string) {
  if (!isOptimizablePhoto(filePath)) {
    return { status: "skipped" as const, reason: "Logos, graphics, and files outside the photo folders are protected." };
  }
  const bytes = await readFile(filePath);
  const result = await optimizePhotoBuffer(bytes);
  if (result.status !== "optimized") return result;
  await writeFile(filePath, result.bytes);
  return result;
}
