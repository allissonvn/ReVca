// Mark — só o ícone da marca (32px). Usado em Editor e Usuários.
import type { JSX } from "react";

type MarkProps = {
  /** Tamanho em px (padrão 32). */
  tamanho?: number;
  /** Classe CSS extra. */
  className?: string;
  /** Label de acessibilidade. */
  "aria-label"?: string;
};

export function Mark({ tamanho = 32, className, "aria-label": ariaLabel }: MarkProps): JSX.Element {
  const estilo: React.CSSProperties = { width: tamanho, height: tamanho };

  return (
    <span className={`mark ${className ?? ""}`} style={estilo} aria-label={ariaLabel ?? "REVCA"}>
      <svg viewBox="0 0 32 32" role="img" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1447ff" />
        <path d="M8 23l5-14h4l-5 14z" fill="#fff" />
        <path d="M15 23l5-14h4l-5 14z" fill="#66cc00" />
      </svg>
    </span>
  );
}
