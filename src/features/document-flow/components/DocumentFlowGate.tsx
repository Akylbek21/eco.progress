import { createContext, useContext } from 'react';
import {
  Alert, Box, Button, CircularProgress, Container, FormControl, InputLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { AccessContext } from '../model/types';
import { useDocumentFlowAccess } from '../hooks/useDocumentFlowAccess';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';
import AccessRequestForm from './AccessRequestForm';
import { canManageDocumentFlowAccess } from '../../document-flow-admin/model/permissions';

const Context = createContext<AccessContext | null>(null);

export const useDocumentFlowContext = () => {
  const value = useContext(Context);
  if (!value) throw new Error('DocumentFlowGate is missing');
  return value;
};

const ContractError = ({ error, retry }: { error: unknown; retry: () => void }) => {
  const schemaError = error instanceof ZodError;
  const mapped = mapDocumentFlowError(error);
  return (
    <Alert severity="error" action={<Button onClick={retry}>Повторить</Button>}>
      <Typography fontWeight={700}>{schemaError ? 'Backend вернул несовместимый формат данных.' : mapped.message}</Typography>
      {schemaError && <Typography variant="body2">Проверка доступа не выполнена. Доступ не предоставлен.</Typography>}
      {(schemaError || mapped.traceId) && (
        <Typography variant="caption" component="div" sx={{ mt: 1 }}>
          {schemaError ? `Код: DF_ACCESS_SCHEMA_INVALID · ${error.issues[0]?.path.join('.') || 'response'}` : `Trace ID: ${mapped.traceId}`}
        </Typography>
      )}
    </Alert>
  );
};

const accessReason = (access: AccessContext) => {
  const membership = access.membershipStatus?.toUpperCase();
  if (!membership) return access.reason || 'Для выбранной организации membership не найден.';
  if (['BLOCKED', 'SUSPENDED', 'DISABLED', 'INACTIVE'].includes(membership)) {
    return access.reason || 'Доступ участника к выбранной организации заблокирован.';
  }
  if (membership === 'INVITED') {
    return access.reason || 'Приглашение в организацию ещё не принято.';
  }
  return access.reason || 'У выбранной организации нет активного доступа к документообороту.';
};

export default function DocumentFlowGate() {
  const { user, isAuthenticated, loading } = useAuth();
  const tenant = useDocumentFlowTenant();
  const access = useDocumentFlowAccess();
  const plans = useQuery({
    queryKey: documentFlowKeys.plans(),
    queryFn: ({ signal }) => documentFlowApi.plans(signal),
    enabled: isAuthenticated && access.isSuccess && access.data.available === false,
    retry: false,
  });

  if (loading) return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (tenant.organizationsQuery.isLoading) {
    return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (tenant.organizationsQuery.isError) {
    return <Container maxWidth="md" sx={{ py: 8 }}><ContractError error={tenant.organizationsQuery.error} retry={() => void tenant.organizationsQuery.refetch()} /></Container>;
  }
  if (!tenant.organizations.length) {
    return <Container maxWidth="md" sx={{ py: 8 }}><Alert severity="warning">У пользователя нет доступного membership в организациях.</Alert></Container>;
  }
  if (tenant.selectionRequired) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight={800}>Выберите организацию</Typography>
          <Alert severity="info">Документы и права доступа загружаются отдельно для каждой организации.</Alert>
          <FormControl fullWidth>
            <InputLabel>Организация</InputLabel>
            <Select label="Организация" value="" onChange={(event) => tenant.selectOrganization(Number(event.target.value))}>
              <MenuItem value="" disabled>Выберите организацию</MenuItem>
              {tenant.organizations.map((organization) => <MenuItem key={organization.id} value={organization.id}>{organization.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
      </Container>
    );
  }
  if (!tenant.organizationResolved || access.isLoading) {
    return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (access.isError) {
    return <Container maxWidth="md" sx={{ py: 8 }}><ContractError error={access.error} retry={() => void access.refetch()} /></Container>;
  }
  if (!access.data?.available) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Stack spacing={3}>
          <Typography variant="h4" fontWeight={800}>Документооборот</Typography>
          <Typography color="text.secondary">Организация: {tenant.organization?.name}</Typography>
          <Alert severity="warning"><Typography fontWeight={700}>Доступ к документообороту не подключён</Typography><Typography variant="body2">{access.data ? accessReason(access.data) : 'Доступ не подтверждён.'}</Typography><Typography variant="body2">Обратитесь к администратору EcoProgress для подключения модуля.</Typography></Alert>
          {canManageDocumentFlowAccess(user) && <Button component={Link} to={`/admin/document-flow-access?organizationId=${tenant.organizationId}`} variant="contained" sx={{ alignSelf: 'flex-start' }}>Выдать доступ</Button>}
          {plans.isError && <Alert severity="error">Не удалось загрузить доступные тарифы.</Alert>}
          {plans.isSuccess && <AccessRequestForm plans={plans.data} />}
        </Stack>
      </Container>
    );
  }
  return <Context.Provider value={access.data}><Outlet /></Context.Provider>;
}
