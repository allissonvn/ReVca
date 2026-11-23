// Painel direito: propriedades da campanha, da página e dos cartões/blocos.
// A digitação usa CampoCor nos campos coloráveis; o resto é onChange direto.
import { useState } from "react";
import type { DragEvent, JSX } from "react";
import { Bloco, Cartao, Pagina } from "../../shared/schema.js";
import { BlocoSchema, CartaoSchema, PaginaSchema } from "../../shared/schema.js";
import { empreendimentoDe, modeloDe, tipoBlocoDe, estado, useEstado, marcarSujo } from "../store.js";
import { CampoCor } from "./CampoCor.js";

export function PainelPropriedades({ onDuplicar }: { onDuplicar: () => void }): JSX.Element | null {
  const e = useEstado();
  const c = e.campanha;
  if (!c || !e.catalogos) return <aside className="painel-props" />;
  const pag = c.paginas[e.pagSelecionada];

  return (
    <aside className="painel-props">
      {/* ---- Campanha ---- */}
      <section className="cartao-props">
        <h2>Campanha</h2>
        <label>Título
          <input value={c.titulo} aria-label="Título da campanha"
            onChange={(ev) => { c.titulo = ev.target.value; marcarSujo(); }} />
        </label>
        <label>Rodapé (opcional)
          <input value={c.rodape ?? ""} placeholder="Ex.: Validade: 30/11" aria-label="Rodapé das páginas"
            onChange={(ev) => { if (ev.target.value) c.rodape = ev.target.value; else delete c.rodape; marcarSujo(); }} />
        </label>
        <button className="btn fantasma bloco" onClick={onDuplicar} title="Cria uma cópia desta campanha para outro mês">
          Duplicar para outro mês
        </button>
      </section>

      {/* ---- Página ---- */}
      {pag && <SecaoPagina pag={pag} />}

      {/* ---- Cartões ---- */}
      {pag?.cartoes.map((car, ci) => (
        <SecaoCartao key={car.id} car={car} ci={ci} faixaPorCartao={modeloDe(pag.modelo)?.faixaPorCartao === true} />
      ))}
    </aside>
  );
}

