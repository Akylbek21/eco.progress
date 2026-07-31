import { useRef, useState } from 'react';
import {
  Alert, Button, Card, CardContent, Checkbox, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminDocumentFlowApi, documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import type { FeatureCode, UsageMetric } from '../model/types';

const features: FeatureCode[] = [
  'DOCUMENT_FLOW', 'DOCUMENT_CREATE', 'MULTI_SIGNING', 'SEQUENTIAL_SIGNING',
  'PARALLEL_SIGNING', 'MIXED_SIGNING', 'EXTERNAL_SIGNING', 'NCALAYER_SIGNING',
  'DOCUMENT_TEMPLATES', 'VERSIONING', 'REVOCATION', 'AUDIT_LOG', 'API_ACCESS',
  'CRM_INTEGRATION', 'CUSTOM_LIMITS',
];
const metrics: UsageMetric[] = ['DOCUMENTS_CREATED', 'SIGNATURES_CREATED', 'EXTERNAL_SIGNATURES_CREATED', 'STORAGE_BYTES', 'ACTIVE_MEMBERS'];

export function AdminPlansPage() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', nameRu: '', nameKk: '', descriptionRu: '', descriptionKk: '', billingPeriod: 'MONTHLY', price: '0', currency: 'KZT', trialDays: '0', active: true, visible: true, sortOrder: '0', enabled: ['DOCUMENT_FLOW', 'DOCUMENT_CREATE'] as FeatureCode[] });
  const query = useQuery({ queryKey: documentFlowKeys.adminPlans(), queryFn: ({ signal }) => adminDocumentFlowApi.plans(signal) });
  const create = useMutation({
    mutationFn: () => adminDocumentFlowApi.createPlan({
      code: form.code.trim(), nameRu: form.nameRu.trim(), nameKk: form.nameKk.trim(),
      descriptionRu: form.descriptionRu, descriptionKk: form.descriptionKk,
      billingPeriod: form.billingPeriod, price: Number(form.price), currency: form.currency,
      trialDays: Number(form.trialDays), active: form.active, visible: form.visible,
      sortOrder: Number(form.sortOrder),
      features: Object.fromEntries(features.map((code) => [code, { enabled: form.enabled.includes(code), limitValue: null, metadataJson: null }])),
    }),
    onSuccess: async () => { setOpen(false); await client.invalidateQueries({ queryKey: documentFlowKeys.adminPlans() }); },
  });
  return <Stack spacing={3}><Stack direction="row" justifyContent="space-between"><Typography variant="h4" fontWeight={800}>Тарифы Document Flow</Typography><Button variant="contained" onClick={() => setOpen(true)}>Создать тариф</Button></Stack>{query.isError && <Alert severity="error">{query.error.message}</Alert>}<Grid container spacing={2}>{(query.data || []).map((plan) => <Grid size={{ xs: 12, md: 6 }} key={plan.id}><Card><CardContent><Typography variant="h6">{plan.nameRu} ({plan.code})</Typography><Typography>{plan.price} {plan.currency} · {plan.billingPeriod}</Typography><Typography>{plan.active ? 'Активен' : 'Неактивен'} · {plan.visible ? 'Публичный' : 'Скрытый'}</Typography><Typography variant="body2">{plan.features.filter((item) => item.enabled).map((item) => item.code).join(', ')}</Typography><Button onClick={() => adminDocumentFlowApi.updatePlan(plan.id, { active: !plan.active }).then(() => client.invalidateQueries({ queryKey: documentFlowKeys.adminPlans() }))}>{plan.active ? 'Отключить' : 'Включить'}</Button></CardContent></Card></Grid>)}</Grid>
    <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth><DialogTitle>Новый тариф</DialogTitle><DialogContent><Grid container spacing={2} mt={0}>{(['code', 'nameRu', 'nameKk', 'descriptionRu', 'descriptionKk', 'price', 'currency', 'trialDays', 'sortOrder'] as const).map((key) => <Grid size={{ xs: 12, md: key.includes('description') ? 12 : 6 }} key={key}><TextField fullWidth label={key} value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} /></Grid>)}<Grid size={{ xs: 12, md: 6 }}><TextField fullWidth select label="Период" value={form.billingPeriod} onChange={(event) => setForm((value) => ({ ...value, billingPeriod: event.target.value }))}><MenuItem value="MONTHLY">MONTHLY</MenuItem><MenuItem value="YEARLY">YEARLY</MenuItem><MenuItem value="ONE_TIME">ONE_TIME</MenuItem></TextField></Grid><Grid size={12}>{features.map((feature) => <FormControlLabel key={feature} control={<Checkbox checked={form.enabled.includes(feature)} onChange={(event) => setForm((value) => ({ ...value, enabled: event.target.checked ? [...value.enabled, feature] : value.enabled.filter((item) => item !== feature) }))} />} label={feature} />)}</Grid></Grid>{create.isError && <Alert severity="error">{create.error.message}</Alert>}</DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Отмена</Button><Button variant="contained" disabled={create.isPending || !form.code.trim() || !form.nameRu.trim() || !form.nameKk.trim()} onClick={() => create.mutate()}>Создать</Button></DialogActions></Dialog>
  </Stack>;
}

