import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ConfirmModal from '../../../components/modals/ConfirmModal';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../contexts/AuthContext';
import useToast from '../../../hooks/useToast';
import type { PekProgram, PekProgramFilters, PekProgramStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import EntityName from '../components/common/EntityName';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekReadiness, PekState, PekStatusBadge } from '../components/common/PekUi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { canCreateProgram, canDeleteProgram } from '../permissions/pekAccess';
import { mapPekError } from '../utils/pekErrorMapper';
import { pekStatusLabels } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const statuses: PekProgramStatus[] = ['DRAFT', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'ACTIVE', 'ARCHIVED'];

const PekProgramsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [deleting, setDeleting] = useState<PekProgram | null>(null);
  const [params, setParams] = useSearchParams();
  const rawSearch = params.get('search') || '';
  const filters: PekProgramFilters = {
    search: useDebouncedValue(rawSearch, 400) || undefined,
    companyId: Number(params.get('companyId')) || undefined,
    objectId: Number(params.get('objectId')) || undefined,
    status: (params.get('status') || undefined) as PekProgramStatus | undefined,
    activeOn: params.get('activeOn') || undefined,
    responsibleUserId: Number(params.get('responsibleUserId')) || undefined,
    page: Number(params.get('page')) || 0,
    size: Number(params.get('size')) || 20,
    sort: params.get('sort') || 'updatedAt,desc',
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key === 'companyId') {
      next.delete('objectId');
      void queryClient.cancelQueries({ queryKey: pekKeys.all });
    }
    if (key !== 'page') next.set('page', '0');
    setParams(next, { replace: true });
  };
  const programs = useQuery({
    queryKey: pekKeys.programList(filters),
    queryFn: ({ signal }) => pekApi.getPrograms(filters, signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(filters.companyId || 0, ['PEK_RESPONSIBLE'], user?.id),
    queryFn: ({ signal }) => pekApi.getAssignees(filters.companyId!, ['PEK_RESPONSIBLE'], signal),
    enabled: Boolean(filters.companyId),
    retry: retryPekQuery,
  });
  const removeProgram = useMutation({
    mutationFn: (program: PekProgram) => pekApi.deleteProgram(program.id, program.version),
    onSuccess: async (_, program) => {
      setDeleting(null);
      queryClient.removeQueries({ queryKey: pekKeys.programDetail(program.company?.id, program.id) });
      await queryClient.invalidateQueries({ queryKey: pekKeys.programsRoot() });
      toast.success(`Программа «${program.number}» удалена`);
    },
    onError: (error) => toast.error(mapPekError(error).message),
  });
  const hasFilters = Boolean(rawSearch || filters.companyId || filters.objectId || filters.status || filters.activeOn || filters.responsibleUserId);

  return <div className="space-y-5">
    <PekPageHeader
      title="Программы ПЭК"
      description="Программы производственного экологического контроля"
      actions={canCreateProgram(user)
        ? <Link to="/staff/pek/programs/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать программу</Link>
        : undefined}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4 xl:grid-cols-8">
      <label className="text-xs font-bold text-slate-600">Поиск
        <input aria-label="Поиск программ" value={rawSearch} onChange={(event) => update('search', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Номер или название" />
      </label>
      <PekCompanyObjectFilters companyId={filters.companyId} objectId={filters.objectId} onCompanyChange={(value) => update('companyId', value)} onObjectChange={(value) => update('objectId', value)} />
      <label className="text-xs font-bold text-slate-600">Статус
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">Все</option>{statuses.map((status) => <option key={status} value={status}>{pekStatusLabels[status]}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-600">Действует на
        <input type="date" value={filters.activeOn || ''} onChange={(event) => update('activeOn', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <PekLookupSelect label="Ответственный" value={filters.responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => update('responsibleUserId', value ? String(value) : '')} />
      <label className="text-xs font-bold text-slate-600">Сортировка
        <select value={filters.sort} onChange={(event) => update('sort', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="updatedAt,desc">Сначала изменённые</option>
          <option value="number,asc">По номеру</option>
          <option value="validFrom,desc">По периоду</option>
        </select>
      </label>
      <button type="button" onClick={() => setParams({}, { replace: true })} className="self-end rounded-xl border px-3 py-2 text-sm font-bold">Сбросить</button>
    </section>
    {programs.isLoading
      ? <PekLoading />
      : programs.isError
        ? <PekQueryError error={programs.error} resource="Программы ПЭК" retry={() => void programs.refetch()} />
        : !programs.data?.content.length
          ? <PekState
              title={hasFilters ? 'По выбранным фильтрам программ нет' : 'Программы ПЭК ещё не созданы'}
              message={hasFilters ? 'Измените или сбросьте фильтры.' : 'Создайте первую программу ПЭК.'}
            />
          : <>
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-slate-50 text-left"><tr>
                  {['Номер', 'Название', 'Компания', 'Объект', 'Период действия', 'Версия', 'Ответственный', 'Статус', 'Готовность', 'Последнее изменение', 'Действия'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
                </tr></thead>
                <tbody>{programs.data.content.map((item) => <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-bold">{item.number}</td>
                  <td className="px-4 py-3">{item.name}</td>
                  <td className="px-4 py-3"><EntityName value={item.company} fallback="—" /></td>
                  <td className="px-4 py-3"><EntityName value={item.object} fallback="—" /></td>
                  <td className="px-4 py-3">{item.validFrom} — {item.validUntil}</td>
                  <td className="px-4 py-3">{item.version}</td>
                  <td className="px-4 py-3">{item.responsible?.name || '—'}</td>
                  <td className="px-4 py-3"><PekStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3"><PekReadiness value={item.readinessPercent} /></td>
                  <td className="px-4 py-3">{item.updatedAt || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link className="font-bold text-eco-700" to={`/staff/pek/programs/${item.id}?companyId=${item.company?.id || filters.companyId || ''}`}>Открыть</Link>
                      {canDeleteProgram(user, item) && (
                        <Button type="button" variant="danger" className="min-h-0 px-3 py-1.5" onClick={() => setDeleting(item)}>
                          Удалить
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>)}</tbody>
              </table>
            </div>
            <div className="flex items-center justify-between">
              <button type="button" disabled={!filters.page} onClick={() => update('page', String((filters.page || 0) - 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Назад</button>
              <span>Страница {(filters.page || 0) + 1} из {programs.data.totalPages || 1}</span>
              <button type="button" disabled={(filters.page || 0) + 1 >= programs.data.totalPages} onClick={() => update('page', String((filters.page || 0) + 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Далее</button>
            </div>
          </>}
    <ConfirmModal
      isOpen={Boolean(deleting)}
      title="Удалить программу ПЭК?"
      description={deleting ? `Программа «${deleting.number} — ${deleting.name}» будет удалена без возможности восстановления.` : undefined}
      confirmText="Удалить"
      variant="danger"
      loading={removeProgram.isPending}
      onClose={() => { if (!removeProgram.isPending) setDeleting(null); }}
      onConfirm={() => { if (deleting) removeProgram.mutate(deleting); }}
    />
  </div>;
};

export default PekProgramsPage;
