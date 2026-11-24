// Verificação do canvas do editor (Puppeteer).
//
// Sobe o servidor já compilado (dist/server/index.js) apontando para um
// diretório de dados TEMPORÁRIO (tmp/check-canvas-data), faz o bootstrap do
// admin com REVCA_EMAIL/REVCA_SENHA, cria uma campanha de 2 páginas e abre o
// editor. Mede tudo em 1440×900 e 1280×800, salva screenshots em
// tmp/screens/canvas/ e falha (exit 1) se qualquer asserção não bater.
//
// Uso: npm run check:canvas   (roda o build antes)
// Requer: REVCA_EMAIL e REVCA_SENHA (admin).
import puppeteer from "puppeteer";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { once } from "node:events";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const DIR_DADOS = join(RAIZ, "tmp", "check-canvas-data");
const DIR_SCREENS = join(RAIZ, "tmp", "screens", "canvas");
const EMAIL = process.env.REVCA_EMAIL ?? "";
const SENHA = process.env.REVCA_SENHA ?? "";

if (!EMAIL || !SENHA) {
  console.error("Defina REVCA_EMAIL e REVCA_SENHA (admin) para rodar o check:canvas.");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const perto = (a, b, tol = 1) => Math.abs(a - b) <= tol;

const resultados = [];
function checar(nome, ok, detalhe = "") {
  resultados.push({ nome, ok });
  console.log(`${ok ? "OK  " : "FALHOU"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

// ---------------------------------------------------------------------------
// Servidor temporário
// ---------------------------------------------------------------------------
rmSync(DIR_DADOS, { recursive: true, force: true });
mkdirSync(DIR_DADOS, { recursive: true });
cpSync(join(RAIZ, "data", "catalogos"), join(DIR_DADOS, "catalogos"), { recursive: true });
cpSync(join(RAIZ, "data", "logos"), join(DIR_DADOS, "logos"), { recursive: true });
mkdirSync(DIR_SCREENS, { recursive: true });

const { criarApp } = await import("../dist/server/index.js");
const app = criarApp({ raizDados: DIR_DADOS, raizProjeto: RAIZ });
const servidor = app.listen(0, "127.0.0.1");
await once(servidor, "listening");
const porta = servidor.address().port;
const base = `http://127.0.0.1:${porta}`;
app.locals.urlBase = base;

const respBootstrap = await fetch(`${base}/api/auth/usuarios`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ nome: "Check Canvas", email: EMAIL, senha: SENHA }),
});
if (!respBootstrap.ok) {
  console.error("Bootstrap do admin falhou:", respBootstrap.status, await respBootstrap.text());
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Navegador
// ---------------------------------------------------------------------------
const navegador = await puppeteer.launch({ headless: true });
const pagina = await navegador.newPage();

async function assentar() {
  await pagina.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function esperar(fn, arg, timeout = 5000) {
  await pagina.waitForFunction(fn, { timeout, polling: 50 }, arg);
}

async function tamanhoMoldura() {
  return pagina.evaluate(() => {
    const m = document.querySelector(".moldura");
    if (!m) return null;
    const r = m.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
}

async function zoomPara(alvo) {
  for (let i = 0; i < 20; i++) {
    const pct = await pagina.$eval(".zoom-pct", (el) => parseInt(el.textContent ?? "0", 10));
    if (pct === alvo) return;
    const seletor = pct < alvo ? 'button[title="Aumentar zoom"]' : 'button[title="Diminuir zoom"]';
    await pagina.click(seletor);
    await sleep(40);
  }
  throw new Error(`não consegui chegar no zoom ${alvo}%`);
}

async function screenshot(view, pct) {
  await pagina.screenshot({ path: join(DIR_SCREENS, `canvas-${view}-${pct}.png`) });
}

/** Define o texto do bloco selecionado como se o usuário tivesse digitado. */
async function definirTexto(valor) {
  await pagina.$eval(
    'textarea[aria-label="Texto do bloco selecionado"]',
    (el, v) => {
      el.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    valor,
  );
}

// ---------------------------------------------------------------------------
// Login + campanha de 2 páginas
// ---------------------------------------------------------------------------
await pagina.setViewport({ width: 1440, height: 900 });
await pagina.goto(`${base}/`, { waitUntil: "networkidle0" });
await esperar(() => document.querySelector("#login-email") !== null);
await pagina.type("#login-email", EMAIL);
await pagina.type("#login-senha", SENHA);
await pagina.click('form[aria-label="Entrar no editor"] button[type="submit"]');
await esperar(() => document.querySelector("#login-email") === null);

// Cria uma campanha determinística com 2 páginas (1 bloco por cartão).
const campanhaId = await pagina.evaluate(async () => {
  const criar = await fetch("/api/campanhas", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ titulo: "Check Canvas", mes: "NOVEMBRO" }),
  });
  if (!criar.ok) throw new Error(`POST campanha: ${criar.status}`);
  const c = await criar.json();
  const p1 = c.paginas[0];
  p1.faixa = "FAIXA 1";
  p1.cartoes[0].titulo = ["CARTÃO UM"];
  p1.cartoes[0].blocos[0].texto = "Linha inicial";
  const p2 = structuredClone(p1);
  p2.id = "pag-2";
  p2.faixa = "FAIXA 2";
  p2.cartoes[0].id = "car-2";
  p2.cartoes[0].titulo = ["CARTÃO DOIS"];
  p2.cartoes[0].blocos[0].id = "blo-2";
  p2.cartoes[0].blocos[0].tipo = "financiamento";
  p2.cartoes[0].blocos[0].texto = "Linha dois";
  c.paginas = [p1, p2];
  const salvar = await fetch(`/api/campanhas/${c.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify(c),
  });
  if (!salvar.ok) throw new Error(`PUT campanha: ${salvar.status} ${await salvar.text()}`);
  return c.id;
});

await pagina.goto(`${base}/?campanha=${encodeURIComponent(campanhaId)}`, { waitUntil: "networkidle0" });
await esperar(() => document.querySelector(".moldura") !== null && document.querySelectorAll(".rail-item").length >= 2);
await assentar();

// ---------------------------------------------------------------------------
// Suíte por viewport
// ---------------------------------------------------------------------------
async function suite(view) {
  console.log(`\n=== viewport ${view} ===`);
  await assentar();

  // Garante página 1, sem "ver todas".
  const verTodas = await pagina.$(".left-rail input[type=checkbox]");
  if (verTodas && (await (await verTodas.getProperty("checked")).jsonValue())) {
    await verTodas.click();
    await assentar();
  }
  const itens = await pagina.$$(".left-rail .rail-item");
  if (itens[0]) {
    await itens[0].click();
    await assentar();
  }

  // A) zoom 100%
  await zoomPara(100);
  let m = await tamanhoMoldura();
  checar(`${view} 100%: moldura 924×1308`, m !== null && perto(m.w, 924) && perto(m.h, 1308), `${m?.w.toFixed(1)}×${m?.h.toFixed(1)}`);
  const esq = await pagina.evaluate(() => {
    const c = document.querySelector(".canvas");
    c.scrollLeft = 0;
    return {
      canvas: c.getBoundingClientRect().left,
      moldura: document.querySelector(".moldura").getBoundingClientRect().left,
    };
  });
  checar(`${view} 100%: nada cortado à esquerda`, esq.moldura >= esq.canvas - 0.5, `moldura.left=${esq.moldura.toFixed(1)} canvas.left=${esq.canvas.toFixed(1)}`);
  await screenshot(view, 100);

  // B) zoom 50%
  await zoomPara(50);
  m = await tamanhoMoldura();
  checar(`${view} 50%: moldura 462×654`, m !== null && perto(m.w, 462) && perto(m.h, 654), `${m?.w.toFixed(1)}×${m?.h.toFixed(1)}`);
  const met = await pagina.evaluate(() => {
    const c = document.querySelector(".canvas");
    const barra = document.querySelector(".zoom-bar");
    return {
      scrollHeight: c.scrollHeight,
      clientHeight: c.clientHeight,
      barraH: barra ? barra.getBoundingClientRect().height : 0,
    };
  });
  // Sem espaço morto: o conteúdo real é moldura + padding (48) + gap (16) + barra.
  // O piso do viewport (clientHeight) pode ser maior que isso; o bug antigo
  // mantinha 1308px de caixa e estourava qualquer um dos dois limites.
  const limite = Math.max(met.clientHeight, 654 + 48 + 16 + met.barraH);
  checar(`${view} 50%: sem espaço morto`, met.scrollHeight <= limite + 1, `scrollHeight=${met.scrollHeight} limite=${limite.toFixed(1)} (barra ${met.barraH.toFixed(1)})`);
  await screenshot(view, 50);

  // C) zoom 150%
  await zoomPara(150);
  m = await tamanhoMoldura();
  checar(`${view} 150%: moldura 1386×1962`, m !== null && perto(m.w, 1386) && perto(m.h, 1962), `${m?.w.toFixed(1)}×${m?.h.toFixed(1)}`);
  const bordas = await pagina.evaluate(() => {
    const c = document.querySelector(".canvas");
    c.scrollLeft = 0;
    const esq = document.querySelector(".moldura").getBoundingClientRect().left - c.getBoundingClientRect().left;
    c.scrollLeft = c.scrollWidth - c.clientWidth;
    const dir = c.getBoundingClientRect().right - document.querySelector(".moldura").getBoundingClientRect().right;
    return { esq, dir, max: c.scrollWidth - c.clientWidth };
  });
  checar(`${view} 150%: borda esquerda alcançável`, bordas.esq >= -0.5, `offset=${bordas.esq.toFixed(1)}`);
  checar(`${view} 150%: borda direita alcançável`, bordas.dir >= -0.5 && bordas.max > 0, `offset=${bordas.dir.toFixed(1)} maxScroll=${bordas.max}`);
  await pagina.evaluate(() => {
    const c = document.querySelector(".canvas");
    c.scrollLeft = 0;
    c.scrollTop = 0;
  });
  await screenshot(view, 150);

  // D) zoom persiste ao trocar de página e ao ligar "ver todas"
  const antes = await tamanhoMoldura();
  const lista = await pagina.$$(".left-rail .rail-item");
  await lista[1].click();
  await assentar();
  const depoisTroca = await tamanhoMoldura();
  checar(`${view} trocar de página mantém o zoom`, antes !== null && depoisTroca !== null && perto(antes.w, depoisTroca.w) && perto(antes.h, depoisTroca.h), `${antes?.w.toFixed(1)} → ${depoisTroca?.w.toFixed(1)}`);

  const caixaVerTodas = await pagina.$(".left-rail input[type=checkbox]");
  await caixaVerTodas.click();
  await assentar();
  const todas = await pagina.evaluate(() =>
    [...document.querySelectorAll(".moldura")].map((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  );
  checar(`${view} "ver todas" mantém o zoom`, todas.length === 2 && todas.every((t) => perto(t.w, antes.w) && perto(t.h, antes.h)), `${todas.map((t) => t.w.toFixed(1)).join(", ")}`);
  await caixaVerTodas.click();
  await assentar();
  await lista[0].click();
  await assentar();

  // E) destaque sem mutação: seleciona, digita, continua destacado com o nome do tipo
  await zoomPara(100);
  const alvo = await pagina.evaluate(() => {
    const el = document.querySelector('.canvas [data-bloco="blo-1"]');
    el.scrollIntoView({ block: "center" });
    el.click();
    return { id: el.dataset.bloco, nome: el.dataset.blocoNome };
  });
  await esperar(() => document.querySelector('textarea[aria-label="Texto do bloco selecionado"]') !== null);
  await definirTexto("Linha inicial editada");
  await assentar();
  const destaque = await pagina.evaluate((id) => {
    const el = document.querySelector(`.canvas [data-bloco="${id}"]`);
    const cs = getComputedStyle(el);
    const antes = getComputedStyle(el, "::before");
    return { outline: cs.outlineWidth, estilo: cs.outlineStyle, tag: antes.content };
  }, alvo.id);
  checar(`${view} destaque: outline 2px após digitar`, destaque.outline === "2px" && destaque.estilo === "solid", `outline=${destaque.outline} ${destaque.estilo}`);
  checar(`${view} destaque: tag = nome do tipo`, destaque.tag.replace(/^"|"$/g, "") === alvo.nome, `${destaque.tag} vs ${alvo.nome}`);

  // F) estouro: aviso nomeia o cartão; ao remover, some e o status volta
  const muitasLinhas = Array.from({ length: 80 }, (_, i) => `Linha ${i + 1}`).join("\n");
  await definirTexto(muitasLinhas);
  await esperar(() => document.querySelector(".aviso-estouro") !== null);
  const aviso = await pagina.evaluate(() => {
    const el = document.querySelector(".aviso-estouro");
    return { texto: el?.textContent ?? "", badge: document.querySelectorAll(".rail-item .rail-estouro").length };
  });
  checar(`${view} estouro: aviso nomeia o cartão`, aviso.texto.includes("Conteúdo passa da página em") && aviso.texto.includes("CARTÃO UM") && aviso.texto.includes("cortado no PDF"), aviso.texto.trim().slice(0, 90));
  checar(`${view} estouro: badge na lista de páginas`, aviso.badge >= 1, `badges=${aviso.badge}`);
  await pagina.click(".aviso-estouro");
  await assentar();
  checar(`${view} estouro: clique seleciona o cartão`, (await pagina.$(".secao-bloque-selecionado")) !== null);

  await definirTexto("Linha inicial");
  await esperar(() => document.querySelector(".aviso-estouro") === null);
  await esperar(() => (document.querySelector(".canvas-status")?.textContent ?? "").includes("Cabe na página"));
  const status = await pagina.$eval(".canvas-status", (el) => el.textContent ?? "");
  checar(`${view} estouro removido: status "Cabe na página"`, status.includes("Cabe na página"), status.trim());

  // G) barra de zoom centrada no canvas
  const centros = await pagina.evaluate(() => {
    const c = document.querySelector(".canvas");
    c.scrollLeft = 0; // posição padrão: a barra é sticky só na vertical
    const b = document.querySelector(".zoom-bar").getBoundingClientRect();
    const r = c.getBoundingClientRect();
    const cs = getComputedStyle(c);
    return {
      barra: b.left + b.width / 2,
      canvas: r.left + c.clientWidth / 2,
      barraL: b.left,
      barraW: b.width,
      canvasL: r.left,
      clientW: c.clientWidth,
      scrollW: c.scrollWidth,
      padL: parseFloat(cs.paddingLeft),
      padR: parseFloat(cs.paddingRight),
    };
  });
  checar(
    `${view} barra de zoom centrada no canvas`,
    Math.abs(centros.barra - centros.canvas) <= 2,
    `dif=${Math.abs(centros.barra - centros.canvas).toFixed(2)}px barra=${centros.barraL.toFixed(1)}+${centros.barraW.toFixed(1)}/2 canvasL=${centros.canvasL} clientW=${centros.clientW} scrollW=${centros.scrollW} pad=${centros.padL}/${centros.padR}`,
  );
}

try {
  await suite("1440x900");
  await pagina.setViewport({ width: 1280, height: 800 });
  await sleep(250);
  await suite("1280x800");
} catch (e) {
  console.error("\nErro durante a verificação:", e);
  checar("execução sem exceção", false, e instanceof Error ? e.message : String(e));
} finally {
  await navegador.close();
  servidor.close();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações OK`);
if (falhas.length > 0) {
  console.log("Falhas:", falhas.map((f) => f.nome).join(" | "));
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
