// Prévia da arte: usa o MESMO render.ts do exportador (AGENTS.md §12).
import { renderCampanha } from "../shared/render.js";
import { artCss } from "../shared/render.js";
import { estado, aoMudar } from "./estado.js";

const LARGURA_PAGINA = 924;
const ALTURA_PAGINA = 1308;

export function iniciarPrevia(container: HTMLElement): void {
  let cssInjetado = false;
  aoMudar(atualizar);
  // janela redimensiona → reescala as molduras sem re-renderizar
  window.addEventListener("resize", () => {
    const escala = calcularEscala(container);
    container.querySelectorAll<HTMLElement>(".escala").forEach((el) => {
      el.style.transform = `scale(${escala})`;
      el.style.width = `${LARGURA_PAGINA * escala}px`;
      el.style.height = `${ALTURA_PAGINA * escala}px`;
    });
  });
  atualizar();

  function atualizar() {
    const { campanha, catalogos } = estado;
    if (!campanha || !catalogos) return;
    if (!cssInjetado) {
      const style = document.createElement("style");
      style.textContent = artCss();
      document.head.appendChild(style);
      cssInjetado = true;
    }
    const paginas = estado.verTodas
      ? campanha.paginas
      : campanha.paginas.filter((_, i) => i === estado.pagSelecionada);
    container.innerHTML = paginas.map((p) => `<div class="moldura"><div class="escala">${renderCampanha({ ...campanha, paginas: [p] }, catalogos)}</div></div>`).join("");
    const escala = calcularEscala(container);
    container.querySelectorAll<HTMLElement>(".escala").forEach((el) => {
      el.style.transform = `scale(${escala})`;
      el.style.width = `${LARGURA_PAGINA * escala}px`;
      el.style.height = `${ALTURA_PAGINA * escala}px`;
    });
    avisarEstouro(container);
  }
}

function calcularEscala(container: HTMLElement): number {
  const largura = container.clientWidth - 24;
  return Math.max(0.2, Math.min(1, largura / LARGURA_PAGINA));
}

/** Altura real do conteúdo da página, em px da arte (ignora a marca d'água,
 * que é absoluta e sai da página de propósito). Corrige pela escala da moldura. */
function alturaConteudo(pag: HTMLElement): number {
  const rect = pag.getBoundingClientRect();
  const escala = rect.width / LARGURA_PAGINA || 1;
  let max = ALTURA_PAGINA;
  pag.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const st = getComputedStyle(el);
    if (st.position === "absolute" || st.position === "fixed") return;
    const fundo = (el.getBoundingClientRect().bottom - rect.top) / escala;
    if (fundo > max) max = fundo;
  });
  return Math.round(max);
}

const TEM_ESTOURO = ALTURA_PAGINA + 2;

/** Se o conteúdo de uma página ultrapassar 1308px, avisa (a arte corta em silêncio). */
export function avisarEstouro(container: HTMLElement): void {
  container.querySelectorAll<HTMLElement>(".pagina").forEach((pag) => {
    const conteudo = alturaConteudo(pag);
    if (conteudo > TEM_ESTOURO) {
      const aviso = document.createElement("div");
      aviso.className = "aviso-estouro";
      aviso.textContent = `⚠ Conteúdo maior que a página: ${conteudo}px de 1308px. O que passar será cortado no PDF.`;
      const moldura = pag.closest(".moldura");
      moldura?.before(aviso);
    }
  });
}

/** Páginas com estouro (id → altura), para o painel marcar ⚠ na lista. */
export function estouros(container: HTMLElement): Map<string, number> {
  const mapa = new Map<string, number>();
  container.querySelectorAll<HTMLElement>(".pagina").forEach((pag) => {
    const id = pag.dataset.pagina ?? "";
    const conteudo = alturaConteudo(pag);
    if (conteudo > TEM_ESTOURO) mapa.set(id, conteudo);
  });
  return mapa;
}
