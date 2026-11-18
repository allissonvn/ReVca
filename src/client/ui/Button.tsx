// Button — variantes default, primary, danger, ghost; opcional ícone à esquerda.
import type { JSX } from "react";
import { Plus, Trash2, Download, LogOut, ArrowLeft } from "lucide-react";

type Variant = "default" | "primary" | "danger" | "ghost";

type ButtonProps = {
  /** Texto do botão. */
  children?: React.ReactNode;
  /** Variante visual. */
  variant?: Variant;
  /** Desabilita o botão. */
  disabled?: boolean;
  /** Tipo do botão (submit, button...). */
  type?: "submit" | "button" | "reset";
  /** Ícone à esquerda (nome lucide). */
  icon?: keyof typeof ICONES;
  /** Apenas ícone (sem texto). */
  iconOnly?: boolean;
  /** Largura total. */
  block?: boolean;
  /** Handler de clique. */
  onClick?: () => void;
  /** Label de acessibilidade para botões só-ícone. */
  "aria-label"?: string;
};

const ICONES = {
  Plus,
  Trash2,
  Download,
  LogOut,
  ArrowLeft,
} as const;

export function Button({
  children,
  variant = "default",
  disabled = false,
  type = "button",
  icon,
  iconOnly = false,
  block = false,
  onClick,
  "aria-label": ariaLabel,
}: ButtonProps): JSX.Element {
  const ClasseVariante =
    variant === "primary" ? "btn primary" : variant === "danger" ? "btn danger" : variant === "ghost" ? "btn ghost" : "btn";
  const ClasseExtra = iconOnly ? "btn icon-only" : block ? "btn bloco" : "";
  const Icone = ICONES[icon ?? "Plus"];

  return (
    <button
      className={`btn ${ClasseVariante} ${ClasseExtra}`.trim()}
      type={type}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {icon && <Icone className="btn-icone" aria-hidden="true" />}
      {children}
    </button>
  );
}
