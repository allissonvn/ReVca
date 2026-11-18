// Logo — marca + wordmark REVCA (~29px). Usado em Home e Login.
import type { JSX } from "react";

type LogoProps = {
  /** Altura aproximada em px (padrão 29). */
  altura?: number;
  /** Classe CSS extra. */
  className?: string;
  /** Label de acessibilidade. */
  "aria-label"?: string;
};

export function Logo({ altura = 29, className, "aria-label": ariaLabel }: LogoProps): JSX.Element {
  const estilo: React.CSSProperties = {
    width: altura * (124 / 32),
    height: altura,
  };

  return (
    <span className={`logo ${className ?? ""}`} style={estilo} aria-label={ariaLabel ?? "REVCA"}>
      <svg viewBox="0 0 124 32" role="img" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1447ff" />
        <path d="M8 23l5-14h4l-5 14z" fill="#fff" />
        <path d="M15 23l5-14h4l-5 14z" fill="#66cc00" />
        <text x="40" y="25" font-family="Anton, Impact, sans-serif" font-size="26" letterSpacing={1}>
          RE<tspan className="vca">VCA</tspan>
        </text>
      </svg>
      <span className="palavra">
        <span className="re">RE</span><span className="vca">VCA</span>
      </span>
    </span>
  );
}
