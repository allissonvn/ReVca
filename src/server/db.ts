// Banco de dados SQLite (AGENTS.md §2, v2).
// Arquivo único em data/vca.db, sem servidor separado.
// Tabelas: usuarios e sessoes.
// Usa better-sqlite3 carregado via createRequire do banner do esbuild
// porque é um módulo CJS com binário nativo que precisa de __dirname (não funciona com import ESM estático).
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { acharRaiz } from "../shared/raiz.js";
import type { Papel } from "../shared/schema.js";

// createRequire injetado pelo banner do esbuild
const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");

export type Usuario = {
  id: string;
  nome: string;
  email: string;
  senhaHash: string;
  papel: Papel;
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
        papel TEXT NOT NULL CHECK (papel IN ('admin', 'editor', 'leitor')),
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
    migrarPapeis(dbInstance);
    db = dbInstance;
    dbs.set(chave, db as DbInstance);
  }
  return db!;
}

/** Migração v2: adiciona o papel 'admin'. SQLite não altera CHECK em cima do tempo,
 *  então recriamos a tabela quando o CREATE existente não menciona 'admin'.
 *  O primeiro usuário cadastrado (dono do sistema) é promovido a admin. */
function migrarPapeis(db: DbInstance): void {
  const linha = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'usuarios'")
    .get() as { sql: string } | undefined;
  if (!linha || linha.sql.includes("'admin'")) return;
  // foreign_keys fica desligado por padrão no better-sqlite3: a tabela sessoes
  // (referências antigas) sobrevive ao DROP; sessões válidas são em memória.
  db.exec(`
    BEGIN;
    CREATE TABLE usuarios_nova (
      id TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      papel TEXT NOT NULL CHECK (papel IN ('admin', 'editor', 'leitor')),
      ativo INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL
    );
    INSERT INTO usuarios_nova (id, nome, email, senha_hash, papel, ativo, criado_em)
      SELECT id, nome, email, senha_hash, papel, ativo, criado_em FROM usuarios ORDER BY criado_em, id;
    DROP TABLE usuarios;
    ALTER TABLE usuarios_nova RENAME TO usuarios;
    COMMIT;
  `);
  db.exec(`UPDATE usuarios SET papel = 'admin' WHERE id = (SELECT id FROM usuarios ORDER BY criado_em, id LIMIT 1)`);
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