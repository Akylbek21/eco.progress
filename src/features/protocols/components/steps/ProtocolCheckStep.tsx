import { useFormContext } from 'react-hook-form';
import type { WizardIssue } from '../components/WizardValidationSummary';
import type { ProtocolWizardForm } from '../wizardTypes';

export default function ProtocolCheckStep({ issues, onGoTo }: { issues: WizardIssue[]; onGoTo: (step: number, field?: WizardIssue['field']) => void }) {
  const { watch } = useFormContext<ProtocolWizardForm>();
  const form = watch();
  const checks = [
    ['Компания выбрана', Boolean(form.companyId), 0], ['Объект выбран', Boolean(form.objectId), 0],
    ['Исполнитель указан', Boolean(form.executorId), 1], ['Прибор действующий', Boolean(form.defaultMeasurementDeviceId) && form.results.every((row) => Boolean(row.measurementDeviceId)), 1],
    ['Результаты заполнены', form.results.length > 0 && form.results.every((row) => row.value !== '' || row.textValue !== ''), 2],
    ['Нормативы проверены', form.results.length > 0 && form.results.every((row) => (row.normativeSource === 'DIRECTORY' && Number(row.normativeId) > 0 && row.normativeStatus !== 'REVIEW' && row.normativeStatus !== 'INACTIVE') || (row.normativeSource === 'MANUAL' && row.normativeValue !== '')), 2],
    ['Место измерения указано', Boolean(form.measurementPlace.trim()), 0],
  ] as const;
  return <section><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Проверка</h3><p className="mt-1 text-sm text-slate-500">Нажмите на пункт, чтобы перейти к исправлению.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{checks.map(([label, ok, target]) => <button type="button" key={label} onClick={() => !ok && onGoTo(target)} className={`rounded-xl border p-4 text-left font-bold ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>{ok ? '✓' : '⚠'} {label}</button>)}</div>{issues.length > 0 && <div className="mt-5 space-y-2">{issues.map((issue) => <button type="button" key={issue.code} onClick={() => onGoTo(issue.step, issue.field)} className="block w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm font-semibold text-rose-900">{issue.message}</button>)}</div>}</section>;
}
