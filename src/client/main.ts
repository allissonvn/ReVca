// Bootstrap do cliente: tela inicial (lista de campanhas) e editor (?campanha=id).
import { estado, aoMudar } from "./estado.js";
import { iniciarPainel, aplicarTema, atualizarAvisos } from "./painel.js";
import { iniciarPrevia, estouros } from "./previa.js";
import { listarCampanhas, lerCampanha, lerCatalogos, criarCampanha, excluirCampanha } from "./api.js";

const app = document.getElementById("app") as HTMLElement;

// Roteamento mínimo: /?campanha=<id> abre o editor; sem parâmetro, a home.
const idCampanha = new URLSearchParams(window.location.search).get("campanha");

aplicarTema();

if (idCampanha) {
  void iniciarEditor(idCampanha);
} else {
  void iniciarHome();
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

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------

async function iniciarHome(): Promise<void> {
  app.innerHTML = `
  <div class="home">
    <h1>Parcelamento Matriz — Editor VCA</h1>
    <div class="linha">
      <button id="nova-campanha">+ Nova campanha</button>
      <button data-act="tema" id="btn-tema">${estado.tema === "escuro" ? "☀ Tema claro" : "🌙 Tema escuro"}</button>
    </div>
    <div id="lista" class="cam-lista"><p class="dica">Carregando…</p></div>
  </div>`;

  document.getElementById("btn-tema")?.addEventListener("click", () => {
    estado.tema = estado.tema === "escuro" ? "claro" : "escuro";
    localStorage.setItem("vca-tema", estado.tema);
    aplicarTema();
    const btn = document.getElementById("btn-tema");
    if (btn) btn.textContent = estado.tema === "escuro" ? "☀ Tema claro" : "🌙 Tema escuro";
  });

  document.getElementById("nova-campanha")?.addEventListener("click", async () => {
    const nova = await criarCampanha();
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  });

  await recarregarLista();

  // delegação de eventos da lista
  const lista = document.getElementById("lista") as HTMLElement;
  lista.addEventListener("click", async (ev) => {
    const alvo = (ev.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!alvo) return;
    const id = alvo.dataset.id ?? "";
    if (alvo.dataset.act === "abrir") {
      window.location.href = `/?campanha=${encodeURIComponent(id)}`;
    } else if (alvo.dataset.act === "duplicar") {
      const mes = window.prompt("Duplicar para qual mês? (em maiúsculas, ex.: DEZEMBRO)", "DEZEMBRO");
      if (!mes) return;
      const nova = await criarCampanha({ duplicarDe: id, mes });
      window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
    } else if (alvo.dataset.act === "excluir") {
      if (window.confirm("Mover esta campanha para a lixeira?")) {
        await excluirCampanha(id);
        await recarregarLista();
      }
    }
  });
}

async function recarregarLista(): Promise<void> {
  const lista = document.getElementById("lista") as HTMLElement;
  try {
    const campanhas = await listarCampanhas();
    if (campanhas.length === 0) {
      lista.innerHTML = `<p class="dica">Nenhuma campanha ainda. Clique em “+ Nova campanha”.</p>`;
      return;
    }
    lista.innerHTML = campanhas.map((c) => itemCampanha(c)).join("");
  } catch (e) {
    lista.innerHTML = `<p class="dica">Erro ao listar: ${e instanceof Error ? e.message : String(e)}</p>`;
  }
}

function itemCampanha(c: CampanhaResumo): string {
  const data = new Date(c.atualizadoEm).toLocaleString("pt-BR");
  return `<div class="cam-item">
    <button class="info" data-act="abrir" data-id="${esc(c.id)}">
      <b>${esc(c.titulo)} — ${esc(c.mes)}</b>
      <small>${c.nPaginas} página(s) · atualizada em ${data}</small>
    </button>
    <button data-act="duplicar" data-id="${esc(c.id)}">Duplicar</button>
    <button data-act="excluir" data-id="${esc(c.id)}">Excluir</button>
  </div>`;
}

type CampanhaResumo = { id: string; titulo: string; mes: string; atualizadoEm: string; nPaginas: number };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
