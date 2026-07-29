import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { documentFlowAdminApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import type { AdminSubscription } from '../types';
import { getDocumentFlowError } from '../utils/errors';

const DocumentFlowAdminPage = ({ plansOnly = false }: { plansOnly?: boolean }) => {
  const client = useQueryClient();
  const [selected, setSelected] = useState<AdminSubscription | null>(null);
  const [action, setAction] = useState('activate');
  const [planCode, setPlanCode] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [reason, setReason] = useState('');
  const plansQuery = useQuery({ queryKey: [...documentFlowKeys.root, 'admin', 'plans'], queryFn: documentFlowAdminApi.plans, retry: false });
  const subscriptionsQuery = useQuery({
    queryKey: documentFlowKeys.adminSubscriptions({ page: 0, size: 50 }),
    queryFn: () => documentFlowAdminApi.subscriptions({ page: 0, size: 50 }),
    enabled: !plansOnly,
    retry: false,
  });
  const mutation = useMutation({
    retry: false,
    mutationFn: () => documentFlowAdminApi.action(selected!.organizationId, action, { planCode, startsAt, expiresAt, reason }, crypto.randomUUID()),
    onSuccess: async () => {
      setSelected(null);
      await client.invalidateQueries({ queryKey: [...documentFlowKeys.root, 'admin', 'subscriptions'] });
    },
  });

  if (plansOnly) return <Box><Typography variant="h4" fontWeight={950}>Тарифы документооборота</Typography>{plansQuery.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(plansQuery.error).message}</Alert>}<Stack spacing={2} sx={{ mt: 3 }}>{plansQuery.data?.map((plan) => <Paper key={plan.code} variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Typography variant="h6" fontWeight={900}>{plan.name} · {plan.code}</Typography><Typography color="text.secondary">{plan.description}</Typography><Typography sx={{ mt: 1 }}>Статус: {plan.active ? 'активен' : 'скрыт'} · features: {plan.features.join(', ')}</Typography></Paper>)}</Stack></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={950}>Подписки документооборота</Typography><Typography color="text.secondary">Изменения применяются только после успешного ответа backend.</Typography>
      {subscriptionsQuery.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(subscriptionsQuery.error).message}</Alert>}
      {subscriptionsQuery.data && (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 3, borderRadius: 3 }}><Table size="small"><TableHead><TableRow><TableCell>Организация / БИН</TableCell><TableCell>Тариф</TableCell><TableCell>Статус</TableCell><TableCell>Срок</TableCell><TableCell>Документы</TableCell><TableCell>Сотрудники</TableCell><TableCell>Хранилище</TableCell><TableCell /></TableRow></TableHead><TableBody>
          {subscriptionsQuery.data.items.map((item) => <TableRow key={item.organizationId}><TableCell><Typography fontWeight={800}>{item.organizationName}</Typography><Typography variant="caption">{item.bin}</Typography></TableCell><TableCell>{item.plan.name}</TableCell><TableCell>{item.status}{item.trial ? ' · trial' : ''}</TableCell><TableCell>{item.startsAt ? new Date(item.startsAt).toLocaleDateString('ru-KZ') : '—'} — {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString('ru-KZ') : '—'}</TableCell><TableCell>{item.usage.documentsThisMonth ?? '—'} / {item.limits.documentsPerMonth ?? '—'}</TableCell><TableCell>{item.usage.members ?? '—'} / {item.limits.members ?? '—'}</TableCell><TableCell>{item.usage.storageBytes ? `${(item.usage.storageBytes / 1024 / 1024 / 1024).toFixed(1)} ГБ` : '—'}</TableCell><TableCell><Button onClick={() => { setSelected(item); setPlanCode(item.plan.code); }}>Управление</Button></TableCell></TableRow>)}
        </TableBody></Table></TableContainer>
      )}
      <Dialog open={!!selected} onClose={mutation.isPending ? undefined : () => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Управление доступом · {selected?.organizationName}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField select label="Действие" value={action} onChange={(event) => setAction(event.target.value)}>{['activate', 'renew', 'suspend', 'restore', 'revoke', 'change-plan', 'change-limits'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField select label="Тариф" value={planCode} onChange={(event) => setPlanCode(event.target.value)}>{plansQuery.data?.map((plan) => <MenuItem key={plan.code} value={plan.code}>{plan.name}</MenuItem>)}</TextField><TextField type="datetime-local" label="Начало" InputLabelProps={{ shrink: true }} value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /><TextField type="datetime-local" label="Окончание" InputLabelProps={{ shrink: true }} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /><TextField multiline minRows={3} label="Причина / комментарий" value={reason} onChange={(event) => setReason(event.target.value)} />{mutation.isError && <Alert severity="error">{getDocumentFlowError(mutation.error).message}</Alert>}</Stack></DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)} disabled={mutation.isPending}>Отмена</Button><Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending || !reason.trim()}>Отправить backend</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentFlowAdminPage;

