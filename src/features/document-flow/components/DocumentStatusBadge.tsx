import { Chip } from '@mui/material';
import { isKnownDocumentStatus } from '../model/access';

const labels: Record<string, string> = {
  DRAFT: 'Черновик',
  READY_FOR_SIGNING: 'Готов к подписанию',
  SIGNING: 'На подписании',
  SENT_FOR_SIGNING: 'Отправлен на подпись',
  PARTIALLY_SIGNED: 'Частично подписан',
  SIGNED: 'Подписан',
  REJECTED: 'Отклонён',
  RETURNED_FOR_REVISION: 'Возвращён на доработку',
  REVISION_REQUIRED: 'Требуется доработка',
  REVOCATION_REQUESTED: 'Запрошен отзыв',
  REVOKED: 'Отозван',
  CANCELLED: 'Отменён',
  EXPIRED: 'Срок истёк',
  ARCHIVED: 'В архиве',
  DELETED: 'Удалён',
};

const colors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  READY_FOR_SIGNING: 'info',
  SIGNING: 'warning',
  SENT_FOR_SIGNING: 'warning',
  PARTIALLY_SIGNED: 'warning',
  SIGNED: 'success',
  REJECTED: 'error',
  RETURNED_FOR_REVISION: 'warning',
  REVISION_REQUIRED: 'warning',
  REVOCATION_REQUESTED: 'warning',
  REVOKED: 'error',
  CANCELLED: 'default',
  EXPIRED: 'error',
  ARCHIVED: 'default',
  DELETED: 'default',
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
