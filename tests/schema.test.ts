import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CampanhaSchema, ModeloSchema, TipoBlocoSchema, TituloProntoSchema, EmpreendimentoSchema,
} from "../src/shared/schema.js";

const campanhaValida = () => ({
  versao: 1,
  id: "teste",
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

  it("aceita a campanha do seed", () => {
    const seed = JSON.parse(readFileSync(join("data", "campanhas", "exemplo.json"), "utf8"));
    expect(() => CampanhaSchema.parse(seed)).not.toThrow();
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
