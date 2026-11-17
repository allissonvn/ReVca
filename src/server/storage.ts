// Persistência em arquivos JSON (AGENTS.md §6): escrita atômica, histórico com
// as 20 versões mais recentes, lixeira no lugar de apagar, ids sanitizados.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, unlinkSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { CampanhaSchema, Campanha } from "../shared/schema.js";

const MAX_HISTORICO = 20;

export class IdInvalidoError extends Error {}
export class NaoEncontradoError extends Error {}
export class ConflitoRevisaoError extends Error {
  constructor(public campanhaAtual: Campanha) {
    super("revisão desatualizada");
  }
}

/** Só letras minúsculas, números, hífen e sublinhado (sem pontos nem barras). */
export function sanitizarId(id: string): string {
  if (!/^[a-z0-9_-]+$/.test(id)) throw new IdInvalidoError(`id inválido: ${id}`);
  return id;
}

export type Storage = {
  campanhasDir: string;
  /** Lista os resumos de todas as campanhas (qualquer papel autenticado visualiza). */
  listar: () => { id: string; titulo: string; mes: string; atualizadoEm: string; nPaginas: number }[];
  ler: (id: string) => Campanha;
  criar: (campanha: Campanha) => Campanha;
  gravar: (campanha: Campanha) => Campanha;
  duplicarParaLixeira: (id: string) => void;
  historicoCount: (id: string) => number;
  /** Verifica se o papel pode criar/editar/excluir campanhas (admin e editor). */
  podeEditar: (papel: string | undefined) => boolean;
};

export function criarStorage(raizDados: string): Storage {
  const campanhasDir = join(raizDados, "campanhas");
  const historicoDir = join(raizDados, "historico");
  const lixeiraDir = join(raizDados, "lixeira");
  mkdirSync(campanhasDir, { recursive: true });

  const caminho = (id: string) => join(campanhasDir, `${sanitizarId(id)}.json`);
  const caminhoHistorico = (id: string) => join(historicoDir, sanitizarId(id));

  // Escrita atômica: arquivo temporário no mesmo diretório + rename
  const escreverAtomico = (destino: string, conteudo: string) => {
    mkdirSync(dirname(destino), { recursive: true });
    const tmp = `${destino}.tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    writeFileSync(tmp, conteudo, "utf8");
    renameSync(tmp, destino);
  };

  const copiarParaHistorico = (id: string, atual: Campanha) => {
    const dir = caminhoHistorico(id);
    mkdirSync(dir, { recursive: true });
    const destino = join(dir, `rev-${atual.revisao}-${Date.now()}.json`);
    escreverAtomico(destino, JSON.stringify(atual, null, 2));
    // mantém só as 20 cópias mais recentes
    const arquivos = readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
      .sort((a, b) => b.m - a.m);
    for (const antigo of arquivos.slice(MAX_HISTORICO)) unlinkSync(join(dir, antigo.f));
  };

  const ler = (id: string): Campanha => {
    const c = caminho(id);
    if (!existsSync(c)) throw new NaoEncontradoError(`campanha não encontrada: ${id}`);
    return CampanhaSchema.parse(JSON.parse(readFileSync(c, "utf8")));
  };

  const storage: Storage = {
    campanhasDir,
    listar: () => {
      return readdirSync(campanhasDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          try {
            const c = CampanhaSchema.parse(JSON.parse(readFileSync(join(campanhasDir, f), "utf8")));
            return { id: c.id, titulo: c.titulo, mes: c.mes, atualizadoEm: c.atualizadoEm, nPaginas: c.paginas.length };
          } catch {
            return null; // arquivo corrompido não derruba a listagem
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
    },
    ler,
    criar: (nova) => {
      CampanhaSchema.parse(nova);
      sanitizarId(nova.id);
      if (existsSync(caminho(nova.id))) throw new ConflitoRevisaoError(ler(nova.id)); // já existe
      escreverAtomico(caminho(nova.id), JSON.stringify(nova, null, 2));
      return nova;
    },
    // Concorrência: exige a revisão que o cliente viu; sobe a revisão ao gravar
    gravar: (entrada) => {
      CampanhaSchema.parse(entrada);
      const atual = ler(entrada.id);
      if (atual.revisao !== entrada.revisao) throw new ConflitoRevisaoError(atual);
      copiarParaHistorico(entrada.id, atual);
      const nova: Campanha = {
        ...entrada,
        revisao: atual.revisao + 1,
        atualizadoEm: new Date().toISOString(),
      };
      escreverAtomico(caminho(entrada.id), JSON.stringify(nova, null, 2));
      return nova;
    },
    // DELETE move para a lixeira (não apaga)
    duplicarParaLixeira: (id) => {
      const origem = caminho(id);
      if (!existsSync(origem)) throw new NaoEncontradoError(`campanha não encontrada: ${id}`);
      mkdirSync(lixeiraDir, { recursive: true });
      renameSync(origem, join(lixeiraDir, `${sanitizarId(id)}-${Date.now()}.json`));
    },
    historicoCount: (id) => {
      const dir = caminhoHistorico(id);
      if (!existsSync(dir)) return 0;
      return readdirSync(dir).filter((f) => f.endsWith(".json")).length;
    },
    podeEditar: (papel) => {
      // admin e editor editam qualquer campanha; leitor não edita (a rota
      // de escrita já é bloqueada pelo requerEditor antes de chegar aqui)
      return papel === "editor" || papel === "admin";
    },
  };
  return storage;
}
