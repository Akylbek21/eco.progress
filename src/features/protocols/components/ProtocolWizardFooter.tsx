import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { step: number; total: number; submitting: boolean; canContinue: boolean; canSaveDraft: boolean; retrying?: boolean; saveState?: string; onBack: () => void; onNext: () => void; onCreate: () => void; onSaveDraft: () => void };
const ProtocolWizardFooter = ({ step, total, submitting, canContinue, canSaveDraft, retrying = false, saveState, onBack, onNext, onCreate, onSaveDraft }: Props) => (
  <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
    <Button type="button" variant="secondary" disabled={step === 0 || submitting} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Назад</Button>
    <div className="flex flex-wrap items-center justify-end gap-3">
      {saveState && <span role="status" className="text-sm font-semibold text-slate-600">{saveState}</span>}
      <Button type="button" variant="secondary" disabled={!canSaveDraft || submitting} onClick={onSaveDraft}>{submitting ? 'Сохраняем…' : retrying ? 'Повторить сохранение' : 'Сохранить черновик'}</Button>
    {step < total - 1
      ? <Button type="button" disabled={!canContinue || submitting} onClick={onNext}>Продолжить <ArrowRight className="h-4 w-4" /></Button>
      : <Button type="button" disabled={!canContinue || submitting} onClick={onCreate}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Сохраняем…' : 'Создать протокол'}</Button>}
    </div>
  </footer>
);
export default ProtocolWizardFooter;
