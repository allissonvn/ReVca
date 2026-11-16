// Exportação com Puppeteer (AGENTS.md §8): abre /render/:id (a MESMA arte da
// prévia), espera fontes e imagens, e gera PDF (uma página por página da
// campanha) ou PNG por página. A instância do navegador é reutilizada entre
// exportações e fechada no encerramento do servidor.
//
// Qualidade:
// - alta: PDF vetorial (texto nítido, selecionável) / PNG 2×;
// - comprimida: rasteriza cada página em PNG 1× e monta o PDF com pdf-lib
//   (arquivo bem menor, bom para WhatsApp/e-mail) / PNG 1×.
//   (JPEG do Puppeteer foi descartado: o encoder do Chromium duplica o
//   conteúdo colorido nessa página — PNG sai limpo e ainda pequeno.)
import puppeteer, { Browser, Page } from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { Campanha, Catalogos } from "../shared/schema.js";
import { PAGINA_LARGURA, PAGINA_ALTURA } from "../shared/layout.js";
import { renderDocumento } from "../shared/render.js";
import { NaoEncontradoError } from "./storage.js";

export type OpcoesExport = {
  /** Página única (1-based). Ausente = todas. */
  pagina?: number;
  /** Versão comprimida (raster 1×). */
  comprimida?: boolean;
};

export type Exportador = {
  exportarPdf: (campanha: Campanha, catalogos: Catalogos, opcoes?: OpcoesExport) => Promise<Buffer>;
  exportarPng: (campanha: Campanha, catalogos: Catalogos, opcoes?: OpcoesExport) => Promise<Buffer[]>;
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

  /** Prepara uma página nova com o HTML completo da campanha.
   * `escala` é o deviceScaleFactor (2 = nítido; 1.5 = raster comprimido). */
  async function preparar(campanha: Campanha, catalogos: Catalogos, escala: number): Promise<Page> {
    const b = await navegador();
    const page = await b.newPage();
    await page.setViewport({
      width: PAGINA_LARGURA,
      height: PAGINA_ALTURA,
      deviceScaleFactor: escala,
    });
    // <base> resolve /logos e /assets (setContent roda em about:blank)
    const html = renderDocumento(campanha, catalogos)
      .replace("<head>", `<head><base href="${urlBase()}/">`);
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    await page.waitForNetworkIdle({ idleTime: 300 }); // logos e marca d'água
    await page.evaluate(() => document.fonts.ready);
    return page;
  }

  /** Índices (0-based) das páginas a exportar; valida a página pedida. */
  function indices(campanha: Campanha, pagina?: number): number[] {
    if (pagina === undefined) return campanha.paginas.map((_, i) => i);
    if (pagina < 1 || pagina > campanha.paginas.length) {
      throw new NaoEncontradoError(`página ${pagina} não existe (a campanha tem ${campanha.paginas.length})`);
    }
    return [pagina - 1];
  }

  return {
    async exportarPdf(campanha, catalogos, opcoes = {}) {
      if (opcoes.comprimida) {
        const page = await preparar(campanha, catalogos, 1);
        try {
          const els = await page.$$(".pagina");
          const doc = await PDFDocument.create();
          for (const i of indices(campanha, opcoes.pagina)) {
            const el = els[i];
            if (!el) continue;
            const img = await doc.embedPng(await el.screenshot({ type: "png" }));
            // 924×1308 px a 96 dpi = 693×981 pt (mesmo tamanho do PDF vetorial)
            const pag = doc.addPage([PAGINA_LARGURA * 0.75, PAGINA_ALTURA * 0.75]);
            pag.drawImage(img, { x: 0, y: 0, width: pag.getWidth(), height: pag.getHeight() });
          }
          // sem object streams para o PDF ficar legível (contagem de páginas nos testes)
          return Buffer.from(await doc.save({ useObjectStreams: false }));
        } finally {
          await page.close();
        }
      }
      const page = await preparar(campanha, catalogos, 1);
      try {
        const pdf = await page.pdf({
          width: `${PAGINA_LARGURA}px`,
          height: `${PAGINA_ALTURA}px`,
          printBackground: true,
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
          ...(opcoes.pagina !== undefined ? { pageRanges: `${opcoes.pagina}` } : {}),
        });
        return Buffer.from(pdf);
      } finally {
        await page.close();
      }
    },

    async exportarPng(campanha, catalogos, opcoes = {}) {
      const comprimida = opcoes.comprimida === true;
      const page = await preparar(campanha, catalogos, comprimida ? 1 : 2);
      try {
        const els = await page.$$(".pagina");
        const saidas: Buffer[] = [];
        for (const i of indices(campanha, opcoes.pagina)) {
          const el = els[i];
          if (!el) continue;
          saidas.push(Buffer.from(await el.screenshot({ type: "png" })));
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

/** Nome do arquivo sanitizado: <titulo>-<mes>.<ext> (AGENTS.md §8). */
export function nomeArquivo(campanha: Campanha, extensao: string): string {
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
