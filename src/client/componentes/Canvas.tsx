// Canvas central: a arte real gerada por render.ts (a MESMA do exportador).
// Escala com transform e avisa quando o conteúdo passa de 1308px — tanto
// visualmente quanto reportando o mapa de estouros ao editor (badges ⚠).
// Phase 3: inclui barra de zoom e destaca o bloco selecionado com outline.
import { useLayoutEffect, useRef } from "react";
import type { JSX } from "react";
import { artCssEscopo, renderPagina } from "../../shared/render.js";
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
      // escopado em ".arte": classes genéricas da arte (.cabecalho, .faixa-verde)
      // não podem vazar para a UI dos painéis
      const style = document.createElement("style");
      style.textContent = artCssEscopo(".arte");
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
      m.style.transformOrigin = "center top";
      m.style.willChange = "transform";
      m.style.transform = `scale(${escala})`;
      m.style.width = `${LARGURA_PAGINA}px`;
      m.style.height = `${ALTURA_PAGINA}px`;
    });
  }

  /** Altura real do conteúdo, em px da arte. Elementos absolutos são a marca
   *  d'água (que sai da página de propósito) e as tags de seleção do editor —
   *  não contam como conteúdo; sem isso a página "estourava" falsamente. */
  function alturaConteudo(pag: HTMLElement): number {
    const rect = pag.getBoundingClientRect();
    const escala = rect.width / LARGURA_PAGINA || 1;
    let max = ALTURA_PAGINA;
    pag.querySelectorAll<HTMLElement>("*").forEach((filho) => {
      const st = getComputedStyle(filho);
      if (st.position === "absolute" || st.position === "fixed") return;
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
      // comparação em px da arte: alturaConteudo já corrige pela escala
      if (conteudo > TEM_ESTOURO) {
        mapa.set(pag.dataset.pagina ?? "", conteudo);
        const aviso = document.createElement("div");
        aviso.className = "aviso-estouro";
        aviso.textContent = `⚠ Conteúdo maior que a página: ${conteudo}px de ${ALTURA_PAGINA}px. O que passar será cortado no PDF.`;
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
    const el = container.current;
    limparSelecaoBlocoDOM();
    if (!sel || !el) return;
    // data-bloco guarda o ID do bloco (não o índice): resolve pelo modelo
    const pagina = estado.campanha?.paginas[estado.pagSelecionada];
    const bloco = pagina?.cartoes[sel.ci]?.blocos[sel.bi];
    if (!bloco) return;
    const alvo = Array.from(el.querySelectorAll<HTMLElement>("[data-bloco]"))
      .find((b) => b.dataset.bloco === bloco.id);
    if (!alvo) return;
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
  }, [estado.blocoSelecionado, estado.pagSelecionada, estado.verTodas]);

  // Clique em bloco: seleciona no painel direito (Phase 4)
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const handler = (ev: MouseEvent) => {
      // sobe do elemento clicado até o bloco mais próximo (o clique pode ter
      // caído num chip por dentro); cliques fora de um bloco não selecionam nada
      const alvo = (ev.target as HTMLElement).closest<HTMLElement>("[data-bloco]");
      if (!alvo || !el.contains(alvo)) return;
      const pagEl = alvo.closest<HTMLElement>(".pagina");
      const carEl = alvo.closest<HTMLElement>("[data-cartao]");
      const campanha = estado.campanha;
      const pagina = campanha?.paginas.find((p) => p.id === pagEl?.dataset.pagina);
      const idCartao = carEl?.dataset.cartao;
      const idBloco = alvo.dataset.bloco;
      if (!pagina || !idCartao || !idBloco) return;
      const ci = pagina.cartoes.findIndex((c) => c.id === idCartao);
      const bi = pagina.cartoes[ci]?.blocos.findIndex((b) => b.id === idBloco) ?? -1;
      if (ci < 0 || bi < 0) return;
      selecionarBloco(ci, bi);
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
            className="escala arte"
            dangerouslySetInnerHTML={{ __html: renderPagina(p, { campanha, catalogos }) }}
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
