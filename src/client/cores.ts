// Aplicação de cor por seleção nos campos (AGENTS.md §5/§7).
import { removerMarcadores } from "../shared/markup.js";

export type CorBotao = "azul" | "vermelho" | "sem";

/** Aplica/remove marcadores de cor no trecho selecionado do campo (input ou textarea). */
export function aplicarCorNoCampo(el: HTMLInputElement | HTMLTextAreaElement, cor: CorBotao): void {
  const inicio = el.selectionStart ?? 0;
  const fim = el.selectionEnd ?? 0;
  if (inicio === fim) return; // sem seleção, nada a fazer
  const valor = el.value;
  let trecho = valor.slice(inicio, fim);
  if (cor === "sem") {
    trecho = removerMarcadores(trecho);
  } else {
    // remove marcadores antigos do trecho para não aninhar sem querer
    trecho = removerMarcadores(trecho);
    const [abre, fecha] = cor === "azul" ? ["[[azul]]", "[[/]]"] : ["((vermelho))", "((/))"];
    trecho = trecho.split("\n").map((l) => (l.length > 0 ? `${abre}${l}${fecha}` : l)).join("\n");
  }
  el.value = valor.slice(0, inicio) + trecho + valor.slice(fim);
  // mantém a seleção sobre o trecho novo e dispara o mesmo fluxo de digitação
  el.focus();
  el.setSelectionRange(inicio, inicio + trecho.length);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}
