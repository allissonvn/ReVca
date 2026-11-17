import type { JSX } from "react";
// Tela de login: primeiro gate do app. O servidor valida e-mail/senha e cria
// a sessão via cookie HttpOnly (AGENTS.md §6). Sem dependências novas.
import { useState } from "react";
import { login } from "../api.js";
import { estado, notificar } from "../store.js";

export function Login({ aoEntrar }: { aoEntrar: () => void }): JSX.Element {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (enviando) return;
    setErro("");
    setEnviando(true);
    try {
      const { usuario } = await login({ email: email.trim(), senha });
      estado.usuario = usuario;
      notificar(); // re-render do App já mostra o app logado
      aoEntrar();
    } catch {
      // 401 ou qualquer falha: mensagem única, sem revelar detalhes
      setErro("E-mail ou senha inválidos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-caixa" onSubmit={(e) => void enviar(e)} aria-label="Entrar no editor">
        <div className="topbar-marca">
          <span className="marca-aba" aria-hidden>Parcelamento</span>
          <h1>Matriz VCA</h1>
        </div>
        <p className="dica">Entre com sua conta para gerenciar as campanhas.</p>

        <label htmlFor="login-email">E-mail</label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label htmlFor="login-senha">Senha</label>
        <input
          id="login-senha"
          type="password"
          autoComplete="current-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        {erro !== "" && <p className="dica erro" role="alert">{erro}</p>}

        <button className="btn primario bloco" type="submit" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
