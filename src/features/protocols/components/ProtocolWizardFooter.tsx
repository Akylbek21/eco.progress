import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { step: number; total: number; submitting: boolean; canContinue: boolean; canSaveDraft: boolean; retrying?: boolean; onBack: () => void; onNext: () => void; onCreate: () => void; onSaveDraft: () => void };
const ProtocolWizardFooter = ({ step, total, submitting, canContinue, canSaveDraft, retrying = false, onBack, onNext, onCreate, onSaveDraft }: Props) => (
  <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
    <Button type="button" variant="secondary" disabled={step === 0 || submitting} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Назад</Button>
    {step === total - 1 && <Button type="button" variant="secondary" disabled={!canSaveDraft || submitting} onClick={onSaveDraft}>Сохранить черновик</Button>}
    {step < total - 1
      ? <Button type="button" disabled={!canContinue || submitting} onClick={onNext}>Продолжить <ArrowRight className="h-4 w-4" /></Button>
      : <Button type="button" disabled={!canContinue || submitting} onClick={onCreate}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Создание и подписание…' : retrying ? 'Повторить' : 'Создать и подписать протокол'}</Button>}
  </footer>
);
export default ProtocolWizardFooter;
