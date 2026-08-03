import { Alert, Box, Chip, Container, FormControl, InputLabel, LinearProgress, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission, limitProgress } from '../model/access';
import type { UsageMetric } from '../model/types';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';

const usageLabels: Record<UsageMetric, string> = {
  DOCUMENTS_CREATED: 'Документы',
  SIGNATURES_CREATED: 'Подписи',
  EXTERNAL_SIGNATURES_CREATED: 'Внешние подписи',
  STORAGE_BYTES: 'Хранилище',
  ACTIVE_MEMBERS: 'Участники',
};

export default function DocumentFlowLayout() {
  const access = useDocumentFlowContext();
  const { user } = useAuth();
  const links = [
    ['/document-flow', 'Dashboard', true],
    ['/document-flow/documents', 'Документы', true],
    ['/document-flow/documents?requiresMySignature=true', 'Мне на подпись', false],
    ['/document-flow/counterparties', 'Контрагенты', hasPermission(access, 'MANAGE_COUNTERPARTIES')],
    ['/document-flow/subscription', 'Тариф и лимиты', true],
    ['/document-flow/settings', 'Настройки', true],
  ] as const;
  return (
    <Box minHeight="100vh" bgcolor="#f4f7f6">
      <Paper square elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="xl" sx={{ py: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems={{ md: 'center' }}>
            <Box flex={1}>
              <Typography variant="h5" fontWeight={800}>Документооборот</Typography>
              <Typography variant="body2" color="text.secondary">{user?.companyName || user?.name || 'Организация'}</Typography>
            </Box>
            {(access.organizations?.length || 0) > 1 && <FormControl size="small" sx={{ minWidth: 240 }}><InputLabel>Организация</InputLabel><Select label="Организация" value={access.organization?.id || ''} onChange={(event) => access.selectOrganization(Number(event.target.value))}>{access.organizations?.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}</Select></FormControl>}
            <Chip label={access.plan?.name || 'Без тарифа'} />
            <Chip label={access.status || 'Статус не указан'} color={access.readOnly ? 'warning' : 'success'} />
            {access.daysRemaining != null && <Chip label={`${access.daysRemaining} дн. до окончания`} variant="outlined" />}
          </Stack>
          <Stack direction="row" gap={1} mt={2} overflow="auto">
            {links.filter(([, , visible]) => visible).map(([to, label]) => (
              <Box
                key={to}
                component={NavLink}
                to={to}
                end={to === '/document-flow'}
                sx={{ px: 2, py: 1, whiteSpace: 'nowrap', borderRadius: 2, textDecoration: 'none', color: 'text.primary', '&.active': { bgcolor: 'primary.main', color: 'white' } }}
              >
                {label}
              </Box>
            ))}
          </Stack>
        </Container>
      </Paper>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {access.readOnly && <Alert severity="warning" sx={{ mb: 2 }}>Доступ только для чтения. Изменяющие операции отключены backend-контекстом доступа.</Alert>}
        <Outlet />
      </Container>
    </Box>
  );
}

export function SubscriptionUsage() {
  const access = useDocumentFlowContext();
  return (
    <Stack spacing={2}>
      {(Object.keys(usageLabels) as UsageMetric[]).map((metric) => {
        const value = limitProgress(access, metric);
        return (
          <Box key={metric}>
            <Stack direction="row" justifyContent="space-between">
              <Typography variant="body2">{usageLabels[metric]}</Typography>
              <Typography variant="body2">{value.used} / {value.limit || '∞'}</Typography>
            </Stack>
            <LinearProgress variant="determinate" value={value.percent} sx={{ mt: 0.5, height: 8, borderRadius: 4 }} />
          </Box>
        );
      })}
    </Stack>
  );
}
