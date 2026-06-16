import { FormEvent, useEffect, useMemo, useState } from 'react';
import Button from '../ui/Button';
import type { Company, CompanyPayload } from '../../types/companies';

type Props = {
  initialValue?: Partial<Company>;
  loading?: boolean;
  submitText?: string;
  onSubmit: (payload: CompanyPayload) => void | Promise<void>;
  onCancel?: () => void;
};

const emptyPayload: CompanyPayload = {
  name: '',
  bin: '',
  legalAddress: '',
  actualAddress: '',
  phone: '',
  email: '',
  comment: '',
  notes: '',
  directorFullName: '',
  director: '',
  directorPosition: '',
  contactPerson: '',
  contactPhone: '',
  bank: '',
  bankName: '',
  iban: '',
  bik: '',
  kbe: '',
  knp: '',
  contractNumber: '',
  contractDate: '',
  objectName: '',
  objectAddress: '',
  activityType: '',
  samplingLocation: '',
  customerRepresentative: '',
};

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizePayload = (value: CompanyPayload): CompanyPayload =>
  Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item])) as CompanyPayload;

const CompanyForm = ({ initialValue, loading = false, submitText = 'Сохранить', onSubmit, onCancel }: Props) => {
  const initialPayload = useMemo(() => ({ ...emptyPayload, ...initialValue }), [initialValue]);
  const [value, setValue] = useState<CompanyPayload>(initialPayload);
  const [error, setError] = useState('');

  useEffect(() => {
    setValue(initialPayload);
  }, [initialPayload]);

  const update = (field: keyof CompanyPayload, nextValue: string) => {
    setValue((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === 'directorFullName' ? { director: nextValue } : {}),
      ...(field === 'bank' ? { bankName: nextValue } : {}),
      ...(field === 'comment' ? { notes: nextValue } : {}),
    }));
    setError('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = normalizePayload({
      ...value,
      director: value.director || value.directorFullName,
      bankName: value.bankName || value.bank,
      notes: value.notes || value.comment,
    });
    if (!payload.name) return setError('Укажите название компании.');
    if (!payload.bin) return setError('Укажите БИН / ИИН.');
    if (!payload.legalAddress && !payload.actualAddress) return setError('Укажите юридический или фактический адрес.');
    if (!payload.phone && !payload.email) return setError('Укажите телефон или email.');
    if (payload.email && !emailPattern.test(payload.email)) return setError('Укажите корректный email.');
    await onSubmit(payload);
  };

  const Field = ({
    label,
    field,
    type = 'text',
    required = false,
    className = '',
  }: {
    label: string;
    field: keyof CompanyPayload;
    type?: string;
    required?: boolean;
    className?: string;
  }) => (
    <label className={`space-y-1.5 text-sm font-semibold text-slate-700 ${className}`}>
      <span>{label}{required && <span className="text-rose-600"> *</span>}</span>
      <input type={type} value={String(value[field] || '')} onChange={(event) => update(field, event.target.value)} className={inputClass} />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</div>}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Основные данные</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Название компании" field="name" required />
          <Field label="БИН / ИИН" field="bin" required />
          <Field label="Юридический адрес" field="legalAddress" required={!value.actualAddress} />
          <Field label="Фактический адрес" field="actualAddress" required={!value.legalAddress} />
          <Field label="Телефон" field="phone" required={!value.email} />
          <Field label="Email" field="email" type="email" required={!value.phone} />
          <Field label="Руководитель" field="directorFullName" />
          <Field label="Контактное лицо" field="contactPerson" />
          <Field label="Вид деятельности" field="activityType" />
          <label className="space-y-1.5 text-sm font-semibold text-slate-700 md:col-span-2">
            <span>Заметки</span>
            <textarea rows={3} value={value.comment || value.notes || ''} onChange={(event) => update('comment', event.target.value)} className={inputClass} />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Реквизиты</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Банк" field="bank" />
          <Field label="IBAN" field="iban" />
          <Field label="БИК" field="bik" />
          <Field label="КБЕ" field="kbe" />
          <Field label="КНП" field="knp" />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="secondary" disabled={loading} onClick={onCancel}>Отмена</Button>}
        <Button type="submit" disabled={loading}>{loading ? 'Сохранение...' : submitText}</Button>
      </div>
    </form>
  );
};

export default CompanyForm;
