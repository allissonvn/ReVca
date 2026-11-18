// ConfirmDialog — confirmação antes de excluir campanha/usuário.
import type { JSX } from "react";
import { Button } from "./Button.js";

type ConfirmDialogProps = {
  /** Se o dialog está aberto. */
  aberto: boolean;
  /** Título. */
  titulo: string;
  /** Mensagem. */
  mensagem: string;
  /** Rótulo do botão confirmar. */
  confirmarRotulo?: string;
  /** Rótulo do botão cancelar. */
  cancelarRotulo?: string;
  /** Ao confirmar. */
  aoConfirmar: () => void;
  /** Ao cancelar/fechar. */
  aoCancelar: () => void;
};

export function ConfirmDialog({
  aberto,
  titulo,
  mensagem,
  confirmarRotulo = "Confirmar",
  cancelarRotulo = "Cancelar",
  aoConfirmar,
  aoCancelar,
}: ConfirmDialogProps): JSX.Element | null {
  if (!aberto) return null;

  return (
    <div className="dialog-overlay" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="dialog">
        <h3>{titulo}</h3>
        <p>{mensagem}</p>
        <div className="acoes">
          <Button variant="ghost" onClick={aoCancelar}>
            {cancelarRotulo}
          </Button>
          <Button variant="danger" onClick={aoConfirmar}>
            {confirmarRotulo}
          </Button>
        </div>
      </div>
    </div>
  );
}
