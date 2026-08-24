import { ShieldCheck, X } from 'lucide-react';

type Props = { step: number; total: number; title: string; submitting: boolean; onClose: () => void };
const ProtocolWizardHeader = ({ step, total, title, submitting, onClose }: Props) => (
  <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-3.5 sm:px-7 sm:py-4">
    <div className="min-w-0"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">Новый протокол</h2><span className="rounded-full bg-eco-50 px-2.5 py-1 text-xs font-bold text-eco-800">Шаг {step + 1} из {total}</span></div><p className="mt-1 truncate text-sm font-semibold text-slate-600">{title}</p></div>
    <div className="flex shrink-0 items-center gap-3"><p className="hidden items-center gap-1.5 text-xs font-semibold text-emerald-700 md:inline-flex"><ShieldCheck className="h-4 w-4" /> Черновик сохраняется автоматически</p>
    <button type="button" disabled={submitting} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50" aria-label="Закрыть создание протокола"><X className="h-5 w-5" /></button>
    </div>
  </header>
);
export default ProtocolWizardHeader;
