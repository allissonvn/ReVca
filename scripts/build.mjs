// Placeholder build script — full esbuild pipeline arrives in Phase 3.
import { build } from "esbuild";

await build({ entryPoints: [], bundle: true, write: false, logLevel: "info" });
console.log("build: ok");