export function AdminSubscriptionsPage() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: documentFlowKeys.adminSubscriptions(), queryFn: ({ signal }) => adminDocumentFlowApi.subscriptions(signal) });
  const [reason, setReason] = useState('');
  const action = useMutation({
    mutationFn: ({ organizationId, name }: { organizationId: number; name: 'suspend' | 'restore' | 'revoke' }) =>
      adminDocumentFlowApi.subscriptionAction(organizationId, name, { reason: reason || `Admin ${name}` }),
    onSuccess: () => client.invalidateQueries({ queryKey: documentFlowKeys.adminSubscriptions() }),
  });
  return <Stack spacing={3}><Typography variant="h4" fontWeight={800}>Подписки Document Flow</Typography><TextField label="Причина административного действия" value={reason} onChange={(event) => setReason(event.target.value)} />{query.isError && <Alert severity="error">{query.error.message}</Alert>}{(query.data || []).map((item) => <Card key={item.id}><CardContent><Typography fontWeight={800}>Организация #{item.organizationId}</Typography><Typography>{item.status} · план #{item.planId}</Typography><Typography>{item.startsAt} — {item.expiresAt || 'без срока'}</Typography><Stack direction="row" gap={1} mt={1}><Button onClick={() => action.mutate({ organizationId: item.organizationId, name: 'suspend' })}>Приостановить</Button><Button onClick={() => action.mutate({ organizationId: item.organizationId, name: 'restore' })}>Восстановить</Button><Button color="error" onClick={() => action.mutate({ organizationId: item.organizationId, name: 'revoke' })}>Отозвать</Button></Stack></CardContent></Card>)}</Stack>;
}

export function AdminAccessGrantsPage() {
  const idempotencyKey = useRef(crypto.randomUUID());
  const plans = useQuery({ queryKey: documentFlowKeys.plans(), queryFn: ({ signal }) => documentFlowApi.plans(signal) });
  const [form, setForm] = useState({ organizationId: '', planCode: '', startsAt: '', expiresAt: '', graceEndsAt: '', paymentMode: 'MANUAL', paymentReference: '', reason: '' });
  const [limits, setLimits] = useState<Partial<Record<UsageMetric, number>>>({});
  const grant = useMutation({
    mutationFn: () => adminDocumentFlowApi.grantAccess({
      organizationId: Number(form.organizationId), planCode: form.planCode,
      startsAt: form.startsAt, expiresAt: form.expiresAt || undefined,
      graceEndsAt: form.graceEndsAt || undefined, paymentMode: form.paymentMode,
      paymentReference: form.paymentReference || undefined, reason: form.reason || undefined, limits,
    }, idempotencyKey.current),
    onSuccess: () => { idempotencyKey.current = crypto.randomUUID(); },
  });
  return <Stack spacing={3} maxWidth={700}><Typography variant="h4" fontWeight={800}>Выдача доступа</Typography><TextField type="number" label="Organization ID" value={form.organizationId} onChange={(event) => setForm((value) => ({ ...value, organizationId: event.target.value }))} /><TextField select label="Тариф" value={form.planCode} onChange={(event) => setForm((value) => ({ ...value, planCode: event.target.value }))}>{(plans.data || []).map((plan) => <MenuItem value={plan.code} key={plan.code}>{plan.nameRu}</MenuItem>)}</TextField>{(['startsAt', 'expiresAt', 'graceEndsAt'] as const).map((key) => <TextField key={key} type="datetime-local" InputLabelProps={{ shrink: true }} label={key} value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} />)}<TextField label="Payment mode" value={form.paymentMode} onChange={(event) => setForm((value) => ({ ...value, paymentMode: event.target.value }))} /><TextField label="Payment reference" value={form.paymentReference} onChange={(event) => setForm((value) => ({ ...value, paymentReference: event.target.value }))} /><TextField label="Причина" value={form.reason} onChange={(event) => setForm((value) => ({ ...value, reason: event.target.value }))} /><Grid container spacing={2}>{metrics.map((metric) => <Grid size={{ xs: 12, sm: 6 }} key={metric}><TextField fullWidth type="number" label={metric} value={limits[metric] ?? ''} onChange={(event) => setLimits((value) => ({ ...value, [metric]: Number(event.target.value) }))} /></Grid>)}</Grid>{grant.isSuccess && <Alert severity="success">Доступ предоставлен.</Alert>}{grant.isError && <Alert severity="error">{grant.error.message}</Alert>}<Button variant="contained" disabled={grant.isPending || !form.organizationId || !form.planCode || !form.startsAt} onClick={() => grant.mutate()}>{grant.isPending ? 'Выдача…' : 'Предоставить доступ'}</Button></Stack>;
}
