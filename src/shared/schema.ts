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

export const BlocoSchema = z.object({
  id: z.string().min(1),
  tipo: z.string().min(1),
  ativo: z.boolean(),
  largura: LarguraSchema,
  // Título aceita markup de cor ([[azul]] / ((vermelho)))
  titulo: z.string(),
  tituloCor: TituloCorSchema,
  // Uma linha = um chip; aceita markup de cor
  texto: z.string(),
});
export type Bloco = z.infer<typeof BlocoSchema>;

export const CartaoSchema = z.object({
  id: z.string().min(1),
  empreendimentoId: z.string().nullable(),
  // Faixa azul do cartão (só nos modelos com faixaPorCartao)
  faixa: z.string().optional(),
  // Faixa verde: 1 ou 2 linhas
  titulo: z.array(z.string()).min(1).max(2),
  blocos: z.array(BlocoSchema),
});
export type Cartao = z.infer<typeof CartaoSchema>;

export const PaginaSchema = z.object({
  id: z.string().min(1),
  modelo: z.string().min(1),
  // Faixa azul da página (nos modelos com faixaPorCartao não é usada)
  faixa: z.string().optional(),
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
