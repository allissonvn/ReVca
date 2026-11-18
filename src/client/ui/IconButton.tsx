// IconButton — botão só-ícone com aria-label obrigatório.
import type { JSX } from "react";

type IconButtonProps = {
  /** Ícone lucide. */
  icon: React.ElementType;
  /** Label de acessibilidade (obrigatório). */
  "aria-label": string;
  /** Desabilita o botão. */
  disabled?: boolean;
  /** Handler de clique. */
  onClick?: () => void;
  /** Cor do ícone (muted, primary, danger...). */
  cor?: "muted" | "primary" | "danger";
};

export function IconButton({
  icon: Icone,
  "aria-label": ariaLabel,
  disabled = false,
  onClick,
  cor = "muted",
}: IconButtonProps): JSX.Element {
  const classeCor = cor === "primary" ? "text-primary" : cor === "danger" ? "text-danger" : "text-muted";

  return (
    <button
      className={`btn btn icon-only ${classeCor}`.trim()}
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <Icone className="btn-icone" aria-hidden="true" />
    </button>
  );
}
