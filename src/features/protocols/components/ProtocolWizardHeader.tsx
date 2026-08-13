import { ShieldCheck, X } from 'lucide-react';

type Props = { step: number; total: number; title: string; submitting: boolean; onClose: () => void };
const ProtocolWizardHeader = ({ step, total, title, submitting, onClose }: Props) => (
  <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
    <div><h2 className="text-xl font-black text-slate-950 sm:text-2xl">Новый протокол</h2><p className="mt-1 text-sm font-semibold text-slate-600">Шаг {step + 1} из {total}: {title}</p><p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" /> Черновик сохраняется автоматически — данные не потеряются.</p></div>
    <button type="button" disabled={submitting} onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-50" aria-label="Закрыть создание протокола"><X className="h-5 w-5" /></button>
  </header>
);
export default ProtocolWizardHeader;
