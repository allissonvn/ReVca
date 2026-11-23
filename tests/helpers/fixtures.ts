// Fixtures de campanha construídas EM CÓDIGO.
//
// Motivo (PROMPT-FIXES.md Phase 2): `data/campanhas/` é gitignored e só existe
// depois de `npm run build` + `npm run seed`, então um clone limpo não teria os
// arquivos que `schema.test.ts` e `campanha-referencia.test.ts` liam. Aqui nada
// depende de disco além de `data/catalogos/` (que é versionado).
//
// Todo texto é placeholder genérico: não vai conteúdo comercial real no repositório.
import type { Bloco, Campanha } from "../../src/shared/schema.js";

type Tipo = Bloco["tipo"];
type Cor = Bloco["tituloCor"];

const bloco = (
  id: string,
  tipo: Tipo,
  largura: 1 | 2,
  titulo: string,
  tituloCor: Cor,
  texto: string,
): Bloco => ({ id, tipo, ativo: true, largura, titulo, tituloCor, texto });

/**
 * Campanha pequena com a MESMA forma do `scripts/seed.ts`
 * (4 páginas: residencial, duplo, loteamentos, aviso · 7 cartões).
 */
export function campanhaSeed(): Campanha {
  return {
    versao: 1,
    id: "exemplo",
    usuarioId: "admin",
    titulo: "Parcelamento Matriz - BLACK FRIDAY",
    mes: "NOVEMBRO",
    paginas: [
      {
        id: "pag-1",
        modelo: "residencial",
        faixa: "Linha: Uni Residencial",
        cartoes: [
          {
            id: "car-1",
            empreendimentoId: "uni-ville",
            titulo: ["Condições para o Uni Ville Residencial", "1ª etapa (31/12/2027)"],
            blocos: [
              bloco("blo-1", "financiamento", 2, "FINANCIAMENTO CEF", "preto", "Linha de condição A\nLinha de condição B"),
              bloco("blo-2", "documentacao", 1, "", "preto", "Documentação gratuita\npara clientes"),
              bloco("blo-3", "documentacao", 1, "", "preto", "Documentação gratuita\napenas para MCMV"),
              bloco("blo-4", "observacao", 2, "OBSERVAÇÃO", "vermelho", "Texto de observação em duas linhas"),
              bloco("blo-5", "prosoluto", 2, "", "preto", "Pró-soluto de 10%"),
            ],
          },
        ],
      },
      {
        id: "pag-2",
        modelo: "duplo",
        cartoes: [
          {
            id: "car-2",
            empreendimentoId: "dona-olivia",
            faixa: "Dona Olivia Universidade",
            titulo: ["Condições para Dona Olivia Universidade"],
            blocos: [bloco("blo-6", "facilita", 2, "PARCELAMENTO FACILITA", "preto", "Sinal de 30%\nParcelamento em 40x")],
          },
          {
            id: "car-3",
            empreendimentoId: "dona-olivia",
            faixa: "Dona Olivia Universidade - Garagens extras",
            titulo: ["Condições para as vagas extras do Dona Olivia Universidade"],
            blocos: [bloco("blo-7", "texto", 2, "", "preto", "Sinal de R$ 3.000,00 em até 34x")],
          },
        ],
      },
      {
        id: "pag-3",
        modelo: "loteamentos",
        faixa: "Linha: Loteamentos",
        cartoes: [
          {
            id: "car-4",
            empreendimentoId: "baron-1",
            titulo: ["Condições para o Baron Connect I"],
            blocos: [
              bloco("blo-8", "texto", 2, "", "preto", "Sinal em até 3x\nParcelamento em 144x\nTaxa 11,49% + TR"),
              bloco("blo-9", "avista", 1, "", "preto", "Venda à vista:\n10% de desconto"),
              bloco("blo-10", "avista", 1, "", "preto", "Parcelamento em\naté 24x sem juros."),
            ],
          },
          {
            id: "car-5",
            empreendimentoId: "baron-2",
            titulo: ["Condições para o Baron Connect II"],
            blocos: [
              bloco("blo-11", "texto", 2, "", "preto", "Sinal em até 3x\nParcelamento em 144x"),
              bloco("blo-12", "avista", 1, "", "preto", "Venda à vista:\n10% de desconto"),
              bloco("blo-13", "avista", 1, "", "preto", "Parcelamento em\naté 24x sem juros."),
            ],
          },
          {
            id: "car-6",
            empreendimentoId: "baron-uchoa",
            titulo: ["Condições para o Baron Uchôa"],
            blocos: [
              bloco("blo-14", "texto", 2, "", "preto", "Sinal em até 3x\nParcelamento em 132x"),
              bloco("blo-15", "avista", 1, "", "preto", "Venda à vista:\n10% de desconto"),
            ],
          },
        ],
      },
      {
        id: "pag-4",
        modelo: "aviso",
        faixa: "VCA Praia",
        cartoes: [
          {
            id: "car-7",
            empreendimentoId: "kahakai",
            titulo: ["Condições para o Kahakai Prado"],
            blocos: [bloco("blo-16", "texto", 2, "", "preto", "Mensagem de aviso do empreendimento\nem duas linhas de placeholder.")],
          },
        ],
      },
    ],
    revisao: 1,
    atualizadoEm: "2026-11-01T10:00:00.000Z",
  };
}

