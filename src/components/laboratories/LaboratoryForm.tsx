import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import type { LaboratoryDetails, LaboratoryEmployee, LaboratoryFormValues } from '../../types/laboratories';
import { parseLaboratoryApiError } from '../../utils/laboratoryApiError';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const emptyValues: LaboratoryFormValues = { name: '', shortName: '', bin: '', address: '', city: '', phone: '', email: '', website: '', notes: '', accreditationNumber: '', accreditationValidFrom: '', accreditationValidUntil: '', accreditationIssuedBy: '', directorEmployeeId: null, headEmployeeId: null };
const valuesFrom = (item?: LaboratoryDetails | null): LaboratoryFormValues => item ? {
  name: item.name, shortName: item.shortName || '', bin: item.bin || '', address: item.address || '', city: item.city || '', phone: item.phone || '', email: item.email || '', website: item.website || '', notes: item.notes || '',
  accreditationNumber: item.accreditationNumber || '', accreditationValidFrom: item.accreditationValidFrom || '', accreditationValidUntil: item.accreditationValidUntil || '', accreditationIssuedBy: item.accreditationIssuedBy || '',
  directorEmployeeId: item.directorEmployeeId || null, headEmployeeId: item.headEmployeeId || null,
} : emptyValues;

type Props = { initial?: LaboratoryDetails | null; employees: LaboratoryEmployee[]; busy: boolean; canEditAccreditation: boolean; onDirtyChange?: (dirty: boolean) => void; onCancel: () => void; onSave: (values: LaboratoryFormValues) => Promise<void> };

const LaboratoryForm = ({ initial, employees, busy, canEditAccreditation, onDirtyChange, onCancel, onSave }: Props) => {
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty } } = useForm<LaboratoryFormValues>({ defaultValues: valuesFrom(initial) });
  useEffect(() => reset(valuesFrom(initial)), [initial, reset]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const protectInternalNavigation = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]');
      if (anchor && !window.confirm('Есть несохранённые изменения. Покинуть страницу?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', protectInternalNavigation, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', protectInternalNavigation, true); };
  }, [isDirty]);
  const active = employees.filter((employee) => employee.active);
  const submit = handleSubmit(async (values) => {
    if (values.accreditationValidFrom && values.accreditationValidUntil && values.accreditationValidFrom > values.accreditationValidUntil) {
      setError('accreditationValidUntil', { type: 'validate', message: 'Дата окончания не может быть раньше даты начала' }); return;
    }
    try {
      await onSave({ ...values, name: values.name.trim(), shortName: values.shortName.trim(), bin: values.bin.trim(), address: values.address.trim(), city: values.city.trim(), phone: values.phone.trim(), email: values.email.trim(), website: values.website.trim(), notes: values.notes.trim(), accreditationNumber: values.accreditationNumber.trim(), accreditationIssuedBy: values.accreditationIssuedBy.trim() });
      reset(values);
    } catch (error) {
      const parsed = parseLaboratoryApiError(error);
      Object.entries(parsed.fieldErrors || {}).forEach(([field, message]) => {
        if (field in emptyValues) setError(field as keyof LaboratoryFormValues, { type: 'server', message });
      });
      if (!parsed.fieldErrors || !Object.keys(parsed.fieldErrors).length) setError('root', { type: 'server', message: parsed.message });
    }
  });
  const field = (name: keyof LaboratoryFormValues, label: string, type = 'text', options?: Parameters<typeof register>[1], disabled = false) => <label className="space-y-1 text-sm font-semibold text-slate-700"><span>{label}</span><input type={type} {...register(name, options)} className={inputClass} disabled={busy || disabled} />{errors[name]?.message && <span className="block text-xs text-rose-700">{String(errors[name]?.message)}</span>}</label>;
  return <form onSubmit={submit} className="space-y-5">
    {errors.root?.message && <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{errors.root.message}</div>}
    <section><h3 className="mb-3 font-black text-slate-900">Основные данные</h3><div className="grid gap-4 md:grid-cols-2">
      {field('name', 'Полное название', 'text', { required: 'Укажите название' })}{field('shortName', 'Краткое название')}{field('bin', 'БИН', 'text', { validate: (value) => !value || /^\d{12}$/.test(String(value).trim()) || 'БИН должен содержать 12 цифр' })}{field('address', 'Адрес')}{field('city', 'Город')}{field('phone', 'Телефон', 'tel', { validate: (value) => !value || /^[+\d\s()\-]{10,}$/.test(String(value)) || 'Проверьте формат телефона' })}{field('email', 'Email', 'email', { validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) || 'Проверьте email' })}{field('website', 'Сайт', 'url')}
      <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2"><span>Примечание</span><textarea {...register('notes')} rows={3} className={inputClass} disabled={busy} /></label>
    </div></section>
    <section><h3 className="mb-3 font-black text-slate-900">Аккредитация</h3><div className="grid gap-4 md:grid-cols-2">
      {field('accreditationNumber', 'Номер аттестата', 'text', undefined, !canEditAccreditation)}{field('accreditationIssuedBy', 'Кем выдан', 'text', undefined, !canEditAccreditation)}{field('accreditationValidFrom', 'Дата начала', 'date', undefined, !canEditAccreditation)}{field('accreditationValidUntil', 'Дата окончания', 'date', undefined, !canEditAccreditation)}
    </div>{!canEditAccreditation && <p className="mt-2 text-xs text-slate-500">Изменение аттестата доступно только ADMIN и DIRECTOR.</p>}</section>
    {initial?.id && <section><h3 className="mb-3 font-black text-slate-900">Руководство</h3><div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm font-semibold"><span>Директор</span><select {...register('directorEmployeeId', { setValueAs: (value) => value ? Number(value) : null })} className={inputClass}><option value="">Не выбран</option>{active.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
      <label className="space-y-1 text-sm font-semibold"><span>Заведующий лабораторией</span><select {...register('headEmployeeId', { setValueAs: (value) => value ? Number(value) : null })} className={inputClass}><option value="">Не выбран</option>{active.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select></label>
    </div></section>}
    <div className="flex justify-end gap-3"><Button type="button" variant="secondary" disabled={busy} onClick={() => { if (!isDirty || window.confirm('Есть несохранённые изменения. Закрыть форму?')) onCancel(); }}>Отмена</Button><Button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить'}</Button></div>
  </form>;
};
export default LaboratoryForm;
