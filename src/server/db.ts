// Banco de dados SQLite (AGENTS.md §2, v2).
// Arquivo único em data/vca.db, sem servidor separado.
// Tabelas: usuarios e sessoes.
// Usa better-sqlite3 carregado via createRequire do banner do esbuild
// porque é um módulo CJS com binário nativo que precisa de __dirname (não funciona com import ESM estático).
import { createRequire } from "node:module";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { acharRaiz } from "../shared/raiz.js";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papel: "editor" | "leitor";
  ativo: boolean;
  criadoEm: string;
};

export type Sessao = {
  id: string;
  usuarioId: string;
  token: string;
  expiraEm: string;
};

// Interface do banco de dados SQLite (subconjunto dos métodos usados)
export interface DbInstance {
  pragma(sql: string): void;
  exec(sql: string): void;
  prepare(sql: string): any;
  close(): void;
}

// Cache de instâncias por caminho do banco (evita singleton compartilhado entre testes)
const dbs = new Map<string, DbInstance>();

export function getDb(raizDados?: string): DbInstance {
  const raiz = raizDados ?? join(acharRaiz(), "data");
  const chave = raiz;
  let db: DbInstance | undefined = dbs.get(chave);
  if (!db) {
    mkdirSync(raiz, { recursive: true });
    const dbInstance = new Database(join(raiz, "vca.db"));
    dbInstance.pragma("journal_mode = WAL");
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha_hash TEXT NOT NULL,
        papel TEXT NOT NULL CHECK (papel IN ('editor', 'leitor')),
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expira_em TEXT NOT NULL,
        criado_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_sessoes_token ON sessoes(token);
      CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
    `);
    db = dbInstance;
    dbs.set(chave, db as DbInstance);
  }
  return db!;
}

export function fecharDb(raizDados?: string): void {
  const raiz = raizDados ?? join(acharRaiz(), "data");
  const db = dbs.get(raiz);
  if (db) {
    db.close();
    dbs.delete(raiz);
  }
}

export function fecharTodosOsDbs(): void {
  for (const [, db] of dbs) {
    db?.close();
  }
  dbs.clear();
}