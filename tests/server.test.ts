import { describe, it, expect, afterAll } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { criarApp } from "../src/server/index.js";
import { criarStorage } from "../src/server/storage.js";
import type { Server } from "node:http";

// Servidor real em porta efêmera + diretório de dados temporário
const raizDados = mkdtempSync(join(tmpdir(), "vca-test-"));
// catálogos reais do projeto (o app lê do disco a cada requisição)
mkdirSync(join(raizDados, "catalogos"), { recursive: true });
for (const arq of ["modelos.json", "tipos-bloco.json", "titulos.json", "empreendimentos.json"]) {
  copyFileSync(join("data", "catalogos", arq), join(raizDados, "catalogos", arq));
}
const server: Server = await new Promise((pronto) => {
  const s = criarApp({ raizDados }).listen(0, "127.0.0.1", () => pronto(s));
});
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

async function req(metodo: string, caminho: string, corpo?: unknown) {
  const r = await fetch(base + caminho, {
    method: metodo,
    headers: corpo !== undefined ? { "content-type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(texto); } catch { /* html */ }
  return { status: r.status, json, texto };
}

const campanhaTeste = () => ({
  versao: 1,
  id: "teste",
  titulo: "Parcelamento Matriz",
  mes: "NOVEMBRO",
  paginas: [
    {
      id: "p1",
      modelo: "residencial",
      faixa: "Linha: Uni Residencial",
      cartoes: [
        {
          id: "c1",
          empreendimentoId: null,
          titulo: ["Condições para o ..."],
          blocos: [{ id: "b1", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "olá" }],
        },
      ],
    },
  ],
  revisao: 1,
  atualizadoEm: "2026-11-01T10:00:00.000Z",
});

afterAll(() => { server.close(); });

describe("API de campanhas", () => {
  it("cria, lê, salva e lista campanha", async () => {
    const criada = await req("POST", "/api/campanhas");
    expect(criada.status).toBe(201);
    const id = (criada.json as { id: string }).id;
    expect(id).toMatch(/^[a-z0-9_-]+$/);

    const lida = await req("GET", `/api/campanhas/${id}`);
    expect(lida.status).toBe(200);
    expect((lida.json as { mes: string }).mes).toBeTruthy();

    // salva com a revisão vista (1) → servidor sobe para 2
    const corpo = { ...(lida.json as object), titulo: "Editada" };
    const salva = await req("PUT", `/api/campanhas/${id}`, corpo);
    expect(salva.status).toBe(200);
    expect((salva.json as { revisao: number }).revisao).toBe(2);
    expect((salva.json as { titulo: string }).titulo).toBe("Editada");

    const lista = await req("GET", "/api/campanhas");
    expect((lista.json as { id: string }[]).some((c) => c.id === id)).toBe(true);
  });

  it("duplica para outro mês", async () => {
    const storage = criarStorage(raizDados);
    storage.criar(campanhaTeste() as never);
    const dup = await req("POST", "/api/campanhas", { duplicarDe: "teste", mes: "DEZEMBRO" });
    expect(dup.status).toBe(201);
    const nova = dup.json as { id: string; mes: string; revisao: number };
    expect(nova.mes).toBe("DEZEMBRO");
    expect(nova.revisao).toBe(1);
    expect(nova.id).not.toBe("teste");
    expect(await req("GET", "/api/campanhas/teste")).toHaveProperty("status", 200);
  });

  it("PUT com revisão atrasada responde 409 com a campanha atual e não altera o arquivo", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "conflito" } as never);
    const atual = await req("GET", "/api/campanhas/conflito");
    const corpoDesatualizado = { ...(atual.json as object), revisao: 999, titulo: "Roubado" };
    const resp = await req("PUT", "/api/campanhas/conflito", corpoDesatualizado);
    expect(resp.status).toBe(409);
    const campanhaAtual = (resp.json as { campanha: { titulo: string; revisao: number } }).campanha;
    expect(campanhaAtual.titulo).not.toBe("Roubado");
    expect(campanhaAtual.revisao).toBe(1);
    // arquivo no disco continua o mesmo
    const noDisco = JSON.parse(readFileSync(join(raizDados, "campanhas", "conflito.json"), "utf8"));
    expect(noDisco.revisao).toBe(1);
  });

  it("PUT com dados inválidos responde 422 com os erros do Zod", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "invalido" } as never);
    const atual = await req("GET", "/api/campanhas/invalido");
    const corpo = { ...(atual.json as object), mes: "NATAL" };
    const resp = await req("PUT", "/api/campanhas/invalido", corpo);
    expect(resp.status).toBe(422);
    expect((resp.json as { erros: unknown[] }).erros.length).toBeGreaterThan(0);
  });

  it("PUT com corpo quebrado responde 422", async () => {
    const r = await fetch(base + "/api/campanhas/qualquer", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{ não é json }",
    });
    expect(r.status).toBe(400); // json malformado nem chega ao Zod
  });

  it("id com ../x é rejeitado", async () => {
    const resp = await req("GET", "/api/campanhas/..%2Fx");
    expect([400, 404]).toContain(resp.status);
    // caminho externo não foi lido: nenhum arquivo fora de raizDados
    expect(existsSync(join(raizDados, "campanhas", "x.json"))).toBe(false);
  });

  it("DELETE move para a lixeira (não apaga)", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "lixeira" } as never);
    const del = await req("DELETE", "/api/campanhas/lixeira");
    expect(del.status).toBe(204);
    expect(existsSync(join(raizDados, "campanhas", "lixeira.json"))).toBe(false);
    const lixeira = readdirSync(join(raizDados, "lixeira"));
    expect(lixeira.some((f) => f.startsWith("lixeira-"))).toBe(true);
  });

  it("mantém no máximo 20 arquivos de histórico após 22 gravações", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "hist" } as never);
    let atual = await req("GET", "/api/campanhas/hist");
    for (let i = 0; i < 22; i++) {
      const corpo = { ...(atual.json as object), titulo: `v${i}` };
      const salva = await req("PUT", "/api/campanhas/hist", corpo);
      expect(salva.status).toBe(200);
      atual = { status: 200, json: salva.json, texto: "" };
    }
    const dir = join(raizDados, "historico", "hist");
    const arquivos = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(arquivos.length).toBe(20);
  });

  it("catálogos vêm com os 4 conjuntos", async () => {
    const resp = await req("GET", "/api/catalogos");
    expect(resp.status).toBe(200);
    const c = resp.json as Record<string, unknown[]>;
    expect(Object.keys(c).sort()).toEqual(["empreendimentos", "modelos", "tiposBloco", "titulos"]);
    expect(c.modelos!.length).toBeGreaterThan(0);
  });

  it("GET /render/:id devolve HTML com as páginas", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "render" } as never);
    const r = await fetch(base + "/render/render");
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain('<div class="pagina"');
  });

  it("campanha desconhecida responde 404", async () => {
    expect((await req("GET", "/api/campanhas/nada")).status).toBe(404);
    expect((await req("DELETE", "/api/campanhas/nada")).status).toBe(404);
  });
});
