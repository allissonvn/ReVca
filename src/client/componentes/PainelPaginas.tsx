// Barra lateral esquerda: páginas com MINIATURA REAL (mesmo render.ts),
// reordenação por arrastar-e-soltar (setas mantidas p/ teclado), adicionar
// página com modelo e "ver todas".
import { useMemo, useState } from "react";
import type { DragEvent, JSX } from "react";
import { renderCampanha } from "../../shared/render.js";
import { Pagina } from "../../shared/schema.js";
import { BlocoSchema, CartaoSchema, PaginaSchema } from "../../shared/schema.js";
import { estado, useEstado, modeloDe, marcarSujo, notificarConteudo } from "../store.js";

const LARGURA_THUMB = 112;
const ESCALA_THUMB = LARGURA_THUMB / 924;

type Props = { estouros: Map<string, number>; somenteLeitura?: boolean };

export function PainelPaginas({ estouros, somenteLeitura = false }: Props): JSX.Element {
  const e = useEstado();
  const [de, setDe] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  if (!e.campanha || !e.catalogos) return <aside className="painel-paginas" />;
  const c = e.campanha;

  /** Solta a página arrastada no índice j (a seleção acompanha a página). */
  function soltar(j: number): void {
    if (de === null || de === j) { setDe(null); setSobre(null); return; }
    const selId = c.paginas[estado.pagSelecionada]?.id;
    const [movida] = c.paginas.splice(de, 1);
    c.paginas.splice(j, 0, movida as Pagina);
    if (selId) estado.pagSelecionada = Math.max(0, c.paginas.findIndex((p) => p.id === selId));
    setDe(null); setSobre(null);
    marcarSujo();
  }

  return (
    <aside className="painel-paginas">
      <h2 className="painel-titulo">Páginas <small>({c.paginas.length})</small></h2>
      <div className="pag-lista">
        {c.paginas.map((p, i) => (
          <ItemPagina
            key={p.id}
            pag={p} i={i} total={c.paginas.length}
            estouro={estouros.get(p.id)}
            arrastando={de === i}
            soltarAqui={de !== null && sobre === i && de !== i}
            somenteLeitura={somenteLeitura}
            aoArrastar={(ev) => { ev.dataTransfer.setData("text/plain", String(i)); ev.dataTransfer.effectAllowed = "move"; setDe(i); }}
            aoPassar={(ev) => { ev.preventDefault(); setSobre(i); }}
            aoSair={() => setSobre((s) => (s === i ? null : s))}
            aoSoltar={(ev) => { ev.preventDefault(); soltar(i); }}
            aoTerminar={() => { setDe(null); setSobre(null); }}
          />
        ))}
      </div>
      {!somenteLeitura && (
        <div className="pag-add">
          <select id="novo-modelo" aria-label="Modelo da nova página">
            {e.catalogos.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button className="btn primario bloco" onClick={adicionarPagina}>+ Página</button>
        </div>
      )}
      <label className="inline">
        <input
          type="checkbox"
          checked={e.verTodas}
          onChange={(ev) => { estado.verTodas = ev.target.checked; notificarConteudo(); }}
        />
        Ver todas as páginas na prévia
      </label>
    </aside>
  );
}

type PropsItem = {
  pag: Pagina; i: number; total: number;
  estouro?: number;
  arrastando: boolean; soltarAqui: boolean;
  somenteLeitura: boolean;
  aoArrastar: (ev: DragEvent) => void;
  aoPassar: (ev: DragEvent) => void;
  aoSair: () => void;
  aoSoltar: (ev: DragEvent) => void;
  aoTerminar: () => void;
};

function ItemPagina({ pag, i, total, estouro, arrastando, soltarAqui, somenteLeitura, aoArrastar, aoPassar, aoSair, aoSoltar, aoTerminar }: PropsItem): JSX.Element {
  const e = useEstado();
  const modelo = modeloDe(pag.modelo);

  // HTML da miniatura memoizado pelo conteúdo da página: digitar num campo
  // não reconstrói o DOM das outras páginas (React só troca se o __html mudar)
  const html = useMemo(
    () => (e.campanha && e.catalogos ? renderCampanha({ ...e.campanha, paginas: [pag] }, e.catalogos) : ""),
    [JSON.stringify(pag), e.catalogos],
  );

  function mover(delta: number): void {
    const ps = estado.campanha!.paginas;
    const j = i + delta;
    [ps[i], ps[j]] = [ps[j] as Pagina, ps[i] as Pagina];
    if (estado.pagSelecionada === i) estado.pagSelecionada = j;
    marcarSujo();
  }

  return (
    <div
      className={`pag-item${i === e.pagSelecionada ? " atual" : ""}${arrastando ? " arrastando" : ""}${soltarAqui ? " soltar-aqui" : ""}`}
      // leitor só seleciona: item não é arrastável nem recebe soltura
      draggable={!somenteLeitura}
      onDragStart={somenteLeitura ? undefined : aoArrastar}
      onDragOver={somenteLeitura ? undefined : aoPassar}
      onDragLeave={somenteLeitura ? undefined : aoSair}
      onDrop={somenteLeitura ? undefined : aoSoltar}
      onDragEnd={somenteLeitura ? undefined : aoTerminar}
    >
      <button
        className="pag-nome"
        title={`Abrir página ${i + 1}`}
        onClick={() => { estado.pagSelecionada = i; notificarConteudo(); }}
      >
        <span className="pag-mini" style={{ width: LARGURA_THUMB, height: Math.round(1308 * ESCALA_THUMB) }}>
          <span
            className="pag-mini-escala"
            style={{ transform: `scale(${ESCALA_THUMB})`, width: LARGURA_THUMB, height: Math.round(1308 * ESCALA_THUMB) }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </span>
        <span className="pag-desc">
          <span className="pag-num">{i + 1}</span>
          <b>{pag.faixa || pag.cartoes[0]?.faixa || "Sem faixa"}</b>
          <small>{modelo?.nome ?? pag.modelo} · {pag.cartoes.length} cartão(ões)</small>
          {estouro !== undefined && <span className="aviso" title={`Conteúdo maior que a página (${estouro}px)`}>! {estouro}px</span>}
        </span>
      </button>
      {!somenteLeitura && (
        <div className="pag-acoes">
          <button className="icone" aria-label="Subir página" disabled={i === 0} onClick={() => mover(-1)}>▲</button>
          <button className="icone" aria-label="Descer página" disabled={i === total - 1} onClick={() => mover(1)}>▼</button>
          <button className="icone" aria-label="Duplicar página" onClick={() => {
            const ps = estado.campanha!.paginas;
            ps.splice(i + 1, 0, JSON.parse(JSON.stringify(pag)) as Pagina);
            estado.pagSelecionada = i + 1;
            marcarSujo();
          }}>duplicar</button>
          <button className="icone perigo" aria-label="Excluir página" onClick={() => {
            const ps = estado.campanha!.paginas;
            ps.splice(i, 1);
            estado.pagSelecionada = Math.min(estado.pagSelecionada, Math.max(0, ps.length - 1));
            marcarSujo();
          }}>✕</button>
        </div>
      )}
    </div>
  );
}

// (sem auxiliar local: o onDragLeave do item limpa o realce via aoSair)

function adicionarPagina(): void {
  const c = estado.campanha;
  if (!c) return;
  const modeloId = (document.getElementById("novo-modelo") as HTMLSelectElement)?.value ?? "residencial";
  const modelo = modeloDe(modeloId);
  const n = Math.max(modelo?.minCartoes ?? 1, 1);
  const faixa = modelo?.faixaPorCartao ? undefined : "Nova faixa";
  const nova = PaginaSchema.parse({
    id: crypto.randomUUID().slice(0, 8),
    modelo: modeloId,
    ...(faixa !== undefined ? { faixa } : {}),
    cartoes: Array.from({ length: n }, () => CartaoSchema.parse({
      id: crypto.randomUUID().slice(0, 8),
      empreendimentoId: null,
      titulo: ["Condições para o ..."],
      blocos: [BlocoSchema.parse(novoBloco("texto"))],
    })),
  });
  c.paginas.push(nova);
  estado.pagSelecionada = c.paginas.length - 1;
  marcarSujo();
}

function novoBloco(tipoId: string) {
  return { id: crypto.randomUUID().slice(0, 8), tipo: tipoId, ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "" };
}
