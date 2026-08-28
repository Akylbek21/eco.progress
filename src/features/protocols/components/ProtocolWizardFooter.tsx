import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { step: number; total: number; submitting: boolean; canContinue: boolean; canSaveDraft: boolean; retrying?: boolean; saveState?: string; nextLabel?: string; createLabel?: string; onBack: () => void; onNext: () => void; onCreate: () => void; onSaveDraft: () => void };
const ProtocolWizardFooter = ({ step, total, submitting, canContinue, canSaveDraft, retrying = false, saveState, nextLabel = 'Продолжить', createLabel = 'Создать протокол', onBack, onNext, onCreate, onSaveDraft }: Props) => (
  <footer className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3.5 shadow-[0_-10px_28px_-22px_rgba(2,28,57,0.55)] sm:px-7">
    {step > 0 ? <Button type="button" variant="ghost" className="gap-2" disabled={submitting} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Назад</Button> : <span />}
    <div className="flex flex-wrap items-center justify-end gap-3">
      {saveState && <span role="status" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500"><CheckCircle2 className="h-4 w-4 text-emerald-600" />{saveState}</span>}
      <Button type="button" variant="ghost" disabled={!canSaveDraft || submitting} onClick={onSaveDraft}>{submitting ? 'Сохраняем…' : retrying ? 'Повторить сохранение' : 'Сохранить'}</Button>
    {step < total - 1
      ? <Button type="button" disabled={!canContinue || submitting} onClick={onNext}>{nextLabel} <ArrowRight className="h-4 w-4" /></Button>
      : <Button type="button" disabled={!canContinue || submitting} onClick={onCreate}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Сохраняем…' : createLabel}</Button>}
    </div>
  </footer>
);
export default ProtocolWizardFooter;
