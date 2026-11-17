// Autenticação (AGENTS.md §6, v2).
// Sessão via token em Map em memória + cookie HTTP-only.
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

export type Autenticacao = {
  /** Cadastra um novo usuário (a regra de quem pode chamar fica na rota). */
  cadastrarUsuario: (input: z.infer<typeof CriarUsuarioSchema>) => UsuarioResumo;
  /** Lista todos os usuários (sem senha). */
  listarUsuarios: () => UsuarioResumo[];
  /** Quantidade de usuários cadastrados (para permitir o primeiro). */
  totalUsuarios: () => number;
  /** Faz login e retorna o usuário + token de sessão. */
  login: (input: z.infer<typeof LoginSchema>) => { usuario: UsuarioResumo; token: string };
  /** Encerra a sessão pelo token. */
  logout: (token: string) => void;
  /** Valida o token de sessão e retorna o usuário, ou null se inválido/expirado. */
  validarSessao: (token: string) => Usuario | null;
  /** Resumo do usuário para expor ao cliente (sem senha). */
  usuarioResumo: (u: Usuario) => UsuarioResumo;
};

// Sessões em memória: token -> { usuarioId, expiraEm }
const sessoes = new Map<string, { usuarioId: string; expiraEm: string }>();

export function criarAutenticacao(raizDados?: string): Autenticacao {
  // raizDados propaga o diretório de dados (isolamento nos testes)
  const db = getDb(raizDados);

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

  const login = (input: z.infer<typeof LoginSchema>) => {
    const dados = LoginSchema.parse(input);

    const linha = db
      .prepare("SELECT * FROM usuarios WHERE email = ?")
      .get(dados.email) as
      | { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }
      | undefined;

    if (!linha || !linha.ativo) {
      const err: any = new Error("email ou senha inválidos");
      err.status = 401;
      throw err;
    }

    const senhaValida = compararSenha(dados.senha, linha.senha_hash);
    if (!senhaValida) {
      const err: any = new Error("email ou senha inválidos");
      err.status = 401;
      throw err;
    }

    const usuario: Usuario = {
      id: linha.id,
      nome: linha.nome,
      email: linha.email,
      senhaHash: linha.senha_hash,
      papel: linha.papel as Papel,
      ativo: !!linha.ativo,
      criadoEm: linha.criado_em,
    };

    const token = gerarToken();
    const expiraEm = new Date(Date.now() + SESSAO_DURACAO_MS).toISOString();
    sessoes.set(token, { usuarioId: usuario.id, expiraEm });

    return { usuario: usuarioParaResumo(usuario), token };
  };

  const logout = (token: string): void => {
    sessoes.delete(token);
  };

  const validarSessao = (token: string): Usuario | null => {
    const sessao = sessoes.get(token);
    if (!sessao) return null;
    if (new Date(sessao.expiraEm) <= new Date()) {
      sessoes.delete(token);
      return null;
    }

    const u = db
      .prepare("SELECT * FROM usuarios WHERE id = ? AND ativo = 1")
      .get(sessao.usuarioId) as
      | { id: string; nome: string; email: string; senha_hash: string; papel: string; ativo: number; criado_em: string }
      | undefined;

    if (!u) return null;

    return linhaParaUsuario(u);
  };

  const usuarioResumo = (u: Usuario): UsuarioResumo => usuarioParaResumo(u);

  return { cadastrarUsuario, listarUsuarios, totalUsuarios, login, logout, validarSessao, usuarioResumo };
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
