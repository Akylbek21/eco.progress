import type { ProtocolTemplate, ProtocolTemplateId } from '../../../../types/protocols';
import { useFormContext } from 'react-hook-form';
import { PROTOCOL_TEMPLATES } from '../../utils/protocolTemplates';
import type { ProtocolWizardForm } from '../wizardTypes';

type Props = { templates: ProtocolTemplate[]; onSelect: (value: ProtocolTemplateId) => void };
const ProtocolTypeStep = ({ templates, onSelect }: Props) => {
  const { watch } = useFormContext<ProtocolWizardForm>(); const selected = watch('templateId');
  return <section aria-labelledby="wizard-step-title"><h3 id="wizard-step-title" tabIndex={-1} className="text-xl font-black text-slate-950">Выберите тип протокола</h3><p className="mt-2 text-sm text-slate-500">Список загружен из backend. Тип можно изменить до создания.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{templates.map((template) => { const id = template.id as ProtocolTemplateId; const config = PROTOCOL_TEMPLATES[id]; if (!config) return null; return <button key={id} type="button" aria-pressed={selected === id} onClick={() => onSelect(id)} className={`min-h-28 rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-eco-600 ${selected === id ? 'border-eco-500 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200 bg-white hover:border-eco-300'}`}><span className="font-black text-slate-900">{template.name || config.label || id}</span><span className="mt-2 block text-xs text-slate-500">{config.requiresSample ? 'С отбором проб' : 'Физические измерения'}</span></button>; })}</div></section>;
};
export default ProtocolTypeStep;
