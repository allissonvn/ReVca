// Field — label + input/select/textarea com tokens do design system.
import type { JSX } from "react";

type FieldProps = {
  /** Rótulo do campo. */
  label: string;
  /** Tipo do input (text, email, password, search...). */
  type?: string;
  /** Valor atual. */
  value: string;
  /** Mudança de valor. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Se é textarea. */
  textarea?: boolean;
  /** Se é select. */
  select?: boolean;
  /** Opções do select. */
  opcoes?: { valor: string; rotulo: string }[];
  /** Placeholder. */
  placeholder?: string;
  /** Campo obrigatório. */
  required?: boolean;
  /** Campo desabilitado. */
  disabled?: boolean;
  /** Nome do campo (para autocomplete). */
  name?: string;
  /** ID do campo (para label associado). */
  id?: string;
  /** Mensagem de erro exibida abaixo. */
  erro?: string;
  /** Dica abaixo do campo. */
  dica?: string;
  /** Atributo autocomplete nativo. */
  autoComplete?: string;
};

export function Field({
  label,
  type = "text",
  value,
  onChange,
  textarea = false,
  select = false,
  opcoes,
  placeholder,
  required = false,
  disabled = false,
  name,
  id,
  erro,
  dica,
  autoComplete,
}: FieldProps): JSX.Element {
  const campoId = id ?? name ?? label.toLowerCase().replace(/\s+/g, "-");

  const propsComuns = {
    id: campoId,
    name,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      onChange(e);
    },
    placeholder,
    required,
    disabled,
    autoComplete,
  };

  const Elemento = textarea
    ? "textarea"
    : select
      ? "select"
      : "input";

  return (
    <div className="field">
      <label htmlFor={campoId}>{label}</label>
      {textarea ? (
        <textarea
          {...propsComuns}
          rows={4}
        />
      ) : select ? (
        <select {...propsComuns}>
          {opcoes?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input {...propsComuns} type={type} />
      )}
      {erro && <p className="dica erro" role="alert">{erro}</p>}
      {!erro && dica && <p className="dica">{dica}</p>}
    </div>
  );
}
