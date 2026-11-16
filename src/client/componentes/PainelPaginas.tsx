import type { JSX } from "react";
// Barra lateral esquerda: lista de páginas (selecionar, subir, descer,
// duplicar, excluir), adicionar com modelo e "ver todas".
import { Pagina } from "../../shared/schema.js";
import { BlocoSchema, CartaoSchema, PaginaSchema } from "../../shared/schema.js";
import { estado, useEstado, modeloDe, marcarSujo, notificarConteudo } from "../store.js";

export function PainelPaginas(): JSX.Element {
  const e = useEstado();
  const c = e.campanha;
  if (!c || !e.catalogos) return <aside className="painel-paginas" />;

  return (
    <aside className="painel-paginas">
      <h2 className="painel-titulo">Páginas <small>({c.paginas.length})</small></h2>
      <div className="pag-lista">
        {c.paginas.map((p, i) => <ItemPagina key={p.id} pag={p} i={i} total={c.paginas.length} />)}
      </div>
      <div className="pag-add">
        <select id="novo-modelo" aria-label="Modelo da nova página">
          {e.catalogos.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <button className="btn primario bloco" onClick={adicionarPagina}>+ Página</button>
      </div>
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

function ItemPagina({ pag, i, total }: { pag: Pagina; i: number; total: number }): JSX.Element {
  const e = useEstado();
  const atual = i === e.pagSelecionada;
  const modelo = modeloDe(pag.modelo);
  const mover = (delta: number): void => {
    const ps = estado.campanha!.paginas;
    const j = i + delta;
    [ps[i], ps[j]] = [ps[j] as Pagina, ps[i] as Pagina];
    if (estado.pagSelecionada === i) estado.pagSelecionada = j;
    marcarSujo();
  };

  return (
    <div className={`pag-item${atual ? " atual" : ""}`}>
      <button
        className="pag-nome"
        title={`Abrir página ${i + 1}`}
        onClick={() => { estado.pagSelecionada = i; notificarConteudo(); }}
      >
        <span className="pag-num">{i + 1}</span>
        <span className="pag-desc">
          {pag.faixa || pag.cartoes[0]?.faixa || "Sem faixa"}
          <small>{modelo?.nome ?? pag.modelo} · {pag.cartoes.length} cartão(ões)</small>
        </span>
        <span className="aviso" data-aviso-pag={pag.id} hidden title="Conteúdo maior que a página">⚠</span>
      </button>
      <div className="pag-acoes">
        <button className="icone" aria-label="Subir página" disabled={i === 0} onClick={() => mover(-1)}>▲</button>
        <button className="icone" aria-label="Descer página" disabled={i === total - 1} onClick={() => mover(1)}>▼</button>
        <button className="icone" aria-label="Duplicar página" onClick={() => {
          const ps = estado.campanha!.paginas;
          ps.splice(i + 1, 0, JSON.parse(JSON.stringify(pag)) as Pagina);
          estado.pagSelecionada = i + 1;
          marcarSujo();
        }}>⧉</button>
        <button className="icone perigo" aria-label="Excluir página" onClick={() => {
          const ps = estado.campanha!.paginas;
          ps.splice(i, 1);
          estado.pagSelecionada = Math.min(estado.pagSelecionada, Math.max(0, ps.length - 1));
          marcarSujo();
        }}>✕</button>
      </div>
    </div>
  );
}

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
