import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import Button from '../../../components/ui/Button';

type Props = { step: number; total: number; submitting: boolean; canContinue: boolean; onBack: () => void; onNext: () => void; onCreate: () => void };
const ProtocolWizardFooter = ({ step, total, submitting, canContinue, onBack, onNext, onCreate }: Props) => (
  <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
    <Button type="button" variant="secondary" disabled={step === 0 || submitting} onClick={onBack}><ArrowLeft className="h-4 w-4" /> Назад</Button>
    <span className="hidden text-xs font-semibold text-slate-500 sm:block">Черновик сохраняется в текущей сессии</span>
    {step < total - 1
      ? <Button type="button" disabled={!canContinue || submitting} onClick={onNext}>Продолжить <ArrowRight className="h-4 w-4" /></Button>
      : <Button type="button" disabled={!canContinue || submitting} onClick={onCreate}>{submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}{submitting ? 'Создание…' : 'Создать протокол'}</Button>}
  </footer>
);
export default ProtocolWizardFooter;
