// Tela de login: primeiro gate do app. O servidor valida e-mail/senha e cria
// a sessão via cookie HttpOnly (AGENTS.md §6).
// UI: design system REVCA — Phase 2.
// Card centralizado (~360px) sobre --bg: Logo, subtítulo, E-mail, Senha,
// botão Entrar full-width primário.
import type { JSX } from "react";
import { useState } from "react";
import { Logo } from "../ui/Logo.js";
import { Button } from "../ui/Button.js";
import { Field } from "../ui/Field.js";
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
        <Logo altura={29} aria-label="REVCA — Entrar" />
        <p className="dica">Entre com sua conta para gerenciar as campanhas.</p>

        <Field
          label="E-mail"
          type="email"
          name="email"
          id="login-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Field
          label="Senha"
          type="password"
          name="senha"
          id="login-senha"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
          autoComplete="current-password"
        />

        {erro !== "" && <p className="dica erro" role="alert">{erro}</p>}

        <Button
          variant="primary"
          type="submit"
          block
          disabled={enviando}
        >
          {enviando ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </div>
  );
}
