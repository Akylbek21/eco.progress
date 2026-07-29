import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { PekPeriodType, PekReportFilters, PekReportStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekReadiness, PekState, PekStatusBadge } from '../components/common/PekUi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { primaryPekAction } from '../utils/pekActions';
import { pekStatusLabels } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import EntityName from '../components/common/EntityName';
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission } from '../../../config/permissions';

const statuses: PekReportStatus[] = [
  'DRAFT', 'COLLECTING', 'REQUIRES_CORRECTION', 'READY_FOR_REVIEW', 'UNDER_REVIEW',
  'RETURNED', 'READY_FOR_APPROVAL', 'APPROVED', 'READY_FOR_SIGNING', 'SIGNED',
  'SUBMITTED', 'ACCEPTED', 'REJECTED', 'ARCHIVED',
];

const PekReportsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const rawSearch = params.get('search') || '';
  const search = useDebouncedValue(rawSearch);
  const filters: PekReportFilters = {
    search: search || undefined,
    companyId: Number(params.get('companyId')) || undefined,
    objectId: Number(params.get('objectId')) || undefined,
    periodType: (params.get('periodType') || undefined) as PekPeriodType | undefined,
    year: Number(params.get('year')) || undefined,
    quarter: Number(params.get('quarter')) || undefined,
    status: (params.get('status') || undefined) as PekReportStatus | undefined,
    responsibleId: Number(params.get('responsibleId')) || undefined,
    valid: params.has('valid') ? params.get('valid') === 'true' : undefined,
    onlyWithErrors: params.get('onlyWithErrors') === 'true' || undefined,
    onlyWithExceedances: params.get('onlyWithExceedances') === 'true' || undefined,
    onlyOverdue: params.get('onlyOverdue') === 'true' || undefined,
    page: Number(params.get('page')) || 0,
    size: Number(params.get('size')) || 20,
    sort: params.get('sort') || 'updatedAt,desc',
  };
  const query = useQuery({
    queryKey: pekKeys.reports(filters),
    queryFn: ({ signal }) => pekService.getReports(filters, signal),
    placeholderData: keepPreviousData,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE']),
    queryFn: ({ signal }) => pekService.getAssignees(['PEK_RESPONSIBLE'], signal),
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
      title="Отчёты ПЭК"
      description="Сбор, проверка, согласование и отправка отчётов"
      actions={hasPermission(user, 'PEK_REPORT_CREATE') ? <Link to="/staff/pek/reports/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать отчёт ПЭК</Link> : undefined}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4 xl:grid-cols-8">
      <label className="text-xs font-bold text-slate-600">Поиск
        <input aria-label="Поиск отчётов" placeholder="Номер отчёта" value={rawSearch} onChange={(event) => update('search', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </label>
      <PekCompanyObjectFilters companyId={filters.companyId} objectId={filters.objectId} onCompanyChange={(value) => update('companyId', value)} onObjectChange={(value) => update('objectId', value)} />
      <label className="text-xs font-bold text-slate-600">Период
        <select value={filters.periodType || ''} onChange={(event) => update('periodType', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
          <option value="">Любой</option><option value="QUARTER">Квартал</option><option value="YEAR">Год</option>
        </select>
      </label>
      <label className="text-xs font-bold text-slate-600">Год
        <input type="number" min={2000} max={2100} value={filters.year || ''} onChange={(event) => update('year', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
      </label>
      <label className="text-xs font-bold text-slate-600">Статус
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
          <option value="">Все статусы</option>
          {statuses.map((status) => <option key={status} value={status}>{pekStatusLabels[status]}</option>)}
        </select>
      </label>
      <PekLookupSelect label="Ответственный" value={filters.responsibleId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => update('responsibleId', value ? String(value) : '')} />
      <label className="text-xs font-bold text-slate-600">Валидность
        <select value={params.get('valid') || ''} onChange={(event) => update('valid', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
          <option value="">Любая</option><option value="true">Валиден</option><option value="false">Требует исправлений</option>
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters.onlyWithErrors)} onChange={(event) => update('onlyWithErrors', event.target.checked ? 'true' : '')} />С ошибками</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters.onlyWithExceedances)} onChange={(event) => update('onlyWithExceedances', event.target.checked ? 'true' : '')} />С превышениями</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={Boolean(filters.onlyOverdue)} onChange={(event) => update('onlyOverdue', event.target.checked ? 'true' : '')} />Просроченные</label>
      </div>
    </section>
    {query.isLoading
      ? <PekLoading />
      : query.isError
        ? <PekQueryError error={query.error} resource="Отчёты ПЭК" retry={() => void query.refetch()} />
        : !query.data?.content.length
          ? <PekState title="Отчёты по выбранным условиям не найдены" />
          : <>
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <table className="w-full min-w-[1350px] text-sm">
                  <thead className="bg-slate-50 text-left"><tr>{['Номер / период', 'Компания', 'Объект', 'Программа', 'Редакция', 'Статус', 'Готовность', 'Ошибки', 'Предупреждения', 'Превышения', 'Ответственный', 'Срок', 'Следующее действие'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                  <tbody>{query.data.content.map((item) => {
                    const action = primaryPekAction(item.availableActions || []);
                    return <tr key={item.id} className="border-t">
                      <td className="px-4 py-3 font-bold">{item.number}<br /><span className="font-normal text-slate-500">{item.periodStart} — {item.periodEnd}</span></td>
                      <td className="px-4 py-3"><EntityName value={item.company} fallback="Компания не указана" /></td>
                      <td className="px-4 py-3"><EntityName value={item.object} fallback="Объект не указан" /></td>
                      <td className="px-4 py-3">{item.program?.name || '—'}</td>
                      <td className="px-4 py-3">{item.revision}</td>
                      <td className="px-4 py-3"><PekStatusBadge status={item.status} /></td>
                      <td className="px-4 py-3"><PekReadiness value={item.readinessPercent} valid={item.valid} /></td>
                      <td className="px-4 py-3 font-bold text-rose-700">{item.blockingIssueCount}</td>
                      <td className="px-4 py-3">{item.warningCount}</td>
                      <td className="px-4 py-3">{item.exceedanceCount}</td>
                      <td className="px-4 py-3">{item.responsible?.name || item.nextResponsible?.name || '—'}</td>
                      <td className="px-4 py-3">{item.dueDate || '—'}</td>
                      <td className="px-4 py-3"><Link className="font-bold text-eco-700" to={`/staff/pek/reports/${item.id}`}>{action?.label || item.nextAction || 'Открыть'}</Link>{action&&!action.enabled&&action.disabledReason&&<p className="mt-1 text-xs text-amber-700">{action.disabledReason}</p>}</td>
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

export default PekReportsPage;
