import { readFile } from "node:fs/promises";
import { inspectPhoto, isOptimizablePhoto, LARGE_PHOTO_BYTES, MAX_EDGE } from "../src/lib/image-pipeline.ts";
import { requestedPhotos } from "./photo-args.mts";

const photos = requestedPhotos(process.argv.slice(2));
if (photos.length === 0) {
  console.log("No new photographic images to check.");
  process.exit(0);
}

let needsAttention = false;
for (const photo of photos) {
  if (!isOptimizablePhoto(photo)) {
    console.log(`Skipped ${photo} (logos, graphics, and other protected assets are not checked).`);
    continue;
  }
  try {
    const inspection = await inspectPhoto(await readFile(photo));
    if (inspection.issues.length === 0) {
      console.log(`OK ${photo}: ${inspection.width}×${inspection.height}, ${inspection.bytes} bytes.`);
      continue;
    }
    needsAttention = true;
    const reasons = inspection.issues.map((issue) =>
      issue === "dimension"
        ? `longest side exceeds ${MAX_EDGE} pixels`
        : `file exceeds ${LARGE_PHOTO_BYTES} bytes`,
    );
    console.log(
      `Needs attention ${photo}: ${inspection.width}×${inspection.height}, ${inspection.bytes} bytes. ${reasons.join("; ")}.`,
    );
  } catch (error) {
    needsAttention = true;
    const message = error instanceof Error ? error.message : "Could not read that photo.";
    console.error(`Could not check ${photo}: ${message}`);
  }
}

if (needsAttention) process.exit(1);
