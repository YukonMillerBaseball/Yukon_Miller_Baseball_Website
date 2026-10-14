import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stub = pathToFileURL(path.join(root, "scripts/server-only-stub.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return nextResolve(stub, context);
  }

  let filePath = null;
  if (specifier.startsWith("@/")) {
    filePath = path.join(root, "src", specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL
  ) {
    filePath = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }

  if (filePath && !path.extname(filePath)) {
    for (const ext of [".ts", ".tsx", ".mts", ".js", ".mjs"]) {
      if (existsSync(filePath + ext)) {
        filePath += ext;
        break;
      }
    }
  }

  if (filePath) return nextResolve(pathToFileURL(filePath).href, context);
  return nextResolve(specifier, context);
}
