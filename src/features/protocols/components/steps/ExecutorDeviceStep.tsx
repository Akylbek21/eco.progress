import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import type { LaboratoryListItem } from '../../../../types/laboratories';
import type { MeasurementDevice } from '../../../../types/protocols';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from '../wizardTypes';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-eco-500 focus:ring-2 focus:ring-eco-100';
const date = (value?: string) => value ? new Date(value).toLocaleDateString('ru-RU') : 'не указана';

export default function ExecutorDeviceStep({ laboratories, employees, devices, onLaboratoryChange }: {
  laboratories: LaboratoryListItem[]; employees: LaboratoryExecutorOption[]; devices: MeasurementDevice[]; onLaboratoryChange: (id: string) => void;
}) {
  const { watch, setValue, formState: { errors } } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  useEffect(() => {
    if (!form.defaultMeasurementDeviceId) return;
    form.results.forEach((row, index) => {
      if (!row.measurementDeviceId) setValue(`results.${index}.measurementDeviceId`, form.defaultMeasurementDeviceId, { shouldDirty: true });
    });
  }, [form.defaultMeasurementDeviceId, form.results, setValue]);
  return <section className="space-y-5"><div><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Кто проводил измерения</h3><p className="mt-1 text-sm text-slate-500">Лаборатория и текущий сотрудник подставляются автоматически, если они настроены.</p></div><div className="grid gap-4 rounded-2xl border border-slate-200 p-4 md:grid-cols-2 sm:p-5">
    <label className="text-sm font-semibold">Лаборатория *<select value={form.laboratoryId} aria-invalid={Boolean(errors.laboratoryId)} onChange={(event) => onLaboratoryChange(event.target.value)} className={`${inputClass} mt-1 ${errors.laboratoryId ? 'border-rose-400' : ''}`}><option value="">Выберите лабораторию</option>{laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{errors.laboratoryId?.message && <span className="mt-1 block text-xs font-semibold text-rose-700">{errors.laboratoryId.message}</span>}</label>
    <label className="text-sm font-semibold">Исполнитель *<select value={form.executorId} aria-invalid={Boolean(errors.executorId)} disabled={!form.laboratoryId} onChange={(event) => setValue('executorId', event.target.value, { shouldDirty: true })} className={`${inputClass} mt-1 disabled:bg-slate-100 ${errors.executorId ? 'border-rose-400' : ''}`}><option value="">{form.laboratoryId ? 'Выберите сотрудника' : 'Сначала выберите лабораторию'}</option>{employees.map((item) => <option key={item.executorId} value={item.executorId}>{item.fullName}</option>)}</select>{errors.executorId?.message && <span className="mt-1 block text-xs font-semibold text-rose-700">{errors.executorId.message}</span>}{form.laboratoryId && employees.length === 0 && <span className="mt-1 block text-xs font-normal text-amber-700">В лаборатории нет доступных активных сотрудников.</span>}</label>
    <label className="text-sm font-semibold md:col-span-2">Прибор по умолчанию (можно выбрать позже)<select value={form.defaultMeasurementDeviceId} onChange={(event) => setValue('defaultMeasurementDeviceId', event.target.value, { shouldDirty: true })} className={`${inputClass} mt-1`}><option value="">Выбрать отдельно для каждого показателя</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name} · поверка до {date(item.verificationValidUntil)}</option>)}</select><span className="mt-1 block text-xs font-normal text-slate-500">Выбранный прибор автоматически добавится ко всем строкам без прибора.</span></label>
  </div></section>;
}
