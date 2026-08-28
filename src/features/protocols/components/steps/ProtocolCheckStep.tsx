import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { ProtocolTemplate } from '../../../../types/protocols';
import type { WizardIssue } from '../components/WizardValidationSummary';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from '../wizardTypes';

export default function ProtocolCheckStep({ issues, templates, companies, objects, employees, onGoTo }: {
  issues: WizardIssue[];
  templates: ProtocolTemplate[];
  companies: Company[];
  objects: CompanyObject[];
  employees: LaboratoryExecutorOption[];
  onGoTo: (step: number, field?: WizardIssue['field']) => void;
}) {
  const { watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const errors = issues.filter((item) => item.severity === 'ERROR');
  const checklist = [
    ['Основные данные', (field: string) => ['templateId', 'protocolDate', 'measurementDate', 'measurementPlace'].some((key) => field.startsWith(key)), 0],
    ['Компания и объект', (field: string) => field.startsWith('companyId') || field.startsWith('objectId'), 0],
    ['Лаборатория и исполнитель', (field: string) => field.startsWith('laboratoryId') || field.startsWith('executorId'), 1],
    ['Условия измерения', (field: string) => ['temperature', 'humidity', 'pressure', 'wind', 'sampleDate', 'water', 'season', 'room', 'workplace', 'lighting', 'noise'].some((key) => field.startsWith(key)), 1],
    ['Методика', (field: string) => field.startsWith('testingMethodNd') || field.startsWith('samplingMethodNd') || field.startsWith('basis'), 1],
    ['Результаты', (field: string) => field.startsWith('results') || field.startsWith('samplingPoints'), 2],
    ['Приборы', (field: string) => field.includes('measurementDeviceId'), 2],
  ] as const;
  const summary = [
    ['Компания', companies.find((item) => String(item.id) === form.companyId)?.name],
    ['Объект', objects.find((item) => String(item.id) === form.objectId)?.name],
    ['Тип', templates.find((item) => String(item.id) === form.templateId)?.name],
    ['Дата', form.protocolDate ? new Date(`${form.protocolDate}T00:00:00`).toLocaleDateString('ru-RU') : ''],
    ['Исполнитель', employees.find((item) => String(item.executorId) === form.executorId)?.fullName],
    ['Количество точек', form.templateId === 'ambient_air' ? form.samplingPoints.length : form.measurementPlace ? 1 : 0],
    ['Количество результатов', form.results.length],
  ];
  return <section className="space-y-5">
    <div><h2 id="wizard-step-title" tabIndex={-1} className="text-lg font-semibold text-slate-950">Проверка</h2><p className="mt-1 text-sm text-slate-500">Проверьте готовность и основные сведения будущего протокола.</p></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <h3 className="text-sm font-semibold text-slate-900">Готовность разделов</h3>
      <div className="mt-3 divide-y divide-slate-100">{checklist.map(([label, match, target]) => { const sectionErrors = errors.filter((item) => match(String(item.fieldPath || item.field || ''))); const first = sectionErrors[0]; return <button key={label} type="button" disabled={!first} onClick={() => first && onGoTo(target, first.field)} className={`flex w-full items-center gap-3 py-3 text-left text-sm ${first ? 'text-amber-800 hover:text-amber-900' : 'text-slate-700'}`}>{first ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />}<span className="font-medium">{label}</span>{sectionErrors.length > 0 && <span className="ml-auto text-xs font-semibold">{sectionErrors.length} {sectionErrors.length === 1 ? 'ошибка' : 'ошибки'}</span>}</button>; })}</div>
    </div>
    {errors.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold text-amber-950">Нужно исправить: {errors.length}</h3><div className="mt-3 space-y-2">{errors.map((item) => <button type="button" key={item.code} onClick={() => onGoTo(item.step, item.field)} className="block w-full text-left text-sm text-amber-900 underline decoration-amber-300 underline-offset-2">{item.message}</button>)}</div></div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"><h3 className="text-sm font-semibold text-slate-900">Основные сведения</h3><dl className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{summary.map(([label, value]) => <div key={String(label)}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-medium text-slate-900">{value || '—'}</dd></div>)}</dl></div>
  </section>;
}
