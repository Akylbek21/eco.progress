import type { WizardIssue } from '../components/WizardValidationSummary';

export default function ProtocolCheckStep({ issues, onGoTo }: {
  issues: WizardIssue[];
  onGoTo: (step: number, field?: WizardIssue['field']) => void;
}) {
  const errors = issues.filter((item) => item.severity === 'ERROR');
  const warnings = issues.filter((item) => item.severity === 'WARNING');
  return (
    <section>
      <h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black">Проверка</h3>
      <p className="mt-1 text-sm text-slate-500">Нажмите на проблему, чтобы перейти к исправлению.</p>
      {!errors.length && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900">Проверка пройдена. Блокирующих ошибок нет.</div>}
      <div className="mt-5 space-y-2">
        {errors.map((item) => <button type="button" key={item.code} onClick={() => onGoTo(item.step, item.field)} className="block w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm font-semibold text-rose-900">Ошибка: {item.message}</button>)}
        {warnings.map((item) => <button type="button" key={item.code} onClick={() => onGoTo(item.step, item.field)} className="block w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm font-semibold text-amber-900">Предупреждение: {item.message}</button>)}
      </div>
    </section>
  );
}
