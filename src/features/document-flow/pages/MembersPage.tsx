import { useEffect, useState } from 'react';
import {
  Alert, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router-dom';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowContext } from '../components/DocumentFlowGate';
import { useDocumentFlowTenant } from '../hooks/useDocumentFlowTenant';
import { canMutate, hasPermission } from '../model/access';
import type { DocumentFlowMember, MembershipRole } from '../model/types';
import { mapDocumentFlowError } from '../utils/apiErrorMapper';

const roles: MembershipRole[] = ['OWNER', 'DOCUMENT_FLOW_ADMIN', 'DOCUMENT_MANAGER', 'SIGNER', 'ACCOUNTANT', 'VIEWER', 'EXTERNAL_SIGNER'];

interface MemberFormValues { userId: string; role: MembershipRole }

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
  const [createOpen, setCreateOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<DocumentFlowMember | null>(null);
  const [stateTarget, setStateTarget] = useState<DocumentFlowMember | null>(null);
  const form = useForm<MemberFormValues>({ defaultValues: { userId: '', role: 'VIEWER' } });

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
  const invalidate = () => queryClient.invalidateQueries({ queryKey: documentFlowKeys.memberLists(tenant.tenantScope!) });
  const createMember = useMutation({
    mutationFn: (values: MemberFormValues) => documentFlowApi.createMember({
      organizationId: tenant.organizationId!, userId: Number(values.userId), role: values.role,
    }),
    onSuccess: async () => { setCreateOpen(false); form.reset(); await invalidate(); },
    onError: (error) => {
      const mapped = mapDocumentFlowError(error);
      Object.entries(mapped.fieldErrors).forEach(([field, message]) => {
        if (field === 'userId' || field === 'role') form.setError(field, { type: 'server', message });
      });
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
  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2}>
        <Typography variant="h4" fontWeight={800}>Сотрудники и доступ</Typography>
        {mutable && <Button variant="contained" onClick={() => setCreateOpen(true)}>Добавить участника</Button>}
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
      {members.isSuccess && items.length > 0 && <Paper><TableContainer><Table><TableHead><TableRow><TableCell>Участник</TableCell><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Membership</TableCell><TableCell align="right">Действия</TableCell></TableRow></TableHead><TableBody>
        {items.map((item) => <TableRow key={item.id}><TableCell>{item.fullName || `Пользователь #${item.userId}`}</TableCell><TableCell>{item.email || '—'}</TableCell><TableCell>{item.role}</TableCell><TableCell><Chip size="small" label={item.status} color={item.status === 'ACTIVE' ? 'success' : 'default'} /></TableCell><TableCell align="right">{mutable && <><Button onClick={() => setRoleTarget(item)}>Изменить роль</Button><Button color={item.status === 'ACTIVE' ? 'warning' : 'success'} onClick={() => setStateTarget(item)}>{item.status === 'ACTIVE' ? 'Деактивировать' : 'Активировать'}</Button></>}</TableCell></TableRow>)}
      </TableBody></Table></TableContainer><TablePagination component="div" count={members.data.totalElements} page={page} rowsPerPage={size} rowsPerPageOptions={[10, 20, 50]} onPageChange={(_, next) => setPage(next)} onRowsPerPageChange={(event) => { setSize(Number(event.target.value)); setPage(0); }} /></Paper>}

      <Dialog open={createOpen} onClose={() => !createMember.isPending && setCreateOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Добавить участника</DialogTitle><DialogContent><Stack spacing={2} mt={1}><TextField type="number" label="ID пользователя" {...form.register('userId', { required: 'Укажите ID пользователя', validate: (value) => Number(value) > 0 || 'ID должен быть положительным' })} error={Boolean(form.formState.errors.userId)} helperText={form.formState.errors.userId?.message} /><TextField select label="Роль" defaultValue="VIEWER" {...form.register('role')}>{roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>{createMember.isError && <Alert severity={mapDocumentFlowError(createMember.error).status === 409 ? 'warning' : 'error'}>{mapDocumentFlowError(createMember.error).message}</Alert>}</Stack></DialogContent><DialogActions><Button disabled={createMember.isPending} onClick={() => setCreateOpen(false)}>Отмена</Button><Button variant="contained" disabled={createMember.isPending} onClick={form.handleSubmit((values) => createMember.mutate(values))}>Добавить</Button></DialogActions></Dialog>

      <Dialog open={Boolean(roleTarget)} onClose={() => !changeRole.isPending && setRoleTarget(null)} fullWidth maxWidth="xs"><DialogTitle>Изменить роль</DialogTitle><DialogContent><TextField select fullWidth sx={{ mt: 1 }} label="Роль" value={roleTarget?.role ?? 'VIEWER'} onChange={(event) => setRoleTarget((current) => current ? { ...current, role: event.target.value as MembershipRole } : current)}>{roles.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>{changeRole.isError && <Alert severity="error" sx={{ mt: 2 }}>{mapDocumentFlowError(changeRole.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={changeRole.isPending} onClick={() => setRoleTarget(null)}>Отмена</Button><Button variant="contained" disabled={changeRole.isPending} onClick={() => roleTarget && changeRole.mutate(roleTarget.role)}>Сохранить</Button></DialogActions></Dialog>

      <Dialog open={Boolean(stateTarget)} onClose={() => !changeState.isPending && setStateTarget(null)} fullWidth maxWidth="sm"><DialogTitle>{stateTarget?.status === 'ACTIVE' ? 'Деактивировать участника?' : 'Активировать участника?'}</DialogTitle><DialogContent><Typography>{stateTarget?.status === 'ACTIVE' ? 'Участник потеряет доступ к документообороту организации. Запись membership сохранится.' : 'Участник снова получит доступ согласно своей роли.'}</Typography>{changeState.isError && <Alert severity="error" sx={{ mt: 2 }}>{mapDocumentFlowError(changeState.error).message}</Alert>}</DialogContent><DialogActions><Button disabled={changeState.isPending} onClick={() => setStateTarget(null)}>Отмена</Button><Button variant="contained" color={stateTarget?.status === 'ACTIVE' ? 'warning' : 'success'} disabled={changeState.isPending} onClick={() => stateTarget && changeState.mutate(stateTarget)}>Подтвердить</Button></DialogActions></Dialog>
    </Stack>
  );
}
