import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyListItem } from '../../../types/companies';
import { createUser, getUsers, type AdminUserRecord } from '../../../services/adminUserService';
import { documentFlowApi } from '../../document-flow/api/documentFlowApi';
import { documentFlowKeys } from '../../document-flow/api/documentFlowKeys';
import type { DocumentFlowMember, MembershipRole } from '../../document-flow/model/types';
import { mapDocumentFlowError } from '../../document-flow/utils/apiErrorMapper';

const roleOptions: Array<{ value: MembershipRole; label: string }> = [
  { value: 'OWNER', label: 'Владелец' },
  { value: 'DOCUMENT_FLOW_ADMIN', label: 'Администратор документооборота' },
  { value: 'DOCUMENT_MANAGER', label: 'Менеджер документов' },
  { value: 'SIGNER', label: 'Подписант' },
  { value: 'ACCOUNTANT', label: 'Бухгалтер' },
  { value: 'VIEWER', label: 'Просмотр' },
  { value: 'EXTERNAL_SIGNER', label: 'Внешний подписант' },
];

interface Props {
  open: boolean;
  organization: CompanyListItem | null;
  onClose: () => void;
}

export default function OrganizationMembersDialog({ open, organization, onClose }: Props) {
  const queryClient = useQueryClient();
  const organizationId = Number(organization?.id ?? 0);
  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [role, setRole] = useState<MembershipRole>('VIEWER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string; password: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('new'); setSelectedUser(null); setRole('VIEWER'); setName(''); setEmail(''); setPassword(''); setCreatedCredentials(null);
  }, [open, organizationId]);

  const members = useQuery({
    queryKey: documentFlowKeys.members(organizationId, { admin: true, page: 0, size: 50 }),
    queryFn: ({ signal }) => documentFlowApi.members({ organizationId, page: 0, size: 50, sort: 'fullName,asc', signal }),
    enabled: open && organizationId > 0,
    retry: false,
  });
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: getUsers, enabled: open && mode === 'existing', retry: false });
  const existingUserIds = useMemo(() => new Set((members.data?.items ?? []).map((member) => member.userId)), [members.data]);
  const availableUsers = useMemo(() => (users.data ?? []).filter((user) => user.status !== 'blocked' && !existingUserIds.has(user.id)), [existingUserIds, users.data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.memberLists(organizationId) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.access(organizationId) }),
    ]);
  };
  const addMember = useMutation({
    mutationFn: async () => {
      let user = selectedUser;
      if (mode === 'new') {
        if (name.trim().length < 2) throw new Error('Укажите ФИО сотрудника.');
        if (!/^\S+@\S+\.\S+$/.test(email.trim())) throw new Error('Укажите корректный email.');
        if (password.length < 6) throw new Error('Пароль должен содержать не меньше 6 символов.');
        user = await createUser({ name: name.trim(), email: email.trim(), password, role: 'CLIENT', type: 'individual', status: 'active' });
      }
      if (!user) throw new Error('Выберите существующий аккаунт.');
      const member = await documentFlowApi.createMember({ organizationId, userId: user.id, role });
      return { member, credentials: mode === 'new' ? { email: email.trim(), password } : null };
    },
    onSuccess: async ({ credentials }) => {
      setCreatedCredentials(credentials);
      setSelectedUser(null); setName(''); setEmail(''); setPassword('');
      await invalidate();
    },
  });
  const activate = useMutation({
    mutationFn: (member: DocumentFlowMember) => documentFlowApi.activateMember(member.id, organizationId),
    onSuccess: invalidate,
  });
  const error = addMember.isError ? mapDocumentFlowError(addMember.error) : null;

  return <Dialog open={open} onClose={() => !addMember.isPending && onClose()} fullWidth maxWidth="md">
    <DialogTitle>Сотрудники · {organization?.name}</DialogTitle>
    <DialogContent><Stack spacing={2} mt={1}>
      <Alert severity="info">Подписка организации и аккаунт сотрудника — разные сущности. Здесь создаётся или выбирается аккаунт, затем он добавляется в организацию.</Alert>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant={mode === 'new' ? 'contained' : 'outlined'} onClick={() => { setMode('new'); setCreatedCredentials(null); }}>Создать новый аккаунт</Button>
        <Button variant={mode === 'existing' ? 'contained' : 'outlined'} onClick={() => { setMode('existing'); setCreatedCredentials(null); }}>Выбрать существующий</Button>
      </Stack>
      {mode === 'new' ? <Stack spacing={2}>
        <TextField required label="ФИО сотрудника" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField required type="email" label="Email для входа" value={email} onChange={(event) => setEmail(event.target.value)} />
        <TextField required type="password" label="Временный пароль" value={password} onChange={(event) => setPassword(event.target.value)} helperText="Передайте email и пароль сотруднику безопасным способом" />
      </Stack> : <Autocomplete
        options={availableUsers} value={selectedUser} onChange={(_, value) => setSelectedUser(value)} loading={users.isFetching}
        getOptionLabel={(option) => `${option.name || option.fullName || option.email} · ${option.email} · ${option.role} · ID ${option.id}`}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => <TextField {...params} required label="Существующий аккаунт" helperText="Можно выбрать сотрудника EcoProgress или клиентский аккаунт, ещё не добавленный в организацию" InputProps={{ ...params.InputProps, endAdornment: <>{users.isFetching && <CircularProgress size={18} />}{params.InputProps.endAdornment}</> }} />}
      />}
      <TextField select required label="Роль в документообороте" value={role} onChange={(event) => setRole(event.target.value as MembershipRole)}>{roleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</TextField>
      {error && <Alert severity={error.status === 409 ? 'warning' : 'error'}>{error.message}{error.traceId && <Typography variant="caption" component="div">Trace ID: {error.traceId}</Typography>}</Alert>}
      {createdCredentials && <Alert severity="success"><Typography fontWeight={700}>Аккаунт создан и добавлен.</Typography><Typography>Email: {createdCredentials.email}</Typography><Typography>Временный пароль: {createdCredentials.password}</Typography><Typography variant="caption">Скопируйте данные сейчас. После закрытия окна пароль больше не показывается.</Typography></Alert>}
      <Typography variant="h6" fontWeight={800} mt={1}>Участники организации</Typography>
      {members.isLoading && <Stack alignItems="center" py={3}><CircularProgress /></Stack>}
      {members.isError && <Alert severity="error">{mapDocumentFlowError(members.error).message}</Alert>}
      {members.isSuccess && members.data.items.length === 0 && <Alert severity="info">Участников пока нет.</Alert>}
      {members.isSuccess && members.data.items.length > 0 && <Table size="small"><TableHead><TableRow><TableCell>Сотрудник</TableCell><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell align="right">Действие</TableCell></TableRow></TableHead><TableBody>{members.data.items.map((member) => <TableRow key={member.id}><TableCell>{member.fullName || `Пользователь #${member.userId}`}</TableCell><TableCell>{member.email || '—'}</TableCell><TableCell>{roleOptions.find((item) => item.value === member.role)?.label ?? member.role}</TableCell><TableCell><Chip size="small" label={member.status} color={member.status === 'ACTIVE' ? 'success' : 'default'} /></TableCell><TableCell align="right">{member.status !== 'ACTIVE' && <Button size="small" disabled={activate.isPending} onClick={() => activate.mutate(member)}>Активировать</Button>}</TableCell></TableRow>)}</TableBody></Table>}
      {activate.isError && <Alert severity="error">{mapDocumentFlowError(activate.error).message}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button disabled={addMember.isPending} onClick={onClose}>Закрыть</Button><Button variant="contained" disabled={addMember.isPending || (mode === 'existing' ? !selectedUser : !name.trim() || !email.trim() || password.length < 6)} onClick={() => addMember.mutate()}>{addMember.isPending ? 'Добавление…' : 'Добавить сотрудника'}</Button></DialogActions>
  </Dialog>;
}
