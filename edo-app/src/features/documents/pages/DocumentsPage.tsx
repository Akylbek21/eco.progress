import { useEffect, useMemo, useState } from 'react';
import { Button, Chip, LinearProgress, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ReplayIcon from '@mui/icons-material/Replay';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState, PageSkeleton, QueryError } from '../../../shared/components/QueryState';
import { useDocuments } from '../hooks/useDocuments';
import type { DocumentFilters } from '../types';
import dayjs from 'dayjs';
import { useDebouncedValue } from '../../../shared/hooks/useDebouncedValue';

const contextFromPath = (path: string) => {
  if (path.includes('/incoming')) return { direction: 'INCOMING', title: 'Входящие документы' };
  if (path.includes('/outgoing')) return { direction: 'OUTGOING', title: 'Исходящие документы' };
  if (path.includes('/waiting-for-me')) return { title: 'Ожидают моей подписи', requiresMySignature: true };
  if (path.includes('/drafts')) return { title: 'Черновики', draft: true };
  if (path.includes('/completed')) return { title: 'Завершённые документы', status: 'SIGNED' };
  if (path.includes('/archive')) return { title: 'Архив', archived: true };
  return { title: 'Все документы' };
};

const statusColors: Record<string, 'default' | 'success' | 'warning' | 'info' | 'error'> = {
  SIGNED: 'success', REJECTED: 'warning', REVOKED: 'warning', DRAFT: 'default', SENT: 'info', PARTIALLY_SIGNED: 'info', OVERDUE: 'error',
};

