// Chamadas à API REST do servidor (AGENTS.md §6).
import { Campanha, Catalogos } from "../shared/schema.js";

export type CampanhaResumo = { id: string; titulo: string; mes: string; atualizadoEm: string; nPaginas: number };

export class ApiErro extends Error {
  constructor(public status: number, public corpo: unknown) {
    super(`HTTP ${status}`);
  }
}

async function chamar(metodo: string, caminho: string, corpo?: unknown): Promise<unknown> {
  const resp = await fetch(caminho, {
    method: metodo,
    headers: corpo !== undefined ? { "content-type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  if (!resp.ok) throw new ApiErro(resp.status, await resp.json().catch(() => null));
  if (resp.status === 204) return null;
  return resp.json();
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
