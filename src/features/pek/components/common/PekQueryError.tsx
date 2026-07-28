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
      ? `${resource} не найден`
      : failure.status && failure.status >= 500
        ? 'Сервис ПЭК временно недоступен'
        : `Не удалось загрузить ${resource.toLowerCase()}`;
  const correlation = failure.traceId ? ` Код обращения: ${failure.traceId}.` : '';
  return <PekState title={title} message={`${failure.message}${correlation}`} retry={retry} />;
};

export default PekQueryError;
