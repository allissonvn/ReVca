// Tela de campanhas: grade de cartões com miniatura da 1ª página (render real),
// busca por título/mês e ações (abrir, duplicar, excluir).
import { artCss, renderCampanha } from "../shared/render.js";
import { estado } from "./estado.js";
import { aplicarTema } from "./painel.js";
import { listarCampanhas, lerCampanha, lerCatalogos, criarCampanha, excluirCampanha, CampanhaResumo } from "./api.js";
import { Campanha } from "../shared/schema.js";

const LARGURA_MINI = 180; // largura fixa da miniatura (a página tem 924)

export async function iniciarHome(container: HTMLElement): Promise<void> {
  container.innerHTML = `
  <div class="home">
    <div class="home-topo">
      <h1>Parcelamento Matriz</h1>
      <div class="linha">
        <input type="text" id="busca" placeholder="Buscar por título ou mês…" aria-label="Buscar campanha">
        <button id="btn-tema" title="Alternar tema do painel (a arte é sempre clara)">${estado.tema === "escuro" ? "☀ Tema claro" : "🌙 Tema escuro"}</button>
        <button id="nova-campanha">+ Nova campanha</button>
      </div>
    </div>
    <div id="grade" class="grade"><p class="dica">Carregando…</p></div>
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

  document.getElementById("busca")?.addEventListener("input", () => filtrar());

  // a arte das miniaturas usa o mesmo CSS do render
  const estilo = document.createElement("style");
  estilo.textContent = artCss();
  document.head.appendChild(estilo);

  let catalogos;
  let campanhas: { resumo: CampanhaResumo; dados: Campanha }[] = [];
  try {
    const resumos = await listarCampanhas();
    catalogos = await lerCatalogos();
    // poucas campanhas, servidor local: ler tudo de uma vez é ok
    campanhas = await Promise.all(resumos.map(async (r) => ({ resumo: r, dados: await lerCampanha(r.id) })));
  } catch (e) {
    const grade = document.getElementById("grade");
    if (grade) grade.innerHTML = `<p class="dica">Erro ao carregar: ${e instanceof Error ? e.message : String(e)}</p>`;
    return;
  }

  const grade = document.getElementById("grade") as HTMLElement;
  if (campanhas.length === 0) {
    grade.innerHTML = `<p class="dica">Nenhuma campanha ainda. Clique em “+ Nova campanha”.</p>`;
    return;
  }
  // mais recentes primeiro
  campanhas.sort((a, b) => b.resumo.atualizadoEm.localeCompare(a.resumo.atualizadoEm));
  grade.innerHTML = campanhas.map((c) => cartaoCampanha(c.resumo, c.dados, catalogos!)).join("");

  // delegação de eventos da grade
  grade.addEventListener("click", async (ev) => {
    const alvo = (ev.target as HTMLElement).closest<HTMLElement>("[data-act]");
    if (!alvo) {
      // clique no cartão (fora dos botões) abre o editor
      const card = (ev.target as HTMLElement).closest<HTMLElement>(".cam-card");
      if (card) window.location.href = `/?campanha=${encodeURIComponent(card.dataset.id ?? "")}`;
      return;
    }
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
        alvo.closest(".cam-card")?.remove();
      }
    }
  });
}

function cartaoCampanha(r: CampanhaResumo, dados: Campanha, catalogos: NonNullable<Awaited<ReturnType<typeof lerCatalogos>>>): string {
  const data = new Date(r.atualizadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const escala = LARGURA_MINI / 924;
  const primeira = dados.paginas[0];
  const mini = primeira
    ? `<div class="mini" style="width:${LARGURA_MINI}px;height:${Math.round(1308 * escala)}px">
        <div class="mini-escala" style="transform:scale(${escala});width:${LARGURA_MINI}px;height:${Math.round(1308 * escala)}px">
          ${renderCampanha({ ...dados, paginas: [primeira] }, catalogos)}
        </div>
      </div>`
    : `<div class="mini mini-vazia">sem páginas</div>`;
  return `<div class="cam-card" data-id="${esc(r.id)}">
    ${mini}
    <div class="cam-info">
      <div class="cam-linha1">
        <span class="badge-mes">${esc(r.mes)}</span>
        <small>${r.nPaginas} pág. · ${data}</small>
      </div>
      <b class="cam-titulo">${esc(r.titulo)}</b>
    </div>
    <div class="cam-acoes">
      <button data-act="abrir" data-id="${esc(r.id)}" title="Abrir no editor">Abrir</button>
      <button data-act="duplicar" data-id="${esc(r.id)}" title="Duplicar para outro mês">Duplicar</button>
      <button data-act="excluir" data-id="${esc(r.id)}" title="Mover para a lixeira">✕</button>
    </div>
  </div>`;
}

/** Filtro simples por título e mês (esconde cartões que não batem). */
function filtrar(): void {
  const q = (document.getElementById("busca") as HTMLInputElement).value.trim().toLowerCase();
  document.querySelectorAll<HTMLElement>(".cam-card").forEach((card) => {
    const t = card.querySelector(".cam-titulo")?.textContent?.toLowerCase() ?? "";
    const m = card.querySelector(".badge-mes")?.textContent?.toLowerCase() ?? "";
    card.hidden = q !== "" && !t.includes(q) && !m.includes(q);
  });
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
