// Autenticação (AGENTS.md §6, v2).
// Sessão persistida na tabela `sessoes` do SQLite (sobrevive a reinícios do
// servidor); o token só trafega no cookie HTTP-only.
// Papéis: admin (gere usuários + tudo do editor), editor (cria/edita/exclui
// campanhas) e leitor (apenas visualiza).
import { randomBytes } from "node:crypto";
import { compareSync, genSaltSync, hashSync } from "bcryptjs";
import { z } from "zod";
import { getDb, Usuario } from "./db.js";
import {
  CriarUsuarioSchema,
  LoginSchema,
  Papel,
  UsuarioResumo,
  UsuarioResumoSchema,
  UsuarioSchema,
  usuarioParaResumo,
} from "../shared/schema.js";

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
// freio a brute-force: 5 erros por e-mail bloqueiam 15 minutos
const LIMITE_TENTATIVAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;

export type Autenticacao = {
  /** Cadastra um novo usuário (a regra de quem pode chamar fica na rota). */
  cadastrarUsuario: (input: z.infer<typeof CriarUsuarioSchema>) => UsuarioResumo;
  /** Lista todos os usuários (sem senha). */
  listarUsuarios: () => UsuarioResumo[];
  /** Ativa/desativa um usuário. Retorna o resumo atualizado ou null se não existir. */
  definirAtivo: (id: string, ativo: boolean) => UsuarioResumo | null;
  /** Quantidade de usuários cadastrados (para permitir o primeiro). */
  totalUsuarios: () => number;
  /** Faz login e retorna o usuário + token (o token vai só no cookie, na rota). */
  login: (input: z.infer<typeof LoginSchema>) => { usuario: UsuarioResumo; token: string };
  /** Encerra a sessão pelo token (apaga do banco). */
  logout: (token: string) => void;
  /** Valida o token de sessão e retorna o usuário, ou null se inválido/expirado. */
  validarSessao: (token: string) => Usuario | null;
  /** Resumo do usuário para expor ao cliente (sem senha). */
  usuarioResumo: (u: Usuario) => UsuarioResumo;
};

