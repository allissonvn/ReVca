// Acha a raiz do projeto subindo até achar package.json
// (funciona no fonte e no bundle do esbuild).
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function acharRaiz(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (existsSync(join(dir, "package.json"))) return dir;
    const pai = dirname(dir);
    if (pai === dir) throw new Error("raiz do projeto não encontrada");
    dir = pai;
  }
}
