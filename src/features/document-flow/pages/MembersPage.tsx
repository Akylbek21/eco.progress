import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography, Box, IconButton,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { MoreVertical, History } from 'lucide-react';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import { canMutate, hasPermission } from '../model/access';
import type { DocumentFlowMember, MembershipRole, AuditEvent } from '../model/types';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';

const roles: MembershipRole[] = ['OWNER', 'DOCUMENT_FLOW_ADMIN', 'DOCUMENT_MANAGER', 'SIGNER', 'ACCOUNTANT', 'VIEWER', 'EXTERNAL_SIGNER'];

interface MemberFormValues { email: string; role: MembershipRole }

export default function MembersPage() {
  const access = useDocumentFlowContext();
  const tenant = useDocumentFlowTenant();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState<'' | MembershipRole>('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<DocumentFlowMember | null>(null);
  const [stateTarget, setStateTarget] = useState<DocumentFlowMember | null>(null);
  const [auditTarget, setAuditTarget] = useState<DocumentFlowMember | null>(null);
  const [auditPage, setAuditPage] = useState(0);
  const form = useForm<MemberFormValues>({ defaultValues: { email: '', role: 'VIEWER' } });

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(0); }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  const filters = { query: debouncedQuery || undefined, status: status || undefined, role: role || undefined, page, size, sort: 'fullName,asc' };
  const members = useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.members(tenant.tenantScope, filters) : ['document-flow', 'tenant-unresolved', 'members'],
    queryFn: ({ signal }) => documentFlowApi.members({ organizationId: tenant.organizationId!, ...filters, signal }),
    enabled: tenant.organizationResolved && access.available && hasPermission(access, 'MANAGE_MEMBERS'),
  });

  const auditLog = useQuery({
    queryKey: auditTarget ? ['members', 'audit', auditTarget.id, auditPage] : [],
    queryFn: ({ signal }) => auditTarget ? documentFlowApi.getMemberAuditLog(auditTarget.id, auditPage, 10, tenant.organizationId, signal) : Promise.resolve(null),
    enabled: Boolean(auditTarget),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: documentFlowKeys.memberLists(tenant.tenantScope!) });

  const inviteMember = useMutation({
    mutationFn: (values: MemberFormValues) => documentFlowApi.inviteMember({ email: values.email.trim(), role: values.role }, tenant.organizationId),
    onSuccess: async () => { setInviteOpen(false); form.reset(); await invalidate(); },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => {
        if (field === 'email' || field === 'role') form.setError(field, { type: 'server', message });
      });
    },
  });

  const resendInvite = useMutation({
    mutationFn: (memberId: number) => documentFlowApi.resendInvitation(memberId, tenant.organizationId),
    onSuccess: async () => { await invalidate(); },
    onError: (error) => {
      console.error('Resend invitation error:', mapDocumentFlowError(error));
    },
  });

  const changeRole = useMutation({
    mutationFn: (nextRole: MembershipRole) => documentFlowApi.updateMemberRole(roleTarget!.id, nextRole, tenant.organizationId!),
    onSuccess: async () => { setRoleTarget(null); await invalidate(); },
  });

  const changeState = useMutation({
    mutationFn: (member: DocumentFlowMember) => member.status === 'ACTIVE'
      ? documentFlowApi.deactivateMember(member.id, tenant.organizationId!)
      : documentFlowApi.activateMember(member.id, tenant.organizationId!),
    onSuccess: async () => { setStateTarget(null); await invalidate(); },
  });

  if (!hasPermission(access, 'MANAGE_MEMBERS')) return <Navigate to="/document-flow/documents" replace />;
  const mutable = canMutate(access, 'MANAGE_MEMBERS');
  const items = members.data?.items ?? [];

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      ACTIVE: 'Активный',
      INACTIVE: 'Неактивный',
      PENDING: 'Ожидание принятия',
      INVITED: 'Приглашён',
      EXPIRED: 'Истёк',
      DECLINED: 'Отклонено',
    };
    return labels[s] || s;
  };

  const statusColor = (s: string) => {
    const colors: Record<string, 'success' | 'warning' | 'error' | 'default' | 'info'> = {
      ACTIVE: 'success',
      INACTIVE: 'default',
      PENDING: 'info',
      INVITED: 'info',
      EXPIRED: 'error',
      DECLINED: 'error',
    };
    return colors[s] ?? 'default';
  };

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" fontWeight={800}>Сотрудники и доступ</Typography>
        {mutable && <Button variant="contained" onClick={() => setInviteOpen(true)}>Пригласить по email</Button>}
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth label="Поиск участника" value={query} onChange={(event) => setQuery(event.target.value)} />
        <TextField select label="Статус" value={status} onChange={(event) => { setStatus(event.target.value); setPage(0); }} sx={{ minWidth: 170 }}>
          <MenuItem value="">Все</MenuItem><MenuItem value="ACTIVE">Активные</MenuItem><MenuItem value="INVITED">Приглашённые</MenuItem><MenuItem value="INACTIVE">Неактивные</MenuItem>
        </TextField>
        <TextField select label="Роль" value={role} onChange={(event) => { setRole(event.target.value as '' | MembershipRole); setPage(0); }} sx={{ minWidth: 220 }}>
          <MenuItem value="">Все</MenuItem>{roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
      </Stack>
      {members.isLoading && <Stack alignItems="center" py={6}><CircularProgress /></Stack>}
      {members.isError && <Alert severity="error" action={<Button onClick={() => members.refetch()}>Повторить</Button>}>{mapDocumentFlowError(members.error).message}</Alert>}
      {members.isSuccess && !items.length && <Alert severity="info">Участники по заданным фильтрам не найдены.</Alert>}
      {members.isSuccess && items.length > 0 && <Paper><TableContainer><Table><TableHead><TableRow><TableCell>Участник</TableCell><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>
        {items.map((item) => <TableRow key={item.id}><TableCell>{item.fullName || `Пользователь #${item.userId}`}</TableCell><TableCell>{item.email || '—'}</TableCell><TableCell>{item.role}</TableCell><TableCell><Chip size="small" label={statusLabel(item.status)} color={statusColor(item.status)} /></TableCell><TableCell align="right"><Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>{item.status === 'INVITED' && mutable && <Button size="small" color="info" onClick={() => resendInvite.mutate(item.id)} disabled={resendInvite.isPending}>Отправить заново</Button>}{mutable && <><Button size="small" onClick={() => setRoleTarget(item)}>Роль</Button><Button size="small" color={item.status === 'ACTIVE' ? 'warning' : 'success'} onClick={() => setStateTarget(item)}>{item.status === 'ACTIVE' ? 'Деактивировать' : 'Активировать'}</Button></>}<IconButton size="small" onClick={() => { setAuditTarget(item); setAuditPage(0); }}><History size={18} /></IconButton></Box></TableCell></TableRow>)}
      </TableBody></Table></TableContainer><TablePagination component="div" count={members.data.totalElements} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Paper>}

      <Dialog open={inviteOpen} onClose={() => !inviteMember.isPending && setInviteOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Пригласить сотрудника</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField type="email" label="Email сотрудника" {...form.register('email', { required: 'Укажите email сотрудника', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Укажите корректный email' } })} error={Boolean(form.formState.errors.email)} helperText={form.formState.errors.email?.message || 'Приглашение будет отправлено на этот адрес'} /><TextField select label="Роль" defaultValue="VIEWER" {...form.register('role')}>{roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>{inviteMember.isError && <Alert severity={mapDocumentFlowError(inviteMember.error).status === 409 ? 'warning' : 'error'}>{mapDocumentFlowError(inviteMember.error).message}</Alert>}</Stack></DialogContent><DialogActions><Button disabled={inviteMember.isPending} onClick={() => setInviteOpen(false)}>Отмена</Button><Button variant="contained" disabled={inviteMember.isPending} onClick={form.handleSubmit((values) => inviteMember.mutate(values))}>Пригласить</Button></DialogActions></Dialog>

      <Dialog open={Boolean(roleTarget)} onClose={() => !changeRole.isPending && setRoleTarget(null)} fullWidth maxWidth="xs"><DialogTitle>Изменить роль</DialogTitle><DialogContent><TextField select fullWidth sx={{ mt: 1 }} label="Роль" value={roleTarget?.role ?? 'VIEWER'} onChange={(event) => setRoleTarget((current) => current ? { ...current, role: event.target.value as MembershipRole } : current)}>{roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>{changeRole.isError && <Alert severity="error" sx={{ mt: 2 }}>{mapDocumentFlowError(changeRole.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={changeRole.isPending} onClick={() => setRoleTarget(null)}>Отмена</Button><Button variant="contained" disabled={changeRole.isPending} onClick={() => roleTarget && changeRole.mutate(roleTarget.role)}>Сохранить</Button></DialogActions></Dialog>

      <Dialog open={Boolean(stateTarget)} onClose={() => !changeState.isPending && setStateTarget(null)} fullWidth maxWidth="sm"><DialogTitle>{stateTarget?.status === 'ACTIVE' ? 'Деактивировать участника?' : 'Активировать участника?'}</DialogTitle><DialogContent><Typography>{stateTarget?.status === 'ACTIVE' ? 'Участник потеряет доступ к документообороту организации. Запись membership сохранится.' : 'Участник снова получит доступ согласно своей роли.'}</Typography>{changeState.isError && <Alert severity="error" sx={{ mt: 2 }}>{mapDocumentFlowError(changeState.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={changeState.isPending} onClick={() => setStateTarget(null)}>Отмена</Button><Button variant="contained" color={stateTarget?.status === 'ACTIVE' ? 'warning' : 'success'} disabled={changeState.isPending} onClick={() => stateTarget && changeState.mutate(stateTarget)}>Подтвердить</Button></DialogActions></Dialog>

      <Dialog open={Boolean(auditTarget)} onClose={() => setAuditTarget(null)} fullWidth maxWidth="sm"><DialogTitle>История действий: {auditTarget?.fullName || auditTarget?.email}</DialogTitle><DialogContent><Stack spacing={2} mt={1}>{auditLog.isLoading && <CircularProgress />}{auditLog.isError && <Alert severity="error">Не удалось загрузить историю</Alert>}{auditLog.isSuccess && auditLog.data && (auditLog.data.items.length === 0 ? <Typography variant="body2" color="textSecondary">История действий отсутствует</Typography> : <Stack spacing={1}>{auditLog.data.items.map((event: AuditEvent, idx) => <Box key={idx} sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}><Typography variant="caption" color="textSecondary">{event.eventType} · {event.actorName || 'система'}</Typography><Typography variant="body2" sx={{ mt: 0.5 }}>{event.description}</Typography><Typography variant="caption" color="textSecondary">{new Date(event.createdAt).toLocaleString('ru-RU')}</Typography></Box>)}</Stack>)}</Stack></DialogContent><DialogActions>{auditLog.data && auditLog.data.hasPrevious && <Button onClick={() => setAuditPage(p => p - 1)}>← Назад</Button>}{auditLog.data && auditLog.data.hasNext && <Button onClick={() => setAuditPage(p => p + 1)}>Далее →</Button>}<Button onClick={() => setAuditTarget(null)}>Закрыть</Button></DialogActions></Dialog>
    </Stack>
  );
}
