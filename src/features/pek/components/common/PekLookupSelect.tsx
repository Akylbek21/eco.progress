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
  filterLayout?: boolean;
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
  filterLayout = false,
  onChange,
  onRetry,
}: Props) => (
  <label className={filterLayout ? 'grid min-w-0 grid-rows-[1rem_2.5rem_minmax(1rem,auto)] gap-y-1 text-xs font-bold text-slate-600' : 'text-sm font-bold'}>
    <span>{label}{required ? ' *' : ''}</span>
    <select
      aria-label={label}
      value={value || ''}
      disabled={disabled || loading || error}
      onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)}
      className={`${filterLayout ? 'h-10' : 'mt-1'} w-full rounded-xl border border-slate-300 px-3 py-2 disabled:bg-slate-100`}
    >
      <option value="">{loading ? 'Загрузка…' : placeholder}</option>
      {options.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name}{item.status === 'INACTIVE' ? ' · неактивен' : ''}{item.description ? ` · ${item.description}` : ''}
        </option>
      ))}
    </select>
    <span className={`${filterLayout ? '' : 'mt-1 block'} text-xs font-medium ${error ? 'text-rose-700' : 'text-slate-500'}`}>
      {!loading && !error && options.length === 0 && 'Доступные значения отсутствуют.'}
      {error && <>
        Не удалось загрузить справочник.
        {onRetry && <button type="button" onClick={onRetry} className="ml-1 underline">Повторить</button>}
      </>}
    </span>
  </label>
);

export default PekLookupSelect;
