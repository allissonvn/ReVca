// Card — container com borda e raio de card.
import type { JSX } from "react";

type CardProps = {
  /** Conteúdo do card. */
  children: React.ReactNode;
  /** Classe CSS extra. */
  className?: string;
};

export function Card({ children, className }: CardProps): JSX.Element {
  return <div className={`card ${className ?? ""}`}>{children}</div>;
}

// Section — card com cabeçalho (título + ícone).
import { Layers } from "lucide-react";

type SectionProps = {
  /** Título da seção (opcional). */
  titulo?: string;
  /** Ícone lucide (opcional). */
  icon?: React.ElementType;
  /** Conteúdo da seção. */
  children: React.ReactNode;
  /** Classe CSS extra. */
  className?: string;
};

const IconePadrao = Layers;

export function Section({ titulo, icon: Icone = IconePadrao, children, className }: SectionProps): JSX.Element {
  return (
    <div className={`section card ${className ?? ""}`}>
      {titulo && (
        <div className="cabecalho">
          <Icone aria-hidden="true" />
          <h3>{titulo}</h3>
        </div>
      )}
      {children}
    </div>
  );
}
