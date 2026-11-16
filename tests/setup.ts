// Setup global para testes Vitest
// Fornece createRequire para módulos que precisam carregar módulos CJS (como better-sqlite3)
import { createRequire } from "node:module";

declare global {
  var createRequire: typeof import("node:module").createRequire;
}

globalThis.createRequire = createRequire;