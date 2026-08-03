import { useFormContext } from 'react-hook-form';
import type { Company, CompanyObject } from '../../../../types/companies';
import type { LaboratoryExecutorOption, ProtocolWizardForm } from '../wizardTypes';

export default function ProtocolSigningStep({ companies, objects, employees }: { companies: Company[]; objects: CompanyObject[]; employees: LaboratoryExecutorOption[] }) {
  const { watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  return <section><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Подписание</h3><p className="mt-1 text-sm text-slate-500">Проверьте краткую сводку. NCALayer подключится только после нажатия кнопки подписания.</p><dl className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2">{[
    ['Номер', 'Будет присвоен автоматически'], ['Компания', companies.find((item) => String(item.id) === form.companyId)?.name || '—'],
    ['Объект', objects.find((item) => String(item.id) === form.objectId)?.name || '—'], ['Дата', form.protocolDate || '—'],
    ['Исполнитель', employees.find((item) => String(item.executorId) === form.executorId)?.fullName || '—'], ['Показателей', String(form.results.length)],
  ].map(([label, value]) => <div key={label}><dt className="text-xs font-bold uppercase text-slate-500">{label}</dt><dd className="mt-1 font-semibold text-slate-950">{value}</dd></div>)}</dl></section>;
}
