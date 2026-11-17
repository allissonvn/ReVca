import type { JSX } from "react";
// Editor: layout estilo Canva — páginas à esquerda, canvas (arte real) ao
// centro, propriedades à direita, barra superior com status de salvamento.
import { useEffect, useState } from "react";
import { lerCampanha, lerCatalogos, criarCampanha } from "../api.js";
import { salvarAgora, estado, useEstado, alternarTema, notificarConteudo, marcarSujo, podeEditar } from "../store.js";import { Canvas } from "../componentes/Canvas.js";
import { PainelPaginas } from "../componentes/PainelPaginas.js";
import { PainelPropriedades } from "../componentes/PainelPropriedades.js";
import { ModalExportar } from "../componentes/ModalExportar.js";
import { exportar } from "../exportar.js";

export function Editor({ id }: { id: string }): JSX.Element {
  useEstado(); // re-render em qualquer mudança de estado/tema
  const [erro, setErro] = useState("");
  const [modalAberto, setModalAberto] = useState(false);
  const [statusExport, setStatusExport] = useState("");
  // páginas com estouro (id → altura), medido pelo canvas
  const [estouros, setEstouros] = useState(new Map<string, number>());
  // leitor: visualiza a arte e as páginas (só seleção); sem campos de edição
  const leitor = !podeEditar();

  useEffect(() => {
    void (async () => {
      try {
        const [catalogos, campanha] = await Promise.all([lerCatalogos(), lerCampanha(id)]);
        estado.catalogos = catalogos;
        estado.campanha = campanha;
        estado.pagSelecionada = 0;
        notificarConteudo();
      } catch (e) {
        setErro(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [id]);

  if (erro !== "") {
    return <div className="editor"><p className="dica erro">Não foi possível abrir a campanha: {erro}</p></div>;
  }
  if (!estado.campanha || !estado.catalogos) {
    return <div className="editor"><p className="dica">Carregando…</p></div>;
  }

  const c = estado.campanha;

  async function voltar(): Promise<void> {
    await salvarAgora();
    window.location.href = "/";
  }

  async function duplicar(): Promise<void> {
    const mes = window.prompt("Duplicar para qual mês? (em maiúsculas, ex.: DEZEMBRO)", "DEZEMBRO");
    if (!mes) return;
    await salvarAgora();
    const nova = await criarCampanha({ duplicarDe: c.id, mes });
    window.location.href = `/?campanha=${encodeURIComponent(nova.id)}`;
  }

  return (
    <div className="editor">
      <header className="topbar">
        <button className="btn fantasma" onClick={() => void voltar()} title="Salvar e voltar às campanhas">← Campanhas</button>

        <input
          className="topbar-titulo"
          value={c.titulo}
          aria-label="Título da campanha"
          readOnly={leitor}
          onChange={(e) => { c.titulo = e.target.value; marcarSujo(); }}
        />
        <select
          className="topbar-mes"
          value={c.mes}
          aria-label="Mês da campanha"
          disabled={leitor}
          onChange={(e) => { c.mes = e.target.value as typeof c.mes; marcarSujo(); }}
        >
          {["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"].map((m) => <option key={m}>{m}</option>)}
        </select>

        <IndicadorStatus />

        <div className="topbar-acoes">
          <button className="btn" onClick={() => void exportar({ formato: "pdf", qualidade: "alta", pagina: "todas" }, setStatusExport)} title="PDF com todas as páginas (qualidade alta)">⬇ PDF</button>
          <button className="btn primario" onClick={() => { setStatusExport(""); setModalAberto(true); }}>⚙ Exportar…</button>
          <button className="btn fantasma" onClick={alternarTema} title="Alternar tema do painel (a arte é sempre clara)">
            {estado.tema === "escuro" ? "☀" : "🌙"}
          </button>
        </div>
      </header>

      {statusExport !== "" && <div className="faixa-export" role="status">{statusExport}</div>}

      <div className={`editor-corpo${leitor ? " leitor" : ""}`}>
        <PainelPaginas estouros={estouros} somenteLeitura={leitor} />
        <Canvas aoEstouro={setEstouros} />
        {!leitor && <PainelPropriedades onDuplicar={() => void duplicar()} />}
      </div>

      {modalAberto && <ModalExportar aoFechar={() => setModalAberto(false)} aoExportar={(o) => void exportar(o, setStatusExport)} />}
    </div>
  );
}

/** Indicador "salvo / salvando / erro / conflito" + botão de recarregar em 409. */
function IndicadorStatus(): JSX.Element {
  const { status } = useEstado();
  const textos: Record<string, string> = {
    salvo: "✓ Tudo salvo",
    salvando: "… Salvando",
    sujo: "● Alterações pendentes",
    erro: "✗ Erro ao salvar",
    conflito: "✗ Conflito: mudou em outro lugar",
  };
  const recarregar = async (): Promise<void> => {
    const nova = await lerCampanha(estado.campanha!.id);
    estado.campanha = nova;
    estado.conflito = false;
    estado.status = "salvo";
    notificarConteudo();
  };
  return (
    <div className="status" role="status">
      <span className={`indicador ${status}`}>{textos[status] ?? ""}</span>
      {status === "conflito" && <button className="btn pequeno" onClick={() => void recarregar()}>Recarregar versão do disco</button>}
    </div>
  );
}
