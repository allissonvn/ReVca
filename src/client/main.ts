// Bootstrap do cliente: tela inicial (grade de campanhas) e editor (?campanha=id).
import { estado, aoMudar } from "./estado.js";
import { iniciarPainel, aplicarTema, atualizarAvisos } from "./painel.js";
import { iniciarPrevia, estouros } from "./previa.js";
import { lerCampanha, lerCatalogos } from "./api.js";
import { iniciarHome } from "./home.js";

const app = document.getElementById("app") as HTMLElement;

// Roteamento mínimo: /?campanha=<id> abre o editor; sem parâmetro, a home.
const idCampanha = new URLSearchParams(window.location.search).get("campanha");

aplicarTema();

if (idCampanha) {
  void iniciarEditor(idCampanha);
} else {
  void iniciarHome(app);
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

async function iniciarEditor(id: string): Promise<void> {
  app.innerHTML = `<div class="app">
    <div class="painel" id="painel"></div>
    <div class="previa" id="previa"></div>
  </div>`;
  const painel = document.getElementById("painel") as HTMLElement;
  const previa = document.getElementById("previa") as HTMLElement;

  try {
    const [catalogos, campanha] = await Promise.all([lerCatalogos(), lerCampanha(id)]);
    estado.catalogos = catalogos;
    estado.campanha = campanha;
  } catch (e) {
    painel.innerHTML = `<p class="dica">Não foi possível abrir a campanha: ${e instanceof Error ? e.message : String(e)}</p>`;
    return;
  }

  iniciarPrevia(previa);
  iniciarPainel(painel, () => estouros(previa));

  // Badges ⚠ da lista: depois da prévia (que se atualiza primeiro por aoMudar)
  aoMudar(atualizarAvisos);
}
