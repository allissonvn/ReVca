import type { JSX } from "react";
// Canvas central: a arte real gerada por render.ts (a MESMA do exportador).
// Escala com transform e avisa quando o conteúdo passa de 1308px.
import { useLayoutEffect, useRef } from "react";
import { artCss, renderCampanha } from "../../shared/render.js";
import { estado, useEstado, notificarConteudo } from "../store.js";

const LARGURA_PAGINA = 924;
const ALTURA_PAGINA = 1308;
const TEM_ESTOURO = ALTURA_PAGINA + 2;

export function Canvas(): JSX.Element {
  const e = useEstado();
  const container = useRef<HTMLDivElement>(null);
  const cssInjetado = useRef(false);

  useLayoutEffect(() => {
    if (!cssInjetado.current) {
      const style = document.createElement("style");
      style.textContent = artCss();
      document.head.appendChild(style);
      cssInjetado.current = true;
    }
    aplicarEscala();
    const onResize = () => aplicarEscala();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  function aplicarEscala(): void {
    const el = container.current;
    if (!el) return;
    const escala = Math.max(0.2, Math.min(1, (el.clientWidth - 48) / LARGURA_PAGINA));
    el.querySelectorAll<HTMLElement>(".escala").forEach((m) => {
      m.style.transform = `scale(${escala})`;
      m.style.width = `${LARGURA_PAGINA * escala}px`;
      m.style.height = `${ALTURA_PAGINA * escala}px`;
    });
  }

  /** Altura real do conteúdo, em px da arte (ignora absolutos — a marca d'água
   * sai da página de propósito). Corrige pela escala da moldura. */
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

  const { campanha, catalogos } = e;
  if (!campanha || !catalogos) return <main className="canvas" ref={container} />;

  const paginas = estado.verTodas
    ? campanha.paginas.map((p, i) => ({ p, i }))
    : campanha.paginas.map((p, i) => ({ p, i })).filter(({ i }) => i === estado.pagSelecionada);

  return (
    <main className="canvas" ref={container}>
      {paginas.map(({ p, i }) => {
        const html = renderCampanha({ ...campanha, paginas: [p] }, catalogos);
        return (
          <div className="moldura" key={p.id} onClick={() => { if (estado.pagSelecionada !== i) { estado.pagSelecionada = i; notificarConteudo(); } }}>
            <div
              className="escala"
              // render.ts escapa todo texto do usuário; HTML seguro por construção
              dangerouslySetInnerHTML={{ __html: html }}
              ref={(el) => {
                // mede o estouro depois que o HTML entrou no DOM
                if (!el) return;
                const pag = el.querySelector<HTMLElement>(".pagina");
                if (!pag) return;
                requestAnimationFrame(() => {
                  const conteudo = alturaConteudo(pag);
                  if (conteudo > TEM_ESTOURO) {
                    const aviso = document.createElement("div");
                    aviso.className = "aviso-estouro";
                    aviso.textContent = `⚠ Conteúdo maior que a página: ${conteudo}px de 1308px. O que passar será cortado no PDF.`;
                    pag.before(aviso);
                  }
                });
              }}
            />
          </div>
        );
      })}
    </main>
  );
}
