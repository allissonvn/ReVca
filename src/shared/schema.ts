import { z } from "zod";

// Chaves de domínio em português (ver AGENTS.md §4); tipos de código em inglês.

export const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
] as const;

export const MesSchema = z.enum(MESES);
export type Mes = (typeof MESES)[number];

export const TituloCorSchema = z.enum(["preto", "vermelho"]);
export type TituloCor = z.infer<typeof TituloCorSchema>;

export const LarguraSchema = z.union([z.literal(1), z.literal(2)]);
export type Largura = z.infer<typeof LarguraSchema>;

export const FaixaCorSchema = z.enum(["azul", "verde"]);
export type FaixaCor = z.infer<typeof FaixaCorSchema>;

// ---- Tabela (estrutura interna usada dentro do bloco "tabela") ----
// Linha de seção ocupa a tabela inteira (colspan) e tem 1 célula;
// linha de dados tem o mesmo número de células do cabeçalho.
// `destaque` pinta a linha de dados como faixa escura (ex.: "2/4 - COM SUÍTE").

export const BlocoTabelaLinhaSchema = z.object({
  secao: z.boolean(),
  celulas: z.array(z.string()).min(1).max(6),
  destaque: z.boolean().optional(),
});
export type BlocoTabelaLinha = z.infer<typeof BlocoTabelaLinhaSchema>;

export const BlocoTabelaSchema = z.object({
  cabecalho: z.array(z.string()).min(1).max(6),
  linhas: z.array(BlocoTabelaLinhaSchema),
});
export type BlocoTabela = z.infer<typeof BlocoTabelaSchema>;

export const BlocoSchema = z
  .object({
    id: z.string().min(1),
    tipo: z.string().min(1),
    ativo: z.boolean(),
    largura: LarguraSchema,
    // Título aceita markup de cor ([[azul]] / ((vermelho)))
    titulo: z.string(),
    tituloCor: TituloCorSchema,
    // Uma linha = um chip; aceita markup de cor
    texto: z.string(),
    // Quando presente, o bloco é uma tabela e `texto` não é usado.
    tabela: BlocoTabelaSchema.optional(),
  })
  .superRefine((bloco, ctx) => {
    if (!bloco.tabela) return;
    const colunas = bloco.tabela.cabecalho.length;
    bloco.tabela.linhas.forEach((linha, i) => {
      if (linha.secao && linha.destaque) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tabela", "linhas", i],
          message: "Linha de seção não pode ser de destaque",
        });
        return;
      }
      const esperado = linha.secao ? 1 : colunas;
      if (linha.celulas.length !== esperado) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tabela", "linhas", i, "celulas"],
          message: linha.secao
            ? "Linha de seção deve ter 1 célula"
            : `Linha de dados deve ter ${colunas} células`,
        });
      }
    });
  });
export type Bloco = z.infer<typeof BlocoSchema>;

// ---- Tabela (entidade separada, não é bloco) ----
// Cabeçalho (2–6 colunas), linhas de seção (colspan) e dados.
// `destaque` pinta a linha de dados como faixa escura (ex.: "2/4 - COM SUÍTE").
export const TabelaSchema = z.object({
  id: z.string().min(1),
  ativo: z.boolean(),
  largura: LarguraSchema,
  // Título aceita markup de cor ([[azul]] / ((vermelho)))
  titulo: z.string(),
  tituloCor: TituloCorSchema,
  // Estrutura da tabela
  tabela: z.object({
    cabecalho: z.array(z.string()).min(1).max(6),
    linhas: z.array(z.object({
      secao: z.boolean(),
      celulas: z.array(z.string()).min(1).max(6),
      destaque: z.boolean().optional(),
    })).superRefine((linhas, ctx) => {
      // validação cruzada: precisa do cabecalho para saber nº de colunas
      // mas aqui não temos acesso ao cabecalho; validação real acontece no nível do Cartao/Pagina
    }),
  }),
});
export type Tabela = z.infer<typeof TabelaSchema>;

export const CartaoSchema = z.object({
  id: z.string().min(1),
  empreendimentoId: z.string().nullable(),
  // Faixa do cartão (azul ou verde) e onde ela fica em relação à logo.
  // Só aparece quando `faixa` tem texto.
  faixa: z.string().optional(),
  faixaCor: FaixaCorSchema.optional(),
  faixaPosicao: z.enum(["acima-logo", "abaixo-logo"]).optional(),
  // false esconde a logo (páginas com várias tabelas mostram a logo uma vez)
  mostrarLogo: z.boolean().optional(),
  // Faixa verde: 1 ou 2 linhas; vazio = sem faixa
  titulo: z.array(z.string()).min(1).max(2),
  blocos: z.array(BlocoSchema),
  // Tabelas (entidade separada dos blocos)
  tabelas: z.array(TabelaSchema).optional(),
});
export type Cartao = z.infer<typeof CartaoSchema>;

