import { Check } from 'lucide-react';
import { normalizeProtocolStatus } from '../../../config/protocolStatus';
import { lifecycleStage } from './protocolDetailsModel';

const stages = ['Создан', 'Рассчитан', 'На утверждении', 'Утверждён, ожидает подписи', 'Подписан / завершён'];
const exceptionalStatuses = {
  NEEDS_REVISION: { label: 'На доработке', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  REPLACED: { label: 'Заменён', className: 'border-slate-300 bg-slate-100 text-slate-800' },
  CANCELLED: { label: 'Отменён', className: 'border-rose-200 bg-rose-50 text-rose-900' },
  ARCHIVED: { label: 'Архив', className: 'border-slate-300 bg-slate-100 text-slate-800' },
} as const;

const ProtocolProgress = ({ status }: { status: string }) => {
  const normalized = normalizeProtocolStatus(status);
  const exceptional = normalized in exceptionalStatuses ? exceptionalStatuses[normalized as keyof typeof exceptionalStatuses] : null;
  if (exceptional) {
    return <section aria-label="Текущий статус протокола" className={`rounded-2xl border px-4 py-3 shadow-sm ${exceptional.className}`}><span className="text-xs font-bold uppercase tracking-wide opacity-70">Текущий статус</span><p className="mt-1 font-black">{exceptional.label}</p></section>;
  }
  const current = lifecycleStage(normalized) ?? 0;
  return (
    <section aria-label="Этапы протокола" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <ol className="flex min-w-[580px] items-center">
        {stages.map((label, index) => <li key={label} className="flex flex-1 items-center last:flex-none">
          <div className={`flex items-center gap-2 text-sm font-bold ${index === current ? 'text-eco-800' : index < current ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`grid h-7 w-7 place-items-center rounded-full ring-1 ${index === current ? 'bg-eco-600 text-white ring-eco-600' : index < current ? 'bg-emerald-100 text-emerald-700 ring-emerald-200' : 'bg-slate-100 ring-slate-200'}`}>{index < current ? <Check className="h-4 w-4" /> : index + 1}</span>
            <span>{label}</span>
          </div>
          {index < stages.length - 1 && <span className={`mx-3 h-px flex-1 ${index < current ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
        </li>)}
      </ol>
    </section>
  );
};

export default ProtocolProgress;
