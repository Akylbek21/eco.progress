import { AlertTriangle, Check } from 'lucide-react';

type Props = {
  steps: string[];
  current: number;
  maxVisited: number;
  errorCounts: number[];
  onSelect: (index: number) => void;
};

export default function ProtocolWizardSidebar({ steps, current, maxVisited, errorCounts, onSelect }: Props) {
  return <nav aria-label="Шаги создания протокола" className="border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
    <ol className="flex gap-2 overflow-x-auto p-3 lg:sticky lg:top-0 lg:flex-col lg:overflow-visible lg:p-5">
      {steps.map((label, index) => {
        const available = index <= maxVisited;
        const active = index === current;
        const errors = errorCounts[index] || 0;
        const completed = index < maxVisited && errors === 0;
        return <li key={label} className="min-w-[150px] lg:min-w-0">
          <button
            type="button"
            disabled={!available}
            onClick={() => onSelect(index)}
            aria-current={active ? 'step' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${active ? 'bg-eco-50 text-eco-950 ring-1 ring-eco-200' : available ? 'text-slate-700 hover:bg-slate-50' : 'cursor-not-allowed text-slate-400'}`}
          >
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${active ? 'bg-eco-700 text-white' : completed ? 'bg-emerald-100 text-emerald-700' : errors && available ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {completed ? <Check className="h-4 w-4" /> : errors && available ? <AlertTriangle className="h-4 w-4" /> : String(index + 1).padStart(2, '0')}
            </span>
            <span className="min-w-0 flex-1 font-medium">{label}</span>
            {errors > 0 && available && <span className="text-xs font-semibold text-amber-700">{errors}</span>}
          </button>
        </li>;
      })}
    </ol>
  </nav>;
}

