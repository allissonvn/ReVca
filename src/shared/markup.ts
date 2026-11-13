// Markup de cor por seleção (AGENTS.md §5).
// Marcadores: [[azul]] abre azul, [[/]] fecha; ((vermelho)) abre vermelho, ((/)) fecha.
// Aninháveis. Estado NUNCA atravessa linha: cada linha é processada do zero.

export type CorMarcada = "azul" | "vermelho";

export type Segmento = {
  texto: string;
  cor: CorMarcada | null;
};

const ABERTURAS: Record<string, CorMarcada> = {
  "[[azul]]": "azul",
  "((vermelho))": "vermelho",
};
const FECHAMENTOS: Record<CorMarcada, string> = {
  azul: "[[/]]",
  vermelho: "((/))",
};

/** Quebra uma linha em segmentos coloridos; texto sempre cru (sem HTML). */
export function parseLinha(linha: string): Segmento[] {
  const segmentos: Segmento[] = [];
  const pilha: CorMarcada[] = [];
  let buffer = "";
  let i = 0;

  const descarregar = (cor: CorMarcada | null) => {
    if (buffer.length > 0) {
      segmentos.push({ texto: buffer, cor });
      buffer = "";
    }
  };

  while (i < linha.length) {
    let achou = false;
    for (const [marcador, cor] of Object.entries(ABERTURAS)) {
      if (linha.startsWith(marcador, i)) {
        descarregar(topo(pilha));
        pilha.push(cor);
        i += marcador.length;
        achou = true;
        break;
      }
    }
    if (!achou) {
      for (const cor of Object.keys(FECHAMENTOS) as CorMarcada[]) {
        const fechamento = FECHAMENTOS[cor];
        if (linha.startsWith(fechamento, i)) {
          const pos = pilha.lastIndexOf(cor);
          if (pos === -1) {
            // Fechamento sem abertura correspondente: vira texto literal
            buffer += fechamento;
          } else {
            descarregar(topo(pilha));
            pilha.splice(pos, 1); // fecha a cor mais interna desse tipo
          }
          i += fechamento.length;
          achou = true;
          break;
        }
      }
    }
    if (!achou) {
      buffer += linha[i];
      i += 1;
    }
  }
  // Abertura sem fechamento: a cor vale até o fim da linha (pilha restante)
  descarregar(topo(pilha));
  return segmentos;
}

function topo(pilha: CorMarcada[]): CorMarcada | null {
  return pilha.length > 0 ? (pilha[pilha.length - 1] as CorMarcada) : null;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CLASSE_COR: Record<CorMarcada, string> = {
  azul: "cor-azul",
  vermelho: "cor-vermelho",
};

/** Uma linha de texto vira HTML escapado com <span> de cor. */
export function renderLinha(linha: string): string {
  return parseLinha(linha)
    .map((seg) => {
      const t = escapeHtml(seg.texto);
      return seg.cor ? `<span class="${CLASSE_COR[seg.cor]}">${t}</span>` : t;
    })
    .join("");
}

/** Texto multilinha: cada linha vira HTML independente (estado não atravessa linha). */
export function renderTexto(texto: string): string[] {
  return texto.split("\n").map(renderLinha);
}

/** Remove todos os marcadores, devolvendo o texto puro. */
export function removerMarcadores(texto: string): string {
  return texto
    .replace(/\[\[azul\]\]|\[\[\/\]\]|\(\(vermelho\)\)|\(\(\/\)\)/g, "");
}
