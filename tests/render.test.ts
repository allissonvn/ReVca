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

// Campanha de teste FIXA (não depende de data/campanhas, que o usuário edita
// pela interface — ver lição: testes nunca devem ler dados mutáveis).
const campanhaSeed = CampanhaSchema.parse({
  versao: 1,
  id: "teste",
  usuarioId: "admin",
  titulo: "Parcelamento Matriz - BLACK FRIDAY",
  mes: "NOVEMBRO",
  paginas: [
    {
      id: "pag-1",
      modelo: "residencial",
      faixa: "Linha: Uni Residencial",
      cartoes: [{
        id: "car-1", empreendimentoId: "uni-ville",
        titulo: ["Condições para o Uni Ville Residencial", "1ª etapa (31/12/2027)"],
        blocos: [
          { id: "blo-1", tipo: "financiamento", ativo: true, largura: 2, titulo: "FINANCIAMENTO CEF", tituloCor: "preto",
            texto: "Sinal de [[azul]]R$ 3.000,00[[/]] em até [[azul]]3x[[/]]\nSaldo em [[azul]]50x[[/]] com [[azul]]INCC[[/]]" },
          { id: "blo-2", tipo: "documentacao", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
            texto: "Documentação ((vermelho))GRÁTIS((/)) para\nclientes ((vermelho))SBPE((/))" },
          { id: "blo-3", tipo: "documentacao", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
            texto: "Documentação ((vermelho))GRÁTIS((/)) apenas\npara os clientes ((vermelho))MCMV((/))" },
          { id: "blo-4", tipo: "observacao", ativo: true, largura: 2, titulo: "OBSERVAÇÃO", tituloCor: "vermelho",
            texto: "SE A SOMA DOS VALORES FOR [[azul]]5%[[/]] DO VALOR DO IMÓVEL" },
          { id: "blo-5", tipo: "prosoluto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "Pró-soluto de 10%" },
        ],
      }],
    },
    {
      id: "pag-2",
      modelo: "duplo",
      cartoes: [
        { id: "car-2", empreendimentoId: "dona-olivia", faixa: "Dona Olivia Universidade",
          titulo: ["Condições para Dona Olivia Universidade"],
          blocos: [{ id: "blo-6", tipo: "facilita", ativo: true, largura: 2, titulo: "PARCELAMENTO FACILITA", tituloCor: "preto",
            texto: "Sinal de [[azul]]30%[[/]] ((vermelho))SEM PARCELAMENTO((/))" }] },
        { id: "car-3", empreendimentoId: "dona-olivia", faixa: "Dona Olivia Universidade - Garagens extras",
          titulo: ["Condições para as vagas extras do Dona Olivia Universidade"],
          blocos: [{ id: "blo-7", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto",
            texto: "Sinal de [[azul]]R$ 3.000,00[[/]], + [[azul]]34X[[/]]" }] },
      ],
    },
    {
      id: "pag-3",
      modelo: "loteamentos",
      faixa: "Linha: Loteamentos",
      cartoes: [
        { id: "car-4", empreendimentoId: "baron-1", titulo: ["Condições para o Baron Connect I (entregue)"],
          blocos: [
            { id: "blo-8", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto",
              texto: "Sinal de tabela em até [[azul]]3x[[/]] sem chocar" },
            { id: "blo-9", tipo: "promocao", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
              texto: "Venda à vista:\n[[azul]]10%[[/]] de desconto" },
            { id: "blo-10", tipo: "investidor", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
              texto: "PARCELAMENTO em\naté [[azul]]24x[[/]] sem juros." },
          ] },
        { id: "car-5", empreendimentoId: "baron-2", titulo: ["Condições para o Baron Connect II (entregue)"],
          blocos: [
            { id: "blo-11", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto",
              texto: "Sinal de tabela em até [[azul]]3x[[/]] sem chocar" },
            { id: "blo-12", tipo: "promocao", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
              texto: "Venda à vista:\n[[azul]]10%[[/]] de desconto" },
            { id: "blo-13", tipo: "investidor", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
              texto: "PARCELAMENTO em\naté [[azul]]24x[[/]] sem juros." },
          ] },
        { id: "car-6", empreendimentoId: "baron-uchoa", titulo: ["Condições para o Baron Uchôa (entregue)"],
          blocos: [
            { id: "blo-14", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto",
              texto: "Sinal de tabela em até [[azul]]3x[[/]] e parcelamento em [[azul]]132x[[/]]" },
            { id: "blo-15", tipo: "avista", ativo: true, largura: 1, titulo: "", tituloCor: "preto",
              texto: "Venda à vista:\n[[azul]]10%[[/]] de desconto" },
          ] },
      ],
    },
    {
      id: "pag-4",
      modelo: "aviso",
      faixa: "VCA Praia",
      cartoes: [{ id: "car-7", empreendimentoId: "kahakai", titulo: ["Condições para o Kahakai Prado"],
        blocos: [{ id: "blo-16", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto",
          texto: "Não deixe de cadastrar o seu cliente no nosso\nmais novo projeto em Prado." }] }],
    },
  ],
  revisao: 1,
  atualizadoEm: new Date().toISOString(),
});

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

  it("logo e placeholder ocupam a MESMA caixa padrão (sem distorção)", () => {
    // altura do modelo × 1,5 de largura, com object-fit:contain
    expect(artCss()).toContain(".logo-area img{height:100%;width:calc(var(--logo) * 1.5);object-fit:contain}");
    expect(artCss()).toContain("logo-ph");
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

  it("chips preservam espaços internos (pre-wrap) e quebram palavras longas", () => {
    // o HTML guarda os espaços; o CSS (pre-wrap) garante que apareçam na arte
    expect(artCss()).toContain("white-space:pre-wrap");
    expect(artCss()).toContain("overflow-wrap:anywhere");
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    const bloco = (c.paginas[0] as any).cartoes[0].blocos[0];
    bloco.texto = "Sinal   de   R$ 3.000,00";
    const html2 = renderCampanha(CampanhaSchema.parse(c), carregarCatalogos());
    expect(html2).toContain("Sinal   de   R$ 3.000,00");
  });

  it("espaços das pontas do chip são aparados (não descentralizam a arte)", () => {
    const c = JSON.parse(JSON.stringify(campanhaSeed));
    const bloco = (c.paginas[0] as any).cartoes[0].blocos[0];
    bloco.texto = "   Sinal de R$ 3.000,00   ";
    const html2 = renderCampanha(CampanhaSchema.parse(c), carregarCatalogos());
    expect(html2).toContain('<div class="chip">Sinal de R$ 3.000,00</div>');
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
