import { describe, it, expect } from "vitest";
import { migrarProto } from "../src/shared/migrate.js";
import { removerMarcadores } from "../src/shared/markup.js";
import { CampanhaSchema } from "../src/shared/schema.js";

// Amostra do formato que o protótipo exporta (campos: modelo, emp, nome, textos, span/estilo ignorados)
const proto = () => ({
  campanha: { titulo: "Parcelamento Matriz - BLACK FRIDAY", mes: "NOVEMBRO" },
  paginas: [
    {
      modelo: "residencial",
      faixa: "Linha: Uni Residencial",
      cartoes: [
        {
          emp: "uni-ville",
          nome: ["Condições para o Uni Ville Residencial", "1ª etapa (31/12/2027)"],
          blocos: [
            { tipo: "financiamento", ativo: true, textos: ["Sinal de R$ 3.000,00 em até 3x\nSaldo em 50x com INCC (até a entrega) e 0,7974% a.m + IPCA (após a entrega)"] },
            { tipo: "documentacao", ativo: true, textos: ["Documentação GRÁTIS para\nclientes SBPE com acréscimo de\nR$ 2.000,00 no SINAL", "Documentação GRÁTIS apenas\npara os clientes MCMV"] },
            { tipo: "observacao", ativo: true, textos: ["SE A SOMA DOS VALORES DAS PARCELAS\nINTERMEDIÁRIAS FOR 5% DO VALOR DO IMÓVEL, NÃO\nPRECISA DE APROVAÇÃO COMERCIAL"] },
            { tipo: "prosoluto", ativo: true, textos: ["Pró-soluto de 10%"] },
            { tipo: "texto", ativo: false, textos: ["bloco desligado"] },
          ],
        },
      ],
    },
    {
      modelo: "aviso",
      faixa: "VCA Praia",
      cartoes: [
        {
          emp: "kahakai",
          nome: ["Condições para o Kahakai Prado"],
          blocos: [{ tipo: "texto", ativo: true, textos: ["Não deixe de cadastrar\nR$20.000,00 + 100x"] }],
        },
      ],
    },
  ],
});

describe("migrarProto", () => {
  it("produz campanha válida pelo schema", () => {
    const c = migrarProto(proto());
    expect(() => CampanhaSchema.parse(c)).not.toThrow();
  });

  it("mantém título e mês", () => {
    const c = migrarProto(proto());
    expect(c.titulo).toBe("Parcelamento Matriz - BLACK FRIDAY");
    expect(c.mes).toBe("NOVEMBRO");
  });

  it("mantém faixa verde (nome) em 2 linhas", () => {
    const c = migrarProto(proto());
    expect(c.paginas[0]?.cartoes[0]?.titulo).toEqual([
      "Condições para o Uni Ville Residencial",
      "1ª etapa (31/12/2027)",
    ]);
  });

  it("bloco de 2 colunas vira 2 blocos de largura 1, sem perder texto", () => {
    const c = migrarProto(proto());
    const blocos = c.paginas[0]?.cartoes[0]?.blocos ?? [];
    const doc = blocos.filter((b) => b.tipo === "documentacao");
    expect(doc).toHaveLength(2);
    expect(doc[0]?.largura).toBe(1);
    expect(doc[1]?.largura).toBe(1);
    expect(removerMarcadores(doc[0]?.texto ?? "")).toContain("Documentação GRÁTIS para");
    expect(removerMarcadores(doc[1]?.texto ?? "")).toContain("para os clientes MCMV");
  });

  it("bloco simples vira largura 2 e mantém o título pronto", () => {
    const c = migrarProto(proto());
    const fin = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "financiamento");
    expect(fin?.largura).toBe(2);
    expect(fin?.titulo).toBe("FINANCIAMENTO CEF");
    expect(fin?.tituloCor).toBe("preto");
  });

  it("converte as cores automáticas em markup (valores azul, GRÁTIS vermelho)", () => {
    const c = migrarProto(proto());
    const fin = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "financiamento");
    expect(fin?.texto).toContain("[[azul]]R$ 3.000,00[[/]]");
    expect(fin?.texto).toContain("[[azul]]INCC[[/]]");
    const doc = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "documentacao");
    expect(doc?.texto).toContain("((vermelho))GRÁTIS((/))");
    expect(doc?.texto).toContain("((vermelho))R$ 2.000,00((/))"); // valores do tipo documentação são vermelhos
    const obs = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "observacao");
    expect(obs?.texto).toContain("[[azul]]5%[[/]]");
    expect(obs?.tituloCor).toBe("vermelho");
  });

  it("prosoluto fica inteiro azul", () => {
    const c = migrarProto(proto());
    const pros = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "prosoluto");
    expect(pros?.texto).toBe("[[azul]]Pró-soluto de 10%[[/]]");
  });

  it("preserva ativo: false e mantém o texto", () => {
    const c = migrarProto(proto());
    const off = (c.paginas[0]?.cartoes[0]?.blocos ?? []).find((b) => b.tipo === "texto");
    expect(off?.ativo).toBe(false);
    expect(off?.texto).toBe("bloco desligado");
  });

  it("empreendimento vazio vira null", () => {
    const p = proto();
    (p.paginas[0]?.cartoes[0] as any).emp = "";
    const c = migrarProto(p);
    expect(c.paginas[0]?.cartoes[0]?.empreendimentoId).toBeNull();
  });

  it("ids são únicos", () => {
    const c = migrarProto(proto());
    const ids = c.paginas.flatMap((p) => [p.id, ...p.cartoes.flatMap((ct) => [ct.id, ...ct.blocos.map((b) => b.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejeita formato inválido", () => {
    expect(() => migrarProto({ foo: 1 })).toThrow();
  });
});
