// Canvas central: a arte real gerada por render.ts (a MESMA do exportador).
// Escala com transform e avisa quando o conteúdo passa de 1308px — tanto
// visualmente quanto reportando o mapa de estouros ao editor.
// Phase 3: inclui barra de zoom e destaca o bloco selecionado com outline.
import { useLayoutEffect, useRef } from "react";
import type { JSX } from "react";
import { artCssEscopo, renderPagina } from "../../shared/render.js";
import { estado, useEstado, notificarConteudo, selecionarBloco, selecionarPagina } from "../store.js";

const LARGURA_PAGINA = 924;
const ALTURA_PAGINA = 1308;

type Props = {
  /** Mapa idDaPágina → { altura, cartaoId? } das páginas com estouro. */
  estouros: Map<string, { altura: number; cartaoId?: string }>;
  /** Callback quando o mapa de estouros muda. */
  aoEstouro?: (estouros: Map<string, { altura: number; cartaoId?: string }>) => void;
};

export function Canvas({ estouros, aoEstouro }: Props): JSX.Element {
  const e = useEstado();
  const container = useRef<HTMLDivElement>(null);
  const cssInjetado = useRef(false);
  const ultimoMapa = useRef("");
  const cssDestaque = useRef<HTMLStyleElement | null>(null);

  // aplica escala sempre que o zoom mudar
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const escala = Math.max(0.25, Math.min(2, e.zoom));
    el.querySelectorAll<HTMLElement>(".escala").forEach((m) => {
      m.style.transformOrigin = "top left";
      m.style.willChange = "transform";
      m.style.transform = `scale(${escala})`;
      // tamanho fixo da página; o transform escala o desenho, o canvas faz scroll se transbordar
      m.style.width = `${LARGURA_PAGINA}px`;
      m.style.height = `${ALTURA_PAGINA}px`;
    });
  }, [e.zoom]);

  useLayoutEffect(() => {
    if (!cssInjetado.current) {
      const style = document.createElement("style");
      style.textContent = artCssEscopo(".arte");
      document.head.appendChild(style);
      cssInjetado.current = true;
    }
    const id = requestAnimationFrame(() => {
      document.fonts.ready.then(() => medirEstouros());
    });
    const onResize = () => { /* escala já atualizada pelo effect de zoom */ };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(id); window.removeEventListener("resize", onResize); };
  }, [e.campanha?.revisao, e.campanha?.paginas.length]);

  /** Altura real do conteúdo, em px da arte. Elementos absolutos (marca d'água)
   *  não contam como conteúdo. Retorna a altura real e o id do cartão estourado. */
  function alturaConteudo(pag: HTMLElement): { altura: number; cartaoId?: string } {
    const rect = pag.getBoundingClientRect();
    const escala = rect.width / LARGURA_PAGINA || 1;
    let max = 0;
    pag.querySelectorAll<HTMLElement>("*").forEach((filho) => {
      const st = getComputedStyle(filho);
      if (st.position === "absolute" || st.position === "fixed") return;
      const fundo = (filho.getBoundingClientRect().bottom - rect.top) / escala;
      if (fundo > max) max = fundo;
    });
    const altura = Math.round(max);
    return { altura, cartaoId: cartaoEstourado(pag) };
  }

  /** Qual cartão (se algum) passa do limite da página? Retorna o id do cartão. */
  function cartaoEstourado(pag: HTMLElement): string | undefined {
    const rect = pag.getBoundingClientRect();
    const escala = rect.width / LARGURA_PAGINA || 1;
    for (const c of pag.querySelectorAll<HTMLElement>(".cartao")) {
      const fundo = (c.getBoundingClientRect().bottom - rect.top) / escala;
      if (fundo >= ALTURA_PAGINA) return c.dataset.cartao ?? undefined;
    }
    return undefined;
  }

  function medirEstouros(): void {
    const el = container.current;
    if (!el) return;
    el.querySelectorAll(".aviso-estouro").forEach((a) => a.remove());
    const mapa = new Map<string, { altura: number; cartaoId?: string }>();
    el.querySelectorAll<HTMLElement>(".pagina").forEach((pag) => {
      const { altura, cartaoId } = alturaConteudo(pag);
      if (altura >= ALTURA_PAGINA) {
        mapa.set(pag.dataset.pagina ?? "", { altura, cartaoId });
        const campanha = estado.campanha;
        const pagina = campanha?.paginas.find((p) => p.id === pag.dataset.pagina);
        const cartao = cartaoId && pagina
          ? pagina.cartoes.find((c) => c.id === cartaoId)
          : undefined;
        const nomeCartao = cartao?.titulo[0] ?? cartaoId ?? "um cartão";
        // Índice do bloco que realmente estourou: último bloco do cartão estourado.
        let biSelecionado = 0;
        if (cartaoId && pagina) {
          const ci = pagina.cartoes.findIndex((c) => c.id === cartaoId);
          if (ci >= 0) {
            const blocos = pagina.cartoes[ci]?.blocos ?? [];
            biSelecionado = Math.max(0, blocos.length - 1);
          }
        }
        const aviso = document.createElement("div");
        aviso.className = "aviso-estouro";
        aviso.role = "alert";
        aviso.tabIndex = 0;
        aviso.title = `Conteúdo maior que a página: ${altura}px de ${ALTURA_PAGINA}px.`;
        aviso.innerHTML = `<span class="estouro-icon" aria-hidden="true">!</span>
          <span>Conteúdo maior que a página (${altura}px de ${ALTURA_PAGINA}px): "${nomeCartao}" será cortado no PDF.</span>`;
        const aoCliqueAviso = () => {
          if (!cartaoId || !pagina) return;
          const ci = pagina.cartoes.findIndex((c) => c.id === cartaoId);
          if (ci >= 0) selecionarBloco(ci, biSelecionado);
          notificarConteudo();
        };
        aviso.onclick = aoCliqueAviso;
        aviso.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") aoCliqueAviso(); };
        const escala = pag.parentElement;
        if (escala) escala.before(aviso);
      }
    });
    const assinatura = [...mapa.entries()].map(([k, v]) => `${k}:${v.altura}:${v.cartaoId ?? ""}`).join("|");
    if (assinatura !== ultimoMapa.current) {
      ultimoMapa.current = assinatura;
      aoEstouro?.(mapa);
    }
  }

  // Destaca o bloco selecionado via regra CSS scoped (sem tocar no DOM).
  // A regra só existe no editor (nunca no render.ts / PDF exportado).
  useLayoutEffect(() => {
    const sel = estado.blocoSelecionado;
    const el = container.current;
    limparEstiloDestaque();
    if (!sel || !el) return;
    const pagina = estado.campanha?.paginas[estado.pagSelecionada];
    const bloco = pagina?.cartoes[sel.ci]?.blocos[sel.bi];
    if (!bloco) return;
    const estilo = document.createElement("style");
    estilo.type = "text/css";
    estilo.textContent = `
      .arte [data-bloco="${escapeCssId(bloco.id)}"] {
        outline: 2px solid var(--primary);
        outline-offset: 4px;
        position: relative;
      }
      .arte [data-bloco="${escapeCssId(bloco.id)}"]::before {
        content: attr(data-bloco-nome);
        position: absolute;
        top: -16px;
        left: 4px;
        background: var(--primary);
        color: #0b1020;
        font-size: 10px;
        font-weight: 700;
        padding: 1px 6px;
        border-radius: 4px;
        z-index: 10;
      }
    `;
    document.head.appendChild(estilo);
    cssDestaque.current = estilo;
    return () => limparEstiloDestaque();
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

  function limparEstiloDestaque(): void {
    if (cssDestaque.current) {
      cssDestaque.current.remove();
      cssDestaque.current = null;
    }
  }

  /** Escapa um identificador para uso em seletor CSS (atributo data-bloco). */
  function escapeCssId(id: string): string {
    return id.replace(/[\\."]/g, "\\$&");
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
          className="escala arte"
          key={p.id}
          onClick={() => { selecionarPagina(i); } }
        >
          <div
            className="pagina"
            dangerouslySetInnerHTML={{ __html: renderPagina(p, { campanha, catalogos }) }}
          />
        </div>
      ))}
    </main>
  );
}
