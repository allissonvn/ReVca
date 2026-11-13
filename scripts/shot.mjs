// Dev: captura cada .page de temp-preview.html em PNG (temp/pag-N.png).
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
mkdirSync(join(raiz, "temp"), { recursive: true });

const browser = await puppeteer.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 924, height: 1308 });
  await page.goto(pathToFileURL(join(raiz, "temp-preview.html")).href, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const paginas = await page.$$(".pagina");
  let i = 0;
  for (const el of paginas) {
    i += 1;
    await el.screenshot({ path: join(raiz, "temp", `pag-${String(i).padStart(2, "0")}.png`) });
  }
  console.log(`temp: ${i} páginas capturadas`);
} finally {
  await browser.close();
}
