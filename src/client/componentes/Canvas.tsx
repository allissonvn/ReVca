// Canvas central: a arte real gerada por render.ts (a MESMA do exportador).
// Escala com transform e avisa quando o conteúdo passa de 1308px — tanto
// visualmente quanto reportando o mapa de estouros ao editor (badges ⚠).
// Phase 3: inclui barra de zoom e destaca o bloco selecionado com outline.
import { useLayoutEffect, useRef } from "react";
import type { JSX } from "react";
import { artCss, renderCampanha } from "../../shared/render.js";
import { estado, useEstado, notificarConteudo, selecionarBloco, limparSelecaoBloco, definirZoom, alternarAjusteTela } from "../store.js";
import { ZoomBar } from "./ZoomBar.js";

const LARGURA_PAGINA = 924;
const ALTURA_PAGINA = 1308;
const TEM_ESTOURO = ALTURA_PAGINA + 2;

type Props = {
  /** Mapa idDaPágina → altura do conteúdo (páginas com estouro). */
  estouros: Map<string, number>;
  /** Callback quando o mapa de estouros muda. */
  aoEstouro?: (estouros: Map<string, number>) => void;
};

export function Canvas({ estouros, aoEstouro }: Props): JSX.Element {
  const e = useEstado();
  const container = useRef<HTMLDivElement>(null);
  const cssInjetado = useRef(false);
  const ultimoMapa = useRef("");

  useLayoutEffect(() => {
    if (!cssInjetado.current) {
      const style = document.createElement("style");
      style.textContent = artCss();
      document.head.appendChild(style);
      cssInjetado.current = true;
    }
    aplicarEscala();
    const id = requestAnimationFrame(medirEstouros);
    const onResize = () => aplicarEscala();
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onResize); };
  });

  function aplicarEscala(): void {
    const el = container.current;
    if (!el) return;
    const escala = Math.max(0.25, Math.min(2, e.zoom));
    el.querySelectorAll<HTMLElement>(".escala").forEach((m) => {
      m.style.transform = `scale(${escala})`;
      m.style.width = `${LARGURA_PAGINA * escala}px`;
      m.style.height = `${ALTURA_PAGINA * escala}px`;
    });
  }

  /** Altura real do conteúdo, em px da arte (ignora absolutos — a marca d'água
   *  sai da página de propósito). Corrige pela escala da moldura. */
  function alturaConteudo(pag: HTMLElement): number {
    const rect = pag.getBoundingClientRect();
    const escala = rect.width / LARGURA_PAGINA || 1;
    let max = ALTURA_PAGINA;
    pag.querySelectorAll<HTMLElement>("*").forEach((filho) => {
      const st = getComputedStyle(filho);
      // Incluir altura de todos os elementos, inclusive positionados
      const fundo = (filho.getBoundingClientRect().bottom - rect.top) / escala;
      if (fundo > max) max = fundo;
    });
    return Math.round(max);
  }

  function medirEstouros(): void {
    const el = container.current;
    if (!el) return;
    el.querySelectorAll(".aviso-estouro").forEach((a) => a.remove());
    const mapa = new Map<string, number>();
    el.querySelectorAll<HTMLElement>(".pagina").forEach((pag) => {
      const conteudo = alturaConteudo(pag);
      const escalaAtual = pag.clientWidth / LARGURA_PAGINA || 1;
      if (conteudo > TEM_ESTOURO * escalaAtual) {
        mapa.set(pag.dataset.pagina ?? "", conteudo);
        const aviso = document.createElement("div");
        aviso.className = "aviso-estouro";
        aviso.textContent = `⚠ Conteúdo maior que a página: ${conteudo}px de ${1308 * escalaAtual}px. O que passar será cortado no PDF.`;
        pag.closest(".moldura")?.before(aviso);
      }
    });
    const assinatura = [...mapa.entries()].map(([k, v]) => `${k}:${v}`).join("|");
    if (assinatura !== ultimoMapa.current) {
      ultimoMapa.current = assinatura;
      aoEstouro?.(mapa);
    }
  }

  // Destaca o bloco selecionado com outline + name tag
  useLayoutEffect(() => {
    const sel = estado.blocoSelecionado;
    if (!sel) {
      limparSelecaoBlocoDOM();
      return;
    }
    const el = container.current;
    if (!el) return;
    limparSelecaoBlocoDOM();
    const blocos = el.querySelectorAll<HTMLElement>(`[data-bloco]`);
    blocos.forEach((b) => (b.style.outline = ""));
    const alvo = el.querySelector<HTMLElement>(`[data-bloco="${sel.bi}"]`);
    if (alvo) {
      alvo.style.outline = `2px solid var(--primary)`;
      alvo.style.outlineOffset = "4px";
      alvo.style.position = "relative";
      const tag = document.createElement("div");
      tag.className = "bloco-tag";
      tag.textContent = `Bloco ${sel.bi + 1}`;
      tag.style.position = "absolute";
      tag.style.top = "-16px";
      tag.style.left = "4px";
      tag.style.background = "var(--primary)";
      tag.style.color = "#0b1020";
      tag.style.fontSize = "10px";
      tag.style.fontWeight = "700";
      tag.style.padding = "1px 6px";
      tag.style.borderRadius = "4px";
      tag.style.zIndex = "10";
      alvo.prepend(tag);
    }
  }, [estado.blocoSelecionado]);

  // Clique em bloco: seleciona no painel direito (Phase 4)
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const handler = (ev: MouseEvent) => {
      const bloco = el.querySelector<HTMLElement>(`[data-bloco]`);
      if (!bloco) return;
      const bi = parseInt(bloco.dataset.bloco ?? "-1", 10);
      if (isNaN(bi) || bi < 0) return;
      // Evita capturar clique em header/aba/pilha
      const alvo = ev.target as HTMLElement;
      if (alvo.closest(".aba") || alvo.closest(".cabecalho") || alvo.closest(".pilha") || alvo.closest(".corpo")) return;
      selecionarBloco(0, bi);
      notificarConteudo();
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [selecionarBloco, notificarConteudo]);

  function limparSelecaoBlocoDOM(): void {
    const el = container.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("[data-bloco]").forEach((b) => {
      b.style.outline = "";
      b.style.outlineOffset = "";
      b.style.position = "";
    });
    el.querySelectorAll<HTMLElement>(".bloco-tag").forEach((t) => t.remove());
  }

  const { campanha, catalogos } = e;
  if (!campanha || !catalogos) return <main className="canvas" ref={container} />;

  const paginas = campanha.paginas
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => {
      // By default show only the selected page; "ver todas" is an explicit opt-in
      if (estado.verTodas) return true;
      return i === estado.pagSelecionada;
    });

  const pagSelecionada = campanha.paginas[estado.pagSelecionada];
  const cabeNaPagina = pagSelecionada
    ? !estouros.has(pagSelecionada.id)
    : true;

  return (
    <main className="canvas" ref={container}>
      {paginas.map(({ p, i }) => (
        <div
          className="moldura"
          key={p.id}
          onClick={() => { if (estado.pagSelecionada !== i) { estado.pagSelecionada = i; notificarConteudo(); } }}
        >
          <div
            className="escala"
            dangerouslySetInnerHTML={{ __html: renderCampanha({ ...campanha, paginas: [p] }, catalogos) }}
          />
        </div>
      ))}
      {/* Barra de zoom */}
      <ZoomBar
        zoom={estado.zoom}
        aoMudarZoom={(z) => { definirZoom(z); aplicarEscala(); }}
        ajustado={estado.zoomAjustado}
        aoAlternarAjuste={(ajustado) => { alternarAjusteTela(ajustado); if (!ajustado) aplicarEscala(); }}
      />
      <div className="canvas-status">
        {cabeNaPagina ? (
          <span className="status-ok">✓ Cabe na página</span>
        ) : (
          <span className="status-estouro">⚠ Conteúdo passa do limite</span>
        )}
      </div>
    </main>
  );
}
