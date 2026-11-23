// Chamadas à API REST do servidor (AGENTS.md §6).
import { Campanha, Catalogos, CriarUsuarioInput, UsuarioResumo, LoginInput } from "../shared/schema.js";

export type CampanhaResumo = { id: string; titulo: string; mes: string; atualizadoEm: string; nPaginas: number };

export class ApiErro extends Error {
  constructor(public status: number, public corpo: unknown) {
    super(`HTTP ${status}`);
  }
}

// Quando qualquer chamada receber 401, a sessão expirou: volta para o login.
// O App registra a reação aqui (limpa o usuário do estado); sem loop de requests.
let aoReceber401: (() => void) | null = null;

export function definirAoReceber401(fn: () => void): void {
  aoReceber401 = fn;
}

async function chamar(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
  const resp = await fetch(caminho, {
    method: metodo,
    credentials: "same-origin", // envia o cookie de sessão (HttpOnly)
    headers: corpo !== undefined ? { "content-type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (!resp.ok) {
    if (resp.status === 401 && aoReceber401 !== null) aoReceber401();
    throw new ApiErro(resp.status, await resp.json().catch(() => null));
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// ---- autenticação ----

export function login(dados: LoginInput): Promise<{ usuario: UsuarioResumo }> {
  return chamar("POST", "/api/auth/login", dados) as Promise<{ usuario: UsuarioResumo }>;
}

export function logout(): Promise<null> {
  return chamar("POST", "/api/auth/logout") as Promise<null>;
}

export function lerSessao(): Promise<{ usuario: UsuarioResumo }> {
  return chamar("GET", "/api/auth/me") as Promise<{ usuario: UsuarioResumo }>;
}

// ---- gestão de usuários (só admin; AGENTS.md §6) ----

export function listarUsuarios(): Promise<UsuarioResumo[]> {
  return chamar("GET", "/api/auth/usuarios") as Promise<UsuarioResumo[]>;
}

export function criarUsuario(dados: CriarUsuarioInput): Promise<UsuarioResumo> {
  return chamar("POST", "/api/auth/usuarios", dados) as Promise<UsuarioResumo>;
}

export function definirUsuarioAtivo(id: string, ativo: boolean): Promise<UsuarioResumo> {
  return chamar("PATCH", `/api/auth/usuarios/${encodeURIComponent(id)}`, { ativo }) as Promise<UsuarioResumo>;
}

export function redefinirSenhaUsuario(id: string, senha: string): Promise<UsuarioResumo> {
  return chamar("PATCH", `/api/auth/usuarios/${encodeURIComponent(id)}`, { senha }) as Promise<UsuarioResumo>;
}

export function listarCampanhas(): Promise<CampanhaResumo[]> {
  return chamar("GET", "/api/campanhas") as Promise<CampanhaResumo[]>;
}

export function lerCampanha(id: string): Promise<Campanha> {
  return chamar("GET", `/api/campanhas/${encodeURIComponent(id)}`) as Promise<Campanha>;
}

export function gravarCampanha(campanha: Campanha): Promise<Campanha> {
  return chamar("PUT", `/api/campanhas/${encodeURIComponent(campanha.id)}`, campanha) as Promise<Campanha>;
}

export function criarCampanha(opcoes: { duplicarDe?: string; mes?: string } = {}): Promise<Campanha> {
  return chamar("POST", "/api/campanhas", opcoes) as Promise<Campanha>;
}

export function excluirCampanha(id: string): Promise<null> {
  return chamar("DELETE", `/api/campanhas/${encodeURIComponent(id)}`) as Promise<null>;
}

export function lerCatalogos(): Promise<Catalogos> {
  return chamar("GET", "/api/catalogos") as Promise<Catalogos>;
}
