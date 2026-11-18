// Gestão de usuários (só admin): lista quem tem conta, cadastra novos
// editor/leitor e ativa/desativa. Novo admin só nasce pelo primeiro acesso
// (bootstrap). O leitor visualiza tudo, mas o servidor bloqueia a escrita.
// UI: design system REVCA — Phase 2.
// Header com Mark, "← Campanhas", título. Duas colunas:
// esquerda: Section "Cadastrados (N)" com linhas (avatar, nome + "(você)",
// e-mail muted, badge de papel, ● Ativo, Redefinir senha com chave,
// Desativar com power em danger); direita 360px: Section "Novo usuário"
// (Nome, E-mail, Senha ≥ 6, dois radio cards Leitor/Editor, "Cadastrar
// usuário" com UserPlus). Campos não ocupam a largura total da página.
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { ApiErro, criarUsuario, definirUsuarioAtivo, listarUsuarios } from "../api.js";
import { UsuarioResumo } from "../../shared/schema.js";
import { estado, notificar, useEstado } from "../store.js";
import { Mark } from "../ui/Mark.js";
import { Button } from "../ui/Button.js";
import { Field } from "../ui/Field.js";
import { Badge } from "../ui/Badge.js";
import { Avatar } from "../ui/Avatar.js";
import { ConfirmDialog } from "../ui/ConfirmDialog.js";
import { Section } from "../ui/Card.js";
import {
  Shield,
  KeyRound,
  Power,
  UserPlus,
  ArrowLeft,
} from "lucide-react";