function SecaoPagina({ pag }: { pag: Pagina }): JSX.Element | null {
  const e = useEstado();
  const modelo = modeloDe(pag.modelo);
  if (!modelo || !e.catalogos) return null;
  return (
    <section className="cartao-props">
      <h2>Página {estado.pagSelecionada + 1}</h2>
      <label>Modelo
        <select value={pag.modelo} aria-label="Modelo da página"
          onChange={(ev) => {
            const novo = modeloDe(ev.target.value);
            if (!novo) return;
            const teste = { ...pag, modelo: novo.id };
            if (!PaginaSchema.safeParse(teste).success) return;
            pag.modelo = novo.id;
            // ajusta a quantidade de cartões respeitando min/max do modelo
            while (pag.cartoes.length > novo.maxCartoes) pag.cartoes.pop();
            while (pag.cartoes.length < novo.minCartoes) pag.cartoes.push(cartaoEmBranco());
            marcarSujo();
          }}>
          {e.catalogos.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </label>
      <label>Faixa azul
        <input value={pag.faixa ?? ""} disabled={modelo.faixaPorCartao} aria-label="Faixa azul da página"
          onChange={(ev) => { pag.faixa = ev.target.value; marcarSujo(); }} />
      </label>
      {modelo.faixaPorCartao && <p className="dica">Neste modelo cada cartão tem a própria faixa azul.</p>}
    </section>
  );
}

function SecaoCartao({ car, ci, faixaPorCartao }: { car: Cartao; ci: number; faixaPorCartao: boolean }): JSX.Element | null {
  const e = useEstado();
  const [bloDe, setBloDe] = useState<number | null>(null);
  const [bloSobre, setBloSobre] = useState<number | null>(null);
  if (!e.catalogos) return null;
  const emp = empreendimentoDe(car.empreendimentoId);

  /** Solta o bloco arrastado no índice j. */
  function soltarBloco(j: number): void {
    if (bloDe === null || bloDe === j) { setBloDe(null); setBloSobre(null); return; }
    const [movido] = car.blocos.splice(bloDe, 1);
    car.blocos.splice(j, 0, movido as Bloco);
    setBloDe(null); setBloSobre(null);
    marcarSujo();
  }

  return (
    <section className="cartao-props">
      <h2>Cartão {ci + 1}{emp ? ` — ${emp.nome[0] ?? ""}` : ""}</h2>

      <label>Empreendimento
        <select value={car.empreendimentoId ?? ""} aria-label={`Empreendimento do cartão ${ci + 1}`}
          onChange={(ev) => {
            car.empreendimentoId = ev.target.value || null;
            const escolhido = empreendimentoDe(car.empreendimentoId);
            if (escolhido) {
              car.titulo = [...escolhido.nome];
              // a faixa azul acompanha o empreendimento (do cartão ou da página)
              if (escolhido.faixa) {
                const pag = estado.campanha?.paginas[estado.pagSelecionada];
                if (modeloDe(pag?.modelo ?? "")?.faixaPorCartao) car.faixa = escolhido.faixa;
                else if (pag) pag.faixa = escolhido.faixa;
              }
            }
            marcarSujo();
          }}>
          <option value="">(sem catálogo)</option>
          {e.catalogos.empreendimentos.map((x) => (
            <option key={x.id} value={x.id}>{x.nome[0] ?? x.id}</option>
          ))}
        </select>
      </label>

      {faixaPorCartao && (
        <label>Faixa azul do cartão
          <input value={car.faixa ?? ""} aria-label={`Faixa azul do cartão ${ci + 1}`}
            onChange={(ev) => { car.faixa = ev.target.value; marcarSujo(); }} />
        </label>
      )}

      <div className="linha">
        <label style={{ flex: 2 }}>Faixa verde, linha 1
          <CampoCor marcado={car.titulo[0] ?? ""} aria={`Faixa verde linha 1 do cartão ${ci + 1}`}
            aoMudar={(m) => { car.titulo[0] = m; marcarSujo(); }} />
        </label>
        <label style={{ flex: 2 }}>linha 2
          <CampoCor marcado={car.titulo[1] ?? ""} aria={`Faixa verde linha 2 do cartão ${ci + 1}`}
            aoMudar={(m) => { if (m) car.titulo[1] = m; else car.titulo = [car.titulo[0] ?? ""]; marcarSujo(); }} />
        </label>
      </div>

      {car.blocos.map((b, bi) => (
        <EditorBloco
          key={b.id} b={b} ci={ci} bi={bi}
          arrastando={bloDe === bi}
          soltarAqui={bloDe !== null && bloSobre === bi && bloDe !== bi}
          aoArrastarAlca={(ev) => { ev.dataTransfer.setData("text/plain", String(bi)); ev.dataTransfer.effectAllowed = "move"; setBloDe(bi); }}
          aoPassar={(ev) => { ev.preventDefault(); setBloSobre(bi); }}
          aoSair={() => setBloSobre((s) => (s === bi ? null : s))}
          aoSoltar={(ev) => { ev.preventDefault(); soltarBloco(bi); }}
          aoTerminar={() => { setBloDe(null); setBloSobre(null); }}
        />
      ))}

      <div className="linha">
        <select data-car={ci} aria-label="Tipo do novo bloco" className="novo-bloco-tipo">
          {e.catalogos.tiposBloco.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
        <button className="btn bloco" onClick={(ev) => {
          const select = (ev.target as HTMLElement).parentElement?.querySelector<HTMLSelectElement>(".novo-bloco-tipo");
          const tipoId = select?.value ?? "texto";
          const tipo = tipoBlocoDe(tipoId);
          car.blocos.push(BlocoSchema.parse({
            id: crypto.randomUUID().slice(0, 8),
            tipo: tipoId,
            ativo: true,
            largura: tipo?.largura ?? 2,
            titulo: tipo?.tituloPadrao ?? "",
            tituloCor: tipo?.tituloCor ?? "preto",
            texto: "",
          }));
          marcarSujo();
        }}>+ Bloco</button>
      </div>
    </section>
  );
}

type PropsBloco = {
  b: Bloco; ci: number; bi: number;
  arrastando: boolean; soltarAqui: boolean;
  aoArrastarAlca: (ev: DragEvent) => void;
  aoPassar: (ev: DragEvent) => void;
  aoSair: () => void;
  aoSoltar: (ev: DragEvent) => void;
  aoTerminar: () => void;
};

function EditorBloco({ b, ci, bi, arrastando, soltarAqui, aoArrastarAlca, aoPassar, aoSair, aoSoltar, aoTerminar }: PropsBloco): JSX.Element | null {
  const e = useEstado();
  if (!e.catalogos) return null;
  const tipo = tipoBlocoDe(b.tipo);
  const pronto = e.catalogos.titulos.find((t) => t.texto === b.titulo);

  return (
    <div
      className={`bloco-item${b.ativo ? "" : " desligado"}${arrastando ? " arrastando" : ""}${soltarAqui ? " soltar-aqui" : ""}`}
      onDragOver={aoPassar}
      onDragLeave={aoSair}
      onDrop={aoSoltar}
    >
      <div className="topo">
        {/* a alça é quem arrasta: evitar tornar o item todo draggable
            (quebra a seleção de texto dentro dos campos) */}
        <span
          className="alca"
          draggable
          onDragStart={aoArrastarAlca}
          onDragEnd={aoTerminar}
          title="Arraste para reordenar"
          aria-label={`Mover bloco ${bi + 1}`}
        >⠿</span>
        <label className="inline">
          <input type="checkbox" checked={b.ativo} aria-label="Bloco ligado/desligado"
            onChange={(ev) => { b.ativo = ev.target.checked; marcarSujo(); }} />
          {tipo?.nome ?? b.tipo}
        </label>
        <div className="pag-acoes">
          <button className="icone" aria-label="Subir bloco" disabled={bi === 0} onClick={() => {
            const blocos = estado.campanha!.paginas[estado.pagSelecionada]!.cartoes[ci]!.blocos;
            [blocos[bi - 1], blocos[bi]] = [blocos[bi] as Bloco, blocos[bi - 1] as Bloco];
            marcarSujo();
          }}>▲</button>
          <button className="icone" aria-label="Descer bloco" onClick={() => {
            const blocos = estado.campanha!.paginas[estado.pagSelecionada]!.cartoes[ci]!.blocos;
            if (bi >= blocos.length - 1) return;
            [blocos[bi], blocos[bi + 1]] = [blocos[bi + 1] as Bloco, blocos[bi] as Bloco];
            marcarSujo();
          }}>▼</button>
          <button className="icone perigo" aria-label="Remover bloco" onClick={() => {
            const car = estado.campanha!.paginas[estado.pagSelecionada]!.cartoes[ci]!;
            car.blocos.splice(bi, 1);
            marcarSujo();
          }}>×</button>
        </div>
      </div>

      <div className="linha">
        <label style={{ flex: 2 }}>Título pronto
          <select value={pronto ? pronto.texto : b.titulo === "" ? "" : "…"} aria-label="Título pronto do bloco"
            onChange={(ev) => {
              const p = e.catalogos?.titulos.find((x) => x.texto === ev.target.value);
              if (p) { b.titulo = p.texto; b.tituloCor = p.cor; marcarSujo(); }
            }}>
            <option value="">(sem título)</option>
            {e.catalogos.titulos.map((t) => <option key={t.texto} value={t.texto}>{t.texto}</option>)}
            {!pronto && b.titulo !== "" && <option value="…">(personalizado)</option>}
          </select>
        </label>
        <label style={{ flex: 1 }}>Cor do título
          <select value={b.tituloCor} aria-label="Cor do título do bloco"
            onChange={(ev) => { if (ev.target.value === "preto" || ev.target.value === "vermelho") { b.tituloCor = ev.target.value; marcarSujo(); } }}>
            <option value="preto">Preto</option>
            <option value="vermelho">Vermelho</option>
          </select>
        </label>
      </div>

      <label>Título (texto livre)
        <CampoCor marcado={b.titulo} aria="Título do bloco"
          aoMudar={(m) => { b.titulo = m; marcarSujo(); }} />
      </label>

      <label>Texto (uma linha = um chip)
        <CampoCor marcado={b.texto} multilinea aria="Texto do bloco"
          aoMudar={(m) => { b.texto = m; marcarSujo(); }} />
      </label>

      <label>Largura
        <select value={b.largura} aria-label="Largura do bloco"
          onChange={(ev) => { const l = Number(ev.target.value); if (l === 1 || l === 2) { b.largura = l; marcarSujo(); } }}>
          <option value="2">Linha inteira</option>
          <option value="1">Meia coluna</option>
        </select>
      </label>
    </div>
  );
}

function cartaoEmBranco(): Cartao {
  return CartaoSchema.parse({
    id: crypto.randomUUID().slice(0, 8),
    empreendimentoId: null,
    titulo: ["Condições para o ..."],
    blocos: [{ id: crypto.randomUUID().slice(0, 8), tipo: "texto", ativo: true, largura: 2, titulo: "", tituloCor: "preto", texto: "" }],
  });
}
