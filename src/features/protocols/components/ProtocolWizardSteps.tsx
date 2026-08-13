import { Check } from 'lucide-react';

type Props = { steps: string[]; current: number; maxVisited: number; onSelect: (index: number) => void };
const ProtocolWizardSteps = ({ steps, current, maxVisited, onSelect }: Props) => (
  <nav aria-label="Шаги создания протокола" className="shrink-0 border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
    <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-eco-600 transition-all" style={{ width: `${((current + 1) / steps.length) * 100}%` }} /></div>
    <ol className="grid grid-cols-5 gap-1 sm:gap-2">{steps.map((label, index) => { const completed = index < current; return <li key={label}><button type="button" disabled={index > maxVisited} onClick={() => onSelect(index)} aria-current={index === current ? 'step' : undefined} className={`flex w-full min-w-0 items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-bold transition sm:px-3 sm:text-xs ${index === current ? 'bg-eco-600 text-white shadow-sm' : index <= maxVisited ? 'bg-white text-eco-800 ring-1 ring-eco-200' : 'bg-slate-100 text-slate-400'}`}>{completed ? <Check className="h-3.5 w-3.5 shrink-0" /> : <span className="shrink-0">{index + 1}.</span>}<span className="truncate">{label}</span></button></li>; })}</ol>
  </nav>
);
export default ProtocolWizardSteps;
