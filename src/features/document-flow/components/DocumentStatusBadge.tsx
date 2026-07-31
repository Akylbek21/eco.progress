import { Chip } from '@mui/material';
import { isKnownDocumentStatus } from '../model/access';

const labels: Record<string, string> = {
  DRAFT: 'Черновик',
  READY_FOR_SIGNING: 'Готов к подписанию',
  SENT_FOR_SIGNING: 'Отправлен на подпись',
  PARTIALLY_SIGNED: 'Частично подписан',
  SIGNED: 'Подписан',
  REJECTED: 'Отклонён',
  RETURNED_FOR_REVISION: 'Возвращён на доработку',
  REVOCATION_REQUESTED: 'Запрошен отзыв',
  REVOKED: 'Отозван',
  CANCELLED: 'Отменён',
  EXPIRED: 'Срок истёк',
  ARCHIVED: 'В архиве',
};

const colors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  READY_FOR_SIGNING: 'info',
  SENT_FOR_SIGNING: 'warning',
  PARTIALLY_SIGNED: 'warning',
  SIGNED: 'success',
  REJECTED: 'error',
  RETURNED_FOR_REVISION: 'warning',
  REVOCATION_REQUESTED: 'warning',
  REVOKED: 'error',
  CANCELLED: 'default',
  EXPIRED: 'error',
  ARCHIVED: 'default',
};

export default function DocumentStatusBadge({ status }: { status: string }) {
  const known = isKnownDocumentStatus(status);
  return (
    <Chip
      size="small"
      color={known ? colors[status] : 'error'}
      label={known ? labels[status] : `Неизвестный статус: ${status}`}
    />
  );
}
