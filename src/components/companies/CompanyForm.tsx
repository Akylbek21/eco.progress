import { useEffect, useMemo } from 'react';
import { useForm, type FieldPath, type SubmitHandler } from 'react-hook-form';
import Button from '../ui/Button';
import { getCompanyFieldErrors } from '../../services/companyService';
import type { CompanyCreateRequest, CompanyDetails, CompanyFormValues } from '../../types/companies';

interface Props {
  initialValue?: Partial<CompanyDetails>;
  loading?: boolean;
  submitText?: string;
  onSubmit: (payload: CompanyCreateRequest) => Promise<void>;
  onCancel?: () => void;
}

const emptyValues: CompanyFormValues = {
  name: '', shortName: '', bin: '', legalAddress: '', actualAddress: '', phone: '', email: '', website: '',
  directorFullName: '', contactPerson: '', contactPhone: '', contactEmail: '', bankName: '', bik: '', iban: '', kbe: '', notes: '',
};
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const errorClass = 'mt-1 text-sm font-medium text-rose-700';
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9 ()-]{10,20}$/;
const ibanPattern = /^KZ\d{2}[A-Z0-9]{16}$/;
const bikPattern = /^[A-Z0-9]{8}([A-Z0-9]{3})?$/;
const nullable = (value: string): string | null => value.trim() || null;

export const toCompanyRequest = (values: CompanyFormValues): CompanyCreateRequest => ({
  name: values.name.trim(),
  shortName: nullable(values.shortName),
  bin: values.bin.trim(),
  legalAddress: nullable(values.legalAddress),
  actualAddress: nullable(values.actualAddress),
  phone: nullable(values.phone),
  email: nullable(values.email),
  website: nullable(values.website),
  directorFullName: nullable(values.directorFullName),
  contactPerson: nullable(values.contactPerson),
  contactPhone: nullable(values.contactPhone),
  contactEmail: nullable(values.contactEmail),
  bankName: nullable(values.bankName),
  bik: nullable(values.bik.replace(/\s/g, '').toUpperCase()),
  iban: nullable(values.iban.replace(/\s/g, '').toUpperCase()),
  kbe: nullable(values.kbe),
  notes: nullable(values.notes),
});

const serverFieldMap: Record<string, FieldPath<CompanyFormValues>> = {
  directorName: 'directorFullName', responsiblePerson: 'contactPerson', responsiblePersonPhone: 'contactPhone',
  responsiblePersonEmail: 'contactEmail', bank: 'bankName', bic: 'bik', comment: 'notes',
};

const CompanyForm = ({ initialValue, loading = false, submitText = 'Сохранить', onSubmit, onCancel }: Props) => {
  const defaults = useMemo<CompanyFormValues>(() => ({
    ...emptyValues,
    ...Object.fromEntries(Object.keys(emptyValues).map((key) => [key, String(initialValue?.[key as keyof CompanyDetails] ?? '')])),
  }), [initialValue]);
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty, isSubmitting } } = useForm<CompanyFormValues>({ defaultValues: defaults, mode: 'onBlur' });

  useEffect(() => reset(defaults), [defaults, reset]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const preventUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const preventInternalNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof HTMLElement ? event.target.closest('a[href]') as HTMLAnchorElement | null : null;
      if (!target || target.target === '_blank' || target.origin !== window.location.origin) return;
      if (!window.confirm('Есть несохранённые изменения. Закрыть форму?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', preventUnload);
    document.addEventListener('click', preventInternalNavigation, true);
    return () => { window.removeEventListener('beforeunload', preventUnload); document.removeEventListener('click', preventInternalNavigation, true); };
  }, [isDirty]);

  const submit: SubmitHandler<CompanyFormValues> = async (values) => {
    try {
      await onSubmit(toCompanyRequest(values));
      reset(values);
    } catch (error) {
      const fieldErrors = getCompanyFieldErrors(error);
      fieldErrors.forEach(({ field, message }) => {
        const target = serverFieldMap[field] || (field in emptyValues ? field as FieldPath<CompanyFormValues> : undefined);
        if (target) setError(target, { type: 'server', message });
      });
      if (!fieldErrors.length) setError('root.server', { type: 'server', message: error instanceof Error ? error.message : 'Не удалось сохранить компанию.' });
    }
  };

  const cancel = () => {
    if (loading || isSubmitting) return;
    if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть форму?')) return;
    onCancel?.();
  };

  const Field = ({ name, label, type = 'text', required = false, rules }: {
    name: FieldPath<CompanyFormValues>; label: string; type?: string; required?: boolean;
    rules?: Parameters<typeof register>[1];
  }) => (
    <label className="block text-sm font-semibold text-slate-700">
      <span>{label}{required && <span className="text-rose-600"> *</span>}</span>
      <input
        type={type}
        aria-invalid={Boolean(errors[name])}
        className={`${inputClass} mt-1.5 ${errors[name] ? 'border-rose-400' : ''}`}
        {...register(name, { required: required ? `${label}: обязательное поле` : false, setValueAs: (value: string) => value, ...rules })}
      />
      {errors[name]?.message && <span role="alert" className={errorClass}>{errors[name]?.message}</span>}
    </label>
  );

  const busy = loading || isSubmitting;
  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-6">
      {errors.root?.server?.message && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errors.root.server.message}</div>}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Основные данные</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field name="name" label="Наименование" required />
          <Field name="shortName" label="Краткое наименование" />
          <Field name="bin" label="БИН" required rules={{ pattern: { value: /^\d{12}$/, message: 'БИН должен содержать ровно 12 цифр' } }} />
          <Field name="website" label="Сайт" type="url" />
          <Field name="legalAddress" label="Юридический адрес" />
          <Field name="actualAddress" label="Фактический адрес" />
          <Field name="phone" label="Телефон" rules={{ pattern: { value: phonePattern, message: 'Укажите корректный телефон' } }} />
          <Field name="email" label="Email" type="email" rules={{ pattern: { value: emailPattern, message: 'Укажите корректный email' } }} />
          <Field name="directorFullName" label="Руководитель" />
          <Field name="contactPerson" label="Контактное лицо" />
          <Field name="contactPhone" label="Телефон контактного лица" rules={{ pattern: { value: phonePattern, message: 'Укажите корректный телефон' } }} />
          <Field name="contactEmail" label="Email контактного лица" type="email" rules={{ pattern: { value: emailPattern, message: 'Укажите корректный email' } }} />
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Реквизиты</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field name="bankName" label="Банк" />
          <Field name="bik" label="БИК" rules={{ validate: (value) => !value || bikPattern.test(value.replace(/\s/g, '').toUpperCase()) || 'БИК должен содержать 8 или 11 латинских букв и цифр' }} />
          <Field name="iban" label="IBAN" rules={{ validate: (value) => !value || ibanPattern.test(value.replace(/\s/g, '').toUpperCase()) || 'IBAN Казахстана должен начинаться с KZ и содержать 20 символов' }} />
          <Field name="kbe" label="КБЕ" rules={{ validate: (value) => !value || /^\d{2}$/.test(value.trim()) || 'КБЕ должен содержать 2 цифры' }} />
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
            <span>Примечание</span>
            <textarea rows={4} className={`${inputClass} mt-1.5`} {...register('notes')} />
          </label>
        </div>
      </section>
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        {onCancel && <Button type="button" variant="secondary" disabled={busy} onClick={cancel}>Отмена</Button>}
        <Button type="submit" disabled={busy}>{busy ? 'Сохранение…' : submitText}</Button>
      </div>
    </form>
  );
};

export default CompanyForm;
