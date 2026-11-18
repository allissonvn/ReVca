// Avatar — inicial do usuário em círculo.
import type { JSX } from "react";

type AvatarProps = {
  /** Iniciais a exibir (ex.: "AV"). */
  iniciais: string;
  /** Label de acessibilidade. */
  "aria-label"?: string;
  /** Tamanho em px (padrão 32). */
  tamanho?: number;
};

export function Avatar({ iniciais, "aria-label": ariaLabel, tamanho = 32 }: AvatarProps): JSX.Element {
  const estilo: React.CSSProperties = {
    width: tamanho,
    height: tamanho,
    fontSize: Math.round(tamanho * 0.45),
  };

  return (
    <span
      className="avatar"
      style={estilo}
      aria-label={ariaLabel ?? iniciais}
      aria-hidden={ariaLabel ? "false" : "true"}
    >
      {iniciais}
    </span>
  );
}
