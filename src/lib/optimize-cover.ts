export const COVER_MAX_WIDTH = 1200;
export const COVER_TARGET_BYTES = 1024 * 1024;
export const COVER_JPEG_QUALITY = 0.85;

const QUALITY_STEPS = [COVER_JPEG_QUALITY, 0.75, 0.65, 0.55] as const;
const SMALLER_WIDTHS = [1000, 800, 640] as const;
const SMALLER_WIDTH_QUALITY = 0.7;

const SUPPORTED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

export class CoverOptimizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoverOptimizeError";
  }
}

export function isSupportedCoverFile(file: File) {
  const type = file.type.toLowerCase();
  if (SUPPORTED_TYPES.has(type)) return true;
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
}

export function coverOutputSize(width: number, height: number, maxWidth: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    maxWidth < 1
  ) {
    return null;
  }
  const limit = Math.min(maxWidth, width);
  const nextWidth = Math.max(1, Math.round(limit));
  const nextHeight = Math.max(1, Math.round((height * nextWidth) / width));
  return { width: nextWidth, height: nextHeight };
}

async function decodeCover(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      return await createImageBitmap(image, { imageOrientation: "from-image" });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = url;
  });
}

function renderJpeg(bitmap: ImageBitmap, maxWidth: number, quality: number) {
  const size = coverOutputSize(bitmap.width, bitmap.height, maxWidth);
  if (!size) {
    return Promise.reject(new CoverOptimizeError("This photo could not be prepared for upload."));
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new CoverOptimizeError("This photo could not be prepared for upload."));
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new CoverOptimizeError("This photo could not be prepared for upload."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

async function encodeCover(bitmap: ImageBitmap) {
  const preferredWidth = Math.min(COVER_MAX_WIDTH, bitmap.width);
  for (const quality of QUALITY_STEPS) {
    const blob = await renderJpeg(bitmap, preferredWidth, quality);
    if (blob.size < COVER_TARGET_BYTES) return blob;
  }
  for (const width of SMALLER_WIDTHS) {
    if (width >= bitmap.width || width >= preferredWidth) continue;
    const blob = await renderJpeg(bitmap, width, SMALLER_WIDTH_QUALITY);
    if (blob.size < COVER_TARGET_BYTES) return blob;
  }
  throw new CoverOptimizeError(
    "This photo is still too large after resizing. Choose a different image.",
  );
}

export async function optimizeCoverImage(file: File) {
  if (!isSupportedCoverFile(file)) {
    throw new CoverOptimizeError("Use a JPEG, PNG, or HEIC photo.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeCover(file);
  } catch {
    throw new CoverOptimizeError(
      "This photo could not be read. If it is a HEIC image, export it as JPEG and try again.",
    );
  }
  try {
    const blob = await encodeCover(bitmap);
    return new File([blob], "cover.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
