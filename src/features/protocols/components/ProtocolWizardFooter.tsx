import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { step: number; total: number; submitting: boolean; canContinue: boolean; canSaveDraft: boolean; retrying?: boolean; saveState?: string; onBack: () => void; onNext: () => void; onCreate: () => void; onSaveDraft: () => void };
const ProtocolWizardFooter = ({ step, total, submitting, canContinue, canSaveDraft, retrying = false, saveState, onBack, onNext, onCreate, onSaveDraft }: Props) => (
  <footer className="sticky bottom-0 z-20 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
    <div>{step > 0 && <Button type="button" variant="ghost" className="gap-2" disabled={submitting} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Назад</Button>}</div>
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      {saveState && <span role="status" className="text-xs text-slate-500 md:hidden">{saveState}</span>}
      <Button type="button" variant="secondary" disabled={!canSaveDraft || submitting} onClick={onSaveDraft}>{retrying ? 'Повторить сохранение' : 'Сохранить черновик'}</Button>
    {step < total - 1
      ? <Button type="button" disabled={!canContinue || submitting} onClick={onNext}>Продолжить <ArrowRight className="h-4 w-4" /></Button>
      : <Button type="button" disabled={!canContinue || submitting} onClick={onCreate}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Создание…' : 'Создать протокол'}</Button>}
    </div>
  </footer>
);
export default ProtocolWizardFooter;
