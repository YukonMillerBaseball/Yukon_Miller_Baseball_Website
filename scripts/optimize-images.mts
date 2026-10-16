import { isOptimizablePhoto, optimizePhotoFile } from "../src/lib/image-pipeline.ts";
import { requestedPhotos } from "./photo-args.mts";

const photos = requestedPhotos(process.argv.slice(2));
if (photos.length === 0) {
  console.log("No new photographic images to optimize.");
  process.exit(0);
}

let failed = false;
for (const photo of photos) {
  if (!isOptimizablePhoto(photo)) {
    console.log(`Skipped ${photo} (logos, graphics, and other protected assets are left unchanged).`);
    continue;
  }
  try {
    const result = await optimizePhotoFile(photo);
    if (result.status === "optimized") {
      console.log(
        `Optimized ${photo}: ${result.before} bytes to ${result.bytes.length} bytes, ${result.width}×${result.height}.`,
      );
    } else {
      console.log(`Unchanged ${photo}: ${result.reason}`);
    }
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : "Could not optimize that photo.";
    console.error(`Could not optimize ${photo}: ${message}`);
  }
}

if (failed) process.exit(1);
