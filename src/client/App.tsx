import type { JSX } from "react";
// Roteamento mínimo por query string: /?campanha=<id> abre o editor; sem, a home.
import { Editor } from "./telas/Editor.js";
import { Home } from "./telas/Home.js";

const id = new URLSearchParams(window.location.search).get("campanha");

export function App(): JSX.Element {
  return id ? <Editor id={id} /> : <Home />;
}
