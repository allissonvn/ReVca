import { describe, it, expect } from "vitest";
import { parseLinha, renderLinha, renderTexto, removerMarcadores } from "../src/shared/markup.js";

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
