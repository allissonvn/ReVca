import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { criarApp } from "../src/server/index.js";
import { criarStorage } from "../src/server/storage.js";
import type { Server } from "node:http";

const require = createRequire(import.meta.url);

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

// Cookie para autenticação (v2)
let tokenExport: string | null = null;

async function fazerLoginExport(): Promise<void> {
  const r = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@vca.com", senha: "admin123" }),
  });
  if (r.status !== 200) throw new Error(`login falhou: ${r.status}`);
  // token só vem no cookie HTTP-only
  const cookie = r.headers.get("set-cookie") ?? "";
  const token = cookie.split(";")[0]?.split("=")[1];
  if (!token) throw new Error("cookie de sessão não retornado pelo login");
  tokenExport = token;
}

async function fetchAuth(caminho: string, opts?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {};
  if (tokenExport) headers["cookie"] = `connect.sid=${tokenExport}`;
  if (opts?.headers) Object.assign(headers, opts.headers as Record<string, string>);
  return fetch(`${base}${caminho}`, { ...opts, headers });
}

// cadastra primeiro usuário e faz login antes dos testes
beforeAll(async () => {
  await fetch(`${base}/api/auth/usuarios`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ nome: "Admin", email: "admin@vca.com", senha: "admin123", papel: "editor" }),
  }).catch(() => {}); // ignora se já existe
  await fazerLoginExport();
});

// campanha com 4 páginas (como o seed)
const campanha = () => ({
  versao: 1,
  id: "exporta",
  usuarioId: "admin",
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
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=pdf`, { method: "POST" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("pdf");
    const pdf = Buffer.from(await r.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(contarPaginasPdf(pdf)).toBe(4);
    // nome do arquivo: titulo-mes.pdf sanitizado
    expect(r.headers.get("content-disposition")).toContain("parcelamento-matriz-teste-novembro.pdf");
  });

  it("PNG de uma página", { timeout: 60000 }, async () => {
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=png&pagina=2`, { method: "POST" });
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
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=png&pagina=9`, { method: "POST" });
    expect(r.status).toBe(404);
  });

  it("PDF comprimido: 4 páginas rasterizadas, PDF válido", { timeout: 90000 }, async () => {
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=pdf&qualidade=comprimida`, { method: "POST" });
    expect(r.status).toBe(200);
    const pdf = Buffer.from(await r.arrayBuffer());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(contarPaginasPdf(pdf)).toBe(4);
  });

  it("PNG comprimido: mesma página em resolução 1× (menor)", { timeout: 90000 }, async () => {
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=png&qualidade=comprimida&pagina=1`, { method: "POST" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("png");
    const png = Buffer.from(await r.arrayBuffer());
    expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    // 1× : largura 924 (IHDR) em vez de 1848 da alta
    expect(png.readUInt32BE(16)).toBe(924);
  });

  it("PDF de uma página só (vetorial)", { timeout: 90000 }, async () => {
    const r = await fetchAuth(`/api/campanhas/exporta/exportar?formato=pdf&pagina=3`, { method: "POST" });
    expect(r.status).toBe(200);
    const pdf = Buffer.from(await r.arrayBuffer());
    expect(contarPaginasPdf(pdf)).toBe(1);
  });
});
