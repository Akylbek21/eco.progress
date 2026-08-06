import { useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { CompanyListItem } from '../../../types/companies';
import { documentFlowKeys } from '../../document-flow/api/documentFlowKeys';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';
import { documentFlowAdminApi } from '../api/documentFlowAdminApi';
import { documentFlowAdminKeys } from '../model/queryKeys';
import type { OrganizationAccessRow } from '../model/types';
import AccessGrantDialog from './AccessGrantDialog';
import AccessStatusChip from './AccessStatusChip';
import SubscriptionActionDialog from './SubscriptionActionDialog';

type CardAction = 'extend' | 'suspend' | 'restore' | 'revoke';

export default function OrganizationAccessCard({ organization }: { organization: CompanyListItem }) {
  const organizationId = Number(organization.id);
  const queryClient = useQueryClient();
  const [grantMode, setGrantMode] = useState<'regular' | 'internal' | null>(null);
  const [action, setAction] = useState<CardAction | null>(null);
  const subscription = useQuery({ queryKey: documentFlowAdminKeys.organization(organizationId), queryFn: ({ signal }) => documentFlowAdminApi.subscription(organizationId, signal), retry: false });
  const access = useQuery({ queryKey: documentFlowAdminKeys.access(organizationId), queryFn: ({ signal }) => documentFlowAdminApi.organizationAccess(organizationId, signal), retry: false });
  const plans = useQuery({ queryKey: documentFlowAdminKeys.plans(), queryFn: ({ signal }) => documentFlowAdminApi.plans(signal) });
  const refresh = async () => {
    const fresh = await documentFlowAdminApi.organizationAccess(organizationId);
    queryClient.setQueryData(documentFlowAdminKeys.access(organizationId), fresh);
    queryClient.setQueryData(documentFlowKeys.access(organizationId), fresh);
    await Promise.all([subscription.refetch(), queryClient.invalidateQueries({ queryKey: documentFlowAdminKeys.all })]);
  };
  const mutation = useMutation({
    mutationFn: async ({ name, reason, date }: { name: CardAction; reason: string; date?: string }) => {
      if (name === 'extend') await documentFlowAdminApi.extend(organizationId, date!, reason);
      if (name === 'suspend') await documentFlowAdminApi.suspend(organizationId, reason);
      if (name === 'restore') await documentFlowAdminApi.restore(organizationId, reason);
      if (name === 'revoke') await documentFlowAdminApi.revoke(organizationId, reason);
      await refresh();
    },
    onSuccess: () => setAction(null),
  });
  if (subscription.isLoading || access.isLoading) return <Card><CardContent><CircularProgress size={24} /></CardContent></Card>;
  const noSubscription = subscription.isError && mapDocumentFlowError(subscription.error).status === 404;
  const current = noSubscription ? null : subscription.data ?? null;
  const row: OrganizationAccessRow = { organization, subscription: current, access: access.data ?? null };
  const plan = plans.data?.find((item) => item.id === current?.planId);
  return <Card><CardContent><Stack spacing={2}>
    <Typography variant="h6" fontWeight={800}>Доступ к документообороту</Typography>
    {access.isError && <Alert severity="error">{mapDocumentFlowError(access.error).message}</Alert>}
    <Stack direction="row" gap={1} flexWrap="wrap"><AccessStatusChip access={access.data ?? null}/>{current && <Chip size="small" label={`${plan?.code ?? `plan #${current.planId}`} · ${current.status}`} />}</Stack>
    {current ? <><Typography>Период: {new Date(current.startsAt).toLocaleString('ru-RU')} — {current.expiresAt ? new Date(current.expiresAt).toLocaleString('ru-RU') : 'бессрочно'}</Typography><Typography>Пользователи: {access.data?.usage.ACTIVE_MEMBERS ?? 0}/{access.data?.limits.ACTIVE_MEMBERS ?? '∞'} · Документы: {access.data?.usage.DOCUMENTS_CREATED ?? 0}/{access.data?.limits.DOCUMENTS_CREATED ?? '∞'}</Typography><Typography>Выдал: {current.createdBy || '—'} · {new Date(current.createdAt).toLocaleString('ru-RU')}</Typography></> : <Alert severity="info">Активная подписка не найдена.</Alert>}
    {access.data?.reason && <Typography color="text.secondary">{access.data.reason}</Typography>}
    <Stack direction="row" gap={1} flexWrap="wrap">{!current && <><Button onClick={() => setGrantMode('regular')}>Выдать доступ</Button><Button onClick={() => setGrantMode('internal')}>Внутренний доступ</Button></>}{current && current.status !== 'CANCELLED' && <Button onClick={() => setAction('extend')}>Продлить</Button>}{current && ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'].includes(current.status) && <Button color="warning" onClick={() => setAction('suspend')}>Приостановить</Button>}{current?.status === 'SUSPENDED' && <Button color="success" onClick={() => setAction('restore')}>Восстановить</Button>}{current && current.status !== 'CANCELLED' && <Button color="error" onClick={() => setAction('revoke')}>Отозвать</Button>}<Button component={Link} to={`/admin/document-flow-access?organizationId=${organizationId}`}>Изменить</Button>{access.data?.available && <Button component={Link} to="/document-flow">Открыть документооборот</Button>}</Stack>
    <AccessGrantDialog open={grantMode !== null} internal={grantMode === 'internal'} initialOrganization={organization} onClose={() => setGrantMode(null)} onCompleted={() => void refresh()} />
    <SubscriptionActionDialog open={Boolean(action)} title={action === 'extend' ? 'Продлить подписку' : action === 'suspend' ? 'Приостановить доступ' : action === 'restore' ? 'Восстановить доступ' : 'Отозвать доступ'} warning={action === 'revoke' ? 'Пользователи потеряют доступ. Документы и история не удаляются.' : undefined} currentDate={action === 'extend' ? row.subscription?.expiresAt : undefined} requireDate={action === 'extend'} pending={mutation.isPending} error={mutation.error} onClose={() => setAction(null)} onSubmit={(reason, date) => action && mutation.mutate({ name: action, reason, date })} />
  </Stack></CardContent></Card>;
}
