import { AlertTriangle, Check, Circle } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../types/companies';
import type { LaboratoryListItem } from '../../../types/laboratories';
import type { ProtocolTemplate } from '../../../types/protocols';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from './wizardTypes';

type Props = {
  templates: ProtocolTemplate[];
  companies: Company[];
  objects: CompanyObject[];
  laboratories: LaboratoryListItem[];
  employees: LaboratoryExecutorOption[];
  currentStep: number;
  errorCounts: number[];
};

export default function ProtocolWizardSummary({ templates, companies, objects, laboratories, employees, currentStep, errorCounts }: Props) {
  const { watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const items = [
    ['Тип протокола', templates.find((item) => String(item.id) === form.templateId)?.name],
    ['Компания', companies.find((item) => String(item.id) === form.companyId)?.name],
    ['Объект', objects.find((item) => String(item.id) === form.objectId)?.name],
    ['Дата', form.protocolDate ? new Date(`${form.protocolDate}T00:00:00`).toLocaleDateString('ru-RU') : ''],
    ['Лаборатория', laboratories.find((item) => String(item.id) === form.laboratoryId)?.name],
    ['Исполнитель', employees.find((item) => String(item.executorId) === form.executorId)?.fullName],
    ['Количество точек', form.templateId === 'ambient_air' ? form.samplingPoints.length : form.measurementPlace ? 1 : 0],
    ['Количество результатов', form.results.length],
  ];
  const readiness = ['Основные данные', 'Лаборатория', 'Результаты', 'Проверка'];

  return <aside className="border-t border-slate-200 bg-white p-5 xl:border-l xl:border-t-0">
    <div className="xl:sticky xl:top-5">
      <h2 className="text-lg font-semibold text-slate-950">Сводка</h2>
      <dl className="mt-4 divide-y divide-slate-100">
        {items.map(([label, value]) => <div key={String(label)} className="py-2.5"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 break-words text-sm font-medium text-slate-800">{value || '—'}</dd></div>)}
      </dl>
      <h3 className="mt-6 text-sm font-semibold text-slate-900">Готовность</h3>
      <ul className="mt-3 space-y-2.5">
        {readiness.map((label, index) => {
          const errors = errorCounts[index] || 0;
          const complete = index < currentStep && errors === 0;
          return <li key={label} className={`flex items-center gap-2 text-sm ${errors ? 'text-amber-700' : complete ? 'text-emerald-700' : 'text-slate-500'}`}>
            {errors ? <AlertTriangle className="h-4 w-4" /> : complete ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
            <span>{label}{errors ? ` — ${errors} ${errors === 1 ? 'ошибка' : 'ошибки'}` : ''}</span>
          </li>;
        })}
      </ul>
    </div>
  </aside>;
}

