import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Button from '../ui/Button';
import type { LaboratoryDetails, LaboratoryEmployee, LaboratoryFormValues } from '../../types/laboratories';
import { mapLaboratoryToForm } from '../../features/laboratories/api/laboratoryMappers';
import { validateLaboratoryForm } from '../../features/laboratories/schemas/laboratorySchema';
import { parseLaboratoryApiError } from '../../utils/laboratoryApiError';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const emptyValues: LaboratoryFormValues = {
  name: '', shortName: '', legalName: '', bin: '', address: '', city: '', phone: '', email: '', website: '',
  accreditationNumber: '', accreditationIssuedAt: '', accreditationValidUntil: '', accreditationIssuedBy: '',
  directorId: null, laboratoryHeadId: null, standardNote: '', logoUrl: '', isDefault: false, active: true,
};
const valuesFrom = (item?: LaboratoryDetails | null) => item ? mapLaboratoryToForm(item) : emptyValues;

type Props = {
  initial?: LaboratoryDetails | null;
  employees: LaboratoryEmployee[];
  busy: boolean;
  canEditAccreditation: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onRefresh?: () => Promise<void> | void;
  onSave: (values: LaboratoryFormValues) => Promise<void>;
};

const LaboratoryForm = ({ initial, employees, busy, canEditAccreditation, onDirtyChange, onCancel, onRefresh, onSave }: Props) => {
  const [conflict, setConflict] = useState(false);
  const { register, handleSubmit, reset, setError, setFocus, formState: { errors, isDirty } } = useForm<LaboratoryFormValues>({ defaultValues: valuesFrom(initial) });

  useEffect(() => reset(valuesFrom(initial)), [initial, reset]);
  useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const protectNavigation = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement | null)?.closest('a[href]');
      if (anchor && !window.confirm('Есть несохранённые изменения. Покинуть страницу?')) event.preventDefault();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', protectNavigation, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', protectNavigation, true); };
  }, [isDirty]);

  const activeEmployees = employees.filter((employee) => employee.active);
  const submit = handleSubmit(async (values) => {
    setConflict(false);
    const validationErrors = validateLaboratoryForm(values);
    const firstInvalidField = Object.keys(validationErrors)[0] as keyof LaboratoryFormValues | undefined;
    Object.entries(validationErrors).forEach(([name, message]) => setError(name as keyof LaboratoryFormValues, { type: 'validate', message }));
    if (firstInvalidField) { setFocus(firstInvalidField); return; }

    try {
      await onSave({
        ...values,
        name: values.name.trim(), shortName: values.shortName.trim(), legalName: values.legalName.trim(),
        bin: values.bin.trim(), address: values.address.trim(), city: values.city.trim(), phone: values.phone.trim(),
        email: values.email.trim(), website: values.website.trim(), standardNote: values.standardNote.trim(),
        accreditationNumber: values.accreditationNumber.trim(), accreditationIssuedBy: values.accreditationIssuedBy.trim(),
      });
      reset(values);
    } catch (error) {
      const parsed = parseLaboratoryApiError(error);
      if (parsed.status === 409) setConflict(true);
      Object.entries(parsed.fieldErrors || {}).forEach(([name, message]) => {
        if (name in emptyValues) setError(name as keyof LaboratoryFormValues, { type: 'server', message });
      });
      setError('root', { type: 'server', message: parsed.message });
    }
  });

  const field = (name: keyof LaboratoryFormValues, label: string, type = 'text', options?: Parameters<typeof register>[1], disabled = false) => (
    <label className="space-y-1 text-sm font-semibold text-slate-700">
      <span>{label}</span>
      <input type={type} {...register(name, options)} className={inputClass} disabled={busy || disabled} />
      {errors[name]?.message && <span className="block text-xs text-rose-700">{String(errors[name]?.message)}</span>}
    </label>
  );

  const employeeOptions = activeEmployees.map((employee) => (
    <option key={employee.id} value={employee.id}>{employee.fullName} · {employee.position || employee.email}</option>
  ));

  return <form onSubmit={submit} className="space-y-5">
    {conflict && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Данные изменены другим пользователем.</p><p className="mt-1">Обновите сведения перед повторным сохранением.</p><div className="mt-3 flex gap-2"><Button type="button" variant="secondary" onClick={() => void onRefresh?.()}>Обновить данные</Button><Button type="button" variant="secondary" onClick={() => setConflict(false)}>Продолжить редактирование</Button></div></div>}
    {errors.root?.message && <div className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{errors.root.message}</div>}
    <section>
      <h3 className="mb-3 font-black text-slate-900">Основные данные</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {field('name', 'Полное название', 'text', { required: 'Укажите название' })}
        {field('shortName', 'Краткое название')}
        {field('legalName', 'Юридическое название')}
        {field('bin', 'БИН')}
        {field('address', 'Адрес', 'text', { required: 'Укажите адрес' })}
        {field('city', 'Город')}
        {field('phone', 'Телефон', 'tel')}
        {field('email', 'Email', 'email')}
        {field('website', 'Сайт', 'url')}
        <label className="space-y-1 text-sm font-semibold text-slate-700 md:col-span-2">
          <span>Примечание</span><textarea {...register('standardNote')} rows={3} className={inputClass} disabled={busy} />
        </label>
      </div>
    </section>
    <section>
      <h3 className="mb-3 font-black text-slate-900">Аккредитация</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {field('accreditationNumber', 'Номер аттестата', 'text', undefined, !canEditAccreditation)}
        {field('accreditationIssuedBy', 'Кем выдан', 'text', undefined, !canEditAccreditation)}
        {field('accreditationIssuedAt', 'Дата выдачи', 'date', undefined, !canEditAccreditation)}
        {field('accreditationValidUntil', 'Действителен до', 'date', undefined, !canEditAccreditation)}
      </div>
      {!canEditAccreditation && <p className="mt-2 text-xs text-slate-500">Изменение аттестата доступно только ADMIN и DIRECTOR.</p>}
    </section>
    {initial?.id && <section>
      <h3 className="mb-3 font-black text-slate-900">Руководство</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm font-semibold"><span>Директор</span><select {...register('directorId', { setValueAs: (value) => value ? Number(value) : null })} className={inputClass}><option value="">Не выбран</option>{employeeOptions}</select></label>
        <label className="space-y-1 text-sm font-semibold"><span>Заведующий лабораторией</span><select {...register('laboratoryHeadId', { setValueAs: (value) => value ? Number(value) : null })} className={inputClass}><option value="">Не выбран</option>{employeeOptions}</select></label>
      </div>
    </section>}
    <section className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('active')} disabled={busy || Boolean(initial?.isDefault)} /> Активна</label>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('isDefault')} disabled={busy} /> По умолчанию</label>
    </section>
    {initial?.isDefault && <p className="text-xs text-amber-700">Основную лабораторию нельзя деактивировать. Сначала назначьте другую лабораторию основной.</p>}
    <div className="flex justify-end gap-3">
      <Button type="button" variant="secondary" disabled={busy} onClick={() => { if (!isDirty || window.confirm('Есть несохранённые изменения. Закрыть форму?')) onCancel(); }}>Отмена</Button>
      <Button type="submit" disabled={busy}>{busy ? 'Сохранение...' : 'Сохранить'}</Button>
    </div>
  </form>;
};

export default LaboratoryForm;
