import { Check } from 'lucide-react';

type Props = { steps: string[]; current: number; maxVisited: number; onSelect: (index: number) => void };
const ProtocolWizardSteps = ({ steps, current, maxVisited, onSelect }: Props) => (
  <nav aria-label="Шаги создания протокола" className="shrink-0 border-b border-slate-100 bg-white px-4 py-3 sm:px-7">
    <ol className="grid grid-cols-5">{steps.map((label, index) => { const completed = index < current; const available = index <= maxVisited; return <li key={label} className="relative min-w-0 before:absolute before:left-0 before:right-0 before:top-4 before:h-px before:bg-slate-200 first:before:left-1/2 last:before:right-1/2"><button type="button" disabled={!available} onClick={() => onSelect(index)} aria-current={index === current ? 'step' : undefined} className="relative z-10 flex w-full min-w-0 flex-col items-center gap-1.5 text-center"><span className={`grid h-8 w-8 place-items-center rounded-full border text-xs font-black transition ${index === current ? 'border-eco-700 bg-eco-700 text-white shadow-sm ring-4 ring-eco-50' : completed ? 'border-emerald-600 bg-emerald-600 text-white' : available ? 'border-eco-300 bg-white text-eco-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>{completed ? <Check className="h-4 w-4" /> : index + 1}</span><span className={`hidden max-w-full truncate text-xs font-bold sm:block ${index === current ? 'text-eco-900' : available ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span></button></li>; })}</ol>
  </nav>
);
export default ProtocolWizardSteps;
