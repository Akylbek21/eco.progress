import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Button from '../ui/Button';
import { createMembership, deleteMembership, getMemberships, updateMembership } from '../../services/membershipService';
import type { CompanyMembership, MembershipStatus } from '../../types/memberships';

type Props = {
  scope: 'companies' | 'pek';
  companyId: string | number;
  canView: boolean;
  canManage: boolean;
};

const MembershipAccessPanel = ({ scope, companyId, canView, canManage }: Props) => {
  const queryClient = useQueryClient();
  const key = ['memberships', scope, String(companyId)] as const;
  const members = useQuery({ queryKey: key, queryFn: ({ signal }) => getMemberships(scope, companyId, signal), enabled: canView && Boolean(companyId) });
  const [editing, setEditing] = useState<CompanyMembership | null>(null);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<MembershipStatus>('ACTIVE');
  useEffect(() => {
    if (!editing) return;
    setUserId(String(editing.userId)); setRole(editing.role); setStatus(editing.status);
  }, [editing]);
  const reload = async () => {
    const actual = await getMemberships(scope, companyId);
    queryClient.setQueryData(key, actual);
    return actual;
  };
  const save = useMutation({ mutationFn: async () => {
    if (editing) await updateMembership(scope, companyId, editing.id, { role: role.trim(), status });
    else await createMembership(scope, companyId, { userId: Number(userId), role: role.trim(), status });
    await reload();
  }, onSuccess: () => { setEditing(null); setUserId(''); setRole(''); setStatus('ACTIVE'); } });
  const remove = useMutation({ mutationFn: async (id: number) => { await deleteMembership(scope, companyId, id); await reload(); } });
  const serverCanManage = scope === 'pek' && (
    members.data?.availableActions.manageMembers === true
    || members.data?.availableActions.manageMemberships === true
  );
  const effectiveCanManage = canManage || serverCanManage;
  const backendCanCreate = members.data?.availableActions.create === true || members.data?.availableActions.addMember === true;
  const mayCreate = effectiveCanManage && (Object.keys(members.data?.availableActions || {}).length === 0 || backendCanCreate || serverCanManage);
  const pending = save.isPending || remove.isPending;
  if (!canView) return null;
  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div><h2 className="font-black">Сотрудники / Доступ</h2><p className="text-sm text-slate-500">Роли и состояние доступа хранятся в backend membership.</p></div>
    {(save.error || remove.error) && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Не удалось изменить доступ сотрудника.</p>}
    {mayCreate && <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-4"><label className="text-sm font-semibold">ID сотрудника<input className="mt-1 w-full rounded-lg border p-2" type="number" min="1" value={userId} disabled={Boolean(editing)} onChange={(event) => setUserId(event.target.value)} /></label><label className="text-sm font-semibold">Роль<input className="mt-1 w-full rounded-lg border p-2" value={role} onChange={(event) => setRole(event.target.value)} /></label><label className="text-sm font-semibold">Статус<select className="mt-1 w-full rounded-lg border p-2" value={status} onChange={(event) => setStatus(event.target.value as MembershipStatus)}><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></label><div className="flex items-end gap-2"><Button type="button" disabled={pending || !userId || !role.trim()} onClick={() => save.mutate()}>{editing ? 'Сохранить' : 'Добавить'}</Button>{editing && <Button type="button" variant="secondary" onClick={() => { setEditing(null); setUserId(''); setRole(''); setStatus('ACTIVE'); }}>Отмена</Button>}</div></div>}
    {members.isLoading ? <p className="text-sm text-slate-500">Загрузка сотрудников…</p> : members.isError ? <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800">Не удалось загрузить сотрудников. <button className="underline" onClick={() => void members.refetch()}>Повторить</button></div> : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Сотрудник</th><th>Email</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>{members.data?.items.map((item) => {
      const memberActionsKnown = Object.keys(item.availableActions).length > 0;
      const mayEdit = effectiveCanManage && (!memberActionsKnown || item.availableActions.edit === true || item.availableActions.update === true);
      const mayDelete = effectiveCanManage && (!memberActionsKnown || item.availableActions.delete === true || item.availableActions.deactivate === true);
      return <tr key={item.id} className="border-t"><td className="p-3 font-semibold">{item.fullName}</td><td>{item.email || '—'}</td><td>{item.role || '—'}</td><td>{item.status}</td><td><div className="flex gap-2">{mayEdit && <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(item)}>Изменить</Button>}{mayDelete && <Button type="button" variant="danger" disabled={pending} onClick={() => remove.mutate(item.id)}>Удалить доступ</Button>}</div></td></tr>;
    })}{!members.data?.items.length && <tr><td className="p-6 text-center text-slate-500" colSpan={5}>Сотрудники не добавлены</td></tr>}</tbody></table></div>}
  </section>;
};

export default MembershipAccessPanel;
