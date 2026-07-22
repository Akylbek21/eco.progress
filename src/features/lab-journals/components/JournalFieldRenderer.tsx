import type { FieldError, Path, UseFormRegister } from 'react-hook-form';
import type { JournalColumnDefinition, LabJournalFormValues } from '../../../types/labJournal';

type Props = { definition: JournalColumnDefinition; register: UseFormRegister<LabJournalFormValues>; error?: FieldError; disabled?: boolean; autoFocus?: boolean };
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

export const JournalFieldRenderer = ({ definition, register, error, disabled, autoFocus }: Props) => {
  const name = `dynamicFields.${definition.key}` as Path<LabJournalFormValues>;
  const options = { required: definition.required ? `Заполните поле «${definition.title}»` : false };
  let control;
  if (definition.type === 'textarea') control = <textarea {...register(name, options)} rows={3} disabled={disabled} autoFocus={autoFocus} placeholder={definition.placeholder} className={inputClass} />;
  else if (definition.type === 'boolean') control = <input type="checkbox" {...register(name)} disabled={disabled} autoFocus={autoFocus} className="h-5 w-5 rounded border-slate-300" />;
  else if (definition.type === 'select') control = <select {...register(name, options)} disabled={disabled} autoFocus={autoFocus} className={inputClass}><option value="">Не выбрано</option>{definition.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  else control = <input type={definition.type === 'datetime' ? 'datetime-local' : definition.type} step={definition.step} min={definition.min} max={definition.max} {...register(name, definition.type === 'number' ? { ...options, setValueAs: (value) => value === '' ? undefined : Number(String(value).replace(',', '.')) } : options)} disabled={disabled} autoFocus={autoFocus} placeholder={definition.placeholder} className={inputClass} />;
  return <label className={`space-y-1 text-sm font-semibold text-slate-700 ${definition.type === 'textarea' ? 'md:col-span-2' : ''}`}><span>{definition.title}{definition.required ? ' *' : ''}</span>{control}{definition.helperText && !error && <span className="block text-xs font-normal text-slate-500">{definition.helperText}</span>}{error?.message && <span role="alert" className="block text-xs text-rose-700">{error.message}</span>}</label>;
};
