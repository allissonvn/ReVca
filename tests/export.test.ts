import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarApp } from "../src/server/index.js";
import { criarStorage } from "../src/server/storage.js";
import type { Server } from "node:http";

// Servidor real em porta efêmera (exportação usa Puppeteer de verdade:
// o teste obrigatório do AGENTS.md §10 é a contagem de páginas do PDF)
const raizDados = mkdtempSync(join(tmpdir(), "vca-export-"));
mkdirSync(join(raizDados, "catalogos"), { recursive: true });
for (const arq of ["modelos.json", "tipos-bloco.json", "titulos.json", "empreendimentos.json"]) {
  copyFileSync(join("data", "catalogos", arq), join(raizDados, "catalogos", arq));
}
const app = criarApp({ raizDados });
const server: Server = await new Promise((pronto) => {
  const s = app.listen(0, "127.0.0.1", () => pronto(s));
});
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
// o exportador resolve /logos e /assets pela URL real do servidor
app.locals.urlBase = base;

// campanha com 4 páginas (como o seed)
const campanha = () => ({
  versao: 1,
  id: "exporta",
  titulo: "Parcelamento Matriz - Teste",
  mes: "NOVEMBRO",
  paginas: Array.from({ length: 4 }, (_, i) => ({
    id: `pag-${i + 1}`,
    modelo: "residencial",
    faixa: `Faixa ${i + 1}`,
    cartoes: [
      {
        id: `car-${i + 1}`,
        empreendimentoId: null,
        titulo: [`Condições ${i + 1}`],
        blocos: [{ id: `blo-${i + 1}`, tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: `Teste ${i + 1}` }],
      },
    ],
  })),
  revisao: 1,
  atualizadoEm: "2026-11-16T10:00:00.000Z",
});

criarStorage(raizDados).criar(campanha() as never);

afterAll(async () => {
  server.close();
  // fecha o Chromium criado pelo exportador padrão
  await app.locals?.exportador?.fechar();
});

/** Número de páginas de um PDF pelo objeto Page do PDF. */
function contarPaginasPdf(pdf: Buffer): number {
  const s = pdf.toString("latin1");
  const matches = s.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

describe("exportação", () => {
  it("PDF tem uma página por página da campanha (4)", { timeout: 60000 }, async () => {
    const r = await fetch(`${base}/api/campanhas/exporta/exportar?formato=pdf`, { method: "POST" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("pdf");
    const pdf = Buffer.from(await r.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(contarPaginasPdf(pdf)).toBe(4);
    // nome do arquivo: titulo-mes.pdf sanitizado
    expect(r.headers.get("content-disposition")).toContain("parcelamento-matriz-teste-novembro.pdf");
  });

  it("PNG de uma página", { timeout: 60000 }, async () => {
    const r = await fetch(`${base}/api/campanhas/exporta/exportar?formato=png&pagina=2`, { method: "POST" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("png");
    const png = Buffer.from(await r.arrayBuffer());
    // assinatura PNG
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // 2× device scale: PNG da página 924×1308 sai com 1848 de largura (IHDR)
    const largura = png.readUInt32BE(16);
    expect(largura).toBe(1848);
  });

  it("PNG de página inexistente responde 404", { timeout: 60000 }, async () => {
    const r = await fetch(`${base}/api/campanhas/exporta/exportar?formato=png&pagina=9`, { method: "POST" });
    expect(r.status).toBe(404);
  });
});
