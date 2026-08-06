import { useState } from 'react';
import { Alert, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import PublicLayout from '../../../layouts/PublicLayout';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import AccessRequestForm from '../components/AccessRequestForm';

export default function DocumentFlowLandingPage({ requestInitiallyOpen = false }: { requestInitiallyOpen?: boolean }) {
  const { isAuthenticated, isStaff, loading, logout, user } = useAuth();
  const [requestOpen, setRequestOpen] = useState(requestInitiallyOpen);
  const plans = useQuery({
    queryKey: documentFlowKeys.plans(),
    queryFn: ({ signal }) => documentFlowApi.plans(signal),
    enabled: !isAuthenticated && requestOpen,
    retry: false,
  });

  if (loading) return <Stack minHeight="70vh" alignItems="center" justifyContent="center"><CircularProgress /></Stack>;
  if (isAuthenticated && !isStaff) return <Navigate to="/document-flow/documents" replace />;

  return (
    <PublicLayout>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={3}>
          <div>
            <Typography variant="h3" fontWeight={900}>Документооборот</Typography>
            <Typography color="text.secondary" mt={1}>Создавайте, отправляйте и подписывайте документы в защищённом кабинете своей организации.</Typography>
          </div>
          {isStaff ? <>
            <Alert severity="info">Сейчас выполнен вход в CRM сотрудника: {user?.email || user?.name}. Для входа владельца или сотрудника организации используйте отдельную учётную запись документооборота.</Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Button component={Link} to="/document-flow/login?redirect=%2Fdocument-flow" onClick={logout} variant="contained" size="large">Войти под аккаунтом организации</Button>
              <Button component={Link} to="/document-flow/documents" variant="outlined" size="large">Продолжить с аккаунтом CRM</Button>
              {user?.role === 'ADMIN' && <Button component={Link} to="/admin/document-flow-access" variant="outlined" size="large">Управление подписками</Button>}
            </Stack>
          </> : <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button variant="contained" size="large" onClick={() => setRequestOpen(true)}>Оставить заявку</Button>
            <Button component={Link} to="/document-flow/login?redirect=%2Fdocument-flow" variant="outlined" size="large">Войти</Button>
          </Stack>}
          {requestOpen && <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography variant="h5" fontWeight={800} mb={2}>Заявка на подключение</Typography>
            {plans.isLoading && <Stack alignItems="center" py={4}><CircularProgress /></Stack>}
            {plans.isError && <Alert severity="error" action={<Button onClick={() => plans.refetch()}>Повторить</Button>}>Не удалось загрузить тарифы.</Alert>}
            {plans.isSuccess && <AccessRequestForm plans={plans.data} />}
          </Paper>}
        </Stack>
      </Container>
    </PublicLayout>
  );
}
