// scripts/screenshots.mjs — Phase 0 do PROMPT-UI.md
// Faz login no app local e captura PNGs de Login, Home, Editor e Usuários,
// nos temas claro e escuro, em 1440×900, em tmp/screens/ (gitignorado).
// Uso: node scripts/screenshots.mjs   (servidor já deve estar rodando em localhost:8080)
import puppeteer from "puppeteer";
import { mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = "http://127.0.0.1:8080";
const OUT = resolve("tmp/screens");
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 1 };

mkdirSync(OUT, { recursive: true });
console.log("diretório de saída:", OUT);

async function login(page) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  // a tela de login renderiza em "/" (sem rota /login); detecta pelo formulário
  const campoEmail = await page.$("#login-email");
  if (campoEmail) {
    await page.waitForSelector("#login-email", { timeout: 5000 });
    await page.type("#login-email", "admin@vca.com");
    await page.type("#login-senha", "admin123");
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !document.querySelector("#login-email"), { timeout: 8000 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
  }
}

async function setTheme(page, tema) {
  // define o tema de forma determinística (o toggle alternaria sempre)
  await page.evaluate((t) => localStorage.setItem("vca-tema", t), tema);
  await page.reload({ waitUntil: "networkidle0" });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
}

async function capturar(page, nome, tema, rota) {
  await page.goto(`${BASE}${rota}`, { waitUntil: "networkidle0" });
  await setTheme(page, tema);
  await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
  const caminho = `${OUT}/${nome}-${tema}.png`;
  try {
    await page.screenshot({ path: caminho, fullPage: true });
    console.log(`ok: ${caminho} (${existsSync(caminho) ? "existe" : "NAO SALVO"})`);
  } catch (e) {
    console.log(`erro: ${caminho}: ${e.message}`);
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);

  await login(page);

  await capturar(page, "home", "claro", "/");
  await capturar(page, "home", "escuro", "/");

  await capturar(page, "usuarios", "claro", "/?tela=usuarios");
  await capturar(page, "usuarios", "escuro", "/?tela=usuarios");

  // A home abre o editor por botão (window.location), não por <a href>,
  // então o id da campanha vem da API.
  const diagnostico = await page.evaluate(async () => {
    const r = await fetch("/api/campanhas");
    const corpo = await r.text();
    let ids = [];
    if (r.ok) {
      try {
        const lista = JSON.parse(corpo);
        ids = (Array.isArray(lista) ? lista : []).map((c) => c.id);
      } catch { /* corpo inválido */ }
    }
    return { status: r.status, url: location.href, ids, amostra: corpo.slice(0, 120) };
  });
  console.log("campanhas:", JSON.stringify(diagnostico));
  const campanhas = diagnostico.ids;
  if (campanhas.length > 0) {
    const rota = `/?campanha=${encodeURIComponent(campanhas[0])}`;
    await capturar(page, "editor", "claro", rota);
    await capturar(page, "editor", "escuro", rota);
  } else {
    console.log("nenhuma campanha encontrada; pulando editor");
  }

  await page.goto(`${BASE}/api/auth/logout`, { waitUntil: "networkidle0" });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.evaluate(() => new Promise((r) => setTimeout(r, 500)));
  await capturar(page, "login", "claro", "/");
  await capturar(page, "login", "escuro", "/");

  await browser.close();
  console.log("concluído: screenshots em tmp/screens/");
})();
