// Toast — notificação temporária (exportação concluída, campanha duplicada, etc.).
import type { JSX } from "react";
import { CircleCheck, AlertCircle } from "lucide-react";

type ToastProps = {
  /** Mensagem. */
  mensagem: string;
  /** Tipo: sucesso | erro. */
  tipo?: "sucesso" | "erro";
  /** Tempo até sumir em ms (padrão 3000). */
  duracao?: number;
  /** Se está visível. */
  visivel: boolean;
  /** Callback quando some. */
  aoSumir?: () => void;
};

export function Toast({
  mensagem,
  tipo = "sucesso",
  duracao = 3000,
  visivel,
  aoSumir,
}: ToastProps): JSX.Element | null {
  if (!visivel) return null;

  const Icone = tipo === "erro" ? AlertCircle : CircleCheck;

  // some sozinho após a duração
  setTimeout(() => aoSumir?.(), duracao);

  return (
    <div className={`toast ${tipo === "erro" ? "toast erro" : ""}`}>
      <Icone aria-hidden="true" />
      <span>{mensagem}</span>
    </div>
  );
}
