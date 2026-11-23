// Painel esquerdo: busca de páginas + lista com miniaturas reais e reordenação.
// Phase 3: itens ~64px, thumbnail 34×48, "n · <empreendimento>", grip à direita.
import { useMemo, useState } from "react";
import type { DragEvent, JSX } from "react";
import { renderCampanha } from "../../shared/render.js";
import { Pagina } from "../../shared/schema.js";
import { modeloDe } from "../store.js";
import { estado, useEstado, marcarSujo, notificarConteudo, selecionarPagina } from "../store.js";
import { SearchField } from "../ui/SearchField.js";
import { Button } from "../ui/Button.js";
import { GripVertical, CopyPlus, Trash2 } from "lucide-react";

const LARGURA_THUMB = 34;
const ALTURA_THUMB = 48;
const ESCALA_THUMB = LARGURA_THUMB / 924;

type Props = {
  estouros: Map<string, { altura: number; cartaoId?: string }>;
  somenteLeitura: boolean;
};

export function LeftRail({ estouros, somenteLeitura }: Props): JSX.Element {
  const e = useEstado();
  const [busca, setBusca] = useState("");
  const [de, setDe] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  if (!e.campanha || !e.catalogos) return <aside className="left-rail" />;
  const c = e.campanha;

  /** Solta a página arrastada no índice j. */
  function soltar(j: number): void {
    if (de === null || de === j) { setDe(null); setSobre(null); return; }
    const selId = c.paginas[estado.pagSelecionada]?.id;
    const [movida] = c.paginas.splice(de, 1);
    c.paginas.splice(j, 0, movida as Pagina);
    if (selId) estado.pagSelecionada = Math.max(0, c.paginas.findIndex((p) => p.id === selId));
    setDe(null); setSobre(null);
    marcarSujo();
  }

  const paginasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return c.paginas.map((_, i) => i);
    return c.paginas
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => {
        // busca na faixa da página, nos títulos dos blocos e no empreendimento
        if (p.faixa?.toLowerCase().includes(q)) return true;
        if (p.cartoes.some((car) => car.titulo.some((t) => t.toLowerCase().includes(q)))) return true;
        return p.cartoes.some((car) =>
          (e.catalogos?.empreendimentos.find((x) => x.id === car.empreendimentoId)?.nome ?? [])
            .some((n) => n.toLowerCase().includes(q)),
        );
      })
      .map(({ i }) => i);
  }, [c.paginas, busca, e.catalogos]);

  function adicionarPagina(): void {
    const modeloId = (document.getElementById("novo-modelo-rail") as HTMLSelectElement)?.value ?? "residencial";
    const modelo = modeloDe(modeloId);
    const n = Math.max(modelo?.minCartoes ?? 1, 1);
    const faixa = modelo?.faixaPorCartao ? undefined : "Nova faixa";
    const nova = {
      id: crypto.randomUUID().slice(0, 8),
      modelo: modeloId,
      ...(faixa !== undefined ? { faixa } : {}),
      cartoes: Array.from({ length: n }, () => ({
        id: crypto.randomUUID().slice(0, 8),
        empreendimentoId: null,
        titulo: ["Condições para o ..."],
        blocos: [{ id: crypto.randomUUID().slice(0, 8), tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "" }],
      })),
    };
    c.paginas.push(nova as Pagina);
    estado.pagSelecionada = c.paginas.length - 1;
    marcarSujo();
    notificarConteudo();
  }

  return (
    <aside className="left-rail">
      <div className="rail-busca">
        <SearchField
          value={busca}
          onChange={(ev) => setBusca(ev.target.value)}
          placeholder="Buscar página (N)"
          id="busca-pagina-rail"
        />
      </div>
      <div className="rail-lista">
        {paginasFiltradas.map((i) => {
          const p = c.paginas[i];
          if (!p) return null;
          const modelo = modeloDe(p.modelo);
          const empId = p.cartoes[0]?.empreendimentoId;
          const emp = empId ? e.catalogos?.empreendimentos.find((x) => x.id === empId) : undefined;
          const nomeEmp = (emp?.nome[0]) ?? p.faixa ?? `Página ${i + 1}`;
          const estouro = estouros.get(p.id);
          return (
            <ItemPagina
              key={p.id}
              pag={p}
              i={i}
              total={c.paginas.length}
              empNome={nomeEmp}
              modeloNome={modelo?.nome ?? p.modelo}
              estouro={estouro}
              arrastando={de === i}
              soltarAqui={de !== null && sobre === i && de !== i}
              somenteLeitura={somenteLeitura}
              aoArrastar={(ev) => {
                ev.dataTransfer.setData("text/plain", String(i));
                ev.dataTransfer.effectAllowed = "move";
                setDe(i);
              }}
              aoPassar={(ev) => { ev.preventDefault(); setSobre(i); }}
              aoSair={() => setSobre((s) => (s === i ? null : s))}
              aoSoltar={(ev) => { ev.preventDefault(); soltar(i); }}
              aoTerminar={() => { setDe(null); setSobre(null); }}
              aoMoverCima={() => { if (i > 0) moverPagina(i, i - 1); }}
              aoMoverBaixo={() => { if (i < c.paginas.length - 1) moverPagina(i, i + 1); }}
              aoDuplicar={() => duplicarPagina(i)}
              aoExcluir={() => excluirPagina(i)}
            />
          );
        })}
      </div>
      {!somenteLeitura && (
        <div className="rail-add">
          <select id="novo-modelo-rail" aria-label="Modelo da nova página">
            {e.catalogos.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
          <button className="btn primario bloco" onClick={adicionarPagina}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              + Página
            </span>
          </button>
        </div>
      )}
      <label className="rail-checkbox inline">
        <input
          type="checkbox"
          checked={e.verTodas}
          onChange={(ev) => { estado.verTodas = ev.target.checked; notificarConteudo(); }}
        />
        Ver todas as páginas na prévia
      </label>
    </aside>
  );

  function moverPagina(origem: number, destino: number): void {
    const ps = c.paginas;
    [ps[origem], ps[destino]] = [ps[destino] as Pagina, ps[origem] as Pagina];
    if (estado.pagSelecionada === origem) estado.pagSelecionada = destino;
    else if (estado.pagSelecionada === destino) estado.pagSelecionada = origem;
    marcarSujo();
    notificarConteudo();
  }

  function duplicarPagina(i: number): void {
    const ps = c.paginas;
    const pagina = ps[i];
    if (!pagina) return;
    ps.splice(i + 1, 0, JSON.parse(JSON.stringify(pagina)) as Pagina);
    estado.pagSelecionada = i + 1;
    marcarSujo();
    notificarConteudo();
  }

  function excluirPagina(i: number): void {
    if (!window.confirm("Mover esta página para a lixeira?")) return;
    const ps = c.paginas;
    ps.splice(i, 1);
    estado.pagSelecionada = Math.min(estado.pagSelecionada, Math.max(0, ps.length - 1));
    marcarSujo();
    notificarConteudo();
  }
}

