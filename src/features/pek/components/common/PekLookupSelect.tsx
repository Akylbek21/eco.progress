import type { PekLookupOption } from '../../api/pekContracts';

type Props = {
  label: string;
  value?: number | null;
  options: PekLookupOption[];
  loading?: boolean;
  error?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (id: number | null) => void;
  onRetry?: () => void;
};

const PekLookupSelect = ({
  label,
  value,
  options,
  loading,
  error,
  required,
  disabled,
  placeholder = 'Выберите значение',
  onChange,
  onRetry,
}: Props) => (
  <label className="text-sm font-bold">
    {label}{required ? ' *' : ''}
    <select
      aria-label={label}
      value={value || ''}
      disabled={disabled || loading || error}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100"
    >
      <option value="">{loading ? 'Загрузка…' : placeholder}</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}{item.status === 'INACTIVE' ? ' · неактивен' : ''}{item.description ? ` · ${item.description}` : ''}
        </option>
      ))}
    </select>
    {!loading && !error && options.length === 0 && <span className="mt-1 block text-xs font-medium text-slate-500">
      Доступные значения отсутствуют.
    </span>}
    {error && <span className="mt-1 block text-xs font-medium text-rose-700">
      Не удалось загрузить справочник.
      {onRetry && <button type="button" onClick={onRetry} className="ml-1 underline">Повторить</button>}
    </span>}
  </label>
);

export default PekLookupSelect;
