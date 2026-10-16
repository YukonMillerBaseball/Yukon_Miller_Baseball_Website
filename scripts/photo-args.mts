import { spawnSync } from "node:child_process";
import { normalizeRepoPath, selectNewPhotos } from "../src/lib/image-pipeline.ts";

function gitPaths(args: string[]) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Could not read the Git file list.");
  }
  return result.stdout.split("\0").filter(Boolean);
}

export function requestedPhotos(argv: readonly string[]) {
  const filesFlag = argv.indexOf("--files");
  if (filesFlag >= 0) {
    return argv.slice(filesFlag + 1).filter((file) => file !== "--files").map(normalizeRepoPath);
  }
  const added = gitPaths(["diff", "--cached", "--name-only", "--diff-filter=A", "-z"]);
  const untracked = gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]);
  return selectNewPhotos(added, untracked);
}
