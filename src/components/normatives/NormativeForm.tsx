import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import type { NormativeValueType } from '../../types/normative';
import type { NormativeRecord as LegacyNormativeRecord } from '../../types/protocols';
import { parseNormativeApiError } from '../../utils/normativeApiError';

export interface NormativeFormValues {
  documentCode: string;
  category: string;
  subCategory?: string;
  indicatorName: string;
  indicatorCode?: string;
  cas?: string;
  formula?: string;
  unit?: string;
  valueType: NormativeValueType;
  value?: string;
  minValue?: string;
  maxValue?: string;
  valueRaw?: string;
  conditions?: string;
  protocolType?: string;
}

type Props = { initial?: LegacyNormativeRecord | null; busy?: boolean; onCancel: () => void; onSave: (values: NormativeFormValues) => Promise<void> };
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const numericTypes: NormativeValueType[] = ['EXACT', 'LE', 'LT', 'GE', 'GT'];
const decimal = (value?: string) => value?.trim() ? value.trim().replace(',', '.') : undefined;

const initialValues = (record?: LegacyNormativeRecord | null): NormativeFormValues => ({
  documentCode: record?.sourceDocumentCode || '', category: record?.category || record?.categoryCode || '', subCategory: record?.normativeSubType || record?.subtype || undefined,
  indicatorName: record?.indicatorName || record?.indicator || '', indicatorCode: record?.code || record?.factorCode || undefined,
  cas: record?.cas || record?.casNumber || undefined, formula: record?.formula || record?.chemicalFormula || undefined, unit: record?.unit || undefined,
  valueType: record?.comparisonType === 'RANGE' ? 'RANGE' : record?.comparisonType === 'GREATER_OR_EQUAL' ? 'GE' : record?.comparisonType === 'EQUAL' ? 'EXACT' : record?.comparisonType === 'ABSENT' ? 'REFERENCE_ONLY' : 'LE',
  value: String(record?.value || record?.normativeValue || ''), minValue: String(record?.minValue || record?.min || ''), maxValue: String(record?.maxValue || record?.max || ''),
  valueRaw: record?.comparisonType === 'ABSENT' ? String(record?.value || record?.normativeValue || '') : undefined,
  conditions: record?.conditionJson || undefined, protocolType: record?.templateId || undefined,
});

const NormativeForm = ({ initial, busy = false, onCancel, onSave }: Props) => {
  const [generalError, setGeneralError] = useState('');
  const { register, watch, reset, setError, handleSubmit, formState: { errors, isSubmitting } } = useForm<NormativeFormValues>({ defaultValues: initialValues(initial) });
  useEffect(() => reset(initialValues(initial)), [initial, reset]);
  const valueType = watch('valueType');
  const submitting = busy || isSubmitting;

  const submit = handleSubmit(async (values) => {
    setGeneralError('');
    const normalized = { ...values, documentCode: values.documentCode.trim(), category: values.category.trim(), indicatorName: values.indicatorName.trim(), indicatorCode: values.indicatorCode?.trim() || undefined, cas: values.cas?.trim() || undefined, formula: values.formula?.trim() || undefined, unit: values.unit?.trim() || undefined, value: decimal(values.value), minValue: decimal(values.minValue), maxValue: decimal(values.maxValue), valueRaw: values.valueRaw?.trim() || undefined, conditions: values.conditions?.trim() || undefined, protocolType: values.protocolType?.trim() || undefined };
    if (normalized.valueType === 'RANGE' && Number(normalized.minValue) > Number(normalized.maxValue)) { setError('maxValue', { message: 'Максимум должен быть не меньше минимума' }); return; }
    if (normalized.conditions) { try { JSON.parse(normalized.conditions); } catch { setError('conditions', { message: 'Условия должны быть корректным JSON-объектом' }); return; } }
    try { await onSave(normalized); } catch (error) {
      const parsed = parseNormativeApiError(error);
      Object.entries(parsed.fieldErrors || {}).forEach(([field, message]) => {
        if (field in values) setError(field as keyof NormativeFormValues, { type: 'server', message });
      });
      setGeneralError(parsed.message);
    }
  });

  const field = (name: keyof NormativeFormValues, label: string, options?: { required?: boolean; numeric?: boolean }) => <label className="space-y-1.5 text-sm font-semibold text-slate-700"><span>{label}{options?.required && ' *'}</span><input {...register(name, { required: options?.required ? `${label} — обязательное поле` : false, validate: name === 'cas' ? (value) => !value || /^\d{2,7}-\d{2}-\d$/.test(String(value)) || 'Некорректный формат CAS' : options?.numeric ? (value) => !value || Number.isFinite(Number(String(value).replace(',', '.'))) || 'Введите число' : undefined })} inputMode={options?.numeric ? 'decimal' : undefined} disabled={submitting} className={inputClass} />{errors[name] && <span role="alert" className="text-xs text-rose-700">{errors[name]?.message}</span>}</label>;

  return <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
    {field('documentCode', 'Документ', { required: true })}{field('category', 'Категория', { required: true })}{field('subCategory', 'Подкатегория')}{field('indicatorName', 'Название показателя', { required: true })}{field('indicatorCode', 'Код')}{field('cas', 'CAS')}{field('formula', 'Формула')}{field('protocolType', 'Область применения')}
    <label className="space-y-1.5 text-sm font-semibold"><span>Тип значения</span><select {...register('valueType')} disabled={submitting} className={inputClass}>{(['EXACT', 'LE', 'LT', 'GE', 'GT', 'RANGE', 'TEXT', 'REFERENCE_ONLY'] as NormativeValueType[]).map((item) => <option key={item} value={item}>{({ EXACT: 'Точное значение', LE: 'Меньше или равно', LT: 'Меньше', GE: 'Больше или равно', GT: 'Больше', RANGE: 'Диапазон', TEXT: 'Текст', REFERENCE_ONLY: 'Справочная запись' } as Record<NormativeValueType, string>)[item]}</option>)}</select></label>
    {numericTypes.includes(valueType) && <>{field('value', 'Значение', { required: true, numeric: true })}{field('unit', 'Единица', { required: true })}</>}
    {valueType === 'RANGE' && <>{field('minValue', 'Минимум', { required: true, numeric: true })}{field('maxValue', 'Максимум', { required: true, numeric: true })}{field('unit', 'Единица', { required: true })}</>}
    {(valueType === 'TEXT' || valueType === 'REFERENCE_ONLY') && <label className="space-y-1.5 text-sm font-semibold sm:col-span-2"><span>Исходный текст *</span><textarea {...register('valueRaw', { required: 'Укажите исходный текст' })} rows={3} className={inputClass} />{errors.valueRaw && <span role="alert" className="text-xs text-rose-700">{errors.valueRaw.message}</span>}</label>}
    <label className="space-y-1.5 text-sm font-semibold sm:col-span-2"><span>Условия применения (JSON)</span><textarea {...register('conditions')} rows={3} className={inputClass} />{errors.conditions && <span role="alert" className="text-xs text-rose-700">{errors.conditions.message}</span>}</label>
    {generalError && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{generalError}</p>}
    <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2"><Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>Отменить</Button><Button type="submit" disabled={submitting}>{submitting ? 'Сохраняем...' : 'Сохранить'}</Button></div>
  </form>;
};

export default NormativeForm;
