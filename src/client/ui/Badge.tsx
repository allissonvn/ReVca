// Badge — etiqueta de papel (admin/editor/leitor) ou status.
import type { JSX } from "react";

type BadgeProps = {
  /** Texto do badge. */
  children: React.ReactNode;
  /** Variante: admin | editor | leitor | default. */
  variante?: "admin" | "editor" | "leitor" | "default";
  /** Classe CSS extra. */
  className?: string;
};

export function Badge({ children, variante = "default", className }: BadgeProps): JSX.Element {
  return (
    <span className={`badge badge-${variante} ${className ?? ""}`} role="badge">
      {children}
    </span>
  );
}
