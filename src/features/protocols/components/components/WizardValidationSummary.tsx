import type { FieldPath } from 'react-hook-form';
import type { ProtocolWizardForm } from '../wizardTypes';

export type WizardIssue = { message: string; step: number; field?: FieldPath<ProtocolWizardForm> };
type Props = { issues: WizardIssue[]; onGoTo: (step: number, field?: WizardIssue['field']) => void };
const WizardValidationSummary = ({ issues, onGoTo }: Props) => {
  if (!issues.length) return <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-900">Все обязательные данные заполнены. Можно переходить к созданию.</div>;
  const steps = new Set(issues.map((issue) => issue.step));
  return (
    <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <h4 className="font-black text-rose-900">Нужно исправить: {issues.length}</h4>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-rose-900">
        {issues.map((issue, index) => (
          <li key={`${issue.step}-${issue.message}-${index}`}>
            {steps.size > 1 ? <button type="button" className="text-left hover:underline" onClick={() => onGoTo(issue.step, issue.field)}>{issue.message}</button> : issue.message}
          </li>
        ))}
      </ul>
      {steps.size === 1 && <button type="button" onClick={() => onGoTo(issues[0].step, issues[0].field)} className="mt-3 rounded-lg bg-white px-3 py-2 font-bold text-eco-700">Исправить данные</button>}
    </div>
  );
};
export default WizardValidationSummary;
