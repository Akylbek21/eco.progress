import { mapPekError } from '../../utils/pekErrorMapper';
import { PekState } from './PekUi';

const PekQueryError = ({ error, resource, retry }: {
  error: unknown;
  resource: string;
  retry: () => void;
}) => {
  const failure = mapPekError(error);
  const title = failure.status === 403
    ? 'Недостаточно прав'
    : failure.status === 404
      ? 'Данные недоступны'
      : failure.status && failure.status >= 500
        ? 'Сервис ПЭК временно недоступен'
        : `Не удалось загрузить ${resource.toLowerCase()}`;
  const code = failure.code ? ` Код ошибки: ${failure.code}.` : '';
  const correlation = failure.traceId ? ` Trace ID: ${failure.traceId}.` : '';
  const message = failure.status === 404
    ? `Запрошенные данные недоступны или были удалены.${code}${correlation}`
    : `${failure.message}${code}${correlation}`;
  return <PekState title={title} message={message} retry={retry} />;
};

export default PekQueryError;
