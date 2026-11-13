// Dev: gera um HTML de prévia do seed em temp-preview.html (para conferir a arte).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { renderDocumento, artCss } from "../src/shared/render.js";
import { CampanhaSchema, Catalogos, ModeloSchema, TipoBlocoSchema, TituloProntoSchema, EmpreendimentoSchema } from "../src/shared/schema.js";
import { acharRaiz } from "../src/shared/raiz.js";

const raiz = acharRaiz();
const lerJson = (rel: string) => JSON.parse(readFileSync(join(raiz, rel), "utf8"));

const catalogos: Catalogos = {
  modelos: lerJson("data/catalogos/modelos.json").map((m: unknown) => ModeloSchema.parse(m)),
  tiposBloco: lerJson("data/catalogos/tipos-bloco.json").map((t: unknown) => TipoBlocoSchema.parse(t)),
  titulos: lerJson("data/catalogos/titulos.json").map((t: unknown) => TituloProntoSchema.parse(t)),
  empreendimentos: lerJson("data/catalogos/empreendimentos.json").map((e: unknown) => EmpreendimentoSchema.parse(e)),
};
const campanha = CampanhaSchema.parse(lerJson("data/campanhas/exemplo.json"));

let html = renderDocumento(campanha, catalogos);

// Fontes por file:// (a prévia roda de file://)
const fontes: Record<string, string> = {
  "anton-latin-400-normal.woff2": "@fontsource/anton/files",
  "oswald-latin-300-normal.woff2": "@fontsource/oswald/files",
  "open-sans-latin-400-normal.woff2": "@fontsource/open-sans/files",
  "open-sans-latin-600-normal.woff2": "@fontsource/open-sans/files",
  "open-sans-latin-700-normal.woff2": "@fontsource/open-sans/files",
};
const css = artCss();
let cssLocal = css;
for (const [arq, dir] of Object.entries(fontes)) {
  cssLocal = cssLocal.replaceAll(`/assets/fonts/${arq}`, pathToFileURL(join(raiz, "node_modules", dir, arq)).href);
}
html = html.replace(css, cssLocal);

// Logos e marca d'água por file://
for (const l of ["logo-vca.png", "watermark.png", "uni-ville.png", "dona-olivia.png", "baron-connect.png", "baron-uchoa.png", "kahakai.png"]) {
  html = html.replaceAll(`/logos/${l}`, pathToFileURL(join(raiz, "data/logos", l)).href);
}

writeFileSync(join(raiz, "temp-preview.html"), html, "utf8");
console.log("temp-preview.html gerado");
