// Segmented — botões alternados (ex.: 2 colunas | 1 coluna).
import type { JSX } from "react";

type SegmentedProps = {
  /** Opções: [{ valor, rotulo }]. */
  opcoes: { valor: string; rotulo: string }[];
  /** Valor atualmente ativo. */
  valor: string;
  /** Mudança de valor. */
  onMudar: (valor: string) => void;
  /** Label de acessibilidade. */
  "aria-label"?: string;
};

export function Segmented({
  opcoes,
  valor,
  onMudar,
  "aria-label": ariaLabel = "Selecionar opção",
}: SegmentedProps): JSX.Element {
  return (
    <div className="segmented" role="radiogroup" aria-label={ariaLabel}>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          className={valor === o.valor ? "active" : ""}
          onClick={() => onMudar(o.valor)}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
