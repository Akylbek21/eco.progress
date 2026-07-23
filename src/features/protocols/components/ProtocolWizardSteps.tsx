type Props = { steps: string[]; current: number; maxVisited: number; onSelect: (index: number) => void };
const ProtocolWizardSteps = ({ steps, current, maxVisited, onSelect }: Props) => (
  <nav aria-label="Шаги создания протокола" className="shrink-0 overflow-x-auto border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
    <ol className="flex min-w-max gap-2">{steps.map((label, index) => <li key={label}><button type="button" disabled={index > maxVisited} onClick={() => onSelect(index)} aria-current={index === current ? 'step' : undefined} className={`rounded-full px-3 py-2 text-xs font-bold transition ${index === current ? 'bg-eco-600 text-white' : index <= maxVisited ? 'bg-white text-eco-800 ring-1 ring-eco-200' : 'bg-slate-100 text-slate-400'}`}>{index + 1}. {label}</button></li>)}</ol>
  </nav>
);
export default ProtocolWizardSteps;
