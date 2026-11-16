import type { JSX } from "react";
// Modal de exportação: formato (PDF/PNG) × páginas (todas/atual) × qualidade.
import { useState } from "react";
import { estado } from "../store.js";
import { nomeExportacao, OpcoesExport } from "../exportar.js";

type Props = {
  aoFechar: () => void;
  aoExportar: (opcoes: OpcoesExport) => void;
};

export function ModalExportar({ aoFechar, aoExportar }: Props): JSX.Element {
  const c = estado.campanha;
  const [formato, setFormato] = useState<"pdf" | "png">("pdf");
  const [paginas, setPaginas] = useState<"todas" | "atual">("todas");
  const [qualidade, setQualidade] = useState<"alta" | "comprimida">("alta");

  if (!c) return <div className="modal" onClick={aoFechar} />;

  const pagina: "todas" | number = paginas === "atual" ? estado.pagSelecionada + 1 : "todas";
  const dica = `${nomeExportacao(c, formato, pagina)}${
    formato === "png" && paginas === "todas" ? ` (são ${c.paginas.length} arquivos, um por página)` : ""
  }`;

  return (
    <div className="modal" onClick={aoFechar}>
      <div className="modal-caixa" role="dialog" aria-modal="true" aria-label="Opções de exportação" onClick={(e) => e.stopPropagation()}>
        <h2>Exportar campanha</h2>

        <fieldset>
          <legend hidden>Formato</legend>
          <h3>Formato</h3>
          <label className="inline"><input type="radio" name="exp-formato" checked={formato === "pdf"} onChange={() => setFormato("pdf")} /> PDF (documento)</label>
          <label className="inline"><input type="radio" name="exp-formato" checked={formato === "png"} onChange={() => setFormato("png")} /> PNG (imagens por página)</label>
        </fieldset>

        <fieldset>
          <legend hidden>Páginas</legend>
          <h3>Páginas ({c.paginas.length})</h3>
          <label className="inline"><input type="radio" name="exp-paginas" checked={paginas === "todas"} onChange={() => setPaginas("todas")} /> Todas ({c.paginas.length})</label>
          <label className="inline"><input type="radio" name="exp-paginas" checked={paginas === "atual"} onChange={() => setPaginas("atual")} /> Só a página selecionada ({estado.pagSelecionada + 1})</label>
        </fieldset>

        <fieldset>
          <legend hidden>Qualidade</legend>
          <h3>Qualidade</h3>
          <label className="inline"><input type="radio" name="exp-qual" checked={qualidade === "alta"} onChange={() => setQualidade("alta")} /> Alta — melhor aparência</label>
          <label className="inline"><input type="radio" name="exp-qual" checked={qualidade === "comprimida"} onChange={() => setQualidade("comprimida")} /> Comprimida — mais leve (rasterizada), boa para WhatsApp</label>
        </fieldset>

        <p className="dica">Arquivo: {dica}</p>

        <div className="linha fim">
          <button className="btn fantasma" onClick={aoFechar}>Cancelar</button>
          <button className="btn primario" onClick={() => { aoFechar(); aoExportar({ formato, qualidade, pagina }); }}>Exportar</button>
        </div>
      </div>
    </div>
  );
}
