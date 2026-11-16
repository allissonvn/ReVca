import { describe, it, expect } from "vitest";
import {
  parseLinha,
  renderLinha,
  renderTexto,
  removerMarcadores,
  extrairRanges,
  montarMarcado,
  pintarTrecho,
  limparTrecho,
  ajustarRanges,
} from "../src/shared/markup.js";

describe("parseLinha", () => {
  it("texto sem marcadores vira um segmento sem cor", () => {
    expect(parseLinha("Sinal de R$ 3.000,00")).toEqual([{ texto: "Sinal de R$ 3.000,00", cor: null }]);
  });

  it("abre e fecha azul", () => {
    expect(parseLinha("a[[azul]]b[[/]]c")).toEqual([
      { texto: "a", cor: null },
      { texto: "b", cor: "azul" },
      { texto: "c", cor: null },
    ]);
  });

  it("abre e fecha vermelho", () => {
    expect(parseLinha("((vermelho))GRÁTIS((/))")).toEqual([{ texto: "GRÁTIS", cor: "vermelho" }]);
  });

  it("aninhamento: vermelho dentro de azul", () => {
    expect(parseLinha("[[azul]]A((vermelho))B((/))C[[/]]")).toEqual([
      { texto: "A", cor: "azul" },
      { texto: "B", cor: "vermelho" },
      { texto: "C", cor: "azul" },
    ]);
  });

  it("aninhamento: azul dentro de vermelho", () => {
    expect(parseLinha("((vermelho))A[[azul]]B[[/]]C((/))")).toEqual([
      { texto: "A", cor: "vermelho" },
      { texto: "B", cor: "azul" },
      { texto: "C", cor: "vermelho" },
    ]);
  });

  it("fechamento sem abertura vira texto literal", () => {
    expect(parseLinha("a[[/]]b")).toEqual([{ texto: "a[[/]]b", cor: null }]);
    expect(parseLinha("a((/))b")).toEqual([{ texto: "a((/))b", cor: null }]);
  });

  it("abertura sem fechamento vai até o fim da linha", () => {
    expect(parseLinha("a[[azul]]b")).toEqual([
      { texto: "a", cor: null },
      { texto: "b", cor: "azul" },
    ]);
  });

  it("fechador de outra cor não fecha o azul", () => {
    // [[/]] fecha azul; ((/)) não tem azul aberto → literal
    expect(parseLinha("[[azul]]a((/))b")).toEqual([
      { texto: "a((/))b", cor: "azul" },
    ]);
  });

  it("fecha a cor mais interna do mesmo tipo", () => {
    expect(parseLinha("[[azul]]a[[azul]]b[[/]]c[[/]]")).toEqual([
      { texto: "a", cor: "azul" },
      { texto: "b", cor: "azul" },
      { texto: "c", cor: "azul" },
    ]);
  });
});

