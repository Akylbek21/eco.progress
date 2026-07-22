import { useEffect, useMemo } from 'react';
import { type FieldError, type Path, useForm } from 'react-hook-form';
import Button from '../../../components/ui/Button';
import { normalizeApiError } from '../../../services/apiHelpers';
import { JournalType, type JournalTypeDefinition, type LabJournalEntry, type LabJournalFormValues } from '../../../types/labJournal';
import { mapJournalEntryToForm, mapJournalFormToCreateRequest, mapJournalFormToUpdateRequest } from '../api/labJournalMappers';
import { useJournalEntryMutations } from '../hooks/useJournalEntryMutations';
import { validateJournalForm } from '../schemas/journalSchemas';
import { JournalFieldRenderer } from './JournalFieldRenderer';

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';

const blankValues = (definition: JournalTypeDefinition, laboratoryId: number): LabJournalFormValues => ({
  journalType: definition.code,
  laboratoryId,
  entryDate: today(),
  registrationDate: definition.code === JournalType.SAMPLE_REGISTRATION ? today() : '',
  preparationDate: definition.code === JournalType.SOLUTION_PREPARATION ? today() : '',
  executorName: '',
  note: '',
  dynamicFields: {},
});

type Props = {
  definition: JournalTypeDefinition;
  laboratoryId: number;
  entry?: LabJournalEntry;
  readOnly?: boolean;
  onDirtyChange: (dirty: boolean) => void;
  onSubmittingChange: (busy: boolean) => void;
  onCancel: () => void;
  onSaved: (entry: LabJournalEntry) => void;
  onSuccessMessage: (message: string) => void;
};

