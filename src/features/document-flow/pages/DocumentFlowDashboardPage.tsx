import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { documentFlowDashboardApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowAccess } from '../access/DocumentFlowAccessProvider';
import { UsageCard } from '../components/UsageCard';
import { getDocumentFlowError } from '../utils/errors';

const labels: Record<string, string> = {
  incoming: 'Входящие',
  outgoing: 'Исходящие',
  requiresMySignature: 'Требуют моей подписи',
  partiallySigned: 'Частично подписаны',
  fullySigned: 'Подписаны всеми',
  rejected: 'Отклонены',
  overdue: 'Просрочены',
  drafts: 'Черновики',
};

const DocumentFlowDashboardPage = () => {
  const { access } = useDocumentFlowAccess();
  const query = useQuery({ queryKey: documentFlowKeys.dashboard(), queryFn: documentFlowDashboardApi.get, retry: false });
  if (query.isPending) return <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress aria-label="Загрузка панели" /></Box>;
  if (query.isError) return <Alert severity="error">{getDocumentFlowError(query.error, 'Не удалось загрузить панель.').message}</Alert>;
  const data = query.data;
  return (
    <Box>
      <Typography variant="h4" fontWeight={950}>Главная</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>Состояние документов и использование тарифа без фиктивных значений.</Typography>
      <Grid container spacing={2} sx={{ mt: 1.5 }}>
        {Object.entries(labels).map(([key, label]) => (
          <Grid key={key} size={{ xs: 6, md: 3 }}>
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="h4" fontWeight={950} sx={{ mt: 0.5 }}>{data.counters[key] ?? '—'}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Typography variant="h5" fontWeight={900} sx={{ mt: 4, mb: 2 }}>Тариф и лимиты</Typography>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}><UsageCard label="Документы за месяц" used={data.usage.documentsThisMonth ?? access.usage.documentsThisMonth} limit={data.limits.documentsPerMonth ?? access.limits.documentsPerMonth} /></Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}><UsageCard label="Сотрудники" used={data.usage.members ?? access.usage.members} limit={data.limits.members ?? access.limits.members} /></Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}><UsageCard label="Хранилище" used={data.usage.storageBytes ?? access.usage.storageBytes} limit={data.limits.storageBytes ?? access.limits.storageBytes} format={(value) => `${(value / 1024 / 1024 / 1024).toFixed(1)} ГБ`} /></Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}><UsageCard label="Внешние подписи" used={data.usage.externalSignaturesThisMonth ?? access.usage.externalSignaturesThisMonth} limit={data.limits.externalSignaturesPerMonth ?? access.limits.externalSignaturesPerMonth} /></Grid>
      </Grid>
    </Box>
  );
};

export default DocumentFlowDashboardPage;

