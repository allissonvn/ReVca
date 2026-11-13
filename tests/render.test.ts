import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderCampanha, renderDocumento, artCss, modeloPorId } from "../src/shared/render.js";
import { Catalogos, CampanhaSchema, ModeloSchema, TipoBlocoSchema, TituloProntoSchema, EmpreendimentoSchema } from "../src/shared/schema.js";

function carregarCatalogos(): Catalogos {
  const ler = (nome: string) => JSON.parse(readFileSync(join("data", "catalogos", nome), "utf8"));
  return {
    modelos: ler("modelos.json").map((m: unknown) => ModeloSchema.parse(m)),
    tiposBloco: ler("tipos-bloco.json").map((t: unknown) => TipoBlocoSchema.parse(t)),
    titulos: ler("titulos.json").map((t: unknown) => TituloProntoSchema.parse(t)),
    empreendimentos: ler("empreendimentos.json").map((e: unknown) => EmpreendimentoSchema.parse(e)),
  };
}

const campanhaSeed = CampanhaSchema.parse(JSON.parse(readFileSync(join("data", "campanhas", "exemplo.json"), "utf8")));

describe("renderCampanha", () => {
  const html = renderCampanha(campanhaSeed, carregarCatalogos());

  it("produz exatamente 4 .page", () => {
    expect((html.match(/class="pagina"/g) ?? []).length).toBe(4);
  });

  it("cabeçalho com título, mês e logo VCA em cada página", () => {
    expect((html.match(/logo-vca\.png/g) ?? []).length).toBe(4);
    expect(html).toContain("Parcelamento Matriz - BLACK FRIDAY");
    expect(html).toContain("NOVEMBRO");
  });

  it("faixa azul da página nas páginas certas", () => {
    expect(html).toContain("Linha: Uni Residencial");
    expect(html).toContain("Linha: Loteamentos");
    expect(html).toContain("VCA Praia");
  });

  it("faixa mini por cartão no modelo duplo", () => {
    expect(html).toContain("Dona Olivia Universidade - Garagens extras");
  });

  it("chips com cor via markup", () => {
    expect(html).toContain('<span class="cor-azul">R$ 3.000,00</span>');
    expect(html).toContain('<span class="cor-vermelho">GRÁTIS</span>');
  });

  it("escapa HTML do usuário", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    (c.paginas[0] as any).cartoes[0].blocos[0].texto = "<script>alert(1)</script>";
    const html2 = renderCampanha(CampanhaSchema.parse(c), carregarCatalogos());
    expect(html2).not.toContain("<script>");
    expect(html2).toContain("&lt;script&gt;");
  });

  it("linha vazia não vira chip", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    (c.paginas[0] as any).cartoes[0].blocos[0].texto = "a\n\nb";
    const html2 = renderCampanha(CampanhaSchema.parse(c), carregarCatalogos());
    // o texto do bloco 1 tem exatamente 2 chips ("a" e "b")
    const bloco1 = html2.slice(html2.indexOf("data-bloco"), html2.indexOf("blo-2"));
    expect((bloco1.match(/class="chip"/g) ?? []).length).toBe(2);
  });

  it("bloco inativo não aparece", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    (c.paginas[0] as any).cartoes[0].blocos[0].ativo = false;
    const html2 = renderCampanha(CampanhaSchema.parse(c), carregarCatalogos());
    expect(html2).not.toContain("FINANCIAMENTO CEF");
  });

  it("dois blocos de largura 1 na sequência formam uma linha de grade", () => {
    // blo-2 e blo-3 (documentação) ficam na mesma .linha-blocos
    const inicio = html.lastIndexOf('<div class="linha-blocos', html.indexOf('data-bloco="blo-2"'));
    const fim = html.lastIndexOf('<div class="linha-blocos', html.indexOf('data-bloco="blo-4"'));
    const entre = html.slice(inicio, fim);
    expect((entre.match(/linha-blocos/g) ?? []).length).toBe(1);
    expect(entre).toContain('data-bloco="blo-2"');
    expect(entre).toContain('data-bloco="blo-3"');
  });

  it("bloco de largura 1 sozinho fica na esquerda (sem classe centro)", () => {
    // Baron Uchôa tem um avista (blo-15) sozinho
    const trecho = html.slice(html.indexOf("blo-15"));
    expect(trecho).toContain("linha-blocos");
    expect(trecho.slice(0, trecho.indexOf("bloco-col"))).not.toContain("centro");
  });

  it("logo do empreendimento aparece", () => {
    expect(html).toContain("/logos/uni-ville.png");
    expect(html).toContain("/logos/baron-connect.png");
  });

  it("empreendimento sem logo mostra marcador tracejado", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    const catalogos = carregarCatalogos();
    const emp = catalogos.empreendimentos.find((e) => e.id === "uni-ville");
    if (emp) emp.logo = null;
    const html2 = renderCampanha(CampanhaSchema.parse(c), catalogos);
    expect(html2).toContain("logo-ph");
  });

  it("variáveis do modelo no elemento da página", () => {
    // residencial escala 1, logo 86; loteamentos escala 0.8, logo 42
    expect(html).toContain("--esc:1");
    expect(html).toContain("--logo:86px");
    expect(html).toContain("--esc:0.8");
    expect(html).toContain("--logo:42px");
  });

  it("rodapé opcional aparece quando preenchido", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    c.rodape = "Válido até 30/11";
    const html2 = renderDocumento(CampanhaSchema.parse(c), carregarCatalogos());
    expect(html2).toContain("Válido até 30/11");
  });
});

describe("renderDocumento", () => {
  it("é um documento completo com o CSS da arte", () => {
    const doc = renderDocumento(campanhaSeed, carregarCatalogos());
    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain(artCss());
    expect((doc.match(/class="pagina"/g) ?? []).length).toBe(4);
  });
});

describe("modeloPorId", () => {
  it("encontra modelo pelo id", () => {
    const catalogos = carregarCatalogos();
    expect(modeloPorId(catalogos, "duplo")?.nome).toBe("Dois cartões (faixa em cada)");
    expect(modeloPorId(catalogos, "x")).toBeUndefined();
  });
});
