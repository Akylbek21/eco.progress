import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { hasPermission } from '../../../config/permissions';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekPeriodType, PekReportFilters } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import EntityName from '../components/common/EntityName';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const statuses = ['DRAFT', 'COLLECTING', 'READY_FOR_REVIEW', 'APPROVED', 'ARCHIVED'];
const valueOrDash = (value?: number | null) => value === null || value === undefined ? '—' : value;

const PekReportsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const rawSearch = params.get('search') || '';
  const filters: PekReportFilters = {
    search: useDebouncedValue(rawSearch, 400) || undefined,
    companyId: Number(params.get('companyId')) || undefined,
    objectId: Number(params.get('objectId')) || undefined,
    programId: Number(params.get('programId')) || undefined,
    year: Number(params.get('year')) || undefined,
    periodType: (params.get('periodType') || undefined) as PekPeriodType | undefined,
    status: params.get('status') || undefined,
    responsibleUserId: Number(params.get('responsibleUserId')) || undefined,
    hasExceedances: params.get('hasExceedances') === 'true' || undefined,
    overdue: params.get('overdue') === 'true' || undefined,
    page: Math.max(0, Number(params.get('page')) || 0),
    size: [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 20,
    sort: params.get('sort') || 'updatedAt,desc',
  };
  const reports = useQuery({
    queryKey: pekKeys.reports(filters), queryFn: ({ signal }) => pekApi.getReports(filters, signal),
    placeholderData: keepPreviousData, retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({ queryKey: pekKeys.assignees(['PEK_RESPONSIBLE']), queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal), retry: retryPekQuery });
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key !== 'page') next.set('page', '0');
    setParams(next, { replace: true });
  };
  const hasFilters = [...params.keys()].some((key) => key !== 'page' && key !== 'size' && key !== 'sort');
  return <div className="space-y-5">
    <PekPageHeader title="Отчёты ПЭК" description="Серверный план/факт, протоколы и workflow отчётности" actions={hasPermission(user, 'PEK_REPORT_CREATE') ? <Link to="/staff/pek/reports/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать отчёт</Link> : undefined} />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4 xl:grid-cols-6">
      <label className="text-xs font-bold text-slate-600">Поиск<input aria-label="Поиск отчётов" value={rawSearch} onChange={(event) => update('search', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" placeholder="Номер или программа" /></label>
      <PekCompanyObjectFilters companyId={filters.companyId} objectId={filters.objectId} onCompanyChange={(value) => update('companyId', value)} onObjectChange={(value) => update('objectId', value)} />
      <label className="text-xs font-bold text-slate-600">Год<input type="number" value={filters.year || ''} onChange={(event) => update('year', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      <label className="text-xs font-bold text-slate-600">Период<select value={filters.periodType || ''} onChange={(event) => update('periodType', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Все</option><option value="QUARTER">Квартал</option><option value="YEAR">Год</option></select></label>
      <label className="text-xs font-bold text-slate-600">Статус<select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Все</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
      <PekLookupSelect label="Ответственный" value={filters.responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onChange={(value) => update('responsibleUserId', value ? String(value) : '')} />
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(filters.hasExceedances)} onChange={(event) => update('hasExceedances', event.target.checked ? 'true' : '')} />Есть превышения</label>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={Boolean(filters.overdue)} onChange={(event) => update('overdue', event.target.checked ? 'true' : '')} />Просроченные</label>
      <button type="button" onClick={() => setParams({}, { replace: true })} className="rounded-xl border px-3 py-2 text-sm font-bold">Сбросить</button>
    </section>
    {reports.isLoading ? <PekLoading /> : reports.isError ? <PekQueryError error={reports.error} resource="Отчёты ПЭК" retry={() => void reports.refetch()} /> : !reports.data?.content.length ? <PekState title={hasFilters ? 'По выбранным фильтрам отчётов нет' : 'Отчёты ПЭК ещё не созданы'} /> : <>
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[1450px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left"><tr>{['Номер', 'Программа', 'Компания', 'Объект', 'Период', 'Статус', 'План', 'Факт', 'Выполнение', 'Превышения', 'Замечания', 'Ответственный', 'Действия'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{reports.data.content.map((report) => <tr key={report.id} className="border-t"><td className="px-4 py-3 font-bold">{report.number || '—'}</td><td className="px-4 py-3"><EntityName value={report.program} fallback="—" /></td><td className="px-4 py-3"><EntityName value={report.company} fallback="—" /></td><td className="px-4 py-3"><EntityName value={report.object} fallback="—" /></td><td className="px-4 py-3">{report.periodStart} — {report.periodEnd}</td><td className="px-4 py-3"><PekStatusBadge status={report.status} /></td><td className="px-4 py-3">{valueOrDash(report.plannedCount)}</td><td className="px-4 py-3">{valueOrDash(report.actualCount)}</td><td className="px-4 py-3">{report.completionPercent == null ? '—' : `${report.completionPercent}%`}</td><td className="px-4 py-3">{valueOrDash(report.exceedanceCount)}</td><td className="px-4 py-3">{valueOrDash(report.commentCount)}</td><td className="px-4 py-3"><EntityName value={report.responsibleUser} fallback="—" /></td><td className="px-4 py-3"><Link className="font-bold text-eco-700" to={`/staff/pek/reports/${report.id}`}>Открыть</Link></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between"><button type="button" disabled={!filters.page} onClick={() => update('page', String((filters.page || 0) - 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Назад</button><span>Страница {(filters.page || 0) + 1} из {reports.data.totalPages || 1}</span><button type="button" disabled={(filters.page || 0) + 1 >= reports.data.totalPages} onClick={() => update('page', String((filters.page || 0) + 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Далее</button></div>
    </>}
  </div>;
};
export default PekReportsPage;