type ItemProps = {
  pag: Pagina;
  i: number;
  total: number;
  empNome: string;
  modeloNome: string;
  estouro?: { altura: number; cartaoId?: string };
  arrastando: boolean;
  soltarAqui: boolean;
  somenteLeitura: boolean;
  aoArrastar: (ev: DragEvent) => void;
  aoPassar: (ev: DragEvent) => void;
  aoSair: () => void;
  aoSoltar: (ev: DragEvent) => void;
  aoTerminar: () => void;
  aoMoverCima: () => void;
  aoMoverBaixo: () => void;
  aoDuplicar: () => void;
  aoExcluir: () => void;
};

function ItemPagina({
  pag,
  i,
  empNome,
  modeloNome,
  estouro,
  arrastando,
  soltarAqui,
  somenteLeitura,
  aoArrastar,
  aoPassar,
  aoSair,
  aoSoltar,
  aoTerminar,
  aoMoverCima,
  aoMoverBaixo,
  aoDuplicar,
  aoExcluir,
  total,
}: ItemProps): JSX.Element {
  const e = useEstado();
  const selecionado = i === e.pagSelecionada;

  // HTML da miniatura memoizado pelo conteúdo da página. O cálculo fica AQUI
  // (e não no map do painel): hooks dentro de .map quebram quando o filtro de
  // busca muda o número de itens renderizados.
  const html = useMemo(
    () => (e.campanha && e.catalogos ? renderCampanha({ ...e.campanha, paginas: [pag] }, e.catalogos) : ""),
    [JSON.stringify(pag), e.campanha, e.catalogos],
  );

  const cls = [
    "rail-item",
    selecionado ? "selecionado" : "",
    arrastando ? "arrastando" : "",
    soltarAqui ? "soltar-aqui" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={cls}
      draggable={!somenteLeitura}
      onDragStart={somenteLeitura ? undefined : aoArrastar}
      onDragOver={somenteLeitura ? undefined : aoPassar}
      onDragLeave={somenteLeitura ? undefined : aoSair}
      onDrop={somenteLeitura ? undefined : aoSoltar}
      onDragEnd={somenteLeitura ? undefined : aoTerminar}
      onClick={() => { selecionarPagina(i); }}
    >
      <div className="rail-mini">
        <span className="rail-mini-escala arte"
          style={{ transform: `scale(${ESCALA_THUMB})`, width: LARGURA_THUMB, height: ALTURA_THUMB }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        {estouro !== undefined && (
          <span className="rail-estouro" title={`Conteúdo maior que a página (${estouro.altura}px)`}>!</span>
        )}
      </div>
      <div className="rail-info">
        <div className="rail-nome">{i + 1} · {empNome}</div>
        <div className="rail-modelo">{modeloNome} · {pag.cartoes.length} cartão(ões)</div>
      </div>
      <div className="rail-grip">
        <GripVertical size={14} strokeWidth={2} />
      </div>
      <div className="rail-acoes">
        {!somenteLeitura && (
          <>
            <button className="icone" aria-label="Subir página" disabled={i === 0} onClick={aoMoverCima}>▲</button>
            <button className="icone" aria-label="Descer página" disabled={i === total - 1} onClick={aoMoverBaixo}>▼</button>
            <button className="icone" aria-label="Duplicar página" onClick={aoDuplicar}>
              <CopyPlus size={14} strokeWidth={2} />
            </button>
            <button className="icone perigo" aria-label="Excluir página" onClick={aoExcluir}>
              <Trash2 size={14} strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
