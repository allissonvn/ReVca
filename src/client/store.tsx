import type { JSX } from "react";
import { useSyncExternalStore } from "react";
import { Campanha, Catalogos, UsuarioResumo } from "../shared/schema.js";
import { gravarCampanha } from "./api.js";

export type StatusSalvamento = "salvo" | "salvando" | "erro" | "conflito" | "sujo";

export type Estado = {
  // usuário autenticado (null = deslogado; controla o gate de login)
  usuario: UsuarioResumo | null;
  // usuarioId da campanha (string, do schema Zod)
  usuarioId: string | null;
  campanha: Campanha | null;
  catalogos: Catalogos | null;
  // página selecionada na prévia (índice) e se mostra todas
  pagSelecionada: number;
  verTodas: boolean;
  // bloco/tabela selecionado no painel direito
  // tipo "bloco" = bloco normal; tipo "tabela" = tabela separada
  blocoSelecionado: { ci: number; bi: number; tipo: "bloco" } | { ci: number; ti: number; tipo: "tabela" } | null;
  // zoom do canvas (0.25–2.0) e se está em "ajustar à tela"
  zoom: number;
  zoomAjustado: boolean;
  status: StatusSalvamento;
  // renovado quando o servidor responde 409 (versão nova no disco)
  conflito: boolean;
  tema: "claro" | "escuro";
  // ---- undo/redo (Phase 4) ----
  // snapshot completo do estado a cada mudança significativa
  historico: Estado[];
  historicoIndex: number;
};

export const estado: Estado = {
  usuario: null,
  usuarioId: null,
  campanha: null,
  catalogos: null,
  pagSelecionada: 0,
  verTodas: false,
  blocoSelecionado: null,
  zoom: 1,
  zoomAjustado: true,
  status: "salvo",
  conflito: false,
  tema: (localStorage.getItem("vca-tema") as "claro" | "escuro" | null) ?? "claro",
  historico: [],
  historicoIndex: -1,
};

// ---- assinatura do React: versão numérica como snapshot ----
let versao = 0;
const ouvintes = new Set<() => void>();

function inscrever(fn: () => void): () => void {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

/** Gancho: re-renderiza o componente quando o estado muda. */
export function useEstado(): Estado {
  useSyncExternalStore(inscrever, () => versao);
  return estado;
}

export function notifier(): void {
  versao++;
  for (const fn of ouvintes) fn();
}

// ---- sessão ----

/** Limpa o usuário (login expirado ou logout) e volta para a tela de login. */
export function deslogar(): void {
  estado.usuario = null;
  estado.usuarioId = null;
  estado.campanha = null;
  estado.catalogos = null;
  notifier();
}

/** Papel do usuário logado: admin e editor criam/editam/excluem campanhas;
 *  leitor só visualiza. Só o admin gerencia usuários. */
export function podeEditar(): boolean {
  const papel = estado.usuario?.papel;
  return papel === "editor" || papel === "admin";
}

export function ehAdmin(): boolean {
  return estado.usuario?.papel === "admin";
}

// ---- seletores auxiliares ----

export function modeloDe(id: string) {
  return estado.catalogos?.modelos.find((m) => m.id === id) ?? estado.catalogos?.modelos[0];
}

export function empreendimentoDe(id: string | null) {
  if (!estado.catalogos || id === null) return undefined;
  return estado.catalogos.empreendimentos.find((e) => e.id === id);
}

export function tipoBlocoDe(id: string) {
  return estado.catalogos?.tiposBloco.find((t) => t.id === id);
}

// ---- salvamento automático com debounce (AGENTS.md §7) ----
let temporizador: ReturnType<typeof setTimeout> | null = null;

export function marcarSujo(): void {
  empurrarHistorico();
  estado.status = "sujo";
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void salvarAgora(), 800);
  notifier(); // prévia atualiza já
}

/** Salva já (usado pelo debounce e antes de trocar de campanha/exportar). */
export async function salvarAgora(): Promise<void> {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  const c = estado.campanha;
  if (!c) return;
  estado.status = "salvando";
  notifier();
  try {
    const salva = await gravarCampanha(c);
    c.revisao = salva.revisao;
    c.atualizadoEm = salva.atualizadoEm;
    estado.status = "salvo";
    estado.conflito = false;
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 409) {
      estado.status = "conflito";
      estado.conflito = true;
    } else {
      estado.status = "erro";
    }
  }
  notifier();
}

/** Mudança que afeta a prévia mas não suja a campanha (ex.: "ver todas"). */
export function notificarConteudo(): void {
  notifier();
}

// ---- undo/redo (Phase 4) ----

