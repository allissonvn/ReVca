// Estado do editor: a campanha aberta + catálogos + controle de salvamento.
import { Campanha, Catalogos } from "../shared/schema.js";
import { gravarCampanha } from "./api.js";

export type StatusSalvamento = "salvo" | "salvando" | "erro" | "conflito" | "sujo";

export type Estado = {
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
  campanha: null,
  catalogos: null,
  pagSelecionada: 0,
  verTodas: false,
  status: "salvo",
  conflito: false,
  tema: (localStorage.getItem("vca-tema") as "claro" | "escuro" | null) ?? "claro",
};

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
  notificar();          // prévia atualiza já (AGENTS.md §7)
  notificarStatus();
}

/** Salva já (usado pelo debounce e antes de trocar de campanha). */
export async function salvarAgora(): Promise<void> {
  if (temporizador) { clearTimeout(temporizador); temporizador = null; }
  const c = estado.campanha;
  if (!c) return;
  estado.status = "salvando";
  notificar();
  notificarStatus();
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
  notificarStatus();
}

// Observadores simples: aoMudar dispara quando o conteúdo muda (prévia),
// aoStatus quando só o indicador de salvamento muda (não reconstrói o painel).
type Ouvinte = () => void;
const ouvintes: Ouvinte[] = [];
const ouvintesStatus: Ouvinte[] = [];

export function aoMudar(fn: Ouvinte): void {
  ouvintes.push(fn);
}

export function aoStatus(fn: Ouvinte): void {
  ouvintesStatus.push(fn);
}

function notificar(): void {
  for (const fn of ouvintes) fn();
}

function notificarStatus(): void {
  for (const fn of ouvintesStatus) fn();
}

/** Mudança que afeta a prévia mas não suja a campanha (ex.: "ver todas"). */
export function notificarConteudo(): void {
  notificar();
}
