// Build do projeto: empacota cliente (esbuild) e servidor/scripts (node),
// copia fontes locais para dist/client/fonts. Roda com `npm run build`.
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url)); // scripts/
const raiz = dirname(root); // raiz do projeto

const passo = async (nome, acao) => {
  try {
    await acao();
    console.log(`build: ${nome} ok`);
  } catch (e) {
    console.warn(`build: ${nome} ignorado (${e?.message ?? e})`);
  }
};

// Servidor: bundle node (puppeteer fica externo por causa de binários dinâmicos).
// Todas as dependências do node_modules ficam como external para evitar
// problemas com require() em dependências CJS dentro do bundle ESM.
import { readdirSync } from "node:fs";
const nodeModules = readdirSync(join(raiz, "node_modules"));

await passo("servidor", () => build({
  entryPoints: [join(raiz, "src/server/index.ts")],
  outfile: join(raiz, "dist/server/index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: true,
  external: ["puppeteer", "better-sqlite3", ...nodeModules],
  logLevel: "warning",
}));

// Seed
await passo("seed", () => build({
  entryPoints: [join(raiz, "scripts/seed.ts")],
  outfile: join(raiz, "dist/scripts/seed.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "warning",
}));

// Cliente (bundle para navegador). jsx: automatic → main.tsx (React).
await passo("cliente", () => build({
  entryPoints: [join(raiz, "src/client/main.tsx")],
  outdir: join(raiz, "dist/client"),
  bundle: true,
  format: "iife",
  jsx: "automatic",
  sourcemap: true,
  logLevel: "warning",
}));

await passo("html", () => {
  copyFileSync(join(raiz, "src/client/index.html"), join(raiz, "dist/client/index.html"));
});

await passo("estilos", () => {
  copyFileSync(join(raiz, "src/client/styles.css"), join(raiz, "dist/client/styles.css"));
});

// Fontes locais (@fontsource): woff2 latin que o CSS da arte referencia
await passo("fontes", () => {
  const destino = join(raiz, "dist/client/fonts");
  mkdirSync(destino, { recursive: true });
  const fonte = (pacote, arquivo) => {
    const origem = join(raiz, "node_modules", "@fontsource", pacote, "files", arquivo);
    if (!existsSync(origem)) throw new Error(`fonte ausente: ${arquivo}`);
    copyFileSync(origem, join(destino, arquivo));
  };
  fonte("anton", "anton-latin-400-normal.woff2");
  fonte("oswald", "oswald-latin-300-normal.woff2");
  fonte("open-sans", "open-sans-latin-400-normal.woff2");
  fonte("open-sans", "open-sans-latin-600-normal.woff2");
  fonte("open-sans", "open-sans-latin-700-normal.woff2");
});

console.log("build: concluído");

