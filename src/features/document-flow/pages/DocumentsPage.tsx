import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardActionArea, CardContent, FormControl, Grid, InputLabel,
  MenuItem, Pagination, Select, Skeleton, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { mapSearchParamsToDocumentFilters } from '../mappers/documentMappers';
import { canMutate } from '../model/access';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import DocumentStatusBadge from '../components/DocumentStatusBadge';

const statusOptions = [
  ['DRAFT', 'Черновик'], ['READY_FOR_SIGNING', 'Готов к подписанию'], ['SIGNING', 'На подписании'],
  ['SIGNED', 'Подписан'], ['REVISION_REQUIRED', 'Требуется доработка'],
  ['REVOCATION_REQUESTED', 'Запрошен отзыв'], ['REVOKED', 'Отозван'], ['ARCHIVED', 'Архивирован'],
] as const;

export default function DocumentsPage() {
  const access = useDocumentFlowContext();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('query') || '');
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = new URLSearchParams(params);
      search.trim() ? next.set('query', search.trim()) : next.delete('query');
      next.set('page', '0');
      setParams(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]); // URL params intentionally synchronized only after debounce.
  const filters = useMemo(() => mapSearchParamsToDocumentFilters(params), [params]);
  const types = useQuery({ queryKey: documentFlowKeys.documentTypes(), queryFn: ({ signal }) => documentFlowApi.documentTypes(signal) });
  const query = useQuery({
    queryKey: documentFlowKeys.documents(filters),
    queryFn: ({ signal }) => documentFlowApi.documents(filters, signal),
    placeholderData: (previous) => previous,
  });
  const set = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (resetPage) next.set('page', '0');
    setParams(next);
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
              <Typography variant="body2" mt={1}>Подписей: {document.signedCount} / {document.requiredCount}</Typography>
            </CardContent></CardActionArea></Card>
          </Grid>
        ))}
      </Grid>
      {(query.data?.totalPages || 0) > 1 && <Box display="flex" justifyContent="center"><Pagination page={filters.page + 1} count={query.data?.totalPages || 1} onChange={(_, page) => set('page', String(page - 1), false)} /></Box>}
    </Stack>
  );
}
