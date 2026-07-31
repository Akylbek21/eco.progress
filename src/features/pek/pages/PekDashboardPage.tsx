import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import type { PekDashboardFilters, PekReportStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { pekStatusLabels } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const statuses: PekReportStatus[] = ['DRAFT', 'COLLECTING', 'READY_FOR_REVIEW', 'APPROVED', 'ARCHIVED'];
const metricDefinitions = [
  ['totalReportCount', 'Количество отчётов', '', false],
  ['readinessPercent', 'Готовность', '%', false],
  ['overdueRiskCount', 'Риск просрочки', '', false],
  ['programExecutionPercent', 'Выполнение программ', '%', false],
  ['criticalIssueCount', 'Критические проблемы', '', true],
  ['openExceedanceCount', 'Превышения', '', true],
  ['overdueActionCount', 'Просроченные действия', '', true],
  ['missingProtocolCount', 'Отсутствующие протоколы', '', true],
] as const;

const PekDashboardPage = () => {
  const [params, setParams] = useSearchParams();
  const filters: PekDashboardFilters = {
    companyId: Number(params.get('companyId')) || undefined,
    objectId: Number(params.get('objectId')) || undefined,
    year: Number(params.get('year')) || undefined,
    quarter: Number(params.get('quarter')) || undefined,
    status: (params.get('status') || undefined) as PekReportStatus | undefined,
    responsibleId: Number(params.get('responsibleId')) || undefined,
  };
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const dashboard = useQuery({
    queryKey: pekKeys.dashboard(filters),
    queryFn: ({ signal }) => pekApi.getDashboard(filters, signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE', 'PEK_REVIEWER', 'PEK_APPROVER']),
    queryFn: ({ signal }) => pekApi.getAssignees(
      ['PEK_RESPONSIBLE', 'PEK_REVIEWER', 'PEK_APPROVER'],
      signal,
    ),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });

  return <div className="space-y-5">
    <PekPageHeader
      title="Производственный экологический контроль"
      description="Фактические показатели программ и отчётов ПЭК"
      actions={<>
        <Link className="rounded-full border px-5 py-2.5 text-sm font-bold" to="/staff/pek/programs">Программы</Link>
        <Link className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white" to="/staff/pek/reports">Отчёты</Link>
      </>}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-7">
      <PekCompanyObjectFilters
        companyId={filters.companyId}
        objectId={filters.objectId}
        onCompanyChange={(value) => update('companyId', value)}
        onObjectChange={(value) => update('objectId', value)}
      />
      <label className="text-xs font-bold text-slate-600">Год
        <input type="number" value={filters.year || ''} onChange={(event) => update('year', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
      </label>
      <label className="text-xs font-bold text-slate-600">Квартал
        <select value={filters.quarter || ''} onChange={(event) => update('quarter', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">Все</option>{[1, 2, 3, 4].map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <label className="text-xs font-bold text-slate-600">Статус
        <select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          <option value="">Все</option>
          {statuses.map((status) => <option key={status} value={status}>{pekStatusLabels[status]}</option>)}
        </select>
      </label>
      <PekLookupSelect
        label="Ответственный"
        value={filters.responsibleId}
        options={assignees.data || []}
        loading={assignees.isLoading}
        error={assignees.isError}
        onRetry={() => void assignees.refetch()}
        onChange={(value) => update('responsibleId', value ? String(value) : '')}
      />
      <button type="button" onClick={() => setParams({}, { replace: true })} className="self-end rounded-xl border px-3 py-2 text-sm font-bold">
        Сбросить
      </button>
    </section>
    {dashboard.isLoading
      ? <PekLoading />
      : dashboard.isError
        ? <PekQueryError error={dashboard.error} resource="Dashboard ПЭК" retry={() => void dashboard.refetch()} />
        : !dashboard.data
          ? <PekState title="Нет данных dashboard" />
          : <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricDefinitions.map(([key, label, suffix, pendingEngine]) => (
                <article key={key} className="rounded-2xl border bg-white p-5" title={pendingEngine ? 'Расчёт показателя будет доступен после подключения validation engine' : undefined}>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-eco-900">{dashboard.data[key]}{suffix}</p>
                  {pendingEngine && <p className="mt-2 text-xs text-slate-400">Показатель возвращён backend</p>}
                </article>
              ))}
            </section>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-black">Ближайшие сроки</h2>
                <div className="mt-3 space-y-2">
                  {dashboard.data.deadlines.map((item) => (
                    <Link key={`${item.type}-${item.id}-${item.date}`} to={item.type.includes('PROGRAM') ? `/staff/pek/programs/${item.id}` : `/staff/pek/reports/${item.id}`} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
                      <span>{item.description}</span><strong>{item.date}</strong>
                    </Link>
                  ))}
                  {!dashboard.data.deadlines.length && <p className="text-sm text-slate-500">Ближайших сроков нет</p>}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-black">Последние отчёты</h2>
                <div className="mt-3 space-y-2">
                  {dashboard.data.reports.map((report) => (
                    <Link key={report.id} to={`/staff/pek/reports/${report.id}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                      <span>{report.number || `Отчёт №${report.id}`} · {report.periodStart}—{report.periodEnd}</span>
                      <PekStatusBadge status={report.status} />
                    </Link>
                  ))}
                  {!dashboard.data.reports.length && <p className="text-sm text-slate-500">Отчётов пока нет</p>}
                </div>
              </div>
            </section>
          </>}
  </div>;
};

export default PekDashboardPage;
