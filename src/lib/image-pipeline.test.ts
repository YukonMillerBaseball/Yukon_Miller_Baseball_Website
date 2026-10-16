import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomFillSync } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import sharp from "sharp";
import {
  inspectPhoto,
  isOptimizablePhoto,
  LARGE_PHOTO_BYTES,
  MAX_EDGE,
  optimizePhotoBuffer,
  optimizePhotoFile,
  selectNewPhotos,
} from "@/lib/image-pipeline";

const TEMP_NEWS_PHOTO = "public/images/news/zz-image-pipeline-test.jpg";

async function jpegFromRaw(
  width: number,
  height: number,
  quality: number,
  orientation?: number,
) {
  const raw = Buffer.alloc(width * height * 3);
  randomFillSync(raw);
  const pipeline = sharp(raw, { raw: { width, height, channels: 3 } }).jpeg({ quality });
  if (!orientation) return pipeline.toBuffer();
  return pipeline.withMetadata({ orientation }).toBuffer();
}

function runImageScript(script: string, args: string[] = []) {
  return spawnSync(
    process.execPath,
    ["--experimental-strip-types", script, ...args],
    { encoding: "utf8" },
  );
}

describe("image pipeline", { concurrency: 1 }, () => {
  it("selects only new JPEG photographs in the supported folders", () => {
    assert.equal(isOptimizablePhoto("public/images/news/fall-camp.jpg"), true);
    assert.equal(isOptimizablePhoto("public/images/roster/player.jpeg"), true);
    assert.equal(isOptimizablePhoto("public/images/facilities/field.jpg"), true);
    assert.equal(isOptimizablePhoto("public/images/news/osssa-logo.png"), false);
    assert.equal(isOptimizablePhoto("public/images/news/yukon-logo.jpg"), false);
    assert.equal(isOptimizablePhoto("public/images/news/sponsor-night.jpg"), false);
    assert.equal(isOptimizablePhoto("public/images/sponsors/partner.jpg"), false);
    assert.equal(isOptimizablePhoto("public/images/logo-mark.jpg"), false);
    assert.equal(isOptimizablePhoto("public/images/news/../roster/sneaky.jpg"), false);

    const selected = selectNewPhotos(
      [
        "public/images/news/new-story.jpg",
        "public/images/news/osssa-logo.png",
        "public/images/coaches/coach.jpg",
      ],
      ["public/images/facilities/new-field.jpg", "public/images/news/new-story.jpg"],
    );
    assert.deepEqual(selected, [
      "public/images/news/new-story.jpg",
      "public/images/facilities/new-field.jpg",
    ]);
  });

  it("resizes oversized photographs without enlarging or growing the file", async () => {
    const oversized = await jpegFromRaw(3200, 1800, 95);
    const optimized = await optimizePhotoBuffer(oversized);
    assert.equal(optimized.status, "optimized");
    if (optimized.status !== "optimized") return;
    assert.ok(optimized.bytes.length < oversized.length);
    assert.equal(optimized.width, MAX_EDGE);
    assert.ok(optimized.height < 1800);
    assert.ok(optimized.height > 0);

    const small = await jpegFromRaw(640, 480, 80);
    const unchanged = await optimizePhotoBuffer(small);
    assert.equal(unchanged.status, "unchanged");

    const stubborn = await jpegFromRaw(2001, 1200, 30);
    const kept = await optimizePhotoBuffer(stubborn);
    assert.equal(kept.status, "unchanged");
    if (kept.status !== "unchanged") return;
    assert.match(kept.reason, /not be smaller/);
  });

  it("applies EXIF orientation before measuring the longest side", async () => {
    const turned = await jpegFromRaw(3000, 1000, 95, 6);
    const optimized = await optimizePhotoBuffer(turned);
    assert.equal(optimized.status, "optimized");
    if (optimized.status !== "optimized") return;
    assert.equal(optimized.height, MAX_EDGE);
    assert.ok(optimized.width < optimized.height);
    const saved = await sharp(optimized.bytes).metadata();
    assert.ok(!saved.orientation || saved.orientation === 1);
  });

  it("leaves graphics and transparent files unchanged", async () => {
    const png = await sharp({
      create: {
        width: 3000,
        height: 3000,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const skipped = await optimizePhotoBuffer(png);
    assert.equal(skipped.status, "skipped");

    const directory = await mkdtemp(join(tmpdir(), "yukon-image-"));
    const logo = join(directory, "yukon-logo.jpg");
    const before = await jpegFromRaw(2400, 1600, 95);
    await writeFile(logo, before);
    const result = await optimizePhotoFile(logo);
    assert.equal(result.status, "skipped");
    assert.deepEqual(await readFile(logo), before);
    await rm(directory, { recursive: true, force: true });
  });

  it("flags new photographs that are too wide or unusually large without editing them", async () => {
    const wide = await jpegFromRaw(2400, 1200, 95);
    const wideReport = await inspectPhoto(wide);
    assert.ok(wideReport.issues.includes("dimension"));

    const heavy = await jpegFromRaw(1800, 1200, 100);
    assert.ok(heavy.length > LARGE_PHOTO_BYTES);
    const heavyReport = await inspectPhoto(heavy);
    assert.deepEqual(heavyReport.issues, ["size"]);
    assert.equal(heavyReport.width, 1800);

    await writeFile(TEMP_NEWS_PHOTO, wide);
    try {
      const before = await readFile(TEMP_NEWS_PHOTO);
      const check = runImageScript("scripts/check-images.mts", ["--files", TEMP_NEWS_PHOTO]);
      assert.equal(check.status, 1);
      assert.match(check.stdout, /Needs attention/);
      assert.match(check.stdout, /longest side exceeds 2000/);
      assert.deepEqual(await readFile(TEMP_NEWS_PHOTO), before);
    } finally {
      await rm(TEMP_NEWS_PHOTO, { force: true });
    }
  });

  it("optimizes an explicitly requested new photograph and then passes validation", async () => {
    const original = await jpegFromRaw(2800, 1600, 95);
    await writeFile(TEMP_NEWS_PHOTO, original);
    try {
      const optimize = runImageScript("scripts/optimize-images.mts", ["--files", TEMP_NEWS_PHOTO]);
      assert.equal(optimize.status, 0, optimize.stderr);
      assert.match(optimize.stdout, /Optimized/);
      const saved = await readFile(TEMP_NEWS_PHOTO);
      assert.ok(saved.length < original.length);
      const meta = await sharp(saved).metadata();
      assert.ok(Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_EDGE);

      const check = runImageScript("scripts/check-images.mts", ["--files", TEMP_NEWS_PHOTO]);
      assert.equal(check.status, 0, check.stdout + check.stderr);
      assert.match(check.stdout, /^OK /m);
    } finally {
      await rm(TEMP_NEWS_PHOTO, { force: true });
    }
  });

  it("does not select existing photographs when no new photo files are present", () => {
    const check = runImageScript("scripts/check-images.mts");
    assert.equal(check.status, 0, check.stderr);
    assert.match(check.stdout, /No new photographic images to check/);

    const optimize = runImageScript("scripts/optimize-images.mts");
    assert.equal(optimize.status, 0, optimize.stderr);
    assert.match(optimize.stdout, /No new photographic images to optimize/);
  });
});
