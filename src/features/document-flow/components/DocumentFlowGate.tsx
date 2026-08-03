import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import type { AccessContext } from '../model/types';
import AccessRequestForm from './AccessRequestForm';
import { useDocumentFlowAccess } from '../hooks/useDocumentFlowAccess';

const developmentAccess: AccessContext = {
  available: true,
  readOnly: false,
  status: 'ACTIVE',
  plan: { code: 'LOCAL_DEVELOPMENT', name: 'Локальный полный доступ' },
  startsAt: null,
  expiresAt: null,
  daysRemaining: null,
  features: [
    'DOCUMENT_FLOW',
    'DOCUMENT_CREATE',
    'MULTI_SIGNING',
    'SEQUENTIAL_SIGNING',
    'PARALLEL_SIGNING',
    'MIXED_SIGNING',
    'EXTERNAL_SIGNING',
    'NCALAYER_SIGNING',
    'DOCUMENT_TEMPLATES',
    'VERSIONING',
    'REVOCATION',
    'AUDIT_LOG',
    'API_ACCESS',
    'CRM_INTEGRATION',
    'CUSTOM_LIMITS',
  ],
  permissions: [
    'VIEW_DOCUMENTS',
    'CREATE_DOCUMENT',
    'EDIT_DOCUMENT',
    'DELETE_DOCUMENT',
    'SIGN_DOCUMENT',
    'SIGN_EXTERNAL',
    'REVOKE_SIGNATURE',
    'MANAGE_MEMBERS',
    'MANAGE_COUNTERPARTIES',
    'MANAGE_TEMPLATES',
    'VIEW_AUDIT_LOG',
    'MANAGE_SUBSCRIPTION',
  ],
  limits: {},
  usage: {},
  availableActions: [],
  reason: null,
};

type DocumentFlowContextValue = AccessContext & { selectOrganization: (organizationId: number) => void };
const Context = createContext<DocumentFlowContextValue | null>(null);
export const useDocumentFlowContext = () => {
  const value = useContext(Context);
  if (!value) throw new Error('DocumentFlowGate is missing');
  return value;
};

export default function DocumentFlowGate() {
  const { isAuthenticated, loading } = useAuth();
  const [organizationId, setOrganizationId] = useState<number>();
  const access = useDocumentFlowAccess(organizationId);
  const bypassAccess = import.meta.env.DEV && import.meta.env.MODE !== 'test';
  const plans = useQuery({
    queryKey: documentFlowKeys.plans(),
    queryFn: ({ signal }) => documentFlowApi.plans(signal),
    enabled: !bypassAccess && access.isSuccess && access.data.available === false,
    staleTime: 5 * 60_000,
  });
  useEffect(() => {
    if (!organizationId && access.data?.organizations?.length === 1) setOrganizationId(access.data.organizations[0].id);
  }, [access.data?.organizations, organizationId]);
  const effectiveAccess = bypassAccess ? developmentAccess : access.data;
  const contextValue = useMemo(() => effectiveAccess ? { ...effectiveAccess, selectOrganization: setOrganizationId } : null, [effectiveAccess]);

  // A stored JWT session is usable while /auth/me refreshes in parallel.
  // Local development still sends the access request, but does not block UI exploration on it.
  if ((!isAuthenticated && loading) || (!bypassAccess && access.isLoading)) {
    return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (access.isError && !bypassAccess) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" action={<Button onClick={() => access.refetch()}>Повторить</Button>}>
          Не удалось проверить доступ к документообороту. Рабочий интерфейс не открыт.
        </Alert>
      </Container>
    );
  }
  if (!effectiveAccess?.available) {
    return (
      <Container maxWidth="md" sx={{ py: 7 }}>
        <Stack spacing={3}>
          <Typography variant="h3" fontWeight={800}>Документооборот EcoProgress</Typography>
          <Typography color="text.secondary">
            Управление документами, версиями и маршрутами подписания с ЭЦП через NCALayer.
          </Typography>
          {effectiveAccess?.reason && <Alert severity="warning">{effectiveAccess.reason}</Alert>}
          <Button component={Link} to="/document-flow/plans" variant="outlined">Посмотреть тарифы</Button>
          <Paper sx={{ p: 3 }}><AccessRequestForm plans={plans.data || []} /></Paper>
          <Alert severity="info">Для подключения также можно обратиться к администрации EcoProgress.</Alert>
        </Stack>
      </Container>
    );
  }
  return <Context.Provider value={contextValue}><Outlet /></Context.Provider>;
}