export function criarAutenticacao(raizDados?: string): Autenticacao {
  // raizDados propaga o diretório de dados (isolamento nos testes)
  const db = getDb(raizDados);
  // tentativas de login falhas por e-mail: email -> { n, ate } (em memória; zera ao reiniciar, o que é aceitável)
  const tentativas = new Map<string, { n: number; ate: number }>();

  const cadastrarUsuario = (input: z.infer<typeof CriarUsuarioSchema>): UsuarioResumo => {
    const dados = CriarUsuarioSchema.parse(input);

    const existente = db
      .prepare("SELECT id FROM usuarios WHERE email = ?")
      .get(dados.email) as { id: string } | undefined;
    if (existente) {
      const err: any = new Error("e-mail já cadastrado");
      err.status = 409;
      throw err;
    }

    const senhaHash = hashSenha(dados.senha);
    const id = gerarId();
    const agora = new Date().toISOString();

    const stmt = db.prepare(
      `INSERT INTO usuarios (id, nome, email, senha_hash, papel, ativo, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    stmt.run(id, dados.nome, dados.email, senhaHash, dados.papel, 1, agora);

    const usuario: Usuario = {
      id,
      nome: dados.nome,
      email: dados.email,
      senhaHash,
      papel: dados.papel,
      ativo: true,
      criadoEm: agora,
    };
    return usuarioParaResumo(usuario);
  };

  const listarUsuarios = (): UsuarioResumo[] => {
    const linhas = db
      .prepare("SELECT * FROM usuarios ORDER BY criado_em, id")
      .all() as Array<{ id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }>;
    return linhas.map((linha) => usuarioParaResumo(linhaParaUsuario(linha)));
  };

  const totalUsuarios = (): number => {
    const linha = db.prepare("SELECT COUNT(*) AS n FROM usuarios").get() as { n: number };
    return linha.n;
  };

  const definirAtivo = (id: string, ativo: boolean): UsuarioResumo | null => {
    const r = db.prepare("UPDATE usuarios SET ativo = ? WHERE id = ?").run(ativo ? 1 : 0, id);
    if (r.changes === 0) return null;
    const linha = db
      .prepare("SELECT * FROM usuarios WHERE id = ?")
      .get(id) as
      | { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }
      | undefined;
    // sessões do usuário desativado morrem na próxima validação (validarSessao exige ativo = 1)
    return linha ? usuarioParaResumo(linhaParaUsuario(linha)) : null;
  };

  const login = (input: z.infer<typeof LoginSchema>) => {
    const dados = LoginSchema.parse(input);

    // limite de tentativas por e-mail: após LIMITE_TENTATIVAS erros, bloqueia
    // por BLOQUEIO_MS (freio simples a brute-force; app local, Map em memória basta)
    const falhas = tentativas.get(dados.email);
    if (falhas && falhas.n >= LIMITE_TENTATIVAS && Date.now() < falhas.ate) {
      const minutos = Math.ceil((falhas.ate - Date.now()) / 60000);
      const err: any = new Error(`muitas tentativas; tente novamente em ${minutos} min`);
      err.status = 429;
      throw err;
    }

    const linha = db
      .prepare("SELECT * FROM usuarios WHERE email = ?")
      .get(dados.email) as
      | { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }
      | undefined;

    const registrarFalha = (): void => {
      const atual = tentativas.get(dados.email);
      const n = atual && Date.now() < atual.ate ? atual.n + 1 : 1;
      tentativas.set(dados.email, { n, ate: Date.now() + BLOQUEIO_MS });
    };

    if (!linha || !linha.ativo) {
      registrarFalha();
      const err: any = new Error("email ou senha inválidos");
      err.status = 401;
      throw err;
    }

    const senhaValida = compararSenha(dados.senha, linha.senha_hash);
    if (!senhaValida) {
      registrarFalha();
      const err: any = new Error("email ou senha inválidos");
      err.status = 401;
      throw err;
    }

    tentativas.delete(dados.email); // acerto zera a contagem

    const usuario: Usuario = {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      senhaHash: linha.senha_hash,
      papel: linha.papel as Papel,
      ativo: !!linha.ativo,
      criadoEm: linha.criado_em,
    };

    // sessão no SQLite: sobrevive a reinícios do servidor (tabela sessoes)
    const token = gerarToken();
    const expiraEm = new Date(Date.now() + SESSAO_DURACAO_MS).toISOString();
    db.prepare("DELETE FROM sessoes WHERE expira_em <= ?").run(new Date().toISOString()); // limpeza de expiradas
    db.prepare("INSERT INTO sessoes (id, usuario_id, token, expira_em) VALUES (?, ?, ?, ?)")
      .run(gerarId(), usuario.id, token, expiraEm);

    return { usuario: usuarioParaResumo(usuario), token };
  };

  const logout = (token: string): void => {
    db.prepare("DELETE FROM sessoes WHERE token = ?").run(token);
  };

  const validarSessao = (token: string): Usuario | null => {
    const sessao = db
      .prepare("SELECT usuario_id, expira_em FROM sessoes WHERE token = ?")
      .get(token) as { usuario_id: string; expira_em: string } | undefined;
    if (!sessao) return null;
    if (new Date(sessao.expira_em) <= new Date()) {
      db.prepare("DELETE FROM sessoes WHERE token = ?").run(token);
      return null;
    }

    const u = db
      .prepare("SELECT * FROM usuarios WHERE id = ? AND ativo = 1")
      .get(sessao.usuario_id) as
      | { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }
      | undefined;

    if (!u) return null;

    return linhaParaUsuario(u);
  };

  const usuarioResumo = (u: Usuario): UsuarioResumo => usuarioParaResumo(u);

  return { cadastrarUsuario, listarUsuarios, totalUsuarios, definirAtivo, login, logout, validarSessao, usuarioResumo };
}

/** Converte a linha do SQLite em Usuario (papel validado contra o enum). */
function linhaParaUsuario(linha: { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }): Usuario {
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    senhaHash: linha.senha_hash,
    papel: linha.papel as Papel,
    ativo: !!linha.ativo,
    criadoEm: linha.criado_em,
  };
}

function gerarId(): string {
  return `${Date.now()}-${randomBytes(8).toString("hex")}`;
}

function gerarToken(): string {
  return randomBytes(32).toString("hex");
}

// ---- helpers síncronos de bcrypt ----

function hashSenha(senha: string): string {
  const salt = genSaltSync(10);
  return hashSync(senha, salt);
}

function compararSenha(senha: string, hash: string): boolean {
  return compareSync(senha, hash);
}
