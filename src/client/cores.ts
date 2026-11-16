// Edição de cor por seleção "estilo Canva" nos campos: o campo de texto mostra
// o TEXTO PURO (sem marcadores); as cores ficam em faixas na memória e viram
// markup no estado a cada tecla (a prévia e o salvamento continuam usando markup).
import {
  CorMarcada,
  RangeCor,
  extrairRanges,
  montarMarcado,
  ajustarRanges,
  pintarTrecho,
  limparTrecho,
} from "../shared/markup.js";

type EstadoCampo = { plain: string; ranges: RangeCor[] };

const estados = new WeakMap<HTMLInputElement | HTMLTextAreaElement, EstadoCampo>();

/** Hexes da paleta que têm token nomeado (mantém o JSON legível). */
const NOME_POR_HEX: Record<string, CorMarcada> = {
  "#1447ff": "azul",
  "#ff3b3b": "vermelho",
};

/** Converte um hex da paleta no valor a guardar no markup. */
export function corParaMarcada(hex: string): CorMarcada {
  const h = hex.toLowerCase();
  return NOME_POR_HEX[h] ?? (h as CorMarcada);
}

/** Prepara o campo para edição: extrai faixas do markup atual do modelo. */
export function iniciarCampo(el: HTMLInputElement | HTMLTextAreaElement, marcado: string): void {
  estados.set(el, extrairRanges(marcado));
}

/** Solta a faixa em memória do campo (ao sair dele). */
export function descartarCampo(el: HTMLInputElement | HTMLTextAreaElement): void {
  estados.delete(el);
}

/** Registra uma edição do texto puro e devolve o markup atualizado
 * (null se o campo não estava em edição — não deveria acontecer ao digitar). */
export function editarCampo(el: HTMLInputElement | HTMLTextAreaElement, novoPlain: string): string | null {
  const st = estados.get(el);
  if (!st) return null;
  const { pos, removidos, inseridos } = diff(st.plain, novoPlain);
  st.ranges = ajustarRanges(novoPlain, st.ranges, pos, removidos, inseridos);
  st.plain = novoPlain;
  return montarMarcado(st.plain, st.ranges);
}

/** Pinta o trecho [ini, fim) (ou o campo todo, se seleção vazia) e devolve o markup. */
export function aplicarCorCampo(
  el: HTMLInputElement | HTMLTextAreaElement,
  marcadoAtual: string,
  cor: CorMarcada,
  ini: number,
  fim: number,
): string {
  const st = estados.get(el) ?? extrairRanges(marcadoAtual);
  const a = ini === fim ? 0 : ini;
  const b = ini === fim ? st.plain.length : fim;
  st.ranges = pintarTrecho(st.plain, st.ranges, a, b, cor);
  estados.set(el, st);
  return montarMarcado(st.plain, st.ranges);
}

/** Tira cor do trecho [ini, fim) (ou o campo todo) e devolve o markup. */
export function tirarCorCampo(
  el: HTMLInputElement | HTMLTextAreaElement,
  marcadoAtual: string,
  ini: number,
  fim: number,
): string {
  const st = estados.get(el) ?? extrairRanges(marcadoAtual);
  const a = ini === fim ? 0 : ini;
  const b = ini === fim ? st.plain.length : fim;
  st.ranges = limparTrecho(st.ranges, a, b);
  estados.set(el, st);
  return montarMarcado(st.plain, st.ranges);
}

/** Diferença entre o texto antigo e o novo: onde entrou/saiu quê.
 * Cobre digitação, colar e apagar; suficiente para faixas de cor. */
function diff(antigo: string, novo: string): { pos: number; removidos: number; inseridos: number } {
  let ini = 0;
  const max = Math.min(antigo.length, novo.length);
  while (ini < max && antigo[ini] === novo[ini]) ini++;
  let fa = antigo.length;
  let fn = novo.length;
  while (fa > ini && fn > ini && antigo[fa - 1] === novo[fn - 1]) {
    fa--;
    fn--;
  }
  return { pos: ini, removidos: fa - ini, inseridos: fn - ini };
}
