import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BlocoSchema, CampanhaSchema, ModeloSchema, TipoBlocoSchema, TituloProntoSchema, EmpreendimentoSchema,
} from "../src/shared/schema.js";
import { campanhaSeed } from "./helpers/fixtures.js";

const campanhaValida = () => ({
  versao: 1,
  id: "teste",
  usuarioId: "admin",
  titulo: "Parcelamento Matriz",
  mes: "NOVEMBRO",
  paginas: [
    {
      id: "p1",
      modelo: "residencial",
      faixa: "Linha: Uni Residencial",
      cartoes: [
        {
          id: "c1",
          empreendimentoId: "uni-ville",
          titulo: ["Condições para o Uni Ville Residencial"],
          blocos: [
            { id: "b1", tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "linha 1\nlinha 2" },
          ],
        },
      ],
    },
  ],
  revisao: 1,
  atualizadoEm: "2026-11-01T10:00:00.000Z",
});

describe("CampanhaSchema", () => {
  it("aceita uma campanha válida", () => {
    expect(() => CampanhaSchema.parse(campanhaValida())).not.toThrow();
  });

  // data/campanhas/ é gitignored: a campanha vem da fixture em código, não do disco.
  it("aceita a campanha do seed", () => {
    expect(() => CampanhaSchema.parse(campanhaSeed())).not.toThrow();
  });

  it("rejeita versão diferente", () => {
    const c = campanhaValida();
    c.versao = 2;
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita mês inválido", () => {
    const c = campanhaValida();
    c.mes = "novembro"; // deve ser maiúsculo
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
    c.mes = "NATAL";
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita revisão negativa ou fracionária", () => {
    const c = campanhaValida();
    c.revisao = 0;
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
    c.revisao = 1.5;
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita largura de bloco diferente de 1 ou 2", () => {
    const c = campanhaValida();
    (c.paginas[0] as any).cartoes[0].blocos[0].largura = 3;
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita tituloCor inválida", () => {
    const c = campanhaValida();
    (c.paginas[0] as any).cartoes[0].blocos[0].tituloCor = "azul";
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita faixa verde com 3 linhas", () => {
    const c = campanhaValida();
    (c.paginas[0] as any).cartoes[0].titulo = ["a", "b", "c"];
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita campo ausente (revisao)", () => {
    const c = campanhaValida();
    delete (c as any).revisao;
    expect(CampanhaSchema.safeParse(c).success).toBe(false);
  });

  it("rejeita JSON quebrado", () => {
    expect(CampanhaSchema.safeParse(null).success).toBe(false);
    expect(CampanhaSchema.safeParse("texto").success).toBe(false);
  });

  it("aceita rodapé opcional", () => {
    const c = campanhaValida();
    (c as any).rodape = "Validade: 30/11";
    expect(() => CampanhaSchema.parse(c)).not.toThrow();
  });
});

describe("BlocoSchema — tabela", () => {
  const bloco = (tabela: unknown) => ({
    id: "b1", tipo: "tabela", ativo: true, largura: 2,
    titulo: "", tituloCor: "preto", texto: "", tabela,
  });

  it("aceita cabeçalho, linha de dados e linha de seção", () => {
    const t = {
      cabecalho: ["TIPO", "PAVIMENTO", "VALOR"],
      linhas: [
        { secao: false, celulas: ["2/4", "TÉRREO", "R$ 244.900,00"] },
        { secao: true, celulas: ["3/4 - COM SUÍTE"] },
      ],
    };
    expect(BlocoSchema.safeParse(bloco(t)).success).toBe(true);
  });

  it("rejeita linha de dados com número de células diferente do cabeçalho", () => {
    const t = {
      cabecalho: ["TIPO", "VALOR"],
      linhas: [{ secao: false, celulas: ["2/4", "R$ 1", "sobra"] }],
    };
    expect(BlocoSchema.safeParse(bloco(t)).success).toBe(false);
  });

  it("rejeita linha de seção com mais de uma célula", () => {
    const t = {
      cabecalho: ["TIPO", "VALOR"],
      linhas: [{ secao: true, celulas: ["3/4", "TÉRREO"] }],
    };
    expect(BlocoSchema.safeParse(bloco(t)).success).toBe(false);
  });

  it("aceita linha de destaque com as células da tabela", () => {
    const t = {
      cabecalho: ["TIPO", "PAVIMENTO", "VALOR"],
      linhas: [{ secao: false, destaque: true, celulas: ["2/4 - COM SUÍTE", "TÉRREO", "ABAIXO"] }],
    };
    expect(BlocoSchema.safeParse(bloco(t)).success).toBe(true);
  });

  it("rejeita linha de seção marcada também como destaque", () => {
    const t = {
      cabecalho: ["TIPO", "VALOR"],
      linhas: [{ secao: true, destaque: true, celulas: ["3/4"] }],
    };
    expect(BlocoSchema.safeParse(bloco(t)).success).toBe(false);
  });

  it("aceita bloco comum sem tabela (campanhas antigas)", () => {
    expect(BlocoSchema.safeParse({
      id: "b2", tipo: "texto", ativo: true, largura: 2,
      titulo: "", tituloCor: "preto", texto: "linha",
    }).success).toBe(true);
  });
});

describe("catálogos do projeto", () => {
  it("modelos.json válido", () => {
    const dados = JSON.parse(readFileSync(join("data", "catalogos", "modelos.json"), "utf8"));
    for (const m of dados) expect(() => ModeloSchema.parse(m)).not.toThrow();
  });

  it("tipos-bloco.json válido", () => {
    const dados = JSON.parse(readFileSync(join("data", "catalogos", "tipos-bloco.json"), "utf8"));
    for (const t of dados) expect(() => TipoBlocoSchema.parse(t)).not.toThrow();
  });

  it("titulos.json válido", () => {
    const dados = JSON.parse(readFileSync(join("data", "catalogos", "titulos.json"), "utf8"));
    for (const t of dados) expect(() => TituloProntoSchema.parse(t)).not.toThrow();
  });

  it("empreendimentos.json válido", () => {
    const dados = JSON.parse(readFileSync(join("data", "catalogos", "empreendimentos.json"), "utf8"));
    for (const e of dados) expect(() => EmpreendimentoSchema.parse(e)).not.toThrow();
  });
});
