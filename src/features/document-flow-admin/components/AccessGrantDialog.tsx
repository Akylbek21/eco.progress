import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import type { CompanyListItem } from '../../../types/companies';
import { documentFlowKeys } from '../../document-flow/api/documentFlowKeys';
import type { UsageMetric } from '../../document-flow/model/types';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';
import { documentFlowAdminApi } from '../api/documentFlowAdminApi';
import { accessGrantFormSchema } from '../api/documentFlowAdminSchemas';
import { documentFlowAdminKeys } from '../model/queryKeys';
import type { AccessGrantRequest, AccessGrantResult } from '../model/types';
import { usageMetricLabels } from '../model/labels';

const metrics: UsageMetric[] = ['ACTIVE_MEMBERS', 'DOCUMENTS_CREATED', 'STORAGE_BYTES', 'EXTERNAL_SIGNATURES_CREATED', 'SIGNATURES_CREATED'];
const nowLocal = () => {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

interface FormValues {
  planCode: string;
  startsAt: string;
  expiresAt: string;
  graceEndsAt: string;
  paymentReference: string;
  reason: string;
}

interface Props {
  open: boolean;
  internal?: boolean;
  initialOrganization?: CompanyListItem | null;
  onClose: () => void;
  onCompleted?: (result: AccessGrantResult) => void;
}

export default function AccessGrantDialog({ open, internal = false, initialOrganization = null, onClose, onCompleted }: Props) {
  const queryClient = useQueryClient();
  const requestId = useRef(crypto.randomUUID());
  const [organization, setOrganization] = useState<CompanyListItem | null>(initialOrganization);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [limits, setLimits] = useState<Partial<Record<UsageMetric, number>>>({});
  const [confirmedInternal, setConfirmedInternal] = useState(false);
  const [result, setResult] = useState<AccessGrantResult | null>(null);
  const form = useForm<FormValues>({
    defaultValues: { planCode: internal ? 'INTERNAL' : '', startsAt: nowLocal(), expiresAt: '', graceEndsAt: '', paymentReference: internal ? 'ECOPROGRESS_INTERNAL' : '', reason: internal ? 'Бессрочный внутренний доступ к модулю документооборота' : '' },
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (!open) return;
    setOrganization(initialOrganization);
    setConfirmedInternal(false);
    setResult(null);
    setLimits({});
    requestId.current = crypto.randomUUID();
    form.reset({ planCode: internal ? 'INTERNAL' : '', startsAt: nowLocal(), expiresAt: '', graceEndsAt: '', paymentReference: internal ? 'ECOPROGRESS_INTERNAL' : '', reason: internal ? 'Бессрочный внутренний доступ к модулю документооборота' : '' });
  }, [form, initialOrganization, internal, open]);

  const organizations = useQuery({
    queryKey: documentFlowAdminKeys.organizations({ query: debouncedSearch, page: 0, size: 20 }),
    queryFn: ({ signal }) => documentFlowAdminApi.searchOrganizations({ query: debouncedSearch || undefined, page: 0, size: 20, sort: 'name,asc', signal }),
    enabled: open && !initialOrganization && (debouncedSearch.length >= 2 || search.length === 0),
  });
  const plans = useQuery({ queryKey: documentFlowAdminKeys.plans(), queryFn: ({ signal }) => documentFlowAdminApi.plans(signal), enabled: open });
  const activePlans = useMemo(() => (plans.data ?? []).filter((plan) => plan.active), [plans.data]);
  const internalPlanAvailable = activePlans.some((plan) => plan.code === 'INTERNAL');

  const grant = useMutation({
    mutationFn: async () => {
      if (!organization) throw new Error('Выберите организацию из результатов поиска.');
      const values = form.getValues();
      const parsed = accessGrantFormSchema.safeParse({
        organizationId: Number(organization.id), planCode: values.planCode, startsAt: values.startsAt,
        expiresAt: values.expiresAt || null, graceEndsAt: values.graceEndsAt || null,
        paymentMode: 'ADMIN_GRANT', paymentReference: values.paymentReference.trim() || null,
        reason: values.reason,
        limits: Object.fromEntries(Object.entries(limits).filter((entry): entry is [string, number] => entry[1] != null)),
      });
      if (!parsed.success) {
        parsed.error.issues.forEach((issue) => {
          const field = issue.path[0];
          if (typeof field === 'string' && field in values) form.setError(field as keyof FormValues, { message: issue.message });
        });
        throw new Error('Проверьте обязательные поля формы.');
      }
      const idempotencyKey = `document-flow-access-${organization.id}-${requestId.current}`;
      const created = await documentFlowAdminApi.createAccessGrant(parsed.data as AccessGrantRequest, idempotencyKey);
      const access = await documentFlowAdminApi.organizationAccess(Number(organization.id));
      const synchronized = access.available === true && access.readOnly === false
        && ['ACTIVE', 'TRIAL'].includes(String(access.subscriptionStatus)) && access.reason == null;
      return { subscriptionId: created.subscriptionId ?? created.id ?? null, access, synchronized };
    },
    onSuccess: async (next) => {
      setResult(next);
      const organizationId = Number(organization!.id);
      queryClient.setQueryData(documentFlowAdminKeys.access(organizationId), next.access);
      queryClient.setQueryData(documentFlowKeys.access(organizationId), next.access);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentFlowAdminKeys.all }),
        queryClient.invalidateQueries({ queryKey: documentFlowKeys.access(organizationId) }),
        queryClient.invalidateQueries({ queryKey: documentFlowKeys.organizations() }),
      ]);
      onCompleted?.(next);
    },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => {
        if (field in form.getValues()) form.setError(field as keyof FormValues, { type: 'server', message });
      });
    },
  });

  const retryAccessCheck = async () => {
    if (!organization || !result) return;
    const access = await documentFlowAdminApi.organizationAccess(Number(organization.id));
    const synchronized = access.available && !access.readOnly && ['ACTIVE', 'TRIAL'].includes(String(access.subscriptionStatus)) && access.reason == null;
    setResult({ ...result, access, synchronized });
  };
  const mappedError = grant.isError ? mapDocumentFlowError(grant.error) : null;
  const invalidLimits = Object.values(limits).some((value) => value != null && (!Number.isInteger(value) || value < 0));
  return <Dialog open={open} onClose={() => !grant.isPending && onClose()} fullWidth maxWidth="md">
    <DialogTitle>{internal ? 'Выдать внутренний доступ' : 'Выдать доступ к документообороту'}</DialogTitle>
    <DialogContent><Stack spacing={2} mt={1}>
      {initialOrganization ? <Alert severity="info">{initialOrganization.name} · БИН {initialOrganization.bin} · ID {initialOrganization.id}</Alert> : <Autocomplete
        options={organizations.data?.items ?? []} loading={organizations.isFetching} filterOptions={(items) => items}
        value={organization} onChange={(_, value) => setOrganization(value)}
        onInputChange={(_, value, reason) => { if (reason === 'input') setSearch(value); }}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        getOptionLabel={(option) => `${option.name} · ${option.bin} · ID ${option.id}`}
        renderInput={(params) => <TextField {...params} required label="Организация" helperText="Поиск по названию или БИН выполняется на сервере" InputProps={{ ...params.InputProps, endAdornment: <>{organizations.isFetching && <CircularProgress size={18} />}{params.InputProps.endAdornment}</> }} />}
      />}
      {internal && !plans.isLoading && !internalPlanAvailable && <Alert severity="error">Внутренний тариф сейчас недоступен. Выдача заблокирована.</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><Controller name="planCode" control={form.control} render={({ field, fieldState }) => <TextField {...field} select fullWidth disabled={internal} required label="Тариф" error={Boolean(fieldState.error)} helperText={fieldState.error?.message}>{activePlans.map((plan) => <MenuItem key={plan.id} value={plan.code}>{plan.name}</MenuItem>)}</TextField>} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Способ выдачи" value="Администратором" disabled /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Дата начала" {...form.register('startsAt')} error={Boolean(form.formState.errors.startsAt)} helperText={form.formState.errors.startsAt?.message} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth disabled={internal} type="datetime-local" InputLabelProps={{ shrink: true }} label="Дата окончания" {...form.register('expiresAt')} error={Boolean(form.formState.errors.expiresAt)} helperText={form.formState.errors.expiresAt?.message || (internal ? 'Бессрочно' : 'Обязательно для временного тарифа')} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Льготный период до" {...form.register('graceEndsAt')} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Номер счёта или основание" {...form.register('paymentReference')} /></Grid>
      </Grid>
      <TextField multiline minRows={3} label="Причина" required {...form.register('reason')} error={Boolean(form.formState.errors.reason)} helperText={form.formState.errors.reason?.message} />
      <Typography fontWeight={700}>Лимиты подписки</Typography>
      <Grid container spacing={2}>{metrics.map((metric) => {
        const invalid = limits[metric] != null && (!Number.isInteger(limits[metric]) || limits[metric]! < 0);
        return <Grid size={{ xs: 12, sm: 6 }} key={metric}><TextField fullWidth type="number" label={usageMetricLabels[metric]} value={limits[metric] ?? ''} error={invalid} helperText={invalid ? 'Укажите целое число не меньше нуля' : ''} inputProps={{ min: 0, step: 1 }} onChange={(event) => setLimits((value) => ({ ...value, [metric]: event.target.value === '' ? undefined : Number(event.target.value) }))} /></Grid>;
      })}</Grid>
      {internal && <><Alert severity="warning">Организация получит бессрочный полный доступ к документообороту.</Alert><FormControlLabel control={<Checkbox checked={confirmedInternal} onChange={(event) => setConfirmedInternal(event.target.checked)} />} label="Подтверждаю выдачу бессрочного доступа выбранной организации" /></>}
      {mappedError && <Alert severity={mappedError.status === 409 ? 'warning' : 'error'}>{mappedError.message}{mappedError.status === 409 && ' Откройте существующую подписку для изменения.'}{mappedError.traceId && <Typography variant="caption" component="div">Trace ID: {mappedError.traceId}</Typography>}</Alert>}
      {result && <Alert severity={result.synchronized ? 'success' : 'warning'}>{result.synchronized ? 'Доступ создан и подтверждён.' : 'Подписка создана, но состояние доступа ещё не обновилось. Повторная выдача не выполняется.'}{result.subscriptionId && <Typography variant="caption" component="div">Номер подписки: {result.subscriptionId}</Typography>}{!result.synchronized && <Button onClick={() => void retryAccessCheck()}>Проверить ещё раз</Button>}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={grant.isPending} onClick={onClose}>{result?.synchronized ? 'Закрыть' : 'Отмена'}</Button><Button variant="contained" disabled={grant.isPending || Boolean(result) || invalidLimits || !organization || !form.watch('planCode') || (internal && (!confirmedInternal || !internalPlanAvailable))} onClick={() => grant.mutate()}>{grant.isPending ? 'Выдача…' : 'Выдать доступ'}</Button></DialogActions>
  </Dialog>;
}
