import Button from '../../../../components/ui/Button';
import type { ApiError } from '../../../../services/apiHelpers';

type Props = {
  error: ApiError;
  message: string;
  pending: boolean;
  onRetry: () => void;
  onReview: () => void;
  onCopyCode: () => void;
  onCopyTechnicalInfo: () => void;
};

const QuickCreateErrorPanel = ({
  error,
  message,
  pending,
  onRetry,
  onReview,
  onCopyCode,
  onCopyTechnicalInfo,
}: Props) => {
  const requestCode = error.requestCode || error.traceId || error.requestId;
  return (
    <section role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
      <h3 className="font-black">Не удалось создать протокол</h3>
      <p className="mt-1 font-semibold">{message}</p>
      {requestCode && <p className="mt-1 text-xs font-semibold">Код обращения: {requestCode}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={onRetry}>Повторить</Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={onReview}>Вернуться к проверке</Button>
        {requestCode && <Button type="button" variant="secondary" onClick={onCopyCode}>Скопировать код ошибки</Button>}
        {import.meta.env.DEV && <Button type="button" variant="secondary" onClick={onCopyTechnicalInfo}>Скопировать данные для разработчика</Button>}
      </div>
    </section>
  );
};

export default QuickCreateErrorPanel;
