import { Card, CardContent, Stack, Typography } from '@mui/material';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { SubscriptionUsage } from '../layout/DocumentFlowLayout';

export default function SubscriptionPage() {
  const access = useDocumentFlowContext();
  return (
    <Stack spacing={3}>
      <Typography variant="h4" fontWeight={800}>Тариф и лимиты</Typography>
      <Card><CardContent>
        <Typography variant="h6">{access.plan?.name || 'Тариф не указан'}</Typography>
        <Typography color="text.secondary">Статус: {access.status || '—'}</Typography>
        <Typography color="text.secondary">Действует до: {access.expiresAt ? new Date(access.expiresAt).toLocaleString('ru-RU') : 'без даты'}</Typography>
      </CardContent></Card>
      <Card><CardContent><SubscriptionUsage /></CardContent></Card>
    </Stack>
  );
}