export function Usuarios(): JSX.Element {
  useEstado();
  const [usuarios, setUsuarios] = useState<UsuarioResumo[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);
  const [excluindoNome, setExcluindoNome] = useState("");

  // Estado local do formulário (declarado antes de qualquer uso)
  const [form, setForm] = useState<{
    nome: string;
    email: string;
    senha: string;
    papel: "editor" | "leitor";
    enviando: boolean;
  }>({ nome: "", email: "", senha: "", papel: "leitor", enviando: false });

  useEffect(() => {
    void (async () => {
      try {
        setUsuarios(await listarUsuarios());
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  async function alternarAtivo(u: UsuarioResumo): Promise<void> {
    setErro(""); setAviso("");
    try {
      const atualizado = await definirUsuarioAtivo(u.id, !u.ativo);
      setUsuarios((atual) => (atual ?? []).map((x) => (x.id === atualizado.id ? atualizado : x)));
      setAviso(`${atualizado.nome} ${atualizado.ativo ? "ativado" : "desativado"}.`);
      notificar();
    } catch (e) {
      setErro(e instanceof ApiErro ? e.message : "Não foi possível alterar o usuário.");
    }
  }

  async function criarNovo({
    nome,
    email,
    senha,
    papel,
  }: {
    nome: string;
    email: string;
    senha: string;
    papel: "editor" | "leitor";
  }): Promise<void> {
    setErro("");
    try {
      const novo = await criarUsuario({ nome: nome.trim(), email: email.trim(), senha, papel });
      setUsuarios((atual) => [...(atual ?? []), novo]);
      setAviso(`Usuário ${novo.nome} cadastrado como ${novo.papel}.`);
    } catch (e2) {
      if (e2 instanceof ApiErro && e2.status === 409) setErro("Este e-mail já está cadastrado.");
      else if (e2 instanceof ApiErro && e2.status === 422) setErro("Confira os campos: e-mail válido e senha de 6 caracteres ou mais.");
      else if (e2 instanceof ApiErro && e2.status === 403) setErro("Somente o administrador pode cadastrar usuários.");
      else setErro("Não foi possível cadastrar. Tente novamente.");
    }
  }

  const usuarioLogado = estado.usuario;
  const iniciais = usuarioLogado?.nome
    ?.split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  async function enviarForm(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (form.enviando) return;
    setForm((a) => ({ ...a, enviando: true }));
    try {
      await criarNovo({
        nome: form.nome,
        email: form.email,
        senha: form.senha,
        papel: form.papel,
      });
      setForm({ nome: "", email: "", senha: "", papel: "leitor", enviando: false });
    } finally {
      setForm((a) => ({ ...a, enviando: false }));
    }
  }

  return (
    <div className="usu-tela">
      <header className="topbar">
        <button
          className="btn fantasma"
          onClick={() => { window.location.href = "/"; }}
          title="Voltar às campanhas"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          ← Campanhas
        </button>
        <Mark tamanho={32} aria-label="REVCA — Usuários" />
        <h1>Usuários</h1>
      </header>

      <main className="usu-conteudo">
        {erro !== "" && <p className="dica erro" role="alert">Erro: {erro}</p>}
        {aviso !== "" && <p className="dica ok" role="status">{aviso}</p>}

        <div className="usu-grid">
          {/* Coluna esquerda: cadastrados */}
          <Section>
            <div className="usu-cabecalho">
              <h2>Cadastrados ({usuarios?.length ?? 0})</h2>
            </div>
            {usuarios === null && <p className="dica">Carregando…</p>}
            {usuarios !== null && usuarios.length === 0 && (
              <p className="dica">Nenhum usuário cadastrado ainda.</p>
            )}
            {usuarios !== null && usuarios.length > 0 && (
              <div className="usu-lista">
                {usuarios.map((u) => {
                  const proprio = u.id === estado.usuario?.id;
                  return (
                    <div key={u.id} className={`usu-linha ${u.ativo ? "" : "usu-inativo"}`}>
                      <div className="usu-info">
                        <Avatar
                          iniciais={u.nome.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2)}
                          aria-label={u.nome}
                        />
                        <div className="usu-dados">
                          <div className="usu-nome">
                            {u.nome}{proprio && <span className="usu-proprio"> (você)</span>}
                          </div>
                          <div className="usu-email">{u.email}</div>
                        </div>
                        <Badge variante={u.papel === "admin" ? "admin" : u.papel === "editor" ? "editor" : "leitor"}>
                          {u.papel.charAt(0).toUpperCase() + u.papel.slice(1)}
                        </Badge>
                        <div className="usu-status">
                          <span className={`usu-pontinho ${u.ativo ? "ativo" : "inativo"}`} aria-hidden="true"></span>
                          {u.ativo ? "● Ativo" : "● Inativo"}
                        </div>
                      </div>
                      <div className="usu-acoes">
                        {!proprio && (
                          <Button
                            variant="ghost"
                            icon="KeyRound"
                            title="Redefinir senha deste usuário"
                            onClick={() => {
                              // Phase 5: chama POST /api/auth/usuarios/:id/redefinir-senha
                              setAviso("Redefinição de senha será liberada na próxima etapa.");
                            }}
                          />
                        )}
                        {!proprio && (
                          <Button
                            variant="ghost"
                            icon="Power"
                            cor="danger"
                            title={u.ativo ? "Desativar acesso deste usuário" : "Reativar acesso deste usuário"}
                            onClick={() => {
                              if (!excluindoId || excluindoId !== u.id) {
                                setExcluindoId(u.id);
                                setExcluindoNome(u.nome);
                              } else {
                                void alternarAtivo(u);
                                setExcluindoId(null);
                                setExcluindoNome("");
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Coluna direita: novo usuário */}
          <Section>
            <h2>Novo usuário</h2>
            <p className="dica">O leitor visualiza todas as campanhas; o editor também cria e edita.</p>
            <form className="usu-form" onSubmit={(e) => void enviarForm(e)} aria-label="Cadastrar novo usuário">
              <Field
                label="Nome"
                name="nome"
                id="usu-nome"
                value={form.nome}
                onChange={(e) => setForm((a) => ({ ...a, nome: e.target.value }))}
                required
              />
              <Field
                label="E-mail"
                type="email"
                name="email"
                id="usu-email"
                value={form.email}
                onChange={(e) => setForm((a) => ({ ...a, email: e.target.value }))}
                required
                autoComplete="off"
              />
              <Field
                label="Senha (mínimo 6 caracteres)"
                type="password"
                name="senha"
                id="usu-senha"
                value={form.senha}
                onChange={(e) => setForm((a) => ({ ...a, senha: e.target.value }))}
                required
                autoComplete="new-password"
              />
              <fieldset className="usu-radio">
                <legend>Papel</legend>
                <div className="usu-radio-opcoes">
                  <label className="usu-radio-card">
                    <input
                      type="radio"
                      name="papel"
                      value="leitor"
                      checked={form.papel === "leitor"}
                      onChange={() => setForm((a) => ({ ...a, papel: "leitor" }))}
                    />
                    <Shield size={18} strokeWidth={2} aria-hidden="true" />
                    <span>Leitor</span>
                    <span className="usu-radio-desc">Só visualiza e exporta.</span>
                  </label>
                  <label className="usu-radio-card">
                    <input
                      type="radio"
                      name="papel"
                      value="editor"
                      checked={form.papel === "editor"}
                      onChange={() => setForm((a) => ({ ...a, papel: "editor" }))}
                    />
                    <Shield size={18} strokeWidth={2} aria-hidden="true" />
                    <span>Editor</span>
                    <span className="usu-radio-desc">Cria e edita campanhas.</span>
                  </label>
                </div>
              </fieldset>
              {erro !== "" && <p className="dica erro" role="alert">{erro}</p>}
              <Button variant="primary" type="submit" disabled={form.enviando}>
                {form.enviando ? "Cadastrando…" : "Cadastrar usuário"} <UserPlus size={16} strokeWidth={2} />
              </Button>
            </form>
          </Section>
        </div>

        {excluindoId && (
          <ConfirmDialog
            aberto={true}
            titulo="Desativar usuário?"
            mensagem={`Tem certeza que deseja desativar “${excluindoNome}”?`}
            confirmarRotulo="Desativar"
            cancelarRotulo="Cancelar"
            aoConfirmar={() => {
              const u = (usuarios ?? []).find((x) => x.id === excluindoId);
              if (u) void alternarAtivo(u);
              setExcluindoId(null);
              setExcluindoNome("");
            }}
            aoCancelar={() => { setExcluindoId(null); setExcluindoNome(""); }}
          />
        )}
      </main>
    </div>
  );
}
