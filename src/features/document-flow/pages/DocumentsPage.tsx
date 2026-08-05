import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, Checkbox, FormControl, FormControlLabel, Grid, InputLabel,
  MenuItem, Pagination, Select, Skeleton, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { mapSearchParamsToDocumentFilters, resetDocumentFilterParams, setDocumentFilterParam } from '../mappers/documentMappers';
import { canMutate } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import DocumentStatusBadge from '../components/DocumentStatusBadge';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';

const statusOptions = [
  ['DRAFT', 'Черновик'], ['READY_FOR_SIGNING', 'Готов к подписанию'], ['SENT_FOR_SIGNING', 'На подписании'],
  ['PARTIALLY_SIGNED', 'Частично подписан'], ['SIGNED', 'Подписан'], ['REJECTED', 'Отклонён'],
  ['RETURNED_FOR_REVISION', 'Возвращён на доработку'], ['REVOCATION_REQUESTED', 'Запрошен отзыв'],
  ['REVOKED', 'Отозван'], ['CANCELLED', 'Отменён'], ['EXPIRED', 'Просрочен'], ['ARCHIVED', 'Архивирован'],
] as const;

export default function DocumentsPage() {
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('query') || '');
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setParams((current) => setDocumentFilterParam(current, 'query', search), { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search, setParams]);
  const filters = useMemo(() => mapSearchParamsToDocumentFilters(params), [params]);
  const types = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const query = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.documents(tenant.tenantScope, filters) : ['document-flow', 'tenant-unresolved', 'documents'],
    queryFn: ({ signal }) => documentFlowApi.documents(filters, signal),
    enabled: tenant.organizationResolved,
  });
  const set = (key: string, value: string, resetPage = true) => {
    setParams(setDocumentFilterParam(params, key, value, resetPage));
  };
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" fontWeight={800}>Документы</Typography>
        {canMutate(access, 'CREATE_DOCUMENT', 'DOCUMENT_CREATE') && <Button component={Link} to="/document-flow/documents/new" variant="contained">Создать</Button>}
      </Stack>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth label="Поиск" value={search} onChange={(event) => setSearch(event.target.value)} /></Grid>
        <Grid size={{ xs: 12, sm: 4, md: 2 }}><FormControl fullWidth><InputLabel>Направление</InputLabel><Select label="Направление" value={params.get('direction') || ''} onChange={(event) => set('direction', event.target.value)}><MenuItem value="">Все</MenuItem><MenuItem value="INCOMING">Входящие</MenuItem><MenuItem value="OUTGOING">Исходящие</MenuItem><MenuItem value="INTERNAL">Внутренние</MenuItem></Select></FormControl></Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}><FormControl fullWidth><InputLabel>Тип</InputLabel><Select label="Тип" value={params.get('type') || ''} onChange={(event) => set('type', event.target.value)}><MenuItem value="">Все</MenuItem>{(types.data || []).filter((item) => item.active).map((item) => <MenuItem key={item.type} value={item.type}>{item.title}</MenuItem>)}</Select></FormControl></Grid>
        <Grid size={{ xs: 12, sm: 4, md: 3 }}><FormControl fullWidth><InputLabel>Статус</InputLabel><Select label="Статус" value={params.get('status') || ''} onChange={(event) => set('status', event.target.value)}><MenuItem value="">Все</MenuItem>{statusOptions.map(([value, label]) => <MenuItem value={value} key={value}>{label}</MenuItem>)}</Select></FormControl></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField fullWidth type="number" label="ID контрагента" value={params.get('counterpartyId') || ''} onChange={(event) => set('counterpartyId', event.target.value)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField fullWidth type="number" label="ID автора" value={params.get('authorId') || ''} onChange={(event) => set('authorId', event.target.value)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="Создан от" InputLabelProps={{ shrink: true }} value={params.get('createdFrom') || ''} onChange={(event) => set('createdFrom', event.target.value)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="Создан до" InputLabelProps={{ shrink: true }} value={params.get('createdTo') || ''} onChange={(event) => set('createdTo', event.target.value)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="Срок от" InputLabelProps={{ shrink: true }} value={params.get('deadlineFrom') || ''} onChange={(event) => set('deadlineFrom', event.target.value)} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><TextField fullWidth type="date" label="Срок до" InputLabelProps={{ shrink: true }} value={params.get('deadlineTo') || ''} onChange={(event) => set('deadlineTo', event.target.value)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><FormControl fullWidth><InputLabel>Сортировка</InputLabel><Select label="Сортировка" value={params.get('sort') || 'createdAt,desc'} onChange={(event) => set('sort', event.target.value)}><MenuItem value="createdAt,desc">Сначала новые</MenuItem><MenuItem value="createdAt,asc">Сначала старые</MenuItem><MenuItem value="deadline,asc">Ближайший срок</MenuItem><MenuItem value="title,asc">По названию</MenuItem></Select></FormControl></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><FormControlLabel control={<Checkbox checked={params.get('requiresMySignature') === 'true'} onChange={(event) => set('requiresMySignature', event.target.checked ? 'true' : '')} />} label="Требует моей подписи" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><FormControlLabel control={<Checkbox checked={params.get('overdue') === 'true'} onChange={(event) => set('overdue', event.target.checked ? 'true' : '')} />} label="Просроченные" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><Button onClick={() => { setSearch(''); setParams(resetDocumentFilterParams(filters.size)); }}>Сбросить фильтры</Button></Grid>
      </Grid>
      {query.isLoading && <Stack>{[1, 2, 3].map((key) => <Skeleton key={key} height={90} />)}</Stack>}
      {query.isError && <Alert severity="error" action={<Button onClick={() => query.refetch()}>Повторить</Button>}>{query.error.message}</Alert>}
      {!query.isLoading && !query.data?.items.length && <Alert severity="info">{Object.keys(filters).some((key) => !['page', 'size', 'sort'].includes(key)) ? 'По заданным фильтрам документов нет.' : 'Документы ещё не созданы.'}</Alert>}
      <Grid container spacing={2}>
        {(query.data?.items || []).map((document) => (
          <Grid size={{ xs: 12, md: mobile ? 12 : 6, lg: 4 }} key={document.id}>
            <Card><CardActionArea component={Link} to={`/document-flow/documents/${document.id}`}><CardContent>
              <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={800}>{document.number || 'Без номера'}</Typography><DocumentStatusBadge status={document.status} /></Stack>
              <Typography variant="h6" mt={1}>{document.title}</Typography>
              <Typography color="text.secondary">{document.counterparty?.name || 'Без контрагента'} · {new Date(document.createdAt).toLocaleDateString('ru-RU')}</Typography>
              <Typography variant="body2">{document.direction === 'INCOMING' ? 'Входящий' : document.direction === 'OUTGOING' ? 'Исходящий' : 'Внутренний'} · Автор: {document.author?.fullName || 'Нет данных'}</Typography>
              <Typography variant="body2" mt={1}>Подписей: {document.signedCount === undefined || document.requiredCount === undefined ? 'Нет данных' : `${document.signedCount} / ${document.requiredCount}`}</Typography>
              <Typography variant="body2">Моя подпись: {document.requiresMySignature === undefined ? 'Нет данных' : document.requiresMySignature ? 'требуется' : 'не требуется'} · Срок: {document.deadline ? new Date(document.deadline).toLocaleDateString('ru-RU') : 'не указан'}</Typography>
            </CardContent></CardActionArea></Card>
          </Grid>
        ))}
      </Grid>
      {(query.data?.totalPages || 0) > 1 && <Box display="flex" justifyContent="center"><Pagination page={filters.page + 1} count={query.data?.totalPages || 1} onChange={(_, page) => set('page', String(page - 1), false)} /></Box>}
      <Typography variant="body2" color="text.secondary">Всего: {query.data?.totalElements ?? 0}</Typography>
    </Stack>
  );
}
