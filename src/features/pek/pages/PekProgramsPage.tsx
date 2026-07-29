import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { PekProgramFilters, PekProgramStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekReadiness, PekState, PekStatusBadge } from '../components/common/PekUi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { primaryPekAction } from '../utils/pekActions';
import { pekStatusLabels } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import EntityName from '../components/common/EntityName';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission } from '../../../config/permissions';

const statuses: PekProgramStatus[] = ['DRAFT', 'UNDER_REVIEW', 'RETURNED', 'APPROVED', 'ACTIVE', 'ARCHIVED'];

const PekProgramsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const rawSearch = params.get('search') || '';
  const search = useDebouncedValue(rawSearch);
  const filters: PekProgramFilters = {
    search: search || undefined,
    companyId: Number(params.get('companyId')) || undefined,
    objectId: Number(params.get('objectId')) || undefined,
    status: (params.get('status') || undefined) as PekProgramStatus | undefined,
    activeOn: params.get('activeOn') || undefined,
    page: Number(params.get('page')) || 0,
    size: Number(params.get('size')) || 20,
    sort: params.get('sort') || 'updatedAt,desc',
  };
  const query = useQuery({
    queryKey: pekKeys.programs(filters),
    queryFn: ({ signal }) => pekService.getPrograms(filters, signal),
    placeholderData: keepPreviousData,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '0');
    setParams(next, { replace: true });
  };

  return <div className="space-y-5">
    <PekPageHeader
      title="Программы ПЭК"
      description="Планы производственного экологического контроля"
      actions={hasPermission(user, 'PEK_PROGRAM_CREATE') ? <Link to="/staff/pek/programs/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать программу ПЭК</Link> : undefined}
    />
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
      <label className="text-xs font-bold text-slate-600">Поиск
        <input aria-label="Поиск программ" placeholder="Номер или название" value={rawSearch} onChange={(event) => update('search', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </label>
      <PekCompanyObjectFilters companyId={filters.companyId} objectId={filters.objectId} onCompanyChange={(value) => update('companyId', value)} onObjectChange={(value) => update('objectId', value)} />
      <label className="text-xs font-bold text-slate-600">Статус
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
          <option value="">Все статусы</option>
          {statuses.map((status) => <option key={status} value={status}>{pekStatusLabels[status]}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-600">Действует на дату
        <input type="date" value={filters.activeOn || ''} onChange={(event) => update('activeOn', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </label>
    </section>
    {query.isLoading
      ? <PekLoading />
      : query.isError
        ? <PekQueryError error={query.error} resource="Программы ПЭК" retry={() => void query.refetch()} />
        : !query.data?.content.length
          ? <PekState title="Программы по выбранным условиям не найдены" message="Измените фильтры или создайте новую программу ПЭК." />
          : <>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[1180px] text-sm">
                  <thead className="bg-slate-50 text-left"><tr>{['Номер', 'Название', 'Компания', 'Объект', 'Версия', 'Период', 'Статус', 'Ответственный', 'Позиций', 'Готовность', 'Изменено', 'Действие'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                  <tbody>{query.data.content.map((item) => {
                    const action = primaryPekAction((item.availableActions || []).filter((candidate) => candidate.code !== 'EDIT'));
                    return <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-bold">{item.number}</td>
                      <td className="px-4 py-3">{item.name}</td>
                      <td className="px-4 py-3"><EntityName value={item.company} fallback="Компания не указана" /></td>
                      <td className="px-4 py-3"><EntityName value={item.object} fallback="Объект не указан" /></td>
                      <td className="px-4 py-3">{item.version}</td>
                      <td className="px-4 py-3">{item.validFrom} — {item.validUntil}</td>
                      <td className="px-4 py-3"><PekStatusBadge status={item.status} /></td>
                      <td className="px-4 py-3">{item.responsible?.name || '—'}</td>
                      <td className="px-4 py-3">{item.controlItems?.length ?? '—'}</td>
                      <td className="px-4 py-3"><PekReadiness value={item.readinessPercent} /></td>
                      <td className="px-4 py-3">{item.updatedAt || '—'}</td>
                      <td className="px-4 py-3"><Link className="font-bold text-eco-700" to={`/staff/pek/programs/${item.id}`}>{action?.label || 'Открыть'}</Link></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <button type="button" disabled={!filters.page} onClick={() => update('page', String((filters.page || 0) - 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Назад</button>
                <span>Страница {(filters.page || 0) + 1} из {query.data.totalPages || 1}</span>
                <button type="button" disabled={(filters.page || 0) + 1 >= query.data.totalPages} onClick={() => update('page', String((filters.page || 0) + 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Далее</button>
              </div>
            </>}
  </div>;
};

export default PekProgramsPage;
