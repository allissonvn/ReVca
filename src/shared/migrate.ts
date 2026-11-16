// Importa o JSON exportado pelo protótipo (referencia/prototipo-multipaginas.html).
// Formato antigo: { campanha: { titulo, mes }, paginas: [ { modelo, faixa,
//   cartoes: [ { emp, faixa, nome: string[], blocos: [ { tipo, ativo, textos: string[] } ] } ] } ] }
// O protótipo aplicava cores automáticas por regra; aqui elas viram markup
// ([[azul]] / ((vermelho))) para não perder cor na conversão.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CampanhaSchema, Campanha, TituloCor, Largura } from "./schema.js";

// Defaults do protótipo (TIPOS): título pronto e cor numérica do tipo
const TITULOS_PROTO: Record<string, { titulo: string; cor: TituloCor } | undefined> = {
  financiamento: { titulo: "FINANCIAMENTO CEF", cor: "preto" },
  facilita: { titulo: "PARCELAMENTO FACILITA", cor: "preto" },
  observacao: { titulo: "OBSERVAÇÃO", cor: "vermelho" },
  promocao: { titulo: "PROMOÇÃO", cor: "vermelho" },
  investidor: { titulo: "CONDIÇÃO INVESTIDOR", cor: "preto" },
};
// Tipos com números em vermelho (num: "r" no protótipo); os demais usam azul
const NUM_VERMELHO = new Set(["documentacao", "promocao"]);
// Tipo com tudo azul (tudo: "b" no protótipo)
const TUDO_AZUL = new Set(["prosoluto"]);

// Mesma regra de cor do protótipo (valores → azul; palavras-chave → vermelho)
const RE_VALOR = /R\$\s?[\d.,]*\d|\d+(?:,\d+)?%(?:\s?a\.m)?|\d+[xX]|INCC|IPCA/g;
const RE_PALAVRA = /(?<![\p{L}\p{N}])(?:GRÁTIS|SBPE|MCMV)(?![\p{L}\p{N}])/gu;

const ProtoSchema = z.object({
  campanha: z.object({ titulo: z.string(), mes: z.string() }),
  paginas: z.array(z.object({
    modelo: z.string(),
    faixa: z.string().optional(),
    cartoes: z.array(z.object({
      emp: z.string().optional(),
      faixa: z.string().optional(),
      nome: z.array(z.string()).optional(),
      blocos: z.array(z.object({
        tipo: z.string(),
        ativo: z.boolean().optional().default(true),
        textos: z.array(z.string()).optional().default([]),
      })),
    })),
  })),
});

/** Aplica a regra de cor do protótipo numa linha, gerando markup. */
function marcarCor(linha: string, tipo: string): string {
  if (TUDO_AZUL.has(tipo)) {
    return linha.trim().length > 0 ? `[[azul]]${linha}[[/]]` : linha;
  }
  const corValor = NUM_VERMELHO.has(tipo) ? "((vermelho))" : "[[azul]]";
  const fechValor = NUM_VERMELHO.has(tipo) ? "((/))" : "[[/]]";
  let resultado = linha;
  // Palavras-chave primeiro (podem coexistir com valores na mesma linha)
  resultado = resultado.replace(RE_PALAVRA, (m) => `((vermelho))${m}((/))`);
  resultado = resultado.replace(RE_VALOR, (m) => `${corValor}${m}${fechValor}`);
  return resultado;
}

/** Converte um JSON do protótipo em campanha do editor. Lança se o formato for inválido. */
export function migrarProto(dados: unknown): Campanha {
  const proto = ProtoSchema.parse(dados);
  let contador = 0;
  const novoId = (prefixo: string) => `${prefixo}-${(++contador).toString().padStart(3, "0")}-${randomUUID().slice(0, 8)}`;

  const paginas = proto.paginas.map((pg) => ({
    id: novoId("pag"),
    modelo: pg.modelo,
    ...(pg.faixa !== undefined ? { faixa: pg.faixa } : {}),
    cartoes: pg.cartoes.map((ct) => {
      const emp = ct.emp && ct.emp.length > 0 ? ct.emp : null;
      const defTitulo = (tipo: string) => {
        const def = TITULOS_PROTO[tipo];
        return { titulo: def?.titulo ?? "", tituloCor: def?.cor ?? "preto" };
      };
      const blocos = ct.blocos.flatMap((bl) => {
        const { titulo, tituloCor } = defTitulo(bl.tipo);
        const textos = bl.textos.map((t) => t.split("\n").map((l) => marcarCor(l, bl.tipo)).join("\n"));
        // Protótipo com 2 textos = bloco de 2 colunas → dois blocos de largura 1
        if (textos.length >= 2) {
          const saida: { id: string; tipo: string; ativo: boolean; largura: Largura; titulo: string; tituloCor: TituloCor; texto: string }[] = [];
          for (let i = 0; i + 1 < textos.length; i += 2) {
            saida.push(bloco(novoId, bl.tipo, bl.ativo, 1, titulo, tituloCor, textos[i] ?? ""));
            saida.push(bloco(novoId, bl.tipo, bl.ativo, 1, titulo, tituloCor, textos[i + 1] ?? ""));
          }
          if (textos.length % 2 === 1) {
            saida.push(bloco(novoId, bl.tipo, bl.ativo, 1, titulo, tituloCor, textos[textos.length - 1] ?? ""));
          }
          return saida;
        }
        return [bloco(novoId, bl.tipo, bl.ativo, 2, titulo, tituloCor, textos[0] ?? "")];
      });
      const nome = (ct.nome ?? [""]).filter((l) => l.trim().length > 0);
      return {
        id: novoId("car"),
        empreendimentoId: emp,
        ...(ct.faixa !== undefined ? { faixa: ct.faixa } : {}),
        titulo: nome.length > 0 ? nome : [""],
        blocos,
      };
    }),
  }));

  return CampanhaSchema.parse({
    versao: 1,
    id: `migrada-${randomUUID().slice(0, 8)}`,
    usuarioId: "migrado",
    titulo: proto.campanha.titulo,
    mes: proto.campanha.mes,
    paginas,
    revisao: 1,
    atualizadoEm: new Date().toISOString(),
  });
}

function bloco(
  novoId: (prefixo: string) => string,
  tipo: string,
  ativo: boolean,
  largura: Largura,
  titulo: string,
  tituloCor: TituloCor,
  texto: string,
) {
  return { id: novoId("blo"), tipo, ativo, largura, titulo, tituloCor, texto };
}
