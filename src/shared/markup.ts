// Markup de cor por seleção (AGENTS.md §5).
// Marcadores nomeados: [[azul]] abre azul, [[/]] fecha; ((vermelho)) abre vermelho, ((/)) fecha.
// Marcador de cor livre (RGB/hex, estilo Canva): [[#rrggbb]] abre, [[/]] fecha.
// Aninháveis. Estado NUNCA atravessa linha: cada linha é processada do zero.

export type CorMarcada = "azul" | "vermelho" | `#${string}`;

export type Segmento = {
  texto: string;
  cor: CorMarcada | null;
};

const ABERTURA_AZUL = "[[azul]]";
const ABERTURA_VERMELHO = "((vermelho))";
const FECHA_AZUL = "[[/]]"; // fecha azul e também cores hex
const FECHA_VERMELHO = "((/))";
const RE_ABRE_HEX = /^\[\[#[0-9a-fA-F]{6}\]\]/;

/** Token que abre a cor (nomeada ou hex). */
export function aberturaDe(cor: CorMarcada): string {
  if (cor === "azul") return ABERTURA_AZUL;
  if (cor === "vermelho") return ABERTURA_VERMELHO;
  return `[[${cor}]]`;
}

/** Token que fecha a cor. */
export function fechamentoDe(cor: CorMarcada): string {
  return cor === "vermelho" ? FECHA_VERMELHO : FECHA_AZUL;
}

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
    // aberturas nomeadas e hex
    if (linha.startsWith(ABERTURA_AZUL, i)) {
      descarregar(topo(pilha));
      pilha.push("azul");
      i += ABERTURA_AZUL.length;
      achou = true;
    } else if (linha.startsWith(ABERTURA_VERMELHO, i)) {
      descarregar(topo(pilha));
      pilha.push("vermelho");
      i += ABERTURA_VERMELHO.length;
      achou = true;
    } else {
      const m = RE_ABRE_HEX.exec(linha.slice(i));
      if (m) {
        descarregar(topo(pilha));
        // o regex garante o formato [[#[6 hex]]]; m[0][2..8] é "#xxxxxx"
        pilha.push(m[0].slice(2, 9).toLowerCase() as CorMarcada);
        i += m[0].length;
        achou = true;
      }
    }
    // fechamentos
    if (!achou) {
      const fech = linha.startsWith(FECHA_VERMELHO, i) ? FECHA_VERMELHO : linha.startsWith(FECHA_AZUL, i) ? FECHA_AZUL : null;
      if (fech) {
        // fecha a cor mais interna que usa esse token de fechamento
        const pos = pilha.map(fechamentoDe).lastIndexOf(fech);
        if (pos === -1) {
          // Fechamento sem abertura correspondente: vira texto literal
          buffer += fech;
        } else {
          descarregar(topo(pilha));
          pilha.splice(pos, 1);
        }
        i += fech.length;
        achou = true;
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

const CLASSE_COR: Partial<Record<CorMarcada, string>> = {
  azul: "cor-azul",
  vermelho: "cor-vermelho",
};

/** Uma linha de texto vira HTML escapado com <span> de cor. */
export function renderLinha(linha: string): string {
  return parseLinha(linha)
    .map((seg) => {
      const t = escapeHtml(seg.texto);
      if (!seg.cor) return t;
      const classe = CLASSE_COR[seg.cor];
      if (classe) return `<span class="${classe}">${t}</span>`;
      // cor hex: o parser só aceita #[0-9a-f]{6}, então é seguro usar no atributo
      return `<span style="color:${seg.cor}">${t}</span>`;
    })
    .join("");
}

/** Texto multilinha: cada linha vira HTML independente (estado não atravessa linha). */
export function renderTexto(texto: string): string[] {
  return texto.split("\n").map(renderLinha);
}

/** Remove todos os marcadores, devolvendo o texto puro (para exibir no campo). */
export function removerMarcadores(texto: string): string {
  return texto.replace(/\[\[(?:azul|#[0-9a-fA-F]{6}|\/)\]\]|\(\((?:vermelho|\/)\)\)/g, "");
}

// ---------------------------------------------------------------------------
// Edição por faixas (o campo mostra texto puro; as cores ficam em faixas)
// ---------------------------------------------------------------------------

export type RangeCor = { ini: number; fim: number; cor: CorMarcada };

/** Texto puro + faixas coloridas (coordenadas no texto puro, por linha). */
export function extrairRanges(marcado: string): { plain: string; ranges: RangeCor[] } {
  const linhas = marcado.split("\n");
  const partesPlain: string[] = [];
  const ranges: RangeCor[] = [];
  let base = 0;
  for (const linha of linhas) {
    const segs = parseLinha(linha);
    const plainLinha = segs.map((s) => s.texto).join("");
    partesPlain.push(plainLinha);
    let offset = 0;
    for (const seg of segs) {
      if (seg.cor && seg.texto.length > 0) {
        ranges.push({ ini: base + offset, fim: base + offset + seg.texto.length, cor: seg.cor });
      }
      offset += seg.texto.length;
    }
    base += plainLinha.length + 1; // +1 pelo \n (ou fim da string)
  }
  return { plain: partesPlain.join("\n"), ranges };
}

/** Remonta o texto com marcadores a partir do texto puro + faixas. */
export function montarMarcado(plain: string, ranges: RangeCor[]): string {
  const linhas = plain.split("\n");
  const bases: number[] = [];
  let base = 0;
  for (const linha of linhas) {
    bases.push(base);
    base += linha.length + 1;
  }
  const saida: string[] = [];
  for (let li = 0; li < linhas.length; li++) {
    const linha = linhas[li] as string;
    const iniLinha = bases[li] as number;
    const fimLinha = iniLinha + linha.length;
    const rs = ranges
      .filter((r) => r.fim > iniLinha && r.ini < fimLinha)
      .map((r) => ({ ini: Math.max(r.ini, iniLinha) - iniLinha, fim: Math.min(r.fim, fimLinha) - iniLinha, cor: r.cor }))
      .filter((r) => r.fim > r.ini)
      .sort((a, b) => a.ini - b.ini);
    let pos = 0;
    let out = "";
    for (const r of rs) {
      if (r.ini < pos) continue; // sobreposição: mantém a primeira
      out += linha.slice(pos, r.ini) + aberturaDe(r.cor) + linha.slice(r.ini, r.fim) + fechamentoDe(r.cor);
      pos = r.fim;
    }
    out += linha.slice(pos);
    saida.push(out);
  }
  return saida.join("\n");
}

/** Remove/trim faixas que se sobrepõem ao trecho [ini, fim). */
export function limparTrecho(ranges: RangeCor[], ini: number, fim: number): RangeCor[] {
  const out: RangeCor[] = [];
  for (const r of ranges) {
    if (r.fim <= ini || r.ini >= fim) {
      out.push(r);
      continue;
    }
    if (r.ini < ini) out.push({ ini: r.ini, fim: ini, cor: r.cor });
    if (r.fim > fim) out.push({ ini: fim, fim: r.fim, cor: r.cor });
  }
  return out;
}

/** Pinta o trecho [ini, fim) com uma cor (substitui cores existentes lá).
 * Seleção que cruza quebra de linha vira uma faixa por linha. */
export function pintarTrecho(plain: string, ranges: RangeCor[], ini: number, fim: number, cor: CorMarcada): RangeCor[] {
  if (fim <= ini) return ranges;
  const out = limparTrecho(ranges, ini, fim);
  let a = ini;
  for (let i = ini; i <= fim; i++) {
    if (i === fim || plain[i] === "\n") {
      if (i > a) out.push({ ini: a, fim: i, cor });
      a = i + 1;
    }
  }
  return out.sort((x, y) => x.ini - y.ini);
}

/** Reage a uma edição do texto: o trecho [pos, pos+removidos) saiu e
 * `inseridos` caracteres entraram em `pos`. Faixas acompanham o texto. */
export function ajustarRanges(plainNovo: string, ranges: RangeCor[], pos: number, removidos: number, inseridos: number): RangeCor[] {
  const fimRem = pos + removidos;
  const delta = inseridos - removidos;
  const ajustadas: RangeCor[] = [];
  for (const r of ranges) {
    let ini: number;
    let fim: number;
    if (r.fim <= pos) {
      ini = r.ini;
      fim = r.fim;
    } else if (r.ini >= fimRem) {
      ini = r.ini + delta;
      fim = r.fim + delta;
    } else {
      // sobrepõe a região editada: encosta no ponto de edição
      ini = r.ini < pos ? r.ini : pos;
      fim = r.fim <= fimRem ? pos + inseridos : r.fim + delta;
    }
    ini = Math.max(0, Math.min(ini, plainNovo.length));
    fim = Math.max(0, Math.min(fim, plainNovo.length));
    if (fim > ini) ajustadas.push({ ini, fim, cor: r.cor });
  }
  // edição pode ter juntado/partido linhas: nenhuma faixa pode cruzar \n
  const out: RangeCor[] = [];
  for (const r of ajustadas) {
    let a = r.ini;
    for (let i = r.ini; i < r.fim; i++) {
      if (plainNovo[i] === "\n") {
        if (i > a) out.push({ ini: a, fim: i, cor: r.cor });
        a = i + 1;
      }
    }
    if (r.fim > a) out.push({ ini: a, fim: r.fim, cor: r.cor });
  }
  return out.sort((x, y) => x.ini - y.ini);
}
