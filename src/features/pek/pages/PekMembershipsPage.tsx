import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekAddMembershipRequest, PekCompanyMembership, PekMembershipStatus, PekUpdateMembershipRequest } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { usePekScope } from '../hooks/usePekScope';
import { mapPekError } from '../utils/pekErrorMapper';
import { retryPekQuery } from '../utils/pekQueryPolicy';

const roles = ['ADMIN', 'DIRECTOR', 'HEAD', 'MANAGER', 'ACCOUNTANT', 'ECOLOGIST', 'LABORATORY', 'WASTE_SPECIALIST'];
const statusLabels: Record<PekMembershipStatus, string> = { ACTIVE: 'Активен', INVITED: 'Приглашён', REMOVED: 'Деактивирован' };

const PekMembershipsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const companyId = Number(params.get('companyId')) || 0;
  const scope = usePekScope(companyId || undefined);
  const company = scope.companies.find((item) => item.id === companyId);
  const key = pekKeys.memberships(companyId, user?.id);
  const memberships = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => pekApi.getPekMemberships(companyId, signal),
    enabled: companyId > 0 && scope.companyAllowed,
    retry: retryPekQuery,
  });
  const canManage = memberships.data?.some((membership) =>
    membership.availableActions?.add === true
    || membership.availableActions?.edit === true
    || membership.availableActions?.deactivate === true
    || membership.companyPermissions?.PEK_MEMBERS_MANAGE === true
  ) === true;
  const [editing, setEditing] = useState<PekCompanyMembership | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: key });
    await memberships.refetch();
  };
  const onMutationError = async (failure: unknown) => {
    const mapped = mapPekError(failure);
    setError(mapped.message);
    setFieldErrors(mapped.fieldErrors);
    if (mapped.status === 409) await refresh();
  };
  const add = useMutation({
    mutationFn: (body: PekAddMembershipRequest) => pekApi.addPekMembership(companyId, body),
    onSuccess: async () => { setError(''); setFieldErrors({}); await refresh(); },
    onError: onMutationError,
    retry: false,
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: PekUpdateMembershipRequest }) => pekApi.updatePekMembership(companyId, id, body),
    onSuccess: async () => { setEditing(null); setError(''); setFieldErrors({}); await refresh(); },
    onError: onMutationError,
    retry: false,
  });
  const deactivate = useMutation({
    mutationFn: ({ id, version }: { id: number; version: number }) => pekApi.deactivatePekMembership(companyId, id, version),
    onSuccess: refresh,
    onError: onMutationError,
    retry: false,
  });
  const pending = add.isPending || update.isPending || deactivate.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const roleCode = String(form.get('roleCode') || '');
    if (editing) update.mutate({ id: editing.id, body: { version: editing.version, roleCode, status: String(form.get('status')) as PekMembershipStatus } });
    else add.mutate({ email: String(form.get('email') || '').trim(), roleCode });
  };

  return <div className="space-y-5">
    <PekPageHeader title="Сотрудники / Доступ ПЭК" description="Управление членством сотрудников в PEK scope компании" />
    <>
      <section className="rounded-2xl border bg-white p-4">
        <label className="block max-w-xl text-sm font-semibold">Компания
          <input type="number" min="1" list="pek-membership-companies" value={companyId || ''} onChange={(event) => setParams(event.target.value ? { companyId: event.target.value } : {}, { replace: true })} placeholder="Выберите или укажите ID компании" className="mt-1 w-full rounded-xl border p-3" />
          <datalist id="pek-membership-companies">{scope.companies.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</datalist>
        </label>
      </section>
      {!companyId
        ? <PekState title="Выберите компанию" message="Список доступных компаний загружается из общего CRM-справочника." />
        : !scope.companyAllowed
          ? null
          : <section className="space-y-4 rounded-2xl border bg-white p-5">
            <div><h2 className="font-black">{company?.name || `Компания №${companyId}`}</h2><p className="text-sm text-slate-500">Сотрудники, роли и статус доступа к ПЭК</p></div>
            {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p>{Object.entries(fieldErrors).map(([field, message]) => <p key={field} className="mt-1">{field}: {message}</p>)}</div>}
            {canManage && <form key={editing?.id || 'new'} onSubmit={submit} className="grid gap-3 rounded-xl border p-4 md:grid-cols-4">
              <label className="text-sm font-semibold">Email сотрудника
                <input name="email" type="email" required={!editing} disabled={Boolean(editing)} defaultValue={editing?.userEmail || ''} className="mt-1 w-full rounded-lg border p-2 disabled:bg-slate-100" />
              </label>
              <label className="text-sm font-semibold">Роль
                <select name="roleCode" required defaultValue={editing?.roleCode || 'ECOLOGIST'} className="mt-1 w-full rounded-lg border p-2">{roles.map((role) => <option key={role}>{role}</option>)}</select>
              </label>
              {editing ? <label className="text-sm font-semibold">Статус
                <select name="status" defaultValue={editing.status} className="mt-1 w-full rounded-lg border p-2"><option value="ACTIVE">Активен</option><option value="INVITED">Приглашён</option><option value="REMOVED">Деактивирован</option></select>
              </label> : <div />}
              <div className="flex items-end gap-2"><Button type="submit" disabled={pending}>{editing ? 'Сохранить' : 'Добавить'}</Button>{editing && <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>}</div>
            </form>}
            {memberships.isLoading ? <PekLoading /> : memberships.isError ? <PekQueryError error={memberships.error} resource="PEK memberships" retry={() => void memberships.refetch()} /> : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Компания</th><th>Сотрудник</th><th>Email</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead><tbody>{memberships.data?.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{company?.name || `№${item.companyId}`}</td><td className="font-semibold">{item.userFullName || `Сотрудник №${item.userId}`}</td><td>{item.userEmail || '—'}</td><td>{item.roleCode}</td><td>{statusLabels[item.status]}</td><td>{canManage && <div className="flex gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(item)}>Изменить</Button>{item.status !== 'REMOVED' && <Button type="button" variant="danger" disabled={pending} onClick={() => { if (window.confirm(`Деактивировать доступ ${item.userFullName || item.userEmail || item.userId}?`)) deactivate.mutate({ id: item.id, version: item.version }); }}>Деактивировать</Button>}</div>}</td></tr>)}{!memberships.data?.length && <tr><td colSpan={6} className="p-6 text-center text-slate-500">Сотрудники не добавлены</td></tr>}</tbody></table></div>}
          </section>}
    </>
  </div>;
};

export default PekMembershipsPage;
