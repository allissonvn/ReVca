import type { JSX } from "react";
// Gestão de usuários (só admin): lista quem tem conta e cadastra novos
// editor/leitor. Novo admin só nasce pelo primeiro acesso (bootstrap).
import { useEffect, useState } from "react";
import { ApiErro, criarUsuario, listarUsuarios } from "../api.js";
import { UsuarioResumo } from "../../shared/schema.js";
import { notificar, useEstado } from "../store.js";

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

  async function criado(novo: UsuarioResumo): Promise<void> {
    setUsuarios((atual) => [...(atual ?? []), novo]);
    setAviso(`Usuário ${novo.nome} cadastrado como ${novo.papel}.`);
    notificar();
  }

  return (
    <div className="home">
      <header className="topbar">
        <button className="btn fantasma" onClick={() => { window.location.href = "/"; }} title="Voltar às campanhas">← Campanhas</button>
        <h1>Usuários</h1>
      </header>

      <main className="home-conteudo usu-tela">
        {erro !== "" && <p className="dica erro">Erro ao carregar: {erro}</p>}
        {aviso !== "" && <p className="dica ok" role="status">{aviso}</p>}

        <FormularioNovo aoCriado={(u) => void criado(u)} />

        <section aria-label="Usuários cadastrados">
          <h2>Cadastrados</h2>
          {usuarios === null && <p className="dica">Carregando…</p>}
          {usuarios !== null && (
            <table className="usu-tabela">
              <thead>
                <tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Situação</th></tr>
              </thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome}</td>
                    <td>{u.email}</td>
                    <td><span className={`badge-papel ${u.papel}`}>{u.papel}</span></td>
                    <td>{u.ativo ? "ativo" : "desativado"}</td>
                  </tr>
                ))}
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
