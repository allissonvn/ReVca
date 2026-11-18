// Barra de zoom do canvas (Phase 3).
// 25–200%, default "fit to screen", Ctrl+wheel, teclas +, -, 0.
import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize, Minimize2 } from "lucide-react";
import { Button } from "../ui/Button.js";
import { IconButton } from "../ui/IconButton.js";

type ZoomBarProps = {
  /** Zoom atual (0.25–2.0). */
  zoom: number;
  /** Mudar o zoom. */
  aoMudarZoom: (zoom: number) => void;
  /** Se está em "fit to screen". */
  ajustado: boolean;
  /** Alternar fit to screen. */
  aoAlternarAjuste: (ajustado: boolean) => void;
};

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2.0;
const ZOOM_PASSO = 0.25;

export function ZoomBar({
  zoom,
  aoMudarZoom,
  ajustado,
  aoAlternarAjuste,
}: ZoomBarProps): JSX.Element {
  const pct = Math.round(zoom * 100);

  const zoomPara = useCallback(
    (novo: number) => {
      const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, novo));
      aoMudarZoom(z);
    },
    [aoMudarZoom],
  );

  // Ctrl+wheel para zoom
  useEffect(() => {
    function roda(ev: WheelEvent) {
      if (!ev.ctrlKey) return;
      ev.preventDefault();
      const delta = ev.deltaY > 0 ? -ZOOM_PASSO : ZOOM_PASSO;
      zoomPara(zoom + delta);
    }
    window.addEventListener("wheel", roda, { passive: false });
    return () => window.removeEventListener("wheel", roda);
  }, [zoom, zoomPara]);

  // Teclas +, -, 0
  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (ev.key === "+" || ev.key === "=") zoomPara(zoom + ZOOM_PASSO);
      else if (ev.key === "-") zoomPara(zoom - ZOOM_PASSO);
      else if (ev.key === "0") {
        aoMudarZoom(1);
        aoAlternarAjuste(true);
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [zoom, zoomPara, aoMudarZoom, aoAlternarAjuste]);

  return (
    <div className="zoom-bar">
      <button
        className="btn fantasma"
        type="button"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => zoomPara(zoom - ZOOM_PASSO)}
        title="Diminuir zoom"
      >
        <Minus size={14} strokeWidth={2} />
      </button>
      <span className="zoom-pct">{pct}%</span>
      <button
        className="btn fantasma"
        type="button"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => zoomPara(zoom + ZOOM_PASSO)}
        title="Aumentar zoom"
      >
        <Plus size={14} strokeWidth={2} />
      </button>
      <button
        className="btn fantasma"
        type="button"
        onClick={() => {
          aoMudarZoom(1);
          aoAlternarAjuste(!ajustado);
        }}
      >
        {ajustado ? <Minimize2 size={14} strokeWidth={2} /> : <Maximize size={14} strokeWidth={2} />}
      </button>
      <span className="zoom-dica">{ajustado ? "Ajustar à tela" : "100%"}</span>
    </div>
  );
}
