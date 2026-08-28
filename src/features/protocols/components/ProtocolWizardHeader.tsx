import { ArrowLeft, CheckCircle2, CircleAlert, LoaderCircle, Save, X } from 'lucide-react';

type Props = { saveState?: string; saveTone?: 'idle' | 'saving' | 'saved' | 'error' | 'conflict'; submitting: boolean; onClose: () => void };
// Статус ниже заменяет прежнюю общую подпись «Черновик сохраняется автоматически» конкретным состоянием autosave.
const ProtocolWizardHeader = ({ saveState, saveTone = 'idle', submitting, onClose }: Props) => (
  <header className="flex flex-col gap-4 px-4 py-5 sm:px-0 sm:py-6 md:flex-row md:items-center md:justify-between">
    <div>
      <button type="button" onClick={onClose} disabled={submitting} className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-eco-800 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /> К протоколам</button>
      <h1 className="text-2xl font-bold tracking-tight text-slate-950">Новый протокол</h1>
      <p className="mt-1 text-sm text-slate-500">Заполните данные лабораторного исследования</p>
    </div>
    <div className="flex items-center justify-between gap-4 md:justify-end">
      {saveState && <span role="status" className={`hidden items-center gap-2 text-sm font-medium md:inline-flex ${saveTone === 'error' || saveTone === 'conflict' ? 'text-rose-700' : saveTone === 'saved' ? 'text-emerald-700' : 'text-slate-500'}`}>
        {saveTone === 'saving' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : saveTone === 'saved' ? <CheckCircle2 className="h-4 w-4" /> : saveTone === 'error' || saveTone === 'conflict' ? <CircleAlert className="h-4 w-4" /> : <Save className="h-4 w-4" />}{saveState}
      </span>}
      <button type="button" disabled={submitting} onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><X className="h-4 w-4" /> Закрыть</button>
    </div>
  </header>
);
export default ProtocolWizardHeader;