describe("renderLinha", () => {
  it("escapa HTML sempre", () => {
    expect(renderLinha("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });

  it("escapa mesmo dentro de cor", () => {
    expect(renderLinha("[[azul]]<x>[[/]]")).toBe('<span class="cor-azul">&lt;x&gt;</span>');
  });

  it("gera spans com classes de cor (segmentos planos)", () => {
    expect(renderLinha("a[[azul]]b((vermelho))c((/))d[[/]]e")).toBe(
      'a<span class="cor-azul">b</span><span class="cor-vermelho">c</span><span class="cor-azul">d</span>e',
    );
  });

  it("texto vazio vira string vazia", () => {
    expect(renderLinha("")).toBe("");
  });
});

describe("renderTexto", () => {
  it("estado nunca atravessa linha: abertura não vaza para a linha seguinte", () => {
    const linhas = renderTexto("linha1 [[azul]]aberta\nlinha2 fechada");
    expect(linhas[0]).toBe('linha1 <span class="cor-azul">aberta</span>');
    expect(linhas[1]).toBe("linha2 fechada");
  });

  it("cada linha é independente", () => {
    const linhas = renderTexto("((vermelho))A((/))\nB");
    expect(linhas[0]).toBe('<span class="cor-vermelho">A</span>');
    expect(linhas[1]).toBe("B");
  });
});

describe("removerMarcadores", () => {
  it("remove todos os marcadores", () => {
    expect(removerMarcadores("[[azul]]a((vermelho))b[[/]]c((/))[[/]]")).toBe("abc");
  });
});

// ---------------------------------------------------------------------------
// Cor hex (RGB livre, estilo Canva) e edição por faixas
// ---------------------------------------------------------------------------

describe("cor hex", () => {
  it("abre e fecha [[#hex]]", () => {
    expect(parseLinha("[[#66cc00]]VERDE[[/]]")).toEqual([{ texto: "VERDE", cor: "#66cc00" }]);
  });

  it("hex vira style color no HTML (seguro: só #hex aceito)", () => {
    expect(renderLinha("[[#66cc00]]V[[/]]")).toBe('<span style="color:#66cc00">V</span>');
  });

  it("[[x]] desconhecido vira texto literal", () => {
    expect(parseLinha("[[x]]")).toEqual([{ texto: "[[x]]", cor: null }]);
  });

  it("injeção via marcador não passa: # maior que 6 dígitos é literal", () => {
    expect(parseLinha("[[#1234567]]<script>")).toEqual([{ texto: "[[#1234567]]<script>", cor: null }]);
  });

  it("removerMarcadores tira hex, nomeados e fechamentos", () => {
    expect(removerMarcadores("[[#ff00ff]]A[[/]]((vermelho))B((/))[[azul]]C[[/]]")).toBe("ABC");
  });
});

describe("faixas de cor (edição estilo Canva)", () => {
  it("extrairRanges converte markup em texto puro + faixas", () => {
    const r = extrairRanges("A[[azul]]BC[[/]]D\n((vermelho))E((/))F");
    expect(r.plain).toBe("ABCD\nEF");
    expect(r.ranges).toEqual([
      { ini: 1, fim: 3, cor: "azul" },
      { ini: 5, fim: 6, cor: "vermelho" },
    ]);
  });

  it("montarMarcado reconstrói o markup; ida e volta fecha", () => {
    const plain = "ABCD";
    const ranges = [{ ini: 1, fim: 3, cor: "azul" as const }];
    const marcado = montarMarcado(plain, ranges);
    expect(marcado).toBe("A[[azul]]BC[[/]]D");
    const volta = extrairRanges(marcado);
    expect(volta.plain).toBe(plain);
    expect(volta.ranges).toEqual(ranges);
  });

  it("montarMarcado usa hex quando a cor não tem nome", () => {
    expect(montarMarcado("AB", [{ ini: 0, fim: 2, cor: "#66cc00" }])).toBe("[[#66cc00]]AB[[/]]");
  });

  it("faixa nunca cruza quebra de linha", () => {
    const plain = "AB\nCD";
    const ranges = [{ ini: 0, fim: 4, cor: "azul" as const }]; // [0,4) cobre "AB\nC"
    const marcado = montarMarcado(plain, ranges);
    expect(marcado).toBe("[[azul]]AB[[/]]\n[[azul]]C[[/]]D");
  });

  it("pintarTrecho substitui cores existentes do trecho", () => {
    const plain = "ABCDEF";
    // pinta [1,4) = "BCD"; o "A" antes da seleção continua azul
    const ranges = pintarTrecho(plain, [{ ini: 0, fim: 3, cor: "azul" }], 1, 4, "#ff00ff");
    expect(ranges).toEqual([
      { ini: 0, fim: 1, cor: "azul" },
      { ini: 1, fim: 4, cor: "#ff00ff" },
    ]);
  });

  it("pintarTrecho corta por linha", () => {
    const plain = "AB\nCD";
    const ranges = pintarTrecho(plain, [], 0, 4, "azul");
    expect(ranges).toEqual([
      { ini: 0, fim: 2, cor: "azul" },
      { ini: 3, fim: 4, cor: "azul" },
    ]);
  });

  it("limparTrecho trima faixas parcialmente dentro", () => {
    const ranges = limparTrecho([{ ini: 0, fim: 5, cor: "azul" }], 2, 4);
    expect(ranges).toEqual([
      { ini: 0, fim: 2, cor: "azul" },
      { ini: 4, fim: 5, cor: "azul" },
    ]);
  });

  it("ajustarRanges acompanha digitação no meio da faixa", () => {
    // faixa [1,4) no texto "ABCD"; usuário insere "X" em 2 → "ABXCD", faixa [1,5)
    const novo = ajustarRanges("ABXCD", [{ ini: 1, fim: 4, cor: "azul" }], 2, 0, 1);
    expect(novo).toEqual([{ ini: 1, fim: 5, cor: "azul" }]);
  });

  it("ajustarRanges desloca faixas depois da edição", () => {
    // "ABCDE", faixa [4,5); insere "---" em 1 → "A---BCDE", faixa vai para [7,8)
    const novo = ajustarRanges("A---BCDE", [{ ini: 4, fim: 5, cor: "azul" }], 1, 0, 3);
    expect(novo).toEqual([{ ini: 7, fim: 8, cor: "azul" }]);
  });

  it("ajustarRanges encolhe faixa quando parte é apagada", () => {
    // "ABCD", faixa [1,4); apaga "BC" (pos 1, 2 removidos) → "AD", faixa [1,2)
    const novo = ajustarRanges("AD", [{ ini: 1, fim: 4, cor: "azul" }], 1, 2, 0);
    expect(novo).toEqual([{ ini: 1, fim: 2, cor: "azul" }]);
  });
});
