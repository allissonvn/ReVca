// Exportação com Puppeteer (AGENTS.md §8): abre /render/:id (a MESMA arte da
// prévia), espera fontes e imagens, e gera PDF (uma página por página da
// campanha) ou PNG por página. A instância do navegador é reutilizada entre
// exportações e fechada no encerramento do servidor.
import puppeteer, { Browser, Page } from "puppeteer";
import { Campanha, Catalogos } from "../shared/schema.js";
import { PAGINA_LARGURA, PAGINA_ALTURA } from "../shared/layout.js";
import { renderDocumento } from "../shared/render.js";
import { NaoEncontradoError } from "./storage.js";

export type Exportador = {
  exportarPdf: (campanha: Campanha, catalogos: Catalogos) => Promise<Buffer>;
  exportarPng: (campanha: Campanha, catalogos: Catalogos, pagina?: number) => Promise<Buffer[]>;
  fechar: () => Promise<void>;
};

export type OpcoesExportador = {
  /** URL base para resolver /logos e /assets quando o HTML é carregado
   * sem servidor (page.setContent roda em about:blank). */
  urlBase?: () => string;
};

export function criarExportador(opcoes: OpcoesExportador = {}): Exportador {
  let browser: Browser | null = null;
  const urlBase = opcoes.urlBase ?? (() => "http://127.0.0.1:8080");

  async function navegador(): Promise<Browser> {
    if (!browser || !browser.connected) {
      browser = await puppeteer.launch({ headless: true });
    }
    return browser;
  }

  /** Prepara uma página nova com o HTML completo da campanha. */
  async function preparar(campanha: Campanha, catalogos: Catalogos): Promise<Page> {
    const b = await navegador();
    const page = await b.newPage();
    await page.setViewport({
      width: PAGINA_LARGURA,
      height: PAGINA_ALTURA,
      deviceScaleFactor: 2, // PNG nítido (AGENTS.md §8)
    });
    // <base> resolve /logos e /assets (setContent roda em about:blank)
    const html = renderDocumento(campanha, catalogos)
      .replace("<head>", `<head><base href="${urlBase()}/">`);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForNetworkIdle({ idleTime: 300 }); // logos e marca d'água
    await page.evaluate(() => document.fonts.ready);
    return page;
  }

  return {
    async exportarPdf(campanha, catalogos) {
      const page = await preparar(campanha, catalogos);
      try {
        const pdf = await page.pdf({
          width: `${PAGINA_LARGURA}px`,
          height: `${PAGINA_ALTURA}px`,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          pageRanges: "", // todas as páginas da campanha
        });
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    },

    async exportarPng(campanha, catalogos, pagina) {
      const page = await preparar(campanha, catalogos);
      try {
        const alvo = pagina !== undefined
          ? [pagina] // 1-based: a API aceita ?pagina=n (1 = primeira)
          : campanha.paginas.map((_, i) => i + 1);
        const saidas: Buffer[] = [];
        const elementos = await page.$$(".pagina");
        if (alvo.some((n) => n < 1 || n > elementos.length)) {
          throw new NaoEncontradoError(`página ${pagina} não existe (a campanha tem ${elementos.length})`);
        }
        for (const n of alvo) {
          const el = elementos[n - 1];
          if (el) saidas.push(Buffer.from(await el.screenshot({ type: "png" })));
        }
        return saidas;
      } finally {
        await page.close();
      }
    },

    async fechar() {
      if (browser) {
        await browser.close();
        browser = null;
      }
    },
  };
}

/** Nome do arquivo sanitizado: <titulo>-<mes>.pdf/png (AGENTS.md §8). */
export function nomeArquivo(campanha: Campanha, extensao: "pdf" | "png"): string {
  const bruto = `${campanha.titulo}-${campanha.mes}`;
  const limpo = bruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-") // " - " não vira três hífens
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${limpo}.${extensao}`;
}