function empurrarHistorico(): void {
  // Remove tudo após o índice atual (se fizermos um novo cambio depois do "future")
  estado.historico = estado.historico.slice(0, estado.historicoIndex + 1);
  // Captura snapshot do estado atual (usamos 'as any' para evitar checagem de propriedades de histórico)
  const snapshot: any = {
    usuario: estado.usuario ? { ...estado.usuario } : null,
    usuarioId: estado.usuarioId,
    campanha: estado.campanha ? { ...estado.campanha } : null,
    catalogos: estado.catalogos ? { ...estado.catalogos } : null,
    pagSelecionada: estado.pagSelecionada,
    verTodas: estado.verTodas,
    blocoSelecionado: estado.blocoSelecionado ? { ...estado.blocoSelecionado } : null,
    zoom: estado.zoom,
    zoomAjustado: estado.zoomAjustado,
    status: estado.status,
    conflito: estado.conflito,
    tema: estado.tema,
  };
  estado.historico.push(snapshot);
  estado.historicoIndex++;
}

export function desfazer(): void {
  if (estado.historicoIndex <= 0) return;
  estado.historicoIndex--;
  const anterior = estado.historico[estado.historicoIndex];
  if (!anterior) return;
  // Restaurar do histórico - atribuir propriedade por propriedade
  estado.usuario = anterior.usuario ?? null;
  estado.usuarioId = anterior.usuarioId ?? "";
  estado.campanha = anterior.campanha ?? null;
  estado.catalogos = anterior.catalogos ?? null;
  estado.pagSelecionada = anterior.pagSelecionada ?? 0;
  estado.verTodas = anterior.verTodas ?? false;
  estado.blocoSelecionado = anterior.blocoSelecionado ?? null;
  estado.zoom = anterior.zoom ?? 1;
  estado.zoomAjustado = anterior.zoomAjustado ?? true;
  estado.status = anterior.status ?? "salvo";
  estado.conflito = anterior.conflito ?? false;
  estado.tema = anterior.tema ?? "claro";
  // historico e historicoIndex são mantidos (já foram ajustados acima)
  notifier();
}

export function refazer(): void {
  if (estado.historicoIndex >= estado.historico.length - 1) return;
  estado.historicoIndex++;
  const proximo = estado.historico[estado.historicoIndex];
  if (!proximo) return;
  // Restaurar do histórico - atribuir propriedade por propriedade
  estado.usuario = proximo.usuario ?? null;
  estado.usuarioId = proximo.usuarioId ?? "";
  estado.campanha = proximo.campanha ?? null;
  estado.catalogos = proximo.catalogos ?? null;
  estado.pagSelecionada = proximo.pagSelecionada ?? 0;
  estado.verTodas = proximo.verTodas ?? false;
  estado.blocoSelecionado = proximo.blocoSelecionado ?? null;
  estado.zoom = proximo.zoom ?? 1;
  estado.zoomAjustado = proximo.zoomAjustado ?? true;
  estado.status = proximo.status ?? "salvo";
  estado.conflito = proximo.conflito ?? false;
  estado.tema = proximo.tema ?? "claro";
  // historico e historicoIndex são mantidos (já foram ajustados acima)
  notifier();
}

// ---- seleção de bloco (Phase 4) ----

/** Seleciona uma página na prévia (índice). */
export function selecionarPagina(i: number): void {
  estado.pagSelecionada = i;
  notificarConteudo();
}

/** Seleciona um bloco para edição no painel direito. */
export function selecionarBloco(ci: number, bi: number): void {
  estado.blocoSelecionado = { ci, bi, tipo: "bloco" };
  notifier();
}

/** Seleciona uma tabela para edição no painel direito. */
export function selecionarTabela(ci: number, ti: number): void {
  estado.blocoSelecionado = { ci, ti, tipo: "tabela" };
  notifier();
}

/** Limpa a seleção de bloco/tabela. */
export function limparSelecaoBloco(): void {
  estado.blocoSelecionado = null;
  notifier();
}

// ---- tema (só o painel; a arte é sempre clara) ----

export function alternarTema(): void {
  estado.tema = estado.tema === "escuro" ? "claro" : "escuro";
  localStorage.setItem("vca-tema", estado.tema);
  aplicarTema();
  notifier();
}

export function aplicarTema(): void {
  document.documentElement.dataset.theme = estado.tema;
}

export function definirZoom(zoom: number): void {
  estado.zoom = Math.min(2, Math.max(0.25, zoom));
  estado.zoomAjustado = false;
  notifier();
}

export function alternarAjusteTela(ajustado: boolean): void {
  estado.zoomAjustado = ajustado;
  if (ajustado) estado.zoom = 1;
  notifier();
}