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
      <p className="mt-1 text-sm text-slate-500">Мы собрали всё, что нужно проверить перед созданием протокола.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className={`rounded-xl border p-4 ${errors.length ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}><div className="text-2xl font-black">{errors.length}</div><div className="text-sm font-semibold">{errors.length ? 'нужно исправить' : 'обязательных ошибок'}</div></div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900"><div className="text-2xl font-black">{warnings.length}</div><div className="text-sm font-semibold">предупреждений</div></div>
      </div>
      {!errors.length && <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900">Все обязательные данные заполнены. Можно перейти к завершению.</div>}
      {errors.length > 0 && <p className="mt-4 text-sm font-semibold text-slate-700">Нажмите на ошибку, чтобы сразу перейти к нужному полю.</p>}
      <div className="mt-5 space-y-2">
        {errors.map((item) => <button type="button" key={item.code} onClick={() => onGoTo(item.step, item.field)} className="block w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-left text-sm font-semibold text-rose-900">Ошибка: {item.message}</button>)}
        {warnings.map((item) => <button type="button" key={item.code} onClick={() => onGoTo(item.step, item.field)} className="block w-full rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-sm font-semibold text-amber-900">Предупреждение: {item.message}</button>)}
      </div>
    </section>
  );
}
