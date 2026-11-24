// Canvas central: a arte real gerada por render.ts (a MESMA do exportador).
// Zoom declarativo: a moldura reserva 924*z × 1308*z no layout e a arte interna
// recebe transform: scale(z) com origem no topo-esquerdo (sem efeito imperativo).
// O destaque do bloco selecionado e o aviso de estouro são renderizados pelo
// React (nada de mutar o DOM da arte).
import { Fragment, useLayoutEffect, useRef } from "react";
import type { JSX } from "react";
import { TriangleAlert } from "lucide-react";
import { artCssEscopo, renderPagina } from "../../shared/render.js";
import {
  estado,
  useEstado,
  notificarConteudo,
  selecionarBloco,
  selecionarPagina,
  definirZoom,
  alternarAjusteTela,
} from "../store.js";
import { ALTURA_PAGINA, LARGURA_PAGINA, limitarZoom, tamanhoMoldura } from "./tamanhoMoldura.js";
import { ZoomBar } from "./ZoomBar.js";

type Estouro = { altura: number; cartaoId?: string };

type Props = {
  /** Mapa idDaPágina → { altura (fundo do último cartão), cartaoId? }. */
  estouros: Map<string, Estouro>;
  /** Callback quando o mapa de estouros muda. */
  aoEstouro?: (estouros: Map<string, Estouro>) => void;
};

export function Canvas({ estouros, aoEstouro }: Props): JSX.Element {
  const e = useEstado();
  const container = useRef<HTMLDivElement>(null);
  const cssInjetado = useRef(false);
  const ultimoMapa = useRef("");

  const z = limitarZoom(e.zoom);
  const { w, h } = tamanhoMoldura(e.zoom);

  // CSS da arte (escopo .arte) injetado uma única vez.
  useLayoutEffect(() => {
    if (!cssInjetado.current) {
      const style = document.createElement("style");
      style.textContent = artCssEscopo(".arte");
      document.head.appendChild(style);
      cssInjetado.current = true;
    }
  }, []);

  // Mede o estouro depois de cada render (conteúdo, página, "ver todas", zoom)
  // e de novo quando as fontes terminam de carregar (métricas mudam).
  const assinatura = JSON.stringify(e.campanha?.paginas ?? []);
  useLayoutEffect(() => {
    let cancelado = false;
    const medir = (): void => {
      if (!cancelado) medirEstouros();
    };
    const id = requestAnimationFrame(medir);
    void document.fonts.ready.then(medir);
    return () => {
      cancelado = true;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assinatura, estado.pagSelecionada, estado.verTodas, e.zoom]);

  /** Mede uma página: retorna estouro se o fundo de algum cartão passar de 1308. */
  function medirPagina(pag: HTMLElement): Estouro | undefined {
    const rect = pag.getBoundingClientRect();
    // getBoundingClientRect já vem multiplicado por z; convertemos de volta para px da arte.
    let altura = 0;
    let cartaoId: string | undefined;
    for (const c of pag.querySelectorAll<HTMLElement>("[data-cartao]")) {
      const fundo = (c.getBoundingClientRect().bottom - rect.top) / z;
      if (fundo > altura) altura = fundo;
      // o primeiro cartão cujo fundo passa de 1308 é o que será cortado no PDF
      if (fundo >= ALTURA_PAGINA && cartaoId === undefined) {
        cartaoId = c.dataset.cartao ?? undefined;
      }
    }
    if (altura >= ALTURA_PAGINA) return { altura: Math.round(altura), cartaoId };
    return undefined;
  }

  function medirEstouros(): void {
    const el = container.current;
    if (!el) return;
    const mapa = new Map<string, Estouro>();
    el.querySelectorAll<HTMLElement>(".pagina").forEach((pag) => {
      const estouro = medirPagina(pag);
      if (estouro) mapa.set(pag.dataset.pagina ?? "", estouro);
    });
    const assinaturaMapa = [...mapa.entries()]
      .map(([k, v]) => `${k}:${v.altura}:${v.cartaoId ?? ""}`)
      .join("|");
    if (assinaturaMapa !== ultimoMapa.current) {
      ultimoMapa.current = assinaturaMapa;
      aoEstouro?.(mapa);
    }
  }

  // Clique em bloco: seleciona no painel direito.
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

  const { campanha, catalogos } = e;
  if (!campanha || !catalogos) return <main className="canvas" ref={container} />;

  const paginas = campanha.paginas
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => (estado.verTodas ? true : i === estado.pagSelecionada));

  // id do bloco selecionado (para a regra de outline via <style> do React).
  const sel = estado.blocoSelecionado;
  const paginaSel = campanha.paginas[estado.pagSelecionada];
  const blocoSelId = sel && paginaSel ? paginaSel.cartoes[sel.ci]?.blocos[sel.bi]?.id : undefined;
  const cabeNaPagina = paginaSel ? !estouros.has(paginaSel.id) : true;

  /** Seleciona o primeiro bloco do cartão que estourou. */
  function selecionarCartaoEstourado(paginaId: string, cartaoId: string): void {
    const idx = campanha!.paginas.findIndex((p) => p.id === paginaId);
    const pagina = campanha!.paginas[idx];
    if (!pagina) return;
    const ci = pagina.cartoes.findIndex((c) => c.id === cartaoId);
    if (ci < 0) return;
    selecionarPagina(idx);
    selecionarBloco(ci, 0);
    notificarConteudo();
  }

  return (
    <main className="canvas" ref={container}>
      {blocoSelId && (
        <style>{`
          .arte [data-bloco="${CSS.escape(blocoSelId)}"] {
            outline: 2px solid var(--primary);
            outline-offset: 4px;
            position: relative;
          }
          .arte [data-bloco="${CSS.escape(blocoSelId)}"]::before {
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
        `}</style>
      )}
      {paginas.map(({ p, i }) => {
        const estouro = estouros.get(p.id);
        const cartao = estouro?.cartaoId
          ? p.cartoes.find((c) => c.id === estouro.cartaoId)
          : undefined;
        const nomeCartao = cartao?.titulo[0] ?? estouro?.cartaoId ?? "um cartão";
        const excesso = estouro ? Math.max(0, Math.round(estouro.altura - ALTURA_PAGINA)) : 0;
        return (
          <Fragment key={p.id}>
            {estouro && (
              <button
                className="aviso-estouro"
                type="button"
                onClick={() => {
                  if (estouro.cartaoId) selecionarCartaoEstourado(p.id, estouro.cartaoId);
                }}
              >
                <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />
                <span>
                  Conteúdo passa da página em {excesso} px (cartão: {nomeCartao}). O excedente será cortado no PDF.
                </span>
              </button>
            )}
            <div className="moldura" style={{ width: w, height: h }} onClick={() => selecionarPagina(i)}>
              <div
                className="escala arte"
                style={{
                  width: LARGURA_PAGINA,
                  height: ALTURA_PAGINA,
                  transform: `scale(${z})`,
                  transformOrigin: "top left",
                }}
                dangerouslySetInnerHTML={{ __html: renderPagina(p, { campanha, catalogos }) }}
              />
            </div>
          </Fragment>
        );
      })}
      <ZoomBar
        zoom={e.zoom}
        aoMudarZoom={(novo) => definirZoom(novo)}
        ajustado={e.zoomAjustado}
        aoAlternarAjuste={(ajustado) => alternarAjusteTela(ajustado)}
        cabeNaPagina={cabeNaPagina}
      />
    </main>
  );
}
