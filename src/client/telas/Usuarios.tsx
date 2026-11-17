import type { JSX } from "react";
// Gestão de usuários (só admin): lista quem tem conta, cadastra novos
// editor/leitor e ativa/desativa. Novo admin só nasce pelo primeiro acesso
// (bootstrap). O leitor visualiza tudo, mas o servidor bloqueia a escrita.
import { useEffect, useState } from "react";
import { ApiErro, criarUsuario, definirUsuarioAtivo, listarUsuarios } from "../api.js";
import { UsuarioResumo } from "../../shared/schema.js";
import { estado, notificar, useEstado } from "../store.js";

export function Usuarios(): JSX.Element {
  useEstado();
  const [usuarios, setUsuarios] = useState<UsuarioResumo[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

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

  return (
    <div className="home">
      <header className="topbar">
        <button className="btn fantasma" onClick={() => { window.location.href = "/"; }} title="Voltar às campanhas">← Campanhas</button>
        <h1>Usuários</h1>
      </header>

      <main className="home-conteudo usu-tela">
        {erro !== "" && <p className="dica erro" role="alert">Erro: {erro}</p>}
        {aviso !== "" && <p className="dica ok" role="status">{aviso}</p>}

        <FormularioNovo aoCriado={(novo) => {
          setUsuarios((atual) => [...(atual ?? []), novo]);
          setAviso(`Usuário ${novo.nome} cadastrado como ${novo.papel}.`);
        }} />

        <section aria-label="Usuários cadastrados">
          <h2>Cadastrados</h2>
          {usuarios === null && <p className="dica">Carregando…</p>}
          {usuarios !== null && (
            <table className="usu-tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Papel</th>
                  <th>Situação</th>
                  <th aria-label="Ações"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map((u) => {
                  const proprio = u.id === estado.usuario?.id;
                  return (
                    <tr key={u.id} className={u.ativo ? "" : "inativo"}>
                      <td>{u.nome}{proprio && <small> (você)</small>}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge-papel ${u.papel}`}>{u.papel}</span></td>
                      <td><span className={`badge-situacao ${u.ativo ? "ativo" : "inativo"}`}>{u.ativo ? "Ativo" : "Inativo"}</span></td>
                      <td className="usu-acoes">
                        <button
                          className={`btn pequeno ${u.ativo ? "perigo" : "primario"}`}
                          disabled={proprio}
                          title={proprio ? "Você não pode desativar a si mesmo" : u.ativo ? "Desativar acesso deste usuário" : "Reativar acesso deste usuário"}
                          onClick={() => void alternarAtivo(u)}
                        >
                          {u.ativo ? "Desativar" : "Ativar"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

/** Formulário de cadastro: papel limitado a editor/leitor — novo admin só
 *  pelo primeiro acesso ao sistema (bootstrap), decisão em DECISOES.md. */
function FormularioNovo({ aoCriado }: { aoCriado: (u: UsuarioResumo) => void }): JSX.Element {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<"editor" | "leitor">("leitor");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    try {
      const novo = await criarUsuario({ nome: nome.trim(), email: email.trim(), senha, papel });
      aoCriado(novo);
      setNome(""); setEmail(""); setSenha(""); setPapel("leitor");
    } catch (e2) {
      if (e2 instanceof ApiErro && e2.status === 409) setErro("Este e-mail já está cadastrado.");
      else if (e2 instanceof ApiErro && e2.status === 422) setErro("Confira os campos: e-mail válido e senha de 6 caracteres ou mais.");
      else if (e2 instanceof ApiErro && e2.status === 403) setErro("Somente o administrador pode cadastrar usuários.");
      else setErro("Não foi possível cadastrar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="usu-form" onSubmit={(e) => void enviar(e)} aria-label="Cadastrar novo usuário">
      <h2>Novo usuário</h2>
      <p className="dica">O leitor visualiza todas as campanhas; o editor também cria e edita.</p>
      <div className="usu-campos">
        <label htmlFor="usu-nome">Nome</label>
        <input id="usu-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </div>
      <div className="usu-campos">
        <label htmlFor="usu-email">E-mail</label>
        <input id="usu-email" type="email" autoComplete="off" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="usu-campos">
        <label htmlFor="usu-senha">Senha (mínimo 6 caracteres)</label>
        <input id="usu-senha" type="password" autoComplete="new-password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
      </div>
      <div className="usu-campos">
        <label htmlFor="usu-papel">Papel</label>
        <select id="usu-papel" value={papel} onChange={(e) => setPapel(e.target.value as "editor" | "leitor")}>
          <option value="leitor">Leitor — só visualiza</option>
          <option value="editor">Editor — cria e edita campanhas</option>
        </select>
      </div>
      {erro !== "" && <p className="dica erro" role="alert">{erro}</p>}
      <button className="btn primario" type="submit" disabled={enviando}>
        {enviando ? "Cadastrando…" : "Cadastrar usuário"}
      </button>
    </form>
  );
}
