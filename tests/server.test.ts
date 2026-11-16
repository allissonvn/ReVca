import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { mkdtempSync, readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { criarApp } from "../src/server/index.js";
import { criarStorage } from "../src/server/storage.js";
import type { Server } from "node:http";

const require = createRequire(import.meta.url);

// Servidor real em porta efêmera + diretório de dados temporário
const raizDados = mkdtempSync(join(tmpdir(), "vca-test-"));
mkdirSync(join(raizDados, "catalogos"), { recursive: true });
for (const arq of ["modelos.json", "tipos-bloco.json", "titulos.json", "empreendimentos.json"]) {
  copyFileSync(join("data", "catalogos", arq), join(raizDados, "catalogos", arq));
}
const server: Server = await new Promise((pronto) => {
  const s = criarApp({ raizDados }).listen(0, "127.0.0.1", () => pronto(s));
});
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

// Token de sessão (mantido entre requisições via header Authorization: Bearer)
let tokenSessao: string | undefined;

async function req(metodo: string, caminho: string, corpo?: unknown): Promise<{ status: number; json: unknown; texto: string }> {
  const headers: Record<string, string> = {};
  if (corpo !== undefined) headers["content-type"] = "application/json";
  let url = base + caminho;
  if (tokenSessao) {
    const sep = caminho.includes("?") ? "&" : "?";
    url += `${sep}token=${encodeURIComponent(tokenSessao)}`;
  }
  const r = await fetch(url, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let json: unknown = null;
  try { json = JSON.parse(texto); } catch { /* html */ }
  return { status: r.status, json, texto };
}

/** Faz login e armazena o token na variável tokenSessao. */
async function fazerLogin(email: string = "admin@vca.com", senha: string = "admin123"): Promise<string> {
  const r = await req("POST", "/api/auth/login", { email, senha });
  if (r.status !== 200) throw new Error(`login falhou: ${r.status} ${r.texto}`);
  const body = r.json as { token?: string } | null;
  const token = body?.token;
  if (!token) throw new Error("token não retornado pelo login: " + r.texto);
  tokenSessao = token;
  return token;
}

const campanhaTeste = () => ({
  versao: 1,
  id: "teste",
  usuarioId: "admin",
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

describe("Autenticação (v2)", () => {
  it("cadastra primeiro usuário", async () => {
    const r = await req("POST", "/api/auth/usuarios", {
      nome: "Admin",
      email: "admin@vca.com",
      senha: "admin123",
      papel: "editor",
    });
    expect([201, 403]).toContain(r.status);
    if (r.status === 201) {
      expect((r.json as { papel: string }).papel).toBe("editor");
    }
  });

  it("não permite cadastro de segundo usuário", async () => {
    const r = await req("POST", "/api/auth/usuarios", {
      nome: "Outro",
      email: "outro@vca.com",
      senha: "outro123",
      papel: "leitor",
    });
    expect(r.status).toBe(403);
  });

  it("faz login com sucesso", async () => {
    const r = await req("POST", "/api/auth/login", { email: "admin@vca.com", senha: "admin123" });
    expect(r.status).toBe(200);
    expect((r.json as { usuario: { nome: string } }).usuario.nome).toBe("Admin");
  });

  it("rejeita senha errada", async () => {
    const r = await req("POST", "/api/auth/login", { email: "admin@vca.com", senha: "errada" });
    expect(r.status).toBe(401);
  });

  it("GET /api/auth/me retorna o usuário logado", async () => {
    await fazerLogin();
    const r = await req("GET", "/api/auth/me");
    expect(r.status).toBe(200);
    expect((r.json as { usuario: { email: string } }).usuario.email).toBe("admin@vca.com");
  });

  it("logout encerra a sessão", async () => {
    await fazerLogin();
    const r = await req("POST", "/api/auth/logout");
    expect(r.status).toBe(204);
    const r2 = await req("GET", "/api/auth/me");
    expect(r2.status).toBe(401);
  });
});

describe("API de campanhas (com autenticação)", () => {
  beforeEach(async () => {
    await req("POST", "/api/auth/usuarios", {
      nome: "Admin",
      email: "admin@vca.com",
      senha: "admin123",
      papel: "editor",
    }).catch(() => {});
    await fazerLogin();
  });

  it("cria, lê, salva e lista campanha", async () => {
    const criada = await req("POST", "/api/campanhas");
    expect(criada.status).toBe(201);
    expect((criada.json as { usuarioId: string }).usuarioId).toBeTruthy();
    const id = (criada.json as { id: string }).id;

    const lida = await req("GET", `/api/campanhas/${id}`);
    expect(lida.status).toBe(200);
    expect((lida.json as { mes: string }).mes).toBeTruthy();

    const corpo = { ...(lida.json as object), titulo: "Editada" };
    const salva = await req("PUT", `/api/campanhas/${id}`, corpo);
    expect(salva.status).toBe(200);
    expect((salva.json as { revisao: number }).revisao).toBe(2);
    expect((salva.json as { titulo: string }).titulo).toBe("Editada");

    const lista = await req("GET", "/api/campanhas");
    expect((lista.json as { id: string }[]).some((c) => c.id === id)).toBe(true);
  });

  it("sem sessão responde 401", async () => {
    tokenSessao = undefined;
    const r = await req("GET", "/api/campanhas");
    expect(r.status).toBe(401);
  });

  it("duplica para outro mês", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "teste-dup" } as never);
    const dup = await req("POST", "/api/campanhas", { duplicarDe: "teste-dup", mes: "DEZEMBRO" });
    expect(dup.status).toBe(201);
    const nova = dup.json as { id: string; mes: string; revisao: number };
    expect(nova.mes).toBe("DEZEMBRO");
    expect(nova.revisao).toBe(1);
    expect(nova.id).not.toBe("teste-dup");
    expect(await req("GET", "/api/campanhas/teste-dup")).toHaveProperty("status", 200);
  });

  it("PUT com revisão atrasada responde 409 com a campanha atual", async () => {
    const storage = criarStorage(raizDados);
    storage.criar({ ...campanhaTeste(), id: "conflito" } as never);
    const atual = await req("GET", "/api/campanhas/conflito");
    const corpoDesatualizado = { ...(atual.json as object), revisao: 999, titulo: "Roubado" };
    const resp = await req("PUT", "/api/campanhas/conflito", corpoDesatualizado);
    expect(resp.status).toBe(409);
    const campanhaAtual = (resp.json as { campanha: { titulo: string; revisao: number } }).campanha;
    expect(campanhaAtual.titulo).not.toBe("Roubado");
    expect(campanhaAtual.revisao).toBe(1);
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

  it("PUT com corpo quebrado responde 400", async () => {
    const r = await fetch(base + "/api/campanhas/qualquer?token=" + encodeURIComponent(tokenSessao ?? ""), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{ não é json }",
    });
    expect(r.status).toBe(400);
  });

  it("id com ../x é rejeitado", async () => {
    const resp = await req("GET", "/api/campanhas/..%2Fx");
    expect([400, 404]).toContain(resp.status);
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
    const r = await fetch(base + "/render/render?token=" + encodeURIComponent(tokenSessao ?? ""));
    const html = await r.text();
    expect(r.status).toBe(200);
    expect(html).toContain('<div class="pagina"');
  });

  it("campanha desconhecida responde 404", async () => {
    expect((await req("GET", "/api/campanhas/nada")).status).toBe(404);
    expect((await req("DELETE", "/api/campanhas/nada")).status).toBe(404);
  });
});
