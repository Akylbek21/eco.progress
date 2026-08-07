import { Box, Stack, Typography } from '@mui/material';
import type { AuditEvent } from '../model/types';

const actionLabels: Record<string, string> = {
  DOCUMENT_CREATED: 'Документ создан', FILE_UPLOADED: 'Файл загружен', VERSION_UPLOADED: 'Загружена новая версия',
  ROUTE_CREATED: 'Маршрут создан', DOCUMENT_PREPARED: 'Подготовлен к подписанию',
  DOCUMENT_SENT: 'Отправлен на подписание', SENT_FOR_SIGNING: 'Отправлен на подписание',
  SIGNATURE_ADDED: 'Документ подписан', SIGNED: 'Документ подписан', DOCUMENT_REJECTED: 'Подписание отклонено',
  RETURNED_FOR_REVISION: 'Документ возвращён на доработку', REVOCATION_REQUESTED: 'Запрошен отзыв документа',
  DOCUMENT_ARCHIVED: 'Документ архивирован',
};

export default function AuditTimeline({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <Typography color="text.secondary">История документа пока пуста.</Typography>;
  return <Stack spacing={0}>{events.map((event, index) => <Stack key={event.id} direction="row" gap={2}>
    <Stack alignItems="center"><Box width={12} height={12} borderRadius="50%" bgcolor="primary.main" mt={0.75} />{index < events.length - 1 && <Box width={2} minHeight={54} bgcolor="divider" />}</Stack>
    <Box pb={2}><Typography fontWeight={700}>{actionLabels[event.eventType] || event.eventType}</Typography><Typography variant="body2" color="text.secondary">{new Date(event.createdAt).toLocaleString('ru-RU')}{event.actorName ? ` · ${event.actorName}` : ''}</Typography>{event.description && <Typography variant="body2">{event.description}</Typography>}</Box>
  </Stack>)}</Stack>;
}
