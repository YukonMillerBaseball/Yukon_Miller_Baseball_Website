import { register } from "node:module";

await register("./test-alias-hooks.mjs", import.meta.url);
