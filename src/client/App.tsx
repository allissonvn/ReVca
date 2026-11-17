import type { JSX } from "react";
// Roteamento mínimo por query string: /?campanha=<id> abre o editor; sem, a home.
// Tudo atrás do gate de login: sem sessão válida, só a tela de login aparece.
import { useEffect, useState } from "react";
import { definirAoReceber401, lerSessao } from "./api.js";
import { deslogar, estado, useEstado } from "./store.js";
import { Editor } from "./telas/Editor.js";
import { Home } from "./telas/Home.js";
import { Login } from "./telas/Login.js";

const id = new URLSearchParams(window.location.search).get("campanha");

export function App(): JSX.Element {
  useEstado();
  // "verificando" evita piscar a tela de login antes de saber a sessão real
  const [fase, setFase] = useState<"verificando" | "pronto">("verificando");

  useEffect(() => {
    definirAoReceber401(() => deslogar());
    void (async () => {
      try {
        const { usuario } = await lerSessao();
        estado.usuario = usuario;
      } catch {
        // 401 ou erro de rede: sem usuário; deslogar() já foi chamado pelo hook
      }
      setFase("pronto");
    })();
  }, []);

  if (fase === "verificando") {
    return <div className="login"><p className="dica">Carregando…</p></div>;
  }
  if (estado.usuario === null) {
    return <Login aoEntrar={() => setFase("pronto")} />;
  }
  return id ? <Editor id={id} /> : <Home />;
}