export const DocumentsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { documentType } = useParams();
  const [params, setParams] = useSearchParams();
  const context = contextFromPath(location.pathname);
  const [search, setSearch] = useState(params.get('search') || '');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);
  const paramsSnapshot = params.toString();
  useEffect(() => {
    const appliedSearch = new URLSearchParams(paramsSnapshot).get('search') || '';
    const nextSearch = debouncedSearch.length >= 2 ? debouncedSearch : '';
    if (appliedSearch === nextSearch) return;
    const next = new URLSearchParams(paramsSnapshot);
    if (nextSearch) next.set('search', nextSearch);
    else next.delete('search');
    next.set('page', '0');
    setParams(next, { replace: true });
  }, [debouncedSearch, paramsSnapshot, setParams]);
  const filters = useMemo<DocumentFilters>(() => ({
    direction: context.direction,
    type: documentType,
    status: params.get('status') || context.status,
    search: params.get('search') || undefined,
    createdFrom: params.get('createdFrom') || undefined,
    createdTo: params.get('createdTo') || undefined,
    requiresMySignature: context.requiresMySignature,
    archived: context.archived,
    draft: context.draft,
    overdue: params.get('overdue') === 'true',
    page: Number(params.get('page') || 0),
    size: Number(params.get('size') || 20),
    sort: params.get('sort') || 'updatedAt,desc',
  }), [context.direction, context.requiresMySignature, context.archived, context.draft, context.status, documentType, params]);
  const query = useDocuments(filters);
  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.set('page', '0');
    setParams(next);
  };
  const outgoing = context.direction === 'OUTGOING' || context.draft;
  const activeFilters = [
    params.get('status') && { key: 'status', label: `Статус: ${params.get('status')}` },
    params.get('search') && { key: 'search', label: `Поиск: ${params.get('search')}` },
    params.get('createdFrom') && { key: 'createdFrom', label: `С: ${params.get('createdFrom')}` },
    params.get('createdTo') && { key: 'createdTo', label: `По: ${params.get('createdTo')}` },
  ].filter((item): item is { key: string; label: string } => Boolean(item));
  const resetFilters = () => {
    setSearch('');
    const next = new URLSearchParams();
    next.set('page', '0');
    next.set('size', params.get('size') || '20');
    next.set('sort', params.get('sort') || 'updatedAt,desc');
    setParams(next);
  };
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <div><Typography variant="h4" fontWeight={900}>{context.title}</Typography><Typography color="text.secondary">Server-side список активной организации</Typography></div>
        {outgoing && <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/documents/create')}>Создать документ</Button>}
      </Stack>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
          <TextField label="Поиск" placeholder="Номер, название, БИН, подписант" value={search} onChange={(event) => setSearch(event.target.value)} />
          <TextField select label="Статус" value={params.get('status') || ''} onChange={(event) => setFilter('status', event.target.value)} sx={{ minWidth: 180 }}><MenuItem value="">Все</MenuItem>{['DRAFT', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'REJECTED', 'REVOKED'].map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}</TextField>
          <TextField label="Создан с" type="date" value={params.get('createdFrom') || ''} onChange={(event) => setFilter('createdFrom', event.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField label="Создан по" type="date" value={params.get('createdTo') || ''} onChange={(event) => setFilter('createdTo', event.target.value)} InputLabelProps={{ shrink: true }} />
          <Button startIcon={<ReplayIcon />} onClick={() => void query.refetch()}>Обновить</Button>
        </Stack>
        {activeFilters.length > 0 && <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mt: 2 }}>{activeFilters.map((filter) => <Chip key={filter.key} label={filter.label} onDelete={() => {
          if (filter.key === 'search') setSearch('');
          setFilter(filter.key, '');
        }} />)}<Button size="small" onClick={resetFilters}>Сбросить</Button></Stack>}
      </Paper>
      {query.isLoading ? <PageSkeleton /> : query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : !query.data?.items.length ? (
        <EmptyState
          title={outgoing ? 'Документы отсутствуют' : 'Входящие документы отсутствуют'}
          text={outgoing ? 'Создайте документ, чтобы начать работу.' : 'Документы появятся после получения от контрагента.'}
          action={outgoing ? <Button variant="contained" onClick={() => navigate('/documents/create')}>Создать документ</Button> : undefined}
        />
      ) : (
        <Paper variant="outlined">
          <TableContainer><Table><TableHead><TableRow><TableCell>Документ</TableCell><TableCell>Тип / направление</TableCell><TableCell>Контрагент</TableCell><TableCell>Автор</TableCell><TableCell>Дата / срок</TableCell><TableCell>Версия</TableCell><TableCell>Подписи</TableCell><TableCell>Статус</TableCell></TableRow></TableHead>
          <TableBody>{query.data.items.map((document) => {
            const progress = document.signatureProgress ? Math.round((document.signatureProgress.signed / Math.max(1, document.signatureProgress.total)) * 100) : 0;
            return <TableRow key={document.id} hover tabIndex={0} onClick={() => navigate(`/documents/${document.id}`)} onKeyDown={(event) => event.key === 'Enter' && navigate(`/documents/${document.id}`)} sx={{ cursor: 'pointer' }}><TableCell><Typography fontWeight={800}>{document.title}</Typography><Typography variant="caption" color="text.secondary">{document.number || 'Без номера'}</Typography></TableCell><TableCell>{document.type.name}<Typography variant="caption" display="block">{document.direction}</Typography></TableCell><TableCell>{document.counterparty?.name || '—'}</TableCell><TableCell>{document.author?.name || '—'}</TableCell><TableCell>{dayjs(document.createdAt).format('DD.MM.YYYY')}<Typography variant="caption" display="block">{document.dueAt ? dayjs(document.dueAt).format('DD.MM.YYYY') : 'Без срока'}</Typography></TableCell><TableCell>{document.version}</TableCell><TableCell sx={{ minWidth: 110 }}>{document.signatureProgress ? `${document.signatureProgress.signed} из ${document.signatureProgress.total}` : '—'}<LinearProgress variant="determinate" value={progress} sx={{ mt: .7 }} /></TableCell><TableCell><Chip size="small" label={document.status} color={statusColors[document.status] || 'default'} /></TableCell></TableRow>;
          })}</TableBody></Table></TableContainer>
          <TablePagination component="div" count={query.data.totalElements} page={query.data.page} rowsPerPage={query.data.size} onPageChange={(_, page) => setFilter('page', String(page))} onRowsPerPageChange={(event) => setFilter('size', event.target.value)} rowsPerPageOptions={[20, 50, 100]} showFirstButton showLastButton labelRowsPerPage="На странице" />
        </Paper>
      )}
    </Stack>
  );
};
