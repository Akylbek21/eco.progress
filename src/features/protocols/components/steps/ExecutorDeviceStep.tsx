import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import type { LaboratoryListItem } from '../../../../types/laboratories';
import type { MeasurementDevice } from '../../../../types/protocols';
import { wizardErrorClass, wizardHelperClass, wizardInputClass, wizardLabelClass } from '../ProtocolWizardField';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from '../wizardTypes';

const date = (value?: string) => value ? new Date(value).toLocaleDateString('ru-RU') : 'не указана';
export default function ExecutorDeviceStep({ laboratories, employees, devices, laboratoriesLoading, employeesLoading, devicesLoading, onLaboratoryChange }: {
  laboratories: LaboratoryListItem[]; employees: LaboratoryExecutorOption[]; devices: MeasurementDevice[]; laboratoriesLoading?: boolean; employeesLoading?: boolean; devicesLoading?: boolean; onLaboratoryChange: (id: string) => void;
}) {
  const { watch, setValue, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  useEffect(() => { if (form.defaultMeasurementDeviceId) form.results.forEach((row, index) => { if (!row.measurementDeviceId) setValue(`results.${index}.measurementDeviceId`, form.defaultMeasurementDeviceId, { shouldDirty: true }); }); }, [form.defaultMeasurementDeviceId, form.results, setValue]);
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h3 className="text-lg font-semibold text-slate-950">Лаборатория</h3><div className="mt-4 grid gap-4 md:grid-cols-2">
    <label className={wizardLabelClass}>Лаборатория *<select value={form.laboratoryId} aria-invalid={Boolean(errors.laboratoryId)} disabled={laboratoriesLoading} onChange={(event) => onLaboratoryChange(event.target.value)} className={`${wizardInputClass} ${errors.laboratoryId ? 'border-rose-400' : ''}`}><option value="">{laboratoriesLoading ? 'Загрузка лабораторий…' : 'Выберите лабораторию'}</option>{laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.laboratoryId?.message && <span className={wizardErrorClass}>{errors.laboratoryId.message}</span>}</label>
    <label className={wizardLabelClass}>Исполнитель *<select value={form.executorId} aria-invalid={Boolean(errors.executorId)} disabled={!form.laboratoryId || employeesLoading} onChange={(event) => setValue('executorId', event.target.value, { shouldDirty: true })} className={`${wizardInputClass} ${errors.executorId ? 'border-rose-400' : ''}`}><option value="">{employeesLoading ? 'Загрузка сотрудников…' : form.laboratoryId ? 'Выберите сотрудника' : 'Сначала выберите лабораторию'}</option>{employees.map((item) => <option key={item.executorId} value={item.executorId}>{item.fullName}</option>)}</select>{errors.executorId?.message && <span className={wizardErrorClass}>{errors.executorId.message}</span>}</label>
    <label className={`${wizardLabelClass} md:col-span-2`}>Прибор по умолчанию<select value={form.defaultMeasurementDeviceId} disabled={devicesLoading} onChange={(event) => setValue('defaultMeasurementDeviceId', event.target.value, { shouldDirty: true })} className={wizardInputClass}><option value="">{devicesLoading ? 'Загрузка приборов…' : 'Выбрать отдельно для каждого показателя'}</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name} · поверка до {date(item.verificationValidUntil)}</option>)}</select><span className={wizardHelperClass}>Применится только к строкам, где прибор ещё не выбран.</span></label>
  </div></section>;
}
