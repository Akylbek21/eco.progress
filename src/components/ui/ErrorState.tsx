import Button from './Button';

type Props = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

const ErrorState = ({
  title = 'Не удалось загрузить данные',
  message = 'Проверьте соединение и повторите попытку.',
  onRetry,
}: Props) => (
  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
    <p className="font-bold">{title}</p>
    <p className="mt-1 text-sm text-rose-800">{message}</p>
    {onRetry && <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>Повторить</Button>}
  </div>
);

export default ErrorState;
