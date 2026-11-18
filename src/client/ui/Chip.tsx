// Chip — pílula com texto, usado para tipo de bloco, status, etc.
import type { JSX } from "react";

type ChipProps = {
  /** Texto do chip. */
  children: React.ReactNode;
  /** Classe CSS extra. */
  className?: string;
  /** Se está selecionado. */
  selecionado?: boolean;
  /** Ao clicar. */
  onClick?: () => void;
};

export function Chip({ children, className, selecionado, onClick }: ChipProps): JSX.Element {
  const classes = ["chip", selecionado ? "selecionado" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    <span
      className={classes}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
    >
      {children}
    </span>
  );
}
