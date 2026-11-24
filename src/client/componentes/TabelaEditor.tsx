// Editor da tabela de valores (bloco com `tabela`).
// Cabeçalho + linhas de dados + linhas de seção (ocupam a tabela toda).
// As células usam CampoCor: o mesmo markup de cor dos chips.
import type { CSSProperties, JSX } from "react";
import { Bloco, Tabela } from "../../shared/schema.js";
import { marcarSujo } from "../store.js";
import { CampoCor } from "./CampoCor.js";
import { IconButton } from "../ui/IconButton.js";
import { Bold, Minus, Plus, Rows3, Trash2 } from "lucide-react";

const MIN_COLUNAS = 2;
const MAX_COLUNAS = 5;

export function TabelaEditor({ bloco }: { bloco: Bloco }): JSX.Element | null {
  if (!bloco.tabela) return null;
  const t: Tabela = bloco.tabela;
  const colunas = t.cabecalho.length;

  function mudarColunas(delta: number): void {
    const alvo = Math.min(MAX_COLUNAS, Math.max(MIN_COLUNAS, colunas + delta));
    if (alvo === colunas) return;
    ajustarColunas(t, alvo);
    marcarSujo();
  }

  function adicionarLinha(secao: boolean): void {
    t.linhas.push(secao
      ? { secao: true, celulas: [""] }
      : { secao: false, celulas: Array.from({ length: colunas }, () => "") });
    marcarSujo();
  }

  return (
    <div className="tabela-editor">
      <div className="tabela-editor-topo">
        <span className="tabela-editor-rotulo">Colunas: {colunas}</span>
        <IconButton
          icon={Minus}
          aria-label="Remover coluna"
          disabled={colunas <= MIN_COLUNAS}
          onClick={() => mudarColunas(-1)}
        />
        <IconButton
          icon={Plus}
          aria-label="Adicionar coluna"
          disabled={colunas >= MAX_COLUNAS}
          onClick={() => mudarColunas(1)}
        />
      </div>

      <div className="tabela-editor-rotulo">Cabeçalho</div>
      <div className="tabela-editor-celulas" style={grade(colunas)}>
        {t.cabecalho.map((c, i) => (
          <CampoCor
            key={`th-${i}`}
            marcado={c}
            aria={`Cabeçalho, coluna ${i + 1}`}
            aoMudar={(m) => { t.cabecalho[i] = m; marcarSujo(); }}
          />
        ))}
      </div>

      <div className="tabela-editor-rotulo">Linhas</div>
      {t.linhas.length === 0 && <p className="dica">Nenhuma linha ainda.</p>}
      {t.linhas.map((linha, li) => (
        <div key={`ln-${li}`} className={`tabela-editor-linha${linha.secao ? " secao" : ""}${linha.destaque ? " destaque" : ""}`}>
          <div className="tabela-editor-celulas" style={grade(linha.secao ? 1 : colunas)}>
            {(linha.secao ? [linha.celulas[0] ?? ""] : linha.celulas).map((c, ci) => (
              <CampoCor
                key={`c-${li}-${ci}`}
                marcado={c}
                aria={linha.secao ? `Linha de seção ${li + 1}` : `Linha ${li + 1}, coluna ${ci + 1}`}
                aoMudar={(m) => { linha.celulas[ci] = m; marcarSujo(); }}
              />
            ))}
          </div>
          <div className="tabela-editor-acoes">
            {/* destaque escuro só faz sentido em linha de dados */}
            {!linha.secao && (
              <IconButton
                icon={Bold}
                cor={linha.destaque ? "primary" : "muted"}
                aria-label={linha.destaque ? "Tirar destaque da linha" : "Destacar a linha"}
                onClick={() => { linha.destaque = !linha.destaque; marcarSujo(); }}
              />
            )}
            <IconButton
              icon={Rows3}
              aria-label={linha.secao ? "Transformar em linha de dados" : "Transformar em linha de seção"}
              onClick={() => { alternarSecao(t, li); marcarSujo(); }}
            />
            <IconButton
              icon={Trash2}
              cor="danger"
              aria-label={`Remover linha ${li + 1}`}
              onClick={() => { t.linhas.splice(li, 1); marcarSujo(); }}
            />
          </div>
        </div>
      ))}

      <div className="tabela-editor-botoes">
        <button className="btn fantasma bloco" type="button" onClick={() => adicionarLinha(false)}>
          + Linha
        </button>
        <button className="btn fantasma bloco" type="button" onClick={() => adicionarLinha(true)}>
          + Linha de seção
        </button>
      </div>
    </div>
  );
}

function grade(colunas: number): CSSProperties {
  return { gridTemplateColumns: `repeat(${colunas}, minmax(0, 1fr))` };
}

/** Ajusta o número de colunas mantendo as células existentes. */
function ajustarColunas(t: Tabela, alvo: number): void {
  while (t.cabecalho.length < alvo) t.cabecalho.push("");
  while (t.cabecalho.length > alvo) t.cabecalho.pop();
  for (const linha of t.linhas) {
    if (linha.secao) continue;
    while (linha.celulas.length < alvo) linha.celulas.push("");
    while (linha.celulas.length > alvo) linha.celulas.pop();
  }
}

/** Converte entre linha de dados e linha de seção sem perder o texto digitado. */
function alternarSecao(t: Tabela, li: number): void {
  const linha = t.linhas[li];
  if (!linha) return;
  if (linha.secao) {
    const primeiro = linha.celulas[0] ?? "";
    linha.secao = false;
    linha.celulas = [primeiro, ...Array.from({ length: Math.max(0, t.cabecalho.length - 1) }, () => "")];
  } else {
    const texto = linha.celulas.map((c) => c.trim()).filter(Boolean).join(" · ");
    linha.secao = true;
    linha.celulas = [texto];
    delete linha.destaque; // seção e destaque são exclusivos (schema)
  }
}
