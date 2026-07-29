import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, Grid, Paper, Stack, Typography } from '@mui/material';
import { documentFlowPlansApi, documentFlowSubscriptionApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { UsageCard } from '../components/UsageCard';
import { AccessRequestDialog } from '../components/AccessRequestDialog';
import { getDocumentFlowError } from '../utils/errors';

const DocumentFlowSubscriptionPage = () => {
  const client = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const query = useQuery({ queryKey: documentFlowKeys.subscription(), queryFn: documentFlowSubscriptionApi.get, retry: false });
  const plansQuery = useQuery({ queryKey: documentFlowKeys.plans(), queryFn: documentFlowPlansApi.list, retry: false });
  const mutation = useMutation({
    retry: false,
    mutationFn: (action: string) => documentFlowSubscriptionApi.requestChange({ action }, crypto.randomUUID()),
    onSuccess: () => client.invalidateQueries({ queryKey: documentFlowKeys.subscription() }),
  });
  if (query.isPending) return <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (query.isError) return <Alert severity="error">{getDocumentFlowError(query.error, 'Не удалось загрузить подписку.').message}</Alert>;
  const subscription = query.data;
  return (
    <Box>
      <Typography variant="h4" fontWeight={950}>Тариф и лимиты</Typography>
      <Paper variant="outlined" sx={{ mt: 3, p: 3, borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}>
          <Box><Typography variant="h5" fontWeight={950}>{subscription.plan?.name || 'Тариф не указан'}</Typography><Typography color="text.secondary">Статус: {subscription.status}{subscription.trial ? ' · пробный период' : ''}</Typography><Typography color="text.secondary">{subscription.startsAt ? `с ${new Date(subscription.startsAt).toLocaleDateString('ru-KZ')}` : ''} {subscription.expiresAt ? `до ${new Date(subscription.expiresAt).toLocaleDateString('ru-KZ')}` : ''}</Typography></Box>
          <Stack direction="row" gap={1} flexWrap="wrap"><Button variant="contained" disabled={mutation.isPending} onClick={() => mutation.mutate('RENEW')}>Продлить</Button><Button variant="outlined" onClick={() => setRequestOpen(true)}>Изменить тариф</Button></Stack>
        </Stack>
        {mutation.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Заявка отправлена. Подписка не изменяется локально до ответа backend.</Alert>}
        {mutation.isError && <Alert severity="error" sx={{ mt: 2 }}>{getDocumentFlowError(mutation.error).message}</Alert>}
      </Paper>
      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}><UsageCard label="Документы" used={subscription.usage.documentsThisMonth} limit={subscription.limits.documentsPerMonth} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><UsageCard label="Сотрудники" used={subscription.usage.members} limit={subscription.limits.members} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><UsageCard label="Хранилище" used={subscription.usage.storageBytes} limit={subscription.limits.storageBytes} format={(value) => `${(value / 1024 / 1024 / 1024).toFixed(1)} ГБ`} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><UsageCard label="Внешние подписи" used={subscription.usage.externalSignaturesThisMonth} limit={subscription.limits.externalSignaturesPerMonth} /></Grid>
      </Grid>
      <Paper variant="outlined" sx={{ mt: 2, p: 3, borderRadius: 3 }}><Typography variant="h6" fontWeight={900}>Доступные функции</Typography><Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2 }}>{subscription.features.map((feature) => <span key={feature} className="rounded-full bg-eco-50 px-3 py-1.5 text-sm font-bold text-eco-800">{feature.replace(/_/g, ' ')}</span>)}</Stack></Paper>
      <AccessRequestDialog open={requestOpen} plans={plansQuery.data || []} onClose={() => setRequestOpen(false)} />
    </Box>
  );
};

export default DocumentFlowSubscriptionPage;
