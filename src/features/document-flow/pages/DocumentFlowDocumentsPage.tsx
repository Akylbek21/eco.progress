import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { Eye, Plus, Search } from 'lucide-react';
import { documentFlowDocumentsApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowAccess } from '../access/DocumentFlowAccessProvider';
import type { DocumentFilters } from '../types';
import { DocumentStatusChip } from '../components/DocumentStatusChip';
import { getDocumentFlowError } from '../utils/errors';

const routeDefaults = (pathname: string): DocumentFilters => {
  if (pathname.includes('/incoming')) return { direction: 'INCOMING' };
  if (pathname.includes('/outgoing')) return { direction: 'OUTGOING' };
  if (pathname.includes('/requires-my-signature')) return { requiresMySignature: true };
  if (pathname.includes('/drafts')) return { status: 'DRAFT' };
  if (pathname.includes('/archive')) return { status: 'ARCHIVED' };
  return {};
};

const DocumentFlowDocumentsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { access, can, hasAction } = useDocumentFlowAccess();
  const filters = useMemo<DocumentFilters>(() => ({
    ...routeDefaults(location.pathname),
    type: searchParams.get('type') || undefined,
    status: searchParams.get('status') || routeDefaults(location.pathname).status,
    search: searchParams.get('search') || undefined,
    page: Number(searchParams.get('page') || 0),
    size: 20,
  }), [location.pathname, searchParams]);
  const query = useQuery({
    queryKey: documentFlowKeys.documents(filters),
    queryFn: () => documentFlowDocumentsApi.list(filters),
    placeholderData: keepPreviousData,
    retry: false,
  });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    next.delete('page');
    setSearchParams(next);
  };
  const title = location.pathname.includes('/incoming') ? 'Входящие'
    : location.pathname.includes('/outgoing') ? 'Исходящие'
      : location.pathname.includes('/requires-my-signature') ? 'Ожидают моей подписи'
        : location.pathname.includes('/drafts') ? 'Черновики' : 'Архив';
  const canCreate = !access.readOnly && can('DOCUMENT_CREATE') && hasAction('CREATE_DOCUMENT');

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Box><Typography variant="h4" fontWeight={950}>{title}</Typography><Typography color="text.secondary">Server-side поиск, фильтры и пагинация.</Typography></Box>
        {canCreate && filters.direction !== 'INCOMING' && <Button variant="contained" startIcon={<Plus />} onClick={() => navigate('/document-flow/app/documents/create')}>Создать документ</Button>}
      </Stack>
      <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth size="small" label="Поиск по номеру, названию, БИН или подписанту" value={searchParams.get('search') || ''} onChange={(event) => update('search', event.target.value)} InputProps={{ startAdornment: <Search size={17} style={{ marginRight: 8 }} /> }} />
          <TextField select size="small" label="Тип" value={searchParams.get('type') || ''} onChange={(event) => update('type', event.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="">Все типы</MenuItem><MenuItem value="CONTRACT">Договор</MenuItem><MenuItem value="ACT">Акт</MenuItem><MenuItem value="FREE_FORM">Произвольный</MenuItem>
          </TextField>
          <TextField select size="small" label="Статус" value={searchParams.get('status') || ''} onChange={(event) => update('status', event.target.value)} sx={{ minWidth: 190 }}>
            <MenuItem value="">Все статусы</MenuItem>{['DRAFT', 'SENT', 'SIGNING', 'PARTIALLY_SIGNED', 'SIGNED', 'REJECTED', 'REVOKED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </TextField>
        </Stack>
      </Paper>
      {query.isFetching && <LinearProgress sx={{ mt: 2 }} />}
      {query.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(query.error, 'Не удалось загрузить документы.').message}</Alert>}
      {!query.isPending && !query.isError && query.data.items.length === 0 && (
        <Paper variant="outlined" sx={{ mt: 2, p: 6, borderRadius: 3, textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={900}>{filters.direction === 'INCOMING' ? 'Входящие документы отсутствуют' : 'Документы отсутствуют'}</Typography>
          {canCreate && filters.direction !== 'INCOMING' && <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/document-flow/app/documents/create')}>Создать первый документ</Button>}
        </Paper>
      )}
      {query.isPending && <Box sx={{ minHeight: 260, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>}
      {query.data?.items.length ? (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 3 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Номер / название</TableCell><TableCell>Тип</TableCell><TableCell>Контрагент</TableCell><TableCell>Дата / срок</TableCell><TableCell>Версия</TableCell><TableCell>Подписи</TableCell><TableCell>Статус</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {query.data.items.map((document) => {
                const percent = document.signaturesTotal ? Math.round((document.signaturesCompleted / document.signaturesTotal) * 100) : 0;
                return (
                  <TableRow key={document.id} hover>
                    <TableCell><Typography fontWeight={800}>{document.number}</Typography><Typography variant="body2" color="text.secondary">{document.title}</Typography></TableCell>
                    <TableCell>{document.type}</TableCell><TableCell>{document.counterparty?.name || '—'}</TableCell>
                    <TableCell>{new Date(document.createdAt).toLocaleDateString('ru-KZ')}<Typography variant="caption" display="block" color="text.secondary">{document.dueAt ? `до ${new Date(document.dueAt).toLocaleDateString('ru-KZ')}` : 'Без срока'}</Typography></TableCell>
                    <TableCell>v{document.version}</TableCell>
                    <TableCell sx={{ minWidth: 120 }}><Typography variant="caption">{document.signaturesCompleted} из {document.signaturesTotal} · {percent}%</Typography><LinearProgress variant="determinate" value={percent} sx={{ mt: 0.5, borderRadius: 5 }} /></TableCell>
                    <TableCell><DocumentStatusChip status={document.status} /></TableCell>
                    <TableCell><Button size="small" startIcon={<Eye size={16} />} onClick={() => navigate(`/document-flow/app/documents/${document.id}`)}>Открыть</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  );
};

export default DocumentFlowDocumentsPage;

