import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useState } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekStaffAssignment, PekStaffStatus, PekStaffTier } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';

const tierLabels: Record<PekStaffTier, string> = { VIEWER: 'Просмотр', EDITOR: 'Редактирование', REVIEWER: 'Проверка и согласование' };
const statusLabels: Record<PekStaffStatus, string> = { ACTIVE: 'Активен', INACTIVE: 'Отключён' };

const PekCompanyStaff = ({ companyId, editable }: { companyId: number; editable: boolean }) => {
  const { user } = useAuth();
  const client = useQueryClient();
  const queryKey = pekKeys.companyStaff(companyId, user?.id);
  const staff = useQuery({ queryKey, queryFn: ({ signal }) => pekApi.getCompanyStaff(companyId, signal) });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PekStaffAssignment | null>(null);
  const [deleting, setDeleting] = useState<PekStaffAssignment | null>(null);
  const [email, setEmail] = useState('');
  const [tier, setTier] = useState<PekStaffTier>('VIEWER');
  const [status, setStatus] = useState<PekStaffStatus>('ACTIVE');
  const refresh = () => client.invalidateQueries({ queryKey });
  const assign = useMutation({ mutationFn: () => pekApi.assignCompanyStaff(companyId, { email: email.trim(), tier }), onSuccess: async () => { setCreating(false); setEmail(''); await refresh(); } });
  const update = useMutation({ mutationFn: () => pekApi.updateCompanyStaff(companyId, editing!.id, editing!.version, { tier, status }), onSuccess: async () => { setEditing(null); await refresh(); } });
  const remove = useMutation({ mutationFn: () => pekApi.removeCompanyStaff(companyId, deleting!.id, deleting!.version), onSuccess: async () => { setDeleting(null); await refresh(); } });
  const openEdit = (item: PekStaffAssignment) => { setTier(item.tier); setStatus(item.status); setEditing(item); };

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Сотрудники ПЭК</h2><p className="text-sm text-slate-500">Доступ сотрудников к данным выбранной компании.</p></div>{editable && <Button variant="contained" onClick={() => { setEmail(''); setTier('VIEWER'); setCreating(true); }}>Назначить сотрудника</Button>}</div>
    <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3"><p><strong>Просмотр</strong><br />Только чтение данных</p><p><strong>Редактирование</strong><br />Программы и рабочие данные</p><p><strong>Проверка</strong><br />Согласование и контроль</p></div>
    {staff.isLoading && <p className="text-sm text-slate-500">Загрузка сотрудников…</p>}
    {staff.isError && <Alert severity="error">{mapPekError(staff.error).message}</Alert>}
    {staff.data && !staff.data.length && <Alert severity="info">Сотрудники ПЭК для компании ещё не назначены.</Alert>}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Сотрудник</th><th className="p-3">Email</th><th className="p-3">Уровень</th><th className="p-3">Статус</th><th className="p-3">Действия</th></tr></thead><tbody>{staff.data?.map((item) => <tr key={item.id} className="border-t"><td className="p-3 font-semibold">{item.userFullName}</td><td className="p-3">{item.userEmail}</td><td className="p-3">{tierLabels[item.tier]}</td><td className="p-3">{statusLabels[item.status]}</td><td className="p-3">{editable && <div className="flex gap-2"><Button size="small" onClick={() => openEdit(item)}>Изменить</Button><Button size="small" color="error" onClick={() => setDeleting(item)}>Снять</Button></div>}</td></tr>)}</tbody></table></div>
    <Dialog open={creating} onClose={() => !assign.isPending && setCreating(false)} fullWidth maxWidth="sm"><DialogTitle>Назначить сотрудника</DialogTitle><DialogContent><div className="mt-2 grid gap-4"><TextField type="email" label="Email сотрудника *" value={email} onChange={(event) => setEmail(event.target.value)} /><TextField select label="Уровень доступа" value={tier} onChange={(event) => setTier(event.target.value as PekStaffTier)}>{Object.entries(tierLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>{assign.isError && <Alert severity="error">{mapPekError(assign.error).message}</Alert>}</div></DialogContent><DialogActions><Button onClick={() => setCreating(false)}>Отмена</Button><Button variant="contained" disabled={assign.isPending || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => assign.mutate()}>Назначить</Button></DialogActions></Dialog>
    <Dialog open={Boolean(editing)} onClose={() => !update.isPending && setEditing(null)} fullWidth maxWidth="sm"><DialogTitle>Доступ сотрудника</DialogTitle><DialogContent><div className="mt-2 grid gap-4"><TextField select label="Уровень доступа" value={tier} onChange={(event) => setTier(event.target.value as PekStaffTier)}>{Object.entries(tierLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><TextField select label="Статус" value={status} onChange={(event) => setStatus(event.target.value as PekStaffStatus)}>{Object.entries(statusLabels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>{update.isError && <Alert severity="error">{mapPekError(update.error).message}</Alert>}</div></DialogContent><DialogActions><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="contained" disabled={update.isPending} onClick={() => update.mutate()}>Сохранить</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !remove.isPending && setDeleting(null)}><DialogTitle>Снять назначение сотрудника?</DialogTitle><DialogContent><p>{deleting?.userFullName} потеряет доступ к ПЭК выбранной компании.</p>{remove.isError && <Alert className="mt-3" severity="error">{mapPekError(remove.error).message}</Alert>}</DialogContent><DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={remove.isPending} onClick={() => remove.mutate()}>Снять назначение</Button></DialogActions></Dialog>
  </section>;
};

export default PekCompanyStaff;
