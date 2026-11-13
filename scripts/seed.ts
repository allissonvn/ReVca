// Cria a campanha de exemplo com as 4 páginas equivalentes às páginas
// 1, 10, 11 e 17 do PDF original (mesma conteúdo do protótipo).
// Uso: npm run seed
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { Campanha, CampanhaSchema } from "../src/shared/schema.js";
import { acharRaiz } from "../src/shared/raiz.js";

const raiz = acharRaiz();
const arquivo = join(raiz, "data", "campanhas", "exemplo.json");

const bloco = (
  id: string, tipo: string, largura: 1 | 2, titulo: string, tituloCor: "preto" | "vermelho", texto: string,
) => ({ id, tipo, ativo: true, largura, titulo, tituloCor, texto });

const seed: Campanha = {
  versao: 1,
  id: "exemplo",
  titulo: "Parcelamento Matriz - BLACK FRIDAY",
  mes: "NOVEMBRO",
  paginas: [
    {
      // Página 1 do PDF: Uni Ville Residencial
      id: "pag-1",
      modelo: "residencial",
      faixa: "Linha: Uni Residencial",
      cartoes: [
        {
          id: "car-1",
          empreendimentoId: "uni-ville",
          titulo: ["Condições para o Uni Ville Residencial", "1ª etapa (31/12/2027)"],
          blocos: [
            bloco("blo-1", "financiamento", 2, "FINANCIAMENTO CEF", "preto",
              "Sinal de [[azul]]R$ 3.000,00[[/]] em até [[azul]]3x[[/]]\n" +
              "Saldo em [[azul]]50x[[/]] com [[azul]]INCC[[/]] (até a entrega) e [[azul]]0,7974% a.m[[/]] + [[azul]]IPCA[[/]] (após a entrega)"),
            bloco("blo-2", "documentacao", 1, "", "preto",
              "Documentação ((vermelho))GRÁTIS((/)) para\nclientes ((vermelho))SBPE((/)) com acréscimo de\n((vermelho))R$ 2.000,00((/)) no SINAL"),
            bloco("blo-3", "documentacao", 1, "", "preto",
              "Documentação ((vermelho))GRÁTIS((/)) apenas\npara os clientes ((vermelho))MCMV((/))"),
            bloco("blo-4", "observacao", 2, "OBSERVAÇÃO", "vermelho",
              "SE A SOMA DOS VALORES DAS PARCELAS\nINTERMEDIÁRIAS FOR [[azul]]5%[[/]] DO VALOR DO IMÓVEL, NÃO\nPRECISA DE APROVAÇÃO COMERCIAL"),
            bloco("blo-5", "prosoluto", 2, "", "preto",
              "[[azul]]Pró-soluto de 10%[[/]]"),
          ],
        },
      ],
    },
    {
      // Página 11 do PDF: Dona Olivia (2 cartões)
      id: "pag-2",
      modelo: "duplo",
      cartoes: [
        {
          id: "car-2",
          empreendimentoId: "dona-olivia",
          faixa: "Dona Olivia Universidade",
          titulo: ["Condições para Dona Olivia Universidade"],
          blocos: [
            bloco("blo-6", "facilita", 2, "PARCELAMENTO FACILITA", "preto",
              "Sinal de [[azul]]30%[[/]] ((vermelho))SEM PARCELAMENTO((/))\nParcelamento em [[azul]]40x[[/]] com [[azul]]IPCA[[/]] + [[azul]]0,7974% a.m[[/]]"),
          ],
        },
        {
          id: "car-3",
          empreendimentoId: "dona-olivia",
          faixa: "Dona Olivia Universidade - Garagens extras",
          titulo: ["Condições para as vagas extras do Dona Olivia Universidade"],
          blocos: [
            bloco("blo-7", "texto", 2, "", "preto",
              "Sinal de [[azul]]R$ 3.000,00[[/]], + [[azul]]34X[[/]] com [[azul]]IPCA[[/]] + [[azul]]10%[[/]]"),
          ],
        },
      ],
    },
    {
      // Página 17 do PDF: Loteamentos (3 cartões)
      id: "pag-3",
      modelo: "loteamentos",
      faixa: "Linha: Loteamentos",
      cartoes: [
        {
          id: "car-4",
          empreendimentoId: "baron-1",
          titulo: ["Condições para o Baron Connect I (entregue)"],
          blocos: [
            bloco("blo-8", "texto", 2, "", "preto",
              "Sinal de tabela em até [[azul]]3x[[/]] sem chocar com mensais\nParcelamento em [[azul]]144x[[/]] conforme tabela e simulador\nTaxa [[azul]]11,49%[[/]] + TR"),
            bloco("blo-9", "avista", 1, "", "preto",
              "Venda à vista:\n[[azul]]10%[[/]] de desconto"),
            bloco("blo-10", "avista", 1, "", "preto",
              "PARCELAMENTO em\naté [[azul]]24x[[/]] sem juros."),
          ],
        },
        {
          id: "car-5",
          empreendimentoId: "baron-2",
          titulo: ["Condições para o Baron Connect II (entregue)"],
          blocos: [
            bloco("blo-11", "texto", 2, "", "preto",
              "Sinal de tabela em até [[azul]]3x[[/]] sem chocar com mensais\nParcelamento em [[azul]]144x[[/]] conforme tabela e simulador\nTaxa [[azul]]11,49%[[/]] + TR"),
            bloco("blo-12", "avista", 1, "", "preto",
              "Venda à vista:\n[[azul]]10%[[/]] de desconto"),
            bloco("blo-13", "avista", 1, "", "preto",
              "PARCELAMENTO em\naté [[azul]]24x[[/]] sem juros."),
          ],
        },
        {
          id: "car-6",
          empreendimentoId: "baron-uchoa",
          titulo: ["Condições para o Baron Uchôa (entregue)"],
          blocos: [
            bloco("blo-14", "texto", 2, "", "preto",
              "Sinal de tabela em até [[azul]]3x[[/]] e parcelamento em [[azul]]132x[[/]]\nconforme tabela e simulador\nTaxa [[azul]]9,5%[[/]]"),
            bloco("blo-15", "avista", 1, "", "preto",
              "Venda à vista:\n[[azul]]10%[[/]] de desconto"),
          ],
        },
      ],
    },
    {
      // Página 10 do PDF: Aviso Kahakai
      id: "pag-4",
      modelo: "aviso",
      faixa: "VCA Praia",
      cartoes: [
        {
          id: "car-7",
          empreendimentoId: "kahakai",
          titulo: ["Condições para o Kahakai Prado"],
          blocos: [
            bloco("blo-16", "texto", 2, "", "preto",
              "Não deixe de cadastrar o seu cliente no nosso\nmais novo projeto em Prado. Com valores a\npartir de [[azul]]R$20.000,00 + 100x de R$1.799,99[[/]]"),
          ],
        },
      ],
    },
  ],
  revisao: 1,
  atualizadoEm: new Date().toISOString(),
};

const dados = CampanhaSchema.parse(seed);
if (existsSync(arquivo)) {
  console.log(`seed: ${arquivo} já existe; nada foi alterado.`);
} else {
  mkdirSync(dirname(arquivo), { recursive: true });
  writeFileSync(arquivo, JSON.stringify(dados, null, 2), "utf8");
  console.log(`seed: campanha de exemplo criada em ${arquivo}`);
}