export const PaginaSchema = z.object({
  id: z.string().min(1),
  modelo: z.string().min(1),
  // Faixa da página (azul ou verde); vazio = sem faixa
  faixa: z.string().optional(),
  faixaCor: FaixaCorSchema.optional(),
  cartoes: z.array(CartaoSchema),
});
export type Pagina = z.infer<typeof PaginaSchema>;

export const CampanhaSchema = z.object({
  versao: z.literal(1),
  id: z.string().min(1),
  // Usuário que criou a campanha (só ele pode editar/excluir)
  usuarioId: z.string().min(1),
  titulo: z.string(),
  mes: MesSchema,
  rodape: z.string().optional(),
  paginas: z.array(PaginaSchema),
  // Sobe a cada gravação (controle de concorrência otimista)
  revisao: z.number().int().positive(),
  atualizadoEm: z.string(),
});
export type Campanha = z.infer<typeof CampanhaSchema>;

// ---- Catálogos (JSON editado à mão pelo dono) ----

export const ModeloSchema = z.object({
  id: z.string().min(1),
  nome: z.string(),
  minCartoes: z.number().int().positive(),
  maxCartoes: z.number().int().positive(),
  faixaPorCartao: z.boolean(),
  // Escala das fontes dos blocos (1 = tamanho original do PDF)
  escala: z.number().positive(),
  alturaLogo: z.number().positive(),
  paddingCartao: z.number(),
  espacoBlocos: z.number(),
  // Onde fica um bloco de largura 1 que sobra sozinho na linha
  celulaSolitaria: z.enum(["esquerda", "centro"]).default("esquerda"),
  // Modelos de tabela: sem a caixa cinza/borda azul do cartão
  semCaixa: z.boolean().optional(),
  // Largura do cartão em px (padrão 738); tabelas largas usam ~830
  larguraCartao: z.number().positive().optional(),
  // Faixa do cartão em tamanho reduzido (padrão true). Os modelos de tabela
  // usam a faixa grande, como no PDF de valores.
  faixaMini: z.boolean().optional(),
});
export type Modelo = z.infer<typeof ModeloSchema>;

export const TipoBlocoSchema = z.object({
  id: z.string().min(1),
  nome: z.string(),
  tituloPadrao: z.string(),
  tituloCor: TituloCorSchema,
  largura: LarguraSchema,
});
export type TipoBloco = z.infer<typeof TipoBlocoSchema>;

export const TituloProntoSchema = z.object({
  texto: z.string(),
  cor: TituloCorSchema,
});
export type TituloPronto = z.infer<typeof TituloProntoSchema>;

export const EmpreendimentoSchema = z.object({
  id: z.string().min(1),
  // Nome (faixa verde): 1 ou 2 linhas
  nome: z.array(z.string()).min(1).max(2),
  faixa: z.string(),
  // Arquivo em data/logos/; null = marcador tracejado
  logo: z.string().nullable(),
});
export type Empreendimento = z.infer<typeof EmpreendimentoSchema>;

export type Catalogos = {
  modelos: Modelo[];
  tiposBloco: TipoBloco[];
  titulos: TituloPronto[];
  empreendimentos: Empreendimento[];
};

export function parseCampanha(data: unknown): Campanha {
  return CampanhaSchema.parse(data);
}

/** Valida e devolve mensagem de erro amigável, ou null se ok. */
export function erroCampanha(data: unknown): string | null {
  const r = CampanhaSchema.safeParse(data);
  return r.success ? null : r.error.message;
}

// ---- Autenticação (v2) ----

export const PapelSchema = z.enum(["admin", "editor", "leitor"]);
export type Papel = z.infer<typeof PapelSchema>;

export const UsuarioSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().email(),
  senhaHash: z.string().min(1),
  papel: PapelSchema,
  ativo: z.boolean(),
  criadoEm: z.string(),
});
export type Usuario = z.infer<typeof UsuarioSchema>;

export const SessaoSchema = z.object({
  id: z.string().min(1),
  usuarioId: z.string().min(1),
  token: z.string().min(1),
  expiraEm: z.string(),
});
export type Sessao = z.infer<typeof SessaoSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CriarUsuarioSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
  papel: PapelSchema.default("editor"),
});
export type CriarUsuarioInput = z.infer<typeof CriarUsuarioSchema>;

/** Admin liga/desliga um usuário; só isso por enquanto (sem edição de nome/papel). */
export const AlterarUsuarioSchema = z.object({
  ativo: z.boolean().optional(),
  papel: z.enum(["admin", "editor", "leitor"]).optional(),
  senha: z.string().min(6).optional(),
});
export type AlterarUsuarioInput = z.infer<typeof AlterarUsuarioSchema>;

export const UsuarioResumoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().email(),
  papel: PapelSchema,
  ativo: z.boolean(),
});
export type UsuarioResumo = z.infer<typeof UsuarioResumoSchema>;

export function usuarioParaResumo(u: Usuario): UsuarioResumo {
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel, ativo: u.ativo };
}
