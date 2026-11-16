// Bootstrap do cliente (React): home de campanhas ou editor (?campanha=id).
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { aplicarTema } from "./store.js";

aplicarTema();
const raiz = createRoot(document.getElementById("app") as HTMLElement);
raiz.render(<App />);
