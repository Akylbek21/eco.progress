import { useFormContext } from 'react-hook-form';
import type { LaboratoryListItem } from '../../../../types/laboratories';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from '../wizardTypes';

const input = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-eco-500 focus:outline-none focus:ring-4 focus:ring-eco-100';
type Props = { laboratories: LaboratoryListItem[]; employees: LaboratoryExecutorOption[]; loading: boolean; error?: boolean; onLaboratoryChange: (id: string) => void };

const LaboratoryExecutorStep = ({ laboratories, employees, loading, error, onLaboratoryChange }: Props) => {
  const { register, watch } = useFormContext<ProtocolWizardForm>();
  const laboratoryId = watch('laboratoryId');
  const laboratory = laboratories.find((item) => String(item.id) === laboratoryId);
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Лаборатория и исполнитель</h3>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-bold">Лаборатория *
          <select {...register('laboratoryId')} onChange={(event) => onLaboratoryChange(event.target.value)} className={`${input} mt-1.5`}>
            <option value="">Выберите лабораторию</option>
            {laboratories.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-bold">Исполнитель *
          <select {...register('executorId')} disabled={!laboratoryId || loading || error} className={`${input} mt-1.5`}>
            <option value="">{loading ? 'Загрузка…' : 'Выберите сотрудника'}</option>
            {employees.map((item) => <option key={item.laboratoryEmployeeId} value={item.laboratoryEmployeeId}>{item.fullName}</option>)}
          </select>
        </label>
        {error && <div role="alert" className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">Не удалось загрузить сотрудников лаборатории.</div>}
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">Руководитель лаборатории</p><p className="mt-1 font-semibold">{laboratory?.laboratoryHeadName || '—'}</p></div>
        <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase text-slate-400">Аккредитация</p><p className="mt-1 font-semibold">{laboratory?.accreditationNumber || '—'} · до {laboratory?.accreditationValidUntil || '—'}</p></div>
      </div>
    </section>
  );
};

export default LaboratoryExecutorStep;
