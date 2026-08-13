import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CompanyListItem } from '../../../types/companies';
import { listUsers, type AdminUserRecord } from '../../../services/adminUserService';
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
  const [mode, setMode] = useState<'existing' | 'invite'>('invite');
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [role, setRole] = useState<MembershipRole>('VIEWER');
  const [invitationSent, setInvitationSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode('invite'); setSelectedUser(null); setRole('VIEWER'); setInviteEmail(''); setInvitationSent(false);
  }, [open, organizationId]);

  const members = useQuery({
    queryKey: documentFlowKeys.members(organizationId, { admin: true, page: 0, size: 50 }),
    queryFn: ({ signal }) => documentFlowApi.members({ organizationId, page: 0, size: 50, sort: 'fullName,asc', signal }),
    enabled: open && organizationId > 0,
    retry: false,
  });
  const users = useQuery({ 
    queryKey: ['admin', 'users', 'paginated'], 
    queryFn: () => listUsers({ limit: 1000 }), 
    enabled: open && mode === 'existing', 
    retry: false 
  });
  const existingUserIds = useMemo(() => new Set((members.data?.items ?? []).map((member) => member.userId)), [members.data]);
  const availableUsers = useMemo(() => (users.data?.items ?? []).filter((user) => user.status !== 'blocked' && !existingUserIds.has(user.id)), [existingUserIds, users.data]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.memberLists(organizationId) }),
      queryClient.invalidateQueries({ queryKey: documentFlowKeys.access(organizationId) }),
    ]);
  };

  const addExistingMember = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error('Выберите существующий аккаунт.');
      await documentFlowApi.createMember({ email: selectedUser.email, role });
      return { member: null, invited: false };
    },
    onSuccess: async () => {
      setSelectedUser(null);
      await invalidate();
    },
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
      if (!inviteEmail.trim()) throw new Error('Укажите email сотрудника.');
      if (!/^\S+@\S+\.\S+$/.test(inviteEmail.trim())) throw new Error('Укажите корректный email.');
      await documentFlowApi.inviteMember({ email: inviteEmail.trim(), role }, organizationId);
      return { invited: true };
    },
    onSuccess: async () => {
      setInvitationSent(true);
      setInviteEmail('');
      setTimeout(() => setInvitationSent(false), 4000);
      await invalidate();
    },
  });

  const activate = useMutation({
    mutationFn: (member: DocumentFlowMember) => documentFlowApi.activateMember(member.id, organizationId),
    onSuccess: invalidate,
  });

  const error = (addExistingMember.isError || inviteMember.isError) ? (addExistingMember.error || inviteMember.error) : null;
  const mappedError = error ? mapDocumentFlowError(error as any) : null;

  return <Dialog open={open} onClose={() => !(addExistingMember.isPending || inviteMember.isPending) && onClose()} fullWidth maxWidth="md">
    <DialogTitle>Сотрудники · {organization?.name}</DialogTitle>
    <DialogContent><Stack spacing={2} mt={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant={mode === 'invite' ? 'contained' : 'outlined'} onClick={() => { setMode('invite'); setInvitationSent(false); }}>Пригласить по email</Button>
        <Button variant={mode === 'existing' ? 'contained' : 'outlined'} onClick={() => { setMode('existing'); setInvitationSent(false); }}>Добавить существующего</Button>
      </Stack>

      {mode === 'invite' ? <Stack spacing={2}>
        <TextField 
          required 
          type="email" 
          label="Email для приглашения" 
          value={inviteEmail} 
          onChange={(event) => setInviteEmail(event.target.value)} 
          placeholder="example@company.com"
          helperText="Приглашение будет отправлено на этот адрес"
        />
        <TextField 
          select 
          required 
          label="Роль в документообороте" 
          value={role} 
          onChange={(event) => setRole(event.target.value as MembershipRole)}
        >
          {roleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        {mappedError && <Alert severity="error">{mappedError.message}</Alert>}
        {invitationSent && <Alert severity="success">Приглашение отправлено на {inviteEmail}</Alert>}
      </Stack> : <Stack spacing={2}>
        <Autocomplete
          options={availableUsers} 
          value={selectedUser} 
          onChange={(_, value) => setSelectedUser(value)} 
          loading={users.isFetching}
          getOptionLabel={(option) => `${option.name || option.fullName || option.email} · ${option.email} · ${option.role}`}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          renderInput={(params) => <TextField 
            {...params} 
            required 
            label="Существующий аккаунт" 
            helperText="Выберите из доступных пользователей в системе"
            InputProps={{ ...params.InputProps, endAdornment: <>{users.isFetching && <CircularProgress size={18} />}{params.InputProps.endAdornment}</> }} 
          />}
        />
        <TextField 
          select 
          required 
          label="Роль в документообороте" 
          value={role} 
          onChange={(event) => setRole(event.target.value as MembershipRole)}
        >
          {roleOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        {mappedError && <Alert severity="error">{mappedError.message}</Alert>}
      </Stack>}

      <Typography variant="h6" fontWeight={800} mt={1}>Участники организации</Typography>
      {members.isLoading && <Stack alignItems="center" py={3}><CircularProgress /></Stack>}
      {members.isError && <Alert severity="error">{mapDocumentFlowError(members.error as any).message}</Alert>}
      {members.isSuccess && members.data.items.length === 0 && <Alert severity="info">Участников пока нет.</Alert>}
      {members.isSuccess && members.data.items.length > 0 && <Table size="small"><TableHead><TableRow><TableCell>Сотрудник</TableCell><TableCell>Email</TableCell><TableCell>Роль</TableCell><TableCell>Статус</TableCell><TableCell align="right">Действие</TableCell></TableRow></TableHead><TableBody>{members.data.items.map((member) => <TableRow key={member.id}><TableCell>{member.fullName || `Пользователь #${member.userId}`}</TableCell><TableCell>{member.email || '—'}</TableCell><TableCell>{roleOptions.find((item) => item.value === member.role)?.label ?? member.role}</TableCell><TableCell><Chip size="small" label={member.status} color={member.status === 'ACTIVE' ? 'success' : member.status === 'INVITED' ? 'info' : 'default'} /></TableCell><TableCell align="right">{member.status !== 'ACTIVE' && <Button size="small" disabled={activate.isPending} onClick={() => activate.mutate(member)}>Активировать</Button>}</TableCell></TableRow>)}</TableBody></Table>}
      {activate.isError && <Alert severity="error">{mapDocumentFlowError(activate.error as any).message}</Alert>}
    </Stack></DialogContent>
    <DialogActions>
      <Button disabled={addExistingMember.isPending || inviteMember.isPending} onClick={onClose}>Закрыть</Button>
      {mode === 'invite' ? <Button 
        variant="contained" 
        disabled={inviteMember.isPending || !inviteEmail.trim()} 
        onClick={() => inviteMember.mutate()}
      >
        {inviteMember.isPending ? 'Отправка…' : 'Пригласить'}
      </Button> : <Button 
        variant="contained" 
        disabled={addExistingMember.isPending || !selectedUser} 
        onClick={() => addExistingMember.mutate()}
      >
        {addExistingMember.isPending ? 'Добавление…' : 'Добавить'}
      </Button>}
    </DialogActions>
  </Dialog>;
}
