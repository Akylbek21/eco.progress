import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import type { UsageMetric } from '../../document-flow/model/types';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';
import { documentFlowAdminApi } from '../api/documentFlowAdminApi';
import type { DocumentFlowAdminPlan, OrganizationAccessRow } from '../model/types';

const metrics: UsageMetric[] = ['ACTIVE_MEMBERS', 'DOCUMENTS_CREATED', 'STORAGE_BYTES', 'EXTERNAL_SIGNATURES_CREATED', 'SIGNATURES_CREATED'];

export default function EditAccessDialog({ open, row, plans, onClose, onCompleted }: {
  open: boolean;
  row: OrganizationAccessRow | null;
  plans: DocumentFlowAdminPlan[];
  onClose: () => void;
  onCompleted: (organizationId: number) => Promise<void>;
}) {
  const currentPlan = plans.find((plan) => plan.id === row?.subscription?.planId);
  const [planCode, setPlanCode] = useState('');
  const [reason, setReason] = useState('');
  const [limits, setLimits] = useState<Partial<Record<UsageMetric, number>>>({});
  useEffect(() => {
    if (!open) return;
    setPlanCode(currentPlan?.code ?? '');
    setReason('');
    setLimits(Object.fromEntries(metrics.flatMap((metric) => row?.access?.limits[metric] == null ? [] : [[metric, row.access.limits[metric]]])));
  }, [currentPlan?.code, open, row?.access?.limits]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!row?.subscription) throw new Error('Подписка не загружена.');
      const organizationId = Number(row.organization.id);
      if (planCode !== currentPlan?.code) await documentFlowAdminApi.changePlan(organizationId, planCode, reason.trim());
      const definedLimits = Object.fromEntries(
        Object.entries(limits).filter((entry): entry is [string, number] => entry[1] != null),
      ) as Partial<Record<UsageMetric, number>>;
      await documentFlowAdminApi.changeLimits(organizationId, definedLimits, reason.trim());
      await onCompleted(organizationId);
    },
    onSuccess: onClose,
  });
  const error = mutation.isError ? mapDocumentFlowError(mutation.error) : null;
  return <Dialog open={open} onClose={() => !mutation.isPending && onClose()} fullWidth maxWidth="md"><DialogTitle>Изменить доступ · {row?.organization.name}</DialogTitle><DialogContent><Stack spacing={2} mt={1}>
    <TextField select label="Тариф" value={planCode} onChange={(event) => setPlanCode(event.target.value)}>{plans.filter((plan) => plan.active).map((plan) => <MenuItem key={plan.id} value={plan.code}>{plan.name} ({plan.code})</MenuItem>)}</TextField>
    <Grid container spacing={2}>{metrics.map((metric) => <Grid size={{ xs: 12, sm: 6 }} key={metric}><TextField fullWidth type="number" label={metric} value={limits[metric] ?? ''} onChange={(event) => setLimits((value) => ({ ...value, [metric]: event.target.value === '' ? undefined : Number(event.target.value) }))} /></Grid>)}</Grid>
    <TextField required multiline minRows={3} label="Причина изменения" value={reason} onChange={(event) => setReason(event.target.value)} error={reason.length > 0 && reason.trim().length < 5} helperText="Минимум 5 символов" />
    <Alert severity="info">Backend предоставляет раздельные операции change-plan и limits. Если изменены оба блока, они выполняются последовательно и затем проверяются через GET access.</Alert>
    {error && <Alert severity={error.status === 409 || error.status === 412 ? 'warning' : 'error'}>{error.message}{error.traceId && <span> · Trace ID: {error.traceId}</span>}</Alert>}
  </Stack></DialogContent><DialogActions><Button disabled={mutation.isPending} onClick={onClose}>Отмена</Button><Button variant="contained" disabled={mutation.isPending || !planCode || reason.trim().length < 5} onClick={() => mutation.mutate()}>{mutation.isPending ? 'Сохранение…' : 'Сохранить'}</Button></DialogActions></Dialog>;
}
