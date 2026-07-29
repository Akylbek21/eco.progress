import { useQuery } from '@tanstack/react-query';
import { useLocation, useParams } from 'react-router-dom';
import {
  Alert, Box, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { documentFlowDocumentsApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { getDocumentFlowError } from '../utils/errors';

const config: Record<string, { title: string; resource: string; description: string }> = {
  counterparties: { title: 'Контрагенты', resource: 'counterparties', description: 'Организации и представители. Backend предотвращает дубли по БИН.' },
  members: { title: 'Сотрудники и подписанты', resource: 'members', description: 'Доступы и роли сотрудников в пределах лимита подписки.' },
  templates: { title: 'Шаблоны', resource: 'templates', description: 'Шаблоны документов и маршрутов, доступные по тарифу.' },
  audit: { title: 'Журнал действий', resource: 'audit', description: 'Неизменяемый журнал операций пользователей и backend.' },
  'revocation-requests': { title: 'Запросы на отзыв', resource: 'revocation-requests', description: 'Входящие и исходящие запросы на отзыв документов.' },
  settings: { title: 'Настройки модуля', resource: 'settings', description: 'Уведомления и параметры документооборота.' },
  notifications: { title: 'Уведомления', resource: 'notifications', description: 'Системные события документооборота.' },
};

const DocumentFlowManagementPage = ({ kind }: { kind?: string }) => {
  const location = useLocation();
  const params = useParams();
  const detected = kind || Object.keys(config).find((key) => location.pathname.includes(`/${key}`)) || 'settings';
  const page = config[detected];
  const resource = params.requestId && detected === 'revocation-requests' ? `${page.resource}/${params.requestId}`
    : params.counterpartyId && detected === 'counterparties' ? `${page.resource}/${params.counterpartyId}` : page.resource;
  const query = useQuery({
    queryKey: [...documentFlowKeys.resource(resource)],
    queryFn: () => documentFlowDocumentsApi.resource<unknown>(resource),
    retry: false,
  });
  const items = query.data && typeof query.data === 'object' && 'items' in query.data
    ? (query.data as { items: Array<Record<string, unknown>> }).items
    : Array.isArray(query.data) ? query.data as Array<Record<string, unknown>> : [];

  return (
    <Box>
      <Typography variant="h4" fontWeight={950}>{page.title}</Typography><Typography color="text.secondary" sx={{ mt: 0.5 }}>{page.description}</Typography>
      {query.isPending && <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}
      {query.isError && <Alert severity="error" sx={{ mt: 3 }}>{getDocumentFlowError(query.error, `Не удалось загрузить раздел «${page.title}».`).message}</Alert>}
      {!query.isPending && !query.isError && items.length === 0 && <Paper variant="outlined" sx={{ mt: 3, p: 5, borderRadius: 3, textAlign: 'center' }}><Typography fontWeight={900}>Данные отсутствуют</Typography><Typography color="text.secondary">Frontend не подставляет демонстрационные записи.</Typography></Paper>}
      {items.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 3, borderRadius: 3 }}>
          <Table size="small"><TableHead><TableRow>{Object.keys(items[0]).slice(0, 6).map((key) => <TableCell key={key}>{key}</TableCell>)}</TableRow></TableHead>
            <TableBody>{items.map((item, index) => <TableRow key={String(item.id || index)}>{Object.keys(items[0]).slice(0, 6).map((key) => <TableCell key={key}>{typeof item[key] === 'object' ? JSON.stringify(item[key]) : String(item[key] ?? '—')}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default DocumentFlowManagementPage;

