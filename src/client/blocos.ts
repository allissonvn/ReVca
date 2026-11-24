// Blocos novos do editor: centraliza os defaults para que a criação pela lista
// de blocos (RightPanel) e por uma página nova (LeftRail) fiquem iguais.
import { Bloco, BlocoSchema, BlocoTabela, TipoBloco } from "../shared/schema.js";

/** Tabela vazia padrão (para bloco tipo "tabela"): 3 colunas, sem linhas. */
export function tabelaEmBranco(): BlocoTabela {
  return { cabecalho: ["COLUNA 1", "COLUNA 2", "COLUNA 3"], linhas: [] };
}

/** Tabela vazia padrão (para entidade Tabela separada): 3 colunas, sem linhas. */
export function tabelaEntidadeEmBranco(): { cabecalho: string[]; linhas: any[] } {
  return { cabecalho: ["COLUNA 1", "COLUNA 2", "COLUNA 3"], linhas: [] };
}

/** Cria um bloco a partir do tipo do catálogo (tabela ganha a estrutura própria). */
export function novoBloco(tipoId: string, tipo: TipoBloco | undefined): Bloco {
  const base = {
    id: crypto.randomUUID().slice(0, 8),
    tipo: tipoId,
    ativo: true,
    largura: tipo?.largura ?? 2,
    titulo: tipo?.tituloPadrao ?? "",
    tituloCor: tipo?.tituloCor ?? "preto",
    texto: "",
  };
  return BlocoSchema.parse(
    tipoId === "tabela" ? { ...base, largura: 2, tabela: tabelaEmBranco() } : base,
  );
}
