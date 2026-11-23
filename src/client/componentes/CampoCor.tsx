import type { JSX } from "react";
// Campo de texto com cor por seleção (estilo Canva): o campo mostra o TEXTO
// PURO; as cores vivem em faixas na memória e viram markup a cada tecla.
// Reusa as primitivas puras de src/shared/markup.ts.
import { useRef, useState } from "react";
import {
  CorMarcada, extrairRanges, montarMarcado, ajustarRanges, pintarTrecho, limparTrecho,
} from "../../shared/markup.js";

const CORES_PALETA = ["#ff3b3b", "#1447ff", "#66cc00", "#1b1b1f", "#ff8a00", "#8b3bff", "#ff4fa3", "#00b8c4"];

/** Hexes canônicos viram token nomeado (mantém o JSON legível). */
function corParaMarcada(hex: string): CorMarcada {
  const h = hex.toLowerCase();
  if (h === "#1447ff") return "azul";
  if (h === "#ff3b3b") return "vermelho";
  return h as CorMarcada;
}

type Props = {
  marcado: string;                 // valor do modelo (com markup)
  aoMudar: (marcado: string) => void;
  aria: string;
  multilinea?: boolean;
  placeholder?: string;
};

export function CampoCor({ marcado, aoMudar, aria, multilinea, placeholder }: Props): JSX.Element {
  const faixas = useRef<{ plain: string; ranges: ReturnType<typeof extrairRanges>["ranges"] } | null>(null);
  const selecao = useRef({ ini: 0, fim: 0 });
  const [paleta, setPaleta] = useState<{ x: number; y: number } | null>(null);
  const el = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const plain = faixas.current?.plain ?? semMarcadores(marcado);

  function aoFocar(): void {
    faixas.current = extrairRanges(marcado);
  }
  function aoSair(): void {
    faixas.current = null;
    setPaleta(null);
  }
  function aoDigitar(valor: string): void {
    const st = faixas.current;
    if (!st) { aoMudar(valor); return; } // campo sem foco registrado: texto cru
    const { pos, removidos, inseridos } = diff(st.plain, valor);
    st.ranges = ajustarRanges(valor, st.ranges, pos, removidos, inseridos);
    st.plain = valor;
    aoMudar(montarMarcado(st.plain, st.ranges));
  }
  function pintar(hex: string): void {
    const st = faixas.current ?? (faixas.current = extrairRanges(marcado));
    const { ini, fim } = selecao.current;
    const a = ini === fim ? 0 : ini;             // sem seleção: pinta o campo todo
    const b = ini === fim ? st.plain.length : fim;
    st.ranges = pintarTrecho(st.plain, st.ranges, a, b, corParaMarcada(hex));
    aoMudar(montarMarcado(st.plain, st.ranges));
    devolverFoco();
  }
  function tirarCor(): void {
    const st = faixas.current ?? (faixas.current = extrairRanges(marcado));
    const { ini, fim } = selecao.current;
    const a = ini === fim ? 0 : ini;
    const b = ini === fim ? st.plain.length : fim;
    st.ranges = limparTrecho(st.ranges, a, b);
    aoMudar(montarMarcado(st.plain, st.ranges));
    devolverFoco();
  }
  function guardarSelecao(): void {
    if (!el.current) return;
    selecao.current = { ini: el.current.selectionStart ?? 0, fim: el.current.selectionEnd ?? 0 };
  }
  function devolverFoco(): void {
    const { ini, fim } = selecao.current;
    el.current?.focus();
    el.current?.setSelectionRange(ini, fim);
  }
  function abrirPaleta(): void {
    guardarSelecao();
    const r = (el.current as HTMLElement).getBoundingClientRect();
    setPaleta({ x: r.left, y: r.bottom + 4 });
  }

  const campo = multilinea ? (
    <textarea
      ref={el as never}
      value={plain}
      rows={3}
      placeholder={placeholder}
      aria-label={aria}
      onFocus={aoFocar}
      onBlur={aoSair}
      onSelect={guardarSelecao}
      onChange={(ev) => aoDigitar(ev.target.value)}
    />
  ) : (
    <input
      ref={el as never}
      type="text"
      value={plain}
      placeholder={placeholder}
      aria-label={aria}
      onFocus={aoFocar}
      onBlur={aoSair}
      onSelect={guardarSelecao}
      onChange={(ev) => aoDigitar(ev.target.value)}
    />
  );

  return (
    <div className="campo-cor">
      {campo}
      <div className="botoes-cor">
        <button type="button" className="btn mini" title="Cor do trecho selecionado" onClick={abrirPaleta}>🎨</button>
        <button type="button" className="btn mini fantasma" title="Remover cor do trecho selecionado" onClick={tirarCor}>Sem cor</button>
      </div>
      {paleta && (
        <div className="paleta" style={{ left: paleta.x, top: paleta.y }} role="dialog" aria-label="Paleta de cores">
          {CORES_PALETA.map((c) => (
            <button
              key={c}
              type="button"
              className="amostra"
              style={{ background: c }}
              title={c}
              aria-label={`Aplicar cor ${c}`}
              onClick={() => { pintar(c); setPaleta(null); }}
            />
          ))}
          <label className="paleta-rgb" title="Cor personalizada (RGB)">
            🎨
            <input
              type="color"
              defaultValue="#1447ff"
              aria-label="Cor personalizada"
              onChange={(ev) => pintar(ev.target.value)}
            />
          </label>
          <button type="button" className="btn mini fantasma" onClick={() => setPaleta(null)}>×</button>
        </div>
      )}
    </div>
  );
}

/** Remove todos os marcadores (para exibir o texto puro no campo). */
function semMarcadores(texto: string): string {
  return texto.replace(/\[\[(?:azul|#[0-9a-fA-F]{6}|\/)\]\]|\(\((?:vermelho|\/)\)\)/g, "");
}

/** Diferença entre o texto antigo e o novo: onde entrou/saiu quê. */
function diff(antigo: string, novo: string): { pos: number; removidos: number; inseridos: number } {
  let ini = 0;
  const max = Math.min(antigo.length, novo.length);
  while (ini < max && antigo[ini] === novo[ini]) ini++;
  let fa = antigo.length;
  let fn = novo.length;
  while (fa > ini && fn > ini && antigo[fa - 1] === novo[fn - 1]) { fa--; fn--; }
  return { pos: ini, removidos: fa - ini, inseridos: fn - ini };
}
