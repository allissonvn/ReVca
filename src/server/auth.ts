// Autenticação (AGENTS.md §6, v2).
// Sessão via token em Map em memória + cookie HTTP-only.
// Papéis: editor (cria/edita/exclui campanhas) e leitor (apenas visualiza).
import { randomBytes } from "node:crypto";
import { compare, hash } from "bcrypt";
import { z } from "zod";
import { getDb, Usuario } from "./db.js";
import {
  CriarUsuarioSchema,
  LoginSchema,
  UsuarioResumo,
  UsuarioResumoSchema,
  UsuarioSchema,
  usuarioParaResumo,
} from "../shared/schema.js";

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

export type Autenticacao = {
  /** Cadastra um novo usuário (só sem sessão ativa — primeiro admin). */
  cadastrarUsuario: (input: z.infer<typeof CriarUsuarioSchema>) => UsuarioResumo;
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

export function criarAutenticacao(): Autenticacao {
  const db = getDb();

  const cadastrarUsuario = (input: z.infer<typeof CriarUsuarioSchema>): UsuarioResumo => {
    const dados = CriarUsuarioSchema.parse(input);

    const existente = db
      .prepare("SELECT id FROM usuarios LIMIT 1")
      .get() as { id: string } | undefined;
    if (existente) {
      const err: any = new Error("cadastro só permitido para o primeiro usuário");
      err.status = 403;
      throw err;
    }

    const senhaHash = hashSync(dados.senha);
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

    const senhaValida = compareSync(dados.senha, linha.senha_hash);
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
      papel: linha.papel as "editor" | "leitor",
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

    return {
      id: u.id,
      nome: u.nome,
      email: u.email,
      senhaHash: u.senha_hash,
      papel: u.papel as "editor" | "leitor",
      ativo: !!u.ativo,
      criadoEm: u.criado_em,
    };
  };

  const usuarioResumo = (u: Usuario): UsuarioResumo => usuarioParaResumo(u);

  return { cadastrarUsuario, login, logout, validarSessao, usuarioResumo };
}

function gerarId(): string {
  return `${Date.now()}-${randomBytes(8).toString("hex")}`;
}

function gerarToken(): string {
  return randomBytes(32).toString("hex");
}

// ---- helpers síncronos de bcrypt ----

function hashSync(senha: string): string {
  const salt = bcryptGenSaltSync(10);
  return bcryptHashSync(senha, salt);
}

function compareSync(senha: string, hash: string): boolean {
  return bcryptCompareSync(senha, hash);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bcrypt = require("bcrypt");
const bcryptGenSaltSync = (rounds: number) => bcrypt.genSaltSync(rounds);
const bcryptHashSync = (senha: string, salt: string) => bcrypt.hashSync(senha, salt);
const bcryptCompareSync = (senha: string, hash: string) => bcrypt.compareSync(senha, hash);
