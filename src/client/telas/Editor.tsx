// Editor: layout REVCA — Phase 3.
// Top bar 56px | left rail 272px | canvas flex | right panel 360px.
// Mantém todos os comportamentos existentes (autosave, 409, DnD, cor por seleção, export).
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { lerCampanha, lerCatalogos, criarCampanha } from "../api.js";
import {
  salvarAgora,
  estado,
  useEstado,
  alternarTema,
  notificarConteudo,
  marcarSujo,
  podeEditar,
  selecionarBloco,
  limparSelecaoBloco,
  definirZoom,
  alternarAjusteTela,
} from "../store.js";
import { LeftRail } from "../componentes/LeftRail.js";
import { RightPanel } from "../componentes/RightPanel.js";
import { Canvas } from "../componentes/Canvas.js";
import { ZoomBar } from "../componentes/ZoomBar.js";
import { ModalExportar } from "../componentes/ModalExportar.js";
import { exportar } from "../exportar.js";
import { Mark } from "../ui/Mark.js";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";
import { Calendar, Undo2, Redo2, Download, ArrowLeft, FileText, Sun, Moon, CircleCheck } from "lucide-react";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

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
        // Ensure default view: single page, not "all pages"
        estado.verTodas = false;
        estado.pagSelecionada = 0;
        estado.blocoSelecionado = null;
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

  const statusTextos: Record<string, string> = {
    salvo: "✓ Tudo salvo",
    salvando: "… Salvando",
    sujo: "● Alterações pendentes",
    erro: "✗ Erro ao salvar",
    conflito: "✗ Conflito: mudou em outro lugar",
  };

  const pagSelecionada = c.paginas[estado.pagSelecionada];
  const cabeNaPagina = pagSelecionada ? !estouros.has(pagSelecionada.id) : true;

  return (
    <div className="editor">
      {/* ===== Top bar 56px ===== */}
      <header className="topbar">
        <button
          className="btn fantasma"
          onClick={() => void voltar()}
          title="Salvar e voltar às campanhas"
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Voltar
        </button>
        <Mark tamanho={32} aria-label="REVCA — Editor" />
        <div className="topbar-campanha">
          <FileText size={16} strokeWidth={2} aria-hidden="true" />
          <input
            className="topbar-titulo"
            value={c.titulo}
            aria-label="Título da campanha"
            readOnly={leitor}
            onChange={(e) => { c.titulo = e.target.value; marcarSujo(); }}
          />
        </div>
        <div className="topbar-mes">
          <Calendar size={16} strokeWidth={2} aria-hidden="true" />
          <select
            className="topbar-mes-select"
            value={c.mes}
            aria-label="Mês da campanha"
            disabled={leitor}
            onChange={(e) => { c.mes = e.target.value as typeof c.mes; marcarSujo(); }}
          >
            {MESES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="topbar-status">
          {estado.status === "salvo" ? (
            <span className="status salvo">
              <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
              Tudo salvo
            </span>
          ) : estado.status === "salvando" ? (
            <span className="status salvando">… Salvando</span>
          ) : estado.status === "sujo" ? (
            <span className="status sujo">● Alterações pendentes</span>
          ) : estado.status === "erro" ? (
            <span className="status erro">✗ Erro ao salvar</span>
          ) : (
            <span className="status conflito">✗ Conflito: mudou em outro lugar</span>
          )}
        </div>
        <div className="topbar-acoes">
          <IconButton
            icon={Undo2}
            cor="muted"
            aria-label="Desfazer"
            onClick={() => { /* undo - Phase 4 */ }}
          />
          <IconButton
            icon={Redo2}
            cor="muted"
            aria-label="Refazer"
            onClick={() => { /* redo - Phase 4 */ }}
          />
          <Button
            variant="ghost"
            icon="Download"
            title="Exportar"
            onClick={() => { setModalAberto(true); }}
          >
            Exportar ▾
          </Button>
          <Button
            variant="primary"
            icon="Download"
            onClick={() => void exportar({ formato: "pdf", qualidade: "alta", pagina: "todas" }, setStatusExport)}
            title="PDF com todas as páginas (qualidade alta)"
          >
            Baixar PDF
          </Button>
          <IconButton
            icon={estado.tema === "escuro" ? Sun : Moon}
            cor="muted"
            aria-label="Alternar tema do painel (a arte é sempre clara)"
            onClick={alternarTema}
          />
        </div>
      </header>

      {statusExport !== "" && <div className="faixa-export" role="status">{statusExport}</div>}

      {/* ===== Corpo: left rail | canvas | right panel ===== */}
      <div className={`editor-corpo${leitor ? " leitor" : ""}`}>
        <LeftRail estouros={estouros} somenteLeitura={leitor} />
        <Canvas estouros={estouros} aoEstouro={setEstouros} />
        {!leitor && <RightPanel onDuplicar={() => void duplicar()} />}
      </div>

      {/* Status da página */}
      <div className="canvas-status">
        {cabeNaPagina ? (
          <span className="status-ok">✓ Cabe na página</span>
        ) : (
          <span className="status-estouro">⚠ Conteúdo passa do limite</span>
        )}
      </div>

      {/* Barra de zoom fixa no viewport */}
      <ZoomBar
        zoom={estado.zoom}
        aoMudarZoom={(z) => { definirZoom(z); }}
        ajustado={estado.zoomAjustado}
        aoAlternarAjuste={(ajustado) => { alternarAjusteTela(ajustado); }}
      />

      {modalAberto && (
        <ModalExportar
          aoFechar={() => setModalAberto(false)}
          aoExportar={(o) => void exportar(o, setStatusExport)}
        />
      )}
    </div>
  );
}
