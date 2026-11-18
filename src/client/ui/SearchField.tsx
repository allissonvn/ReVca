// SearchField — ícone de lupa dentro do input de busca.
import type { JSX } from "react";
import { Search } from "lucide-react";

type SearchFieldProps = {
  /** Valor atual. */
  value: string;
  /** Mudança de valor. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Placeholder. */
  placeholder?: string;
  /** Campo desabilitado. */
  disabled?: boolean;
  /** ID do campo. */
  id?: string;
};

export function SearchField({
  value,
  onChange,
  placeholder = "Buscar…",
  disabled = false,
  id,
}: SearchFieldProps): JSX.Element {
  return (
    <div className="search-field">
      <Search className="search-icone" aria-hidden="true" />
      <input
        id={id}
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Buscar"
      />
    </div>
  );
}
