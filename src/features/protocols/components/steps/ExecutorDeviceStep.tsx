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
  const { watch, setValue } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  useEffect(() => {
    if (!form.defaultMeasurementDeviceId) return;
    form.results.forEach((row, index) => {
      if (!row.measurementDeviceId) setValue(`results.${index}.measurementDeviceId`, form.defaultMeasurementDeviceId, { shouldDirty: true });
    });
  }, [form.defaultMeasurementDeviceId, form.results, setValue]);
  return <section className="space-y-5"><div><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Исполнитель и прибор</h3><p className="mt-1 text-sm text-slate-500">Показываются только действующие сотрудники и приборы.</p></div><div className="grid gap-4 md:grid-cols-2">
    <label className="text-sm font-semibold">Лаборатория<select value={form.laboratoryId} onChange={(event) => onLaboratoryChange(event.target.value)} className={`${inputClass} mt-1`}><option value="">Выберите лабораторию</option>{laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="text-sm font-semibold">Сотрудник<select value={form.executorId} onChange={(event) => setValue('executorId', event.target.value, { shouldDirty: true })} className={`${inputClass} mt-1`}><option value="">Выберите сотрудника</option>{employees.map((item) => <option key={item.executorId} value={item.executorId}>{item.fullName}</option>)}</select></label>
    <label className="text-sm font-semibold md:col-span-2">Прибор<select value={form.defaultMeasurementDeviceId} onChange={(event) => setValue('defaultMeasurementDeviceId', event.target.value, { shouldDirty: true })} className={`${inputClass} mt-1`}><option value="">Выберите прибор</option>{devices.map((item) => <option key={item.id} value={item.id}>{item.name} · поверка до {date(item.verificationValidUntil)}</option>)}</select></label>
  </div></section>;
}
