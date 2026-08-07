import { useEffect, useRef, useState } from 'react';
import {
  Alert, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import type { CompanyListItem } from '../../../types/companies';
import { getCompanyById } from '../../../services/companyService';
import { documentFlowKeys } from '../../document-flow/api/documentFlowKeys';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';
import { documentFlowAdminApi } from '../api/documentFlowAdminApi';
import AccessGrantDialog from '../components/AccessGrantDialog';
import AccessStatusChip from '../components/AccessStatusChip';
import SubscriptionActionDialog from '../components/SubscriptionActionDialog';
import EditAccessDialog from '../components/EditAccessDialog';
import OrganizationMembersDialog from '../components/OrganizationMembersDialog';
import { documentFlowAdminKeys } from '../model/queryKeys';
import type { AccessGrantFilters, DocumentFlowAdminSubscription, OrganizationAccessRow } from '../model/types';

type ActionName = 'extend' | 'suspend' | 'restore' | 'revoke';

const statusValues = ['', 'PENDING', 'TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'EXPIRED', 'CANCELLED'] as const;
const daysRemaining = (date: string | null) => date ? Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000) : null;
const statusAllows = (subscription: DocumentFlowAdminSubscription, action: ActionName) => {
  if (action === 'restore') return subscription.status === 'SUSPENDED';
  if (action === 'suspend') return ['ACTIVE', 'TRIAL', 'GRACE_PERIOD'].includes(subscription.status);
  if (action === 'extend') return !['CANCELLED'].includes(subscription.status);
  return !['CANCELLED'].includes(subscription.status);
};

export default function DocumentFlowAccessAdminPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const preselectedOpened = useRef(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState<AccessGrantFilters['status']>('');
  const [planCode, setPlanCode] = useState('');
  const [accessFilter, setAccessFilter] = useState<AccessGrantFilters['access']>('ALL');
  const [sort, setSort] = useState('name,asc');
  const [grantMode, setGrantMode] = useState<'regular' | 'internal' | null>(null);
  const [grantOrganization, setGrantOrganization] = useState<CompanyListItem | null>(null);
  const [action, setAction] = useState<{ name: ActionName; row: OrganizationAccessRow } | null>(null);
  const [historyOrganization, setHistoryOrganization] = useState<CompanyListItem | null>(null);
  const [editRow, setEditRow] = useState<OrganizationAccessRow | null>(null);
  const [membersOrganization, setMembersOrganization] = useState<CompanyListItem | null>(null);
  const preselectedOrganizationId = searchParams.get('organizationId');
  const preselectedOrganization = useQuery({
    queryKey: ['company', preselectedOrganizationId],
    queryFn: ({ signal }) => getCompanyById(preselectedOrganizationId!, signal),
    enabled: Boolean(preselectedOrganizationId),
  });
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0); }, 350); return () => window.clearTimeout(timer); }, [query]);
  const filters: AccessGrantFilters = { query: debouncedQuery || undefined, status, planCode: planCode || undefined, access: accessFilter, page, size, sort };
  const organizations = useQuery({
    queryKey: documentFlowAdminKeys.list(filters),
    queryFn: ({ signal }) => documentFlowAdminApi.accessList({
      search: debouncedQuery || undefined, status: status || undefined, planCode: planCode || undefined,
      accessState: accessFilter === 'WITHOUT_ACCESS' ? 'UNAVAILABLE' : undefined,
      hasSubscription: accessFilter === 'WITHOUT_ACCESS' ? false : undefined,
      expiresBefore: accessFilter === 'EXPIRING_30_DAYS' ? new Date(Date.now() + 30 * 86_400_000).toISOString() : undefined,
      page, size, sort: sort.split(',')[0], direction: sort.split(',')[1] || 'asc',
    }, signal),
  });
  const plans = useQuery({ queryKey: documentFlowAdminKeys.plans(), queryFn: ({ signal }) => documentFlowAdminApi.plans(signal) });
  const history = useQuery({
    queryKey: [...documentFlowAdminKeys.all, 'history', historyOrganization?.id ?? 0],
    queryFn: ({ signal }) => documentFlowAdminApi.subscriptionEvents(Number(historyOrganization!.id), 0, 50, signal),
    enabled: Boolean(historyOrganization),
  });
  useEffect(() => {
    if (!preselectedOrganization.data || preselectedOpened.current) return;
    preselectedOpened.current = true;
    setQuery(preselectedOrganization.data.name);
  }, [preselectedOrganization.data]);
  const rows: OrganizationAccessRow[] = (organizations.data?.items ?? []).map((item) => ({
    organization: { id: String(item.organizationId), name: item.organizationName, bin: item.organizationBin, status: 'ACTIVE' },
    subscription: item.hasSubscription ? {
      id: item.subscriptionId!, organizationId: item.organizationId, planId: 0, status: item.subscriptionStatus!, startsAt: item.startsAt!, expiresAt: item.expiresAt,
      trialEndsAt: null, graceEndsAt: null, paymentMode: '', paymentReference: null, suspensionReason: null, createdBy: null, createdAt: '', updatedAt: '', version: null,
    } : null,
    access: {
      organizationId: item.organizationId, hasSubscription: item.hasSubscription, subscriptionId: item.subscriptionId,
      subscriptionVersion: null, subscriptionStatus: item.subscriptionStatus, planId: null, planCode: item.planCode, planName: item.planName,
      available: item.available, readOnly: item.readOnly, reason: null, startsAt: item.startsAt, expiresAt: item.expiresAt,
      limits: {}, usage: {}, activeMemberCount: item.activeMemberCount, hasOwner: item.hasOwner, availableAdminActions: item.availableAdminActions,
    },
  }));

  const refreshOrganization = async (organizationId: number) => {
    const fresh = await documentFlowAdminApi.organizationAccess(organizationId);
    queryClient.setQueryData(documentFlowAdminKeys.access(organizationId), fresh);
    queryClient.setQueryData(documentFlowKeys.access(organizationId), fresh);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentFlowAdminKeys.all }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.access(organizationId) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.organizations() }),
    ]);
  };
  const actionMutation = useMutation({
    mutationFn: async ({ selected, reason, date }: { selected: NonNullable<typeof action>; reason: string; date?: string }) => {
      const organizationId = Number(selected.row.organization.id);
      const version = (await documentFlowAdminApi.organizationAccess(organizationId)).subscriptionVersion;
      if (version == null) throw new Error('Backend не вернул версию подписки. Обновите данные.');
      if (selected.name === 'extend') await documentFlowAdminApi.extend(organizationId, date!, reason, version);
      if (selected.name === 'suspend') await documentFlowAdminApi.suspend(organizationId, reason, version);
      if (selected.name === 'restore') await documentFlowAdminApi.restore(organizationId, reason, version);
      if (selected.name === 'revoke') await documentFlowAdminApi.revoke(organizationId, reason, version);
      await refreshOrganization(organizationId);
    },
    onSuccess: () => setAction(null),
    onError: async (error) => {
      const statusCode = mapDocumentFlowError(error).status;
      if ((statusCode === 409 || statusCode === 412) && action) {
        await queryClient.invalidateQueries({ queryKey: documentFlowAdminKeys.organization(action.row.organization.id) });
        await queryClient.invalidateQueries({ queryKey: documentFlowAdminKeys.all });
      }
    },
  });
  const openGrant = (mode: 'regular' | 'internal', organization: CompanyListItem | null = null) => { setGrantOrganization(organization); setGrantMode(mode); };
  const loading = organizations.isLoading || plans.isLoading;
  return <Stack spacing={3}>
    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2}><div><Typography variant="h4" fontWeight={800}>Доступ к документообороту</Typography><Typography color="text.secondary">Администрирование подписок организаций</Typography></div><Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" onClick={() => void Promise.all([organizations.refetch(), plans.refetch()])}>Обновить</Button><Button variant="outlined" onClick={() => openGrant('internal')}>Выдать внутренний доступ</Button><Button variant="contained" onClick={() => openGrant('regular')}>Выдать доступ</Button></Stack></Stack>
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}><TextField fullWidth label="Поиск организации по названию или БИН" value={query} onChange={(event) => setQuery(event.target.value)} /><TextField select label="Статус" value={status} onChange={(event) => { setStatus(event.target.value as AccessGrantFilters['status']); setPage(0); }} sx={{ minWidth: 180 }}>{statusValues.map((item) => <MenuItem key={item || 'all'} value={item}>{item || 'Все'}</MenuItem>)}</TextField><TextField select label="Тариф" value={planCode} onChange={(event) => { setPlanCode(event.target.value); setPage(0); }} sx={{ minWidth: 190 }}><MenuItem value="">Все</MenuItem>{(plans.data ?? []).map((plan) => <MenuItem key={plan.id} value={plan.code}>{plan.name}</MenuItem>)}</TextField><TextField select label="Доступ" value={accessFilter} onChange={(event) => { setAccessFilter(event.target.value as AccessGrantFilters['access']); setPage(0); }} sx={{ minWidth: 220 }}><MenuItem value="ALL">Все</MenuItem><MenuItem value="WITHOUT_ACCESS">Без доступа</MenuItem><MenuItem value="EXPIRING_30_DAYS">Истекает за 30 дней</MenuItem></TextField><TextField select label="Сортировка" value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }} sx={{ minWidth: 190 }}><MenuItem value="name,asc">Название А–Я</MenuItem><MenuItem value="name,desc">Название Я–А</MenuItem><MenuItem value="bin,asc">БИН</MenuItem></TextField></Stack>
    {(organizations.isError || plans.isError) && <Alert severity="error">{mapDocumentFlowError(organizations.error || plans.error).message}</Alert>}
    {loading && <Stack alignItems="center" py={6}><CircularProgress /></Stack>}
    {!loading && rows.length === 0 && <Alert severity="info">Организации по заданным условиям не найдены.</Alert>}
    {!loading && rows.length > 0 && <Paper><TableContainer><Table size="small"><TableHead><TableRow><TableCell>Организация</TableCell><TableCell>Тариф / статус</TableCell><TableCell>Доступ</TableCell><TableCell>Период</TableCell><TableCell>Осталось</TableCell><TableCell>Лимиты</TableCell><TableCell>Выдал</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>{rows.map((row) => {
      const subscription = row.subscription;
      const plan = plans.data?.find((item) => item.code === row.access?.planCode);
      const days = daysRemaining(subscription?.expiresAt ?? null);
      const actions = row.access?.availableAdminActions ?? [];
      return <TableRow key={row.organization.id}><TableCell><Typography fontWeight={700}>{row.organization.name}</Typography><Typography variant="caption">БИН {row.organization.bin} · ID {row.organization.id}</Typography></TableCell><TableCell>{subscription ? <><Chip size="small" label={plan?.code ?? row.access?.planCode ?? '—'} /><Typography variant="caption" component="div">{subscription.status}</Typography></> : 'Нет подписки'}</TableCell><TableCell><AccessStatusChip access={row.access} /></TableCell><TableCell>{subscription ? <>{new Date(subscription.startsAt).toLocaleDateString('ru-RU')} — {subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU') : 'бессрочно'}</> : '—'}</TableCell><TableCell>{days == null ? '∞' : days}</TableCell><TableCell>Участников: {row.access?.activeMemberCount ?? 0}</TableCell><TableCell>—</TableCell><TableCell align="right"><Stack alignItems="flex-end">{actions.includes('grant') && <><Button size="small" onClick={() => openGrant('regular', row.organization)}>Выдать</Button><Button size="small" onClick={() => openGrant('internal', row.organization)}>Внутренний</Button></>}{subscription && <Button size="small" onClick={() => setMembersOrganization(row.organization)}>Сотрудники</Button>}{(actions.includes('change-plan') || actions.includes('limits')) && <Button size="small" onClick={() => setEditRow(row)}>Изменить</Button>}{actions.includes('extend') && <Button size="small" onClick={() => setAction({ name: 'extend', row })}>Продлить</Button>}{actions.includes('suspend') && <Button size="small" color="warning" onClick={() => setAction({ name: 'suspend', row })}>Приостановить</Button>}{actions.includes('restore') && <Button size="small" color="success" onClick={() => setAction({ name: 'restore', row })}>Восстановить</Button>}{actions.includes('revoke') && <Button size="small" color="error" onClick={() => setAction({ name: 'revoke', row })}>Отозвать</Button>}<Button size="small" onClick={() => setHistoryOrganization(row.organization)}>История</Button></Stack></TableCell></TableRow>;
    })}</TableBody></Table></TableContainer><TablePagination component="div" count={organizations.data?.totalElements ?? 0} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Paper>}
    <AccessGrantDialog open={grantMode !== null} internal={grantMode === 'internal'} initialOrganization={grantOrganization} onClose={() => { setGrantMode(null); setGrantOrganization(null); }} />
    <EditAccessDialog open={Boolean(editRow)} row={editRow} plans={plans.data ?? []} onClose={() => setEditRow(null)} onCompleted={refreshOrganization} />
    <OrganizationMembersDialog open={Boolean(membersOrganization)} organization={membersOrganization} onClose={() => setMembersOrganization(null)} />
    <SubscriptionActionDialog open={Boolean(action)} title={action?.name === 'extend' ? 'Продлить подписку' : action?.name === 'suspend' ? 'Приостановить доступ' : action?.name === 'restore' ? 'Восстановить доступ' : 'Отозвать доступ'} warning={action?.name === 'revoke' ? 'Пользователи организации потеряют доступ к модулю. Документы, файлы, участники и история не удаляются.' : undefined} currentDate={action?.name === 'extend' ? action.row.subscription?.expiresAt : undefined} requireDate={action?.name === 'extend'} pending={actionMutation.isPending} error={actionMutation.error} onClose={() => setAction(null)} onSubmit={(reason, date) => action && actionMutation.mutate({ selected: action, reason, date })} />
    <Dialog open={Boolean(historyOrganization)} onClose={() => setHistoryOrganization(null)} fullWidth maxWidth="sm"><DialogTitle>История доступа · {historyOrganization?.name}</DialogTitle><DialogContent><Stack spacing={2}>{history.isLoading && <CircularProgress size={24} />}{history.isError && <Alert severity="error">{mapDocumentFlowError(history.error).message}</Alert>}{history.data?.items.map((event) => <Card variant="outlined" key={event.id}><CardContent><Typography fontWeight={700}>{event.eventType}</Typography><Typography>{event.oldStatus || '—'} → {event.newStatus || '—'}</Typography><Typography>{event.reason || 'Без комментария'}</Typography><Typography variant="caption">Администратор #{event.actorUserId ?? 'система'} · {new Date(event.createdAt).toLocaleString('ru-RU')}</Typography></CardContent></Card>)}</Stack></DialogContent><DialogActions><Button onClick={() => setHistoryOrganization(null)}>Закрыть</Button></DialogActions></Dialog>
  </Stack>;
}
