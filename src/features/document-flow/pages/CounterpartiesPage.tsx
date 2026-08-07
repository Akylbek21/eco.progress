import { useEffect, useState } from 'react';
import {
  Alert, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { canMutate } from '../model/access';
import type { Counterparty } from '../model/types';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';
import { emptyToUndefined, isValidEmail, isValidPhone, normalizeBin } from '../utils/counterpartyForm';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';

interface CounterpartyFormValues {
  bin: string;
  name: string;
  directorName: string;
  address: string;
  email: string;
  phone: string;
}

interface RepresentativeFormValues {
  fullName: string;
  position: string;
  email: string;
  phone: string;
}

const defaultValues: CounterpartyFormValues = {
  bin: '', name: '', directorName: '', address: '', email: '', phone: '',
};

export default function CounterpartiesPage() {
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'));
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<'' | Counterparty['status']>('ACTIVE');
  const [sort, setSort] = useState('name,asc');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Counterparty | null>(null);
  const [representativeTarget, setRepresentativeTarget] = useState<Counterparty | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const form = useForm<CounterpartyFormValues>({ defaultValues });
  const representativeForm = useForm<RepresentativeFormValues>({
    defaultValues: { fullName: '', position: '', email: '', phone: '' },
  });
  const filters = { query: debouncedQuery || undefined, status: status || undefined, sort, page, size };

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0); }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const counterpartiesQuery = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.counterparties(tenant.tenantScope, filters) : ['document-flow', 'tenant-unresolved', 'counterparties'],
    queryFn: ({ signal }) => documentFlowApi.getCounterparties({ organizationId: tenant.organizationId!, ...filters, signal }),
    enabled: tenant.organizationResolved,
  });

  useEffect(() => {
    setCreateDialogOpen(false);
    setArchiveTarget(null);
    setRepresentativeTarget(null);
    form.reset(defaultValues);
    setPage(0);
  }, [form, tenant.organizationId]);

  const createMutation = useMutation({
    mutationFn: (values: CounterpartyFormValues) => documentFlowApi.createCounterparty({
      bin: normalizeBin(values.bin),
      name: values.name.trim(),
      directorName: emptyToUndefined(values.directorName),
      address: emptyToUndefined(values.address),
      email: emptyToUndefined(values.email),
      phone: emptyToUndefined(values.phone),
    }, tenant.organizationId!),
    onSuccess: async () => {
      setCreateDialogOpen(false);
      form.reset(defaultValues);
      setSuccessMessage('Контрагент добавлен');
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.counterpartyLists(tenant.tenantScope!) });
    },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      if (mapped.code === 'COUNTERPARTY_DUPLICATE_BIN') {
        form.setError('bin', { type: 'server', message: 'Контрагент с таким БИН уже существует' });
      }
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => {
        if (field in defaultValues) form.setError(field as keyof CounterpartyFormValues, { type: 'server', message });
      });
    },
  });


  const archiveMutation = useMutation({
    mutationFn: (counterpartyId: number) => documentFlowApi.archiveCounterparty(counterpartyId, tenant.organizationId!),
    onSuccess: async (counterparty) => {
      setArchiveTarget(null);
      queryClient.setQueryData(documentFlowKeys.counterparty(tenant.tenantScope!, counterparty.id), counterparty);
      await queryClient.invalidateQueries({ queryKey: documentFlowKeys.counterpartyLists(tenant.tenantScope!) });
    },
  });

  const representativesQuery = useQuery({
    queryKey: representativeTarget
      ? documentFlowKeys.representatives(tenant.tenantScope!, representativeTarget.id)
      : documentFlowKeys.representatives(tenant.tenantScope!, 0),
    queryFn: ({ signal }) => documentFlowApi.representatives(representativeTarget!.id, signal),
    enabled: Boolean(representativeTarget),
  });

  const addRepresentativeMutation = useMutation({
    mutationFn: (values: RepresentativeFormValues) => documentFlowApi.addRepresentative(representativeTarget!.id, {
      fullName: values.fullName.trim(),
      position: emptyToUndefined(values.position) ?? null,
      email: emptyToUndefined(values.email) ?? null,
      phone: emptyToUndefined(values.phone) ?? null,
    }),
    onSuccess: async () => {
      representativeForm.reset();
      await queryClient.invalidateQueries({
        queryKey: documentFlowKeys.representatives(tenant.tenantScope!, representativeTarget!.id),
      });
    },
  });

  const allowed = canMutate(access, 'MANAGE_COUNTERPARTIES');
  const createError = createMutation.isError ? mapDocumentFlowError(createMutation.error) : null;
  const archiveError = archiveMutation.isError ? mapDocumentFlowError(archiveMutation.error) : null;

  const visibleItems = counterpartiesQuery.data?.items ?? [];

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <div>
          <Typography variant="h4" fontWeight={800}>Контрагенты</Typography>
        </div>
        {allowed && <Button variant="contained" onClick={() => setCreateDialogOpen(true)}>Добавить контрагента</Button>}
      </Stack>

      {successMessage && <Alert severity="success" onClose={() => setSuccessMessage('')}>{successMessage}</Alert>}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth label="Поиск по названию или БИН/ИИН" value={query} onChange={(event) => setQuery(event.target.value)} />
        <TextField select label="Статус" value={status} onChange={(event) => { setStatus(event.target.value as '' | Counterparty['status']); setPage(0); }} sx={{ minWidth: 170 }}>
          <MenuItem value="">Все</MenuItem><MenuItem value="ACTIVE">Активные</MenuItem><MenuItem value="ARCHIVED">В архиве</MenuItem>
        </TextField>
        <TextField select label="Сортировка" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} sx={{ minWidth: 220 }}>
          <MenuItem value="name,asc">Название А–Я</MenuItem><MenuItem value="name,desc">Название Я–А</MenuItem><MenuItem value="updatedAt,desc">Недавно изменённые</MenuItem>
        </TextField>
      </Stack>
      {counterpartiesQuery.isError && (
        <Alert severity="error" action={<Button onClick={() => counterpartiesQuery.refetch()}>Повторить</Button>}>
          {mapDocumentFlowError(counterpartiesQuery.error).message}
        </Alert>
      )}
      {counterpartiesQuery.isLoading && <Stack alignItems="center" py={6}><CircularProgress /></Stack>}
      {counterpartiesQuery.isSuccess && visibleItems.length === 0 && (
        <Alert severity="info">Контрагенты ещё не добавлены.</Alert>
      )}
      {counterpartiesQuery.isSuccess && visibleItems.length > 0 && mobile && (
        <Stack spacing={2}>{visibleItems.map((item) => (
          <Card key={item.id}><CardContent><Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" gap={1}><Typography fontWeight={800}>{item.name}</Typography><Chip size="small" color={item.status === 'ACTIVE' ? 'success' : 'default'} label={item.status === 'ACTIVE' ? 'Активен' : 'В архиве'} /></Stack>
            <Typography>БИН: {item.bin}</Typography><Typography>{item.directorName || 'Руководитель не указан'}</Typography>
            <Typography>{item.address || 'Адрес не указан'}</Typography><Typography>{item.phone || 'Телефон не указан'}</Typography><Typography>{item.email || 'Email не указан'}</Typography>
            <Stack direction="row" flexWrap="wrap"><Button onClick={() => setRepresentativeTarget(item)}>Представители</Button>{allowed && item.status === 'ACTIVE' && <Button color="warning" onClick={() => setArchiveTarget(item)}>Архивировать</Button>}</Stack>
          </Stack></CardContent></Card>
        ))}<TablePagination component="div" count={counterpartiesQuery.data.totalElements} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} onPageChange={(_, nextPage) => setPage(nextPage)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Stack>
      )}
      {counterpartiesQuery.isSuccess && visibleItems.length > 0 && !mobile && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow>
                <TableCell>Название</TableCell><TableCell>БИН</TableCell><TableCell>Руководитель</TableCell>
                <TableCell>Email</TableCell><TableCell>Телефон</TableCell><TableCell>Статус</TableCell>
                <TableCell>Дата изменения</TableCell><TableCell align="right">Действия</TableCell>
              </TableRow></TableHead>
              <TableBody>{visibleItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name}</TableCell><TableCell>{item.bin}</TableCell>
                  <TableCell>{item.directorName || '—'}</TableCell><TableCell>{item.email || '—'}</TableCell>
                  <TableCell>{item.phone || '—'}</TableCell>
                  <TableCell><Chip size="small" color={item.status === 'ACTIVE' ? 'success' : 'default'} label={item.status === 'ACTIVE' ? 'Активен' : 'В архиве'} /></TableCell>
                  <TableCell>{item.updatedAt ? new Date(item.updatedAt).toLocaleString('ru-RU') : '—'}</TableCell>
                  <TableCell align="right">
                    <Button onClick={() => setRepresentativeTarget(item)}>Представители</Button>
                    {allowed && item.status === 'ACTIVE' && <Button color="warning" onClick={() => setArchiveTarget(item)}>Архивировать</Button>}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div" count={counterpartiesQuery.data.totalElements} page={page}
            rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]}
            onPageChange={(_, nextPage) => setPage(nextPage)}
            onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }}
          />
        </Paper>
      )}

      <Dialog open={createDialogOpen} onClose={() => !createMutation.isPending && setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Новый контрагент</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          <Controller name="bin" control={form.control} rules={{
            required: 'Укажите БИН',
            validate: (value) => normalizeBin(value).length === 12 || 'БИН должен содержать 12 цифр',
          }} render={({ field, fieldState }) => (
            <TextField {...field} label="БИН" inputMode="numeric" error={Boolean(fieldState.error)} helperText={fieldState.error?.message || `${normalizeBin(field.value).length} из 12 цифр`} />
          )} />
          <TextField label="Название" {...form.register('name', {
            required: 'Укажите название', validate: (value) => Boolean(value.trim()) || 'Укажите название',
          })} error={Boolean(form.formState.errors.name)} helperText={form.formState.errors.name?.message} />
          <TextField label="ФИО руководителя" {...form.register('directorName')} />
          <TextField label="Адрес" {...form.register('address')} />
          <TextField label="Email" {...form.register('email', { validate: (value) => isValidEmail(value) || 'Укажите корректный email' })} error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message} />
          <TextField label="Телефон" {...form.register('phone', { validate: (value) => isValidPhone(value) || 'Укажите корректный телефон' })} error={Boolean(form.formState.errors.phone)} helperText={form.formState.errors.phone?.message} />
          {createMutation.isSuccess && <Alert severity="success">Контрагент создан.</Alert>}
          {createError && !form.formState.errors.bin && <Alert severity={createError.status === 403 ? 'warning' : 'error'}>{createError.message}</Alert>}
        </Stack></DialogContent>
        <DialogActions>
          <Button disabled={createMutation.isPending} onClick={() => setCreateDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" disabled={createMutation.isPending} onClick={form.handleSubmit((values) => createMutation.mutate(values))}>
            {createMutation.isPending ? 'Создание…' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(archiveTarget)} onClose={() => !archiveMutation.isPending && setArchiveTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Архивировать контрагента?</DialogTitle>
        <DialogContent>
          <Typography>Контрагент перестанет отображаться при создании новых документов. Существующие документы сохранят связь.</Typography>
          {archiveError && <Alert severity="error" sx={{ mt: 2 }}>{archiveError.message}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={archiveMutation.isPending} onClick={() => setArchiveTarget(null)}>Отмена</Button>
          <Button color="warning" variant="contained" disabled={archiveMutation.isPending} onClick={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}>
            {archiveMutation.isPending ? 'Архивирование…' : 'Архивировать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(representativeTarget)} onClose={() => !addRepresentativeMutation.isPending && setRepresentativeTarget(null)} fullWidth maxWidth="md">
        <DialogTitle>Представители · {representativeTarget?.name}</DialogTitle>
        <DialogContent><Stack spacing={2} mt={1}>
          {representativesQuery.isLoading && <CircularProgress size={24} />}
          {representativesQuery.isError && <Alert severity="error">{mapDocumentFlowError(representativesQuery.error).message}</Alert>}
          {representativesQuery.isSuccess && representativesQuery.data.length === 0 && <Alert severity="info">Представители не добавлены.</Alert>}
          {representativesQuery.isSuccess && representativesQuery.data.length > 0 && (
            <Table size="small"><TableHead><TableRow><TableCell>ФИО</TableCell><TableCell>Должность</TableCell><TableCell>Email</TableCell><TableCell>Телефон</TableCell><TableCell>Статус</TableCell></TableRow></TableHead>
              <TableBody>{representativesQuery.data.map((item) => <TableRow key={item.id}><TableCell>{item.fullName}</TableCell><TableCell>{item.position || '—'}</TableCell><TableCell>{item.email || '—'}</TableCell><TableCell>{item.phone || '—'}</TableCell><TableCell>{item.active ? 'Активен' : 'Неактивен'}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
          {allowed && <Paper variant="outlined" sx={{ p: 2 }}><Stack spacing={2}>
            <Typography fontWeight={700}>Добавить представителя</Typography>
            <TextField label="ФИО" {...representativeForm.register('fullName', { required: 'Укажите ФИО', validate: (value) => Boolean(value.trim()) || 'Укажите ФИО' })} error={Boolean(representativeForm.formState.errors.fullName)} helperText={representativeForm.formState.errors.fullName?.message} />
            <TextField label="Должность" {...representativeForm.register('position')} />
            <TextField label="Email" {...representativeForm.register('email', { validate: (value) => isValidEmail(value) || 'Укажите корректный email' })} error={Boolean(representativeForm.formState.errors.email)} helperText={representativeForm.formState.errors.email?.message} />
            <TextField label="Телефон" {...representativeForm.register('phone', { validate: (value) => isValidPhone(value) || 'Укажите корректный телефон' })} error={Boolean(representativeForm.formState.errors.phone)} helperText={representativeForm.formState.errors.phone?.message} />
            {addRepresentativeMutation.isError && <Alert severity="error">{mapDocumentFlowError(addRepresentativeMutation.error).message}</Alert>}
            <Button variant="contained" disabled={addRepresentativeMutation.isPending} onClick={representativeForm.handleSubmit((values) => addRepresentativeMutation.mutate(values))}>{addRepresentativeMutation.isPending ? 'Добавление…' : 'Добавить'}</Button>
          </Stack></Paper>}
          <Alert severity="info">Редактирование, активация, деактивация и признак «может подписывать» отсутствуют в backend API.</Alert>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setRepresentativeTarget(null)}>Закрыть</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