/**
 * Campanha SINTÉTICA de 19 páginas / 25 cartões com a mesma distribuição de
 * modelos do PDF de referência (que saía de `data/campanhas/exemplo.json`):
 *   residencial 14 (1 cartão) · aviso 1 (1) · duplo 1 (2) · loteamentos 3 (3, 3, 2)
 * Total de cartões: 14 + 1 + 2 + 3 + 3 + 2 = 25.
 *
 * Os testes só podem assertar a ESTRUTURA da referência; o conteúdo aqui é
 * deliberadamente genérico.
 */
export function campanhaReferencia(): Campanha {
  // Ids que existem em data/catalogos/empreendimentos.json (versionado).
  const empreendimentos = [
    "uni-ville", "dona-lys", "vila-do-servidor", "bellator-olivia", "sculptor-residence",
    "duque-lavenir", "kahakai", "dona-olivia", "duque-dulest", "verso-residence",
    "bem-viver", "du-bem", "baron-1", "baron-2", "baron-uchoa", "amado-residencial",
  ];

  const paginas: Campanha["paginas"] = [];
  let pagina = 0;
  let cartao = 0;
  let blocoId = 0;

  const novoBloco = (texto: string): Bloco => {
    blocoId += 1;
    return bloco(`blo-${blocoId}`, "texto", 2, "", "preto", texto);
  };

  const novoCartao = (titulo: string): Campanha["paginas"][number]["cartoes"][number] => {
    cartao += 1;
    return {
      id: `car-${cartao}`,
      empreendimentoId: empreendimentos[(cartao - 1) % empreendimentos.length] ?? null,
      titulo: [`Condições para ${titulo}`],
      blocos: [novoBloco(`Linha de condição 1 do cartão ${cartao}\nLinha de condição 2 do cartão ${cartao}`)],
    };
  };

  const novaPagina = (modelo: Campanha["paginas"][number]["modelo"], faixa?: string): void => {
    pagina += 1;
    paginas.push({
      id: `pag-${pagina}`,
      modelo,
      ...(faixa !== undefined ? { faixa } : {}),
      cartoes: [],
    });
  };

  // 14 × residencial (1 cartão cada)
  for (let i = 0; i < 14; i++) {
    novaPagina("residencial", `Linha: Empreendimento ${i + 1}`);
    paginas[paginas.length - 1]?.cartoes.push(novoCartao(`Empreendimento ${i + 1}`));
  }

  // 1 × aviso (1 cartão)
  novaPagina("aviso", "VCA Aviso");
  paginas[paginas.length - 1]?.cartoes.push(novoCartao("Aviso"));

  // 1 × duplo (2 cartões, faixa em cada)
  novaPagina("duplo");
  paginas[paginas.length - 1]?.cartoes.push({ ...novoCartao("Duplo A"), faixa: "Faixa do cartão A" });
  paginas[paginas.length - 1]?.cartoes.push({ ...novoCartao("Duplo B"), faixa: "Faixa do cartão B" });

  // 3 × loteamentos (3, 3 e 2 cartões)
  for (const qtd of [3, 3, 2]) {
    novaPagina("loteamentos", "Linha: Loteamentos");
    for (let i = 0; i < qtd; i++) {
      paginas[paginas.length - 1]?.cartoes.push(novoCartao(`Loteamento ${i + 1}`));
    }
  }

  return {
    versao: 1,
    id: "referencia",
    usuarioId: "admin",
    titulo: "Parcelamento Matriz - BLACK FRIDAY",
    mes: "NOVEMBRO",
    paginas,
    revisao: 1,
    atualizadoEm: "2026-11-01T10:00:00.000Z",
  };
}
