import { createContext, useContext, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Container, FormControl, InputLabel, MenuItem, Select, Stack, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ZodError } from 'zod';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
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
  const { user, isAuthenticated, loading, logout } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [requestOpen, setRequestOpen] = useState(false);
  const tenant = useDocumentFlowTenant();
  const access = useDocumentFlowAccess();
  const invited = access.data?.membershipStatus?.toUpperCase() === 'INVITED';
  const canManageAccess = canManageDocumentFlowAccess(user);
  const plans = useQuery({
    queryKey: documentFlowKeys.plans(),
    queryFn: ({ signal }) => documentFlowApi.plans(signal),
    enabled: isAuthenticated && access.isSuccess && access.data.available === false && !invited && requestOpen,
    retry: false,
  });
  const invitedMembers = useQuery({
    queryKey: tenant.tenantScope
      ? documentFlowKeys.members(tenant.tenantScope, { status: 'INVITED', selfActivation: true })
      : ['document-flow', 'tenant-unresolved', 'invited-members'],
    queryFn: ({ signal }) => documentFlowApi.members({
      organizationId: tenant.organizationId!, status: 'INVITED', page: 0, size: 50, sort: 'fullName,asc', signal,
    }),
    enabled: Boolean(tenant.organizationResolved && invited && canManageAccess),
    retry: false,
  });
  const currentMembership = invitedMembers.data?.items.find((member) =>
    String(member.userId) === String(user?.id)
    || Boolean(user?.email && member.email?.toLowerCase() === user.email.toLowerCase()),
  );
  const activateMembership = useMutation({
    mutationFn: () => documentFlowApi.activateMember(currentMembership!.id, tenant.organizationId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: documentFlowKeys.organizations(String(user?.id ?? 'anonymous')) }),
        queryClient.invalidateQueries({ queryKey: documentFlowKeys.access(tenant.tenantScope!) }),
        queryClient.invalidateQueries({ queryKey: documentFlowKeys.memberLists(tenant.tenantScope!) }),
      ]);
    },
  });

  if (loading) return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  if (!isAuthenticated) return <Navigate to={`/document-flow/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (tenant.organizationsQuery.isLoading) {
    return <Box minHeight="70vh" display="grid" sx={{ placeItems: 'center' }}><CircularProgress /></Box>;
  }
  if (tenant.organizationsQuery.isError) {
    return <Container maxWidth="md" sx={{ py: 8 }}><ContractError error={tenant.organizationsQuery.error} retry={() => void tenant.organizationsQuery.refetch()} /></Container>;
  }
  if (!tenant.organizations.length) {
    return <Container maxWidth="md" sx={{ py: 8 }}><Stack spacing={2}><Alert severity="warning"><Typography fontWeight={700}>Документооборот пока не подключён</Typography><Typography variant="body2">Ваш аккаунт ещё не добавлен ни в одну организацию документооборота.</Typography></Alert><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><Button component={Link} to="/document-flow/request" variant="contained">Оставить заявку</Button><Button component={Link} to="/document-flow/login?redirect=%2Fdocument-flow" onClick={logout} variant="outlined">Войти под другим аккаунтом</Button></Stack></Stack></Container>;
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
          <Alert severity="warning"><Typography fontWeight={700}>{invited ? 'Приглашение в организацию не принято' : 'Доступ к документообороту не подключён'}</Typography><Typography variant="body2">{access.data ? accessReason(access.data) : 'Доступ не подтверждён.'}</Typography><Typography variant="body2">{invited ? 'Активируйте участие, чтобы войти в документооборот.' : 'Обратитесь к администратору EcoProgress для подключения модуля.'}</Typography></Alert>
          {invited && canManageAccess && invitedMembers.isLoading && <Alert severity="info">Проверяем приглашение пользователя…</Alert>}
          {invited && canManageAccess && currentMembership && <Button variant="contained" disabled={activateMembership.isPending} onClick={() => activateMembership.mutate()} sx={{ alignSelf: 'flex-start' }}>{activateMembership.isPending ? 'Активация…' : 'Активировать моё участие'}</Button>}
          {invited && canManageAccess && invitedMembers.isSuccess && !currentMembership && <Alert severity="info">Ваше приглашение не найдено в списке участников. Попросите администратора организации активировать участника или отправить приглашение повторно.</Alert>}
          {invitedMembers.isError && <Alert severity="error">Не удалось получить приглашение. Откройте управление участниками или обратитесь к администратору организации.</Alert>}
          {activateMembership.isError && <Alert severity="error">{mapDocumentFlowError(activateMembership.error).message}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            {!invited && <Button variant="contained" onClick={() => setRequestOpen(true)}>Оставить заявку</Button>}
            <Button component={Link} to="/document-flow/login?redirect=%2Fdocument-flow" onClick={logout} variant="outlined">Войти под другим аккаунтом</Button>
            {canManageAccess && <Button component={Link} to={`/admin/document-flow-access?organizationId=${tenant.organizationId}`} variant="outlined">Управление подпиской</Button>}
          </Stack>
          {!invited && requestOpen && plans.isLoading && <Stack alignItems="center" py={3}><CircularProgress /></Stack>}
          {!invited && requestOpen && plans.isError && <Alert severity="error" action={<Button onClick={() => plans.refetch()}>Повторить</Button>}>Не удалось загрузить доступные тарифы.</Alert>}
          {!invited && requestOpen && plans.isSuccess && <AccessRequestForm plans={plans.data} initialOrganizationName={tenant.organization?.name} initialBin={tenant.organization?.bin ?? ''} />}
        </Stack>
      </Container>
    );
  }
  return <Context.Provider value={access.data}><Outlet /></Context.Provider>;
}