export const JournalEntryForm = ({ definition, laboratoryId, entry, readOnly, onDirtyChange, onSubmittingChange, onCancel, onSaved, onSuccessMessage }: Props) => {
  const defaults = useMemo(() => entry ? mapJournalEntryToForm(entry) : blankValues(definition, laboratoryId), [definition, entry, laboratoryId]);
  const { createMutation, updateMutation } = useJournalEntryMutations();
  const busy = createMutation.isPending || updateMutation.isPending;
  const { register, handleSubmit, reset, setError, setFocus, watch, formState: { errors, isDirty } } = useForm<LabJournalFormValues>({ defaultValues: defaults });
  useEffect(() => reset(defaults), [defaults, reset]);
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange]);
  useEffect(() => onSubmittingChange(busy), [busy, onSubmittingChange]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
  const dynamicFields = watch('dynamicFields');
  const remaining = Number(dynamicFields.initialQuantity || 0) - Number(dynamicFields.usedQuantity || 0);

  const submit = handleSubmit(async (values) => {
    if (busy || readOnly) return;
    const validation = validateJournalForm(values, definition.columns);
    const paths = Object.keys(validation) as Path<LabJournalFormValues>[];
    paths.forEach((path) => setError(path, { type: 'validate', message: validation[path] }));
    if (paths.length) { setFocus(paths[0]); return; }
    try {
      const saved = entry
        ? await updateMutation.mutateAsync({ id: entry.id, payload: mapJournalFormToUpdateRequest(values) })
        : await createMutation.mutateAsync(mapJournalFormToCreateRequest(values));
      reset(mapJournalEntryToForm(saved));
      onSuccessMessage(entry ? 'Запись журнала обновлена' : 'Запись журнала создана');
      onSaved(saved);
    } catch (error) {
      const parsed = normalizeApiError(error, 'Не удалось сохранить запись журнала.');
      const fieldPaths: Array<Path<LabJournalFormValues>> = [];
      Object.entries(parsed.fieldErrors).forEach(([rawPath, message]) => {
        const path = rawPath.startsWith('data.') || rawPath.startsWith('fields.')
          ? `dynamicFields.${rawPath.split('.').slice(1).join('.')}`
          : rawPath.replace(/^values\./, 'dynamicFields.');
        setError(path as Path<LabJournalFormValues>, { type: 'server', message });
        fieldPaths.push(path as Path<LabJournalFormValues>);
      });
      const combined = [parsed.message, ...parsed.errors].filter(Boolean).join(' ');
      for (const key of ['registrationDate', 'preparationDate', 'entryDate', 'laboratoryId', 'executorName'] as const) {
        if (combined.includes(key) && !fieldPaths.includes(key)) { setError(key, { type: 'server', message: parsed.message }); fieldPaths.push(key); }
      }
      setError('root', { type: 'server', message: combined || parsed.message });
      if (fieldPaths[0]) setFocus(fieldPaths[0]);
    }
  });

  const dynamicErrors = errors.dynamicFields as Record<string, FieldError> | undefined;
  const showRegistrationDate = definition.code === JournalType.SAMPLE_REGISTRATION || Boolean(entry?.registrationDate);
  const showPreparationDate = definition.code === JournalType.SOLUTION_PREPARATION || Boolean(entry?.preparationDate);
  return <form onSubmit={submit} className="space-y-6" noValidate>
    {errors.root?.message && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{errors.root.message}</div>}
    {entry && !entry.version && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Версия записи не получена от backend. При конфликте сохранение может быть отклонено.</div>}
    <fieldset disabled={busy || readOnly} className="grid gap-4 md:grid-cols-2"><legend className="mb-3 text-base font-bold text-slate-900">Основная информация</legend>
      <label className="space-y-1 text-sm font-semibold"><span>Тип журнала</span><input value={definition.name} disabled className={inputClass} /></label>
      <label className="space-y-1 text-sm font-semibold"><span>Лаборатория</span><input value={laboratoryId} disabled className={inputClass} /></label>
      <label className="space-y-1 text-sm font-semibold"><span>Дата записи *</span><input type="date" {...register('entryDate', { required: 'Укажите дату записи' })} autoFocus className={inputClass} />{errors.entryDate?.message && <span role="alert" className="block text-xs text-rose-700">{errors.entryDate.message}</span>}</label>
      {showRegistrationDate && <label className="space-y-1 text-sm font-semibold"><span>Дата регистрации *</span><input type="date" {...register('registrationDate')} className={inputClass} />{errors.registrationDate?.message && <span role="alert" className="block text-xs text-rose-700">{errors.registrationDate.message}</span>}</label>}
      {showPreparationDate && <label className="space-y-1 text-sm font-semibold"><span>Дата приготовления *</span><input type="date" {...register('preparationDate')} className={inputClass} />{errors.preparationDate?.message && <span role="alert" className="block text-xs text-rose-700">{errors.preparationDate.message}</span>}</label>}
      <label className="space-y-1 text-sm font-semibold"><span>Исполнитель</span><input {...register('executorName')} className={inputClass} />{errors.executorName?.message && <span role="alert" className="block text-xs text-rose-700">{errors.executorName.message}</span>}</label>
      <label className="space-y-1 text-sm font-semibold md:col-span-2"><span>Примечание</span><textarea rows={3} {...register('note')} className={inputClass} /></label>
    </fieldset>
    <fieldset disabled={busy || readOnly} className="grid gap-4 md:grid-cols-2"><legend className="mb-3 text-base font-bold text-slate-900">Данные журнала</legend>{definition.columns.map((column) => <JournalFieldRenderer key={column.key} definition={column} register={register} error={dynamicErrors?.[column.key]} disabled={busy || readOnly} />)}
      {definition.code === JournalType.CHEMICAL_REAGENT_USAGE && <div className={`rounded-xl p-3 text-sm font-semibold md:col-span-2 ${remaining < 0 ? 'bg-rose-50 text-rose-800' : 'bg-slate-50 text-slate-700'}`}>Расчётный остаток: {Number.isFinite(remaining) ? remaining : '—'}. Значение не отправляется в backend.</div>}
    </fieldset>
    <div className="flex justify-end gap-3 border-t pt-4"><Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>{readOnly ? 'Закрыть' : 'Отмена'}</Button>{!readOnly && <Button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить'}</Button>}</div>
  </form>;
};
