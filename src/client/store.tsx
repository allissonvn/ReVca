import type { JSX } from "react";
// Estado global do editor, consumido pelo React (AGENTS.md §7).
// O estado é mutável e único (como antes); o React assina por useSyncExternalStore
// com um contador de versão: cada notificar() força re-render de quem usa useEstado().
import { useSyncExternalStore } from "react";
import { Campanha, Catalogos, UsuarioResumo } from "../shared/schema.js";
import { gravarCampanha } from "./api.js";

export type StatusSalvamento = "salvo" | "salvando" | "erro" | "conflito" | "sujo";

export type Estado = {
  // usuário autenticado (null = deslogado; controla o gate de login)
  usuario: UsuarioResumo | null;
  campanha: Campanha | null;
  catalogos: Catalogos | null;
  // página selecionada na prévia (índice) e se mostra todas
  pagSelecionada: number;
  verTodas: boolean;
  status: StatusSalvamento;
  // renovado quando o servidor responde 409 (versão nova no disco)
  conflito: boolean;
  tema: "claro" | "escuro";
};

export const estado: Estado = {
  usuario: null,
  campanha: null,
  catalogos: null,
  pagSelecionada: 0,
  verTodas: false,
  status: "salvo",
  conflito: false,
  tema: (localStorage.getItem("vca-tema") as "claro" | "escuro" | null) ?? "claro",
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

export function notificar(): void {
  versao++;
  for (const fn of ouvintes) fn();
}

// ---- sessão ----

/** Limpa o usuário (login expirado ou logout) e volta para a tela de login. */
export function deslogar(): void {
  estado.usuario = null;
  // evita que a home/editor antigos continuem mostrando dados da sessão anterior
  estado.campanha = null;
  estado.catalogos = null;
  notificar();
}

/** Papel do usuário logado; "leitor" não pode criar/editar/excluir campanhas. */
export function ehEditor(): boolean {
  return estado.usuario?.papel === "editor";
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
  estado.status = "sujo";
  if (temporizador) clearTimeout(temporizador);
  temporizador = setTimeout(() => void salvarAgora(), 800);
  notificar(); // prévia atualiza já
}

/** Salva já (usado pelo debounce e antes de trocar de campanha/exportar). */
export async function salvarAgora(): Promise<void> {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  const c = estado.campanha;
  if (!c) return;
  estado.status = "salvando";
  notificar();
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
  notificar();
}

/** Mudança que afeta a prévia mas não suja a campanha (ex.: "ver todas"). */
export function notificarConteudo(): void {
  notificar();
}

// ---- tema (só o painel; a arte é sempre clara) ----

export function alternarTema(): void {
  estado.tema = estado.tema === "escuro" ? "claro" : "escuro";
  localStorage.setItem("vca-tema", estado.tema);
  aplicarTema();
  notificar();
}

export function aplicarTema(): void {
  document.documentElement.dataset.theme = estado.tema;
}
