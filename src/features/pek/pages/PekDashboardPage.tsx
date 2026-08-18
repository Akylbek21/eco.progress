import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekDashboardFilters, PekReportStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { pekStatusLabels } from '../utils/pekLabels';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const statuses: PekReportStatus[] = ['DRAFT', 'COLLECTING', 'READY_FOR_REVIEW', 'RETURNED', 'APPROVED', 'SIGNED', 'ARCHIVED'];
const metricDefinitions = [
  ['criticalIssueCount', 'Требуют внимания', '', '/staff/pek/reports', {}],
  ['overdueRiskCount', 'Срок заканчивается в ближайшие 30 дней', '', '/staff/pek/programs', {}],
  ['missingProtocolCount', 'Отсутствующие протоколы', '', '/staff/pek/reports', { issue: 'MISSING_PROTOCOL' }],
  ['openExceedanceCount', 'Открытые превышения', '', '/staff/pek/reports', { issue: 'OPEN_EXCEEDANCE' }],
  ['overdueActionCount', 'Просроченные мероприятия', '', '/staff/pek/programs', {}],
  ['readinessPercent', 'Отчёты на проверке и утверждённые', '%', '/staff/pek/reports', {}],
  ['programExecutionPercent', 'Доля активных программ', '%', '/staff/pek/programs', {}],
  ['returnedReportCount', 'Возвращённые отчёты', '', '/staff/pek/reports', { status: 'RETURNED' }],
  ['signedReportCount', 'Подписанные отчёты', '', '/staff/pek/reports', { status: 'SIGNED' }],
  ['draftReportCount', 'Черновики', '', '/staff/pek/reports', { status: 'DRAFT' }],
  ['unmatchedSourceCount', 'Несопоставленные протоколы', '', '/staff/pek/reports', { issue: 'UNMATCHED_SOURCE' }],
  ['ambiguousSourceCount', 'Неоднозначные результаты', '', '/staff/pek/reports', {}],
  ['staleSourceCount', 'Устаревшие связи', '', '/staff/pek/reports', {}],
  ['totalReportCount', 'Отчёты за период', '', '/staff/pek/reports', {}],
] as const;
const PekDashboardPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
    if (key === 'companyId') {
      next.delete('objectId');
      void queryClient.cancelQueries({ queryKey: pekKeys.all });
    }
    setParams(next, { replace: true });
  };
  const dashboard = useQuery({
    queryKey: pekKeys.dashboard(filters, user?.id),
    queryFn: ({ signal }) => pekApi.getDashboard(filters, signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE', 'PEK_REVIEWER', 'PEK_APPROVER'], user?.id),
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
      description="Что требует вашего действия сегодня"
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
        ? <PekQueryError error={dashboard.error} resource="сводка ПЭК" retry={() => void dashboard.refetch()} />
        : !dashboard.data
          ? <PekState title="Сводка пока недоступна" />
          : <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricDefinitions.map(([key, label, suffix, path, drillDown]) => (
                <article key={key} className="rounded-2xl border bg-white p-5">
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 text-3xl font-black text-eco-900">{dashboard.data[key] == null ? <span className="text-lg text-slate-500">—</span> : `${dashboard.data[key]}${suffix}`}</p>
                  {dashboard.data[key] != null && <Link className="mt-3 inline-block text-xs font-bold text-eco-700" to={`${path}?${new URLSearchParams({ ...(filters.companyId ? { companyId: String(filters.companyId) } : {}), ...(filters.objectId ? { objectId: String(filters.objectId) } : {}), ...(filters.year ? { year: String(filters.year) } : {}), ...drillDown })}`}>Открыть</Link>}
                </article>
              ))}
            </section>
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-black">Ближайшие задачи</h2>
                <div className="mt-3 space-y-2">
                  {dashboard.data.deadlines.map((item) => (
                    <Link key={`${item.type}-${item.id}-${item.date}`} to={item.type.includes('PROGRAM') ? `/staff/pek/programs/${item.id}` : `/staff/pek/reports/${item.id}`} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm">
                      <span>{item.description}</span><strong>{item.date}</strong>
                    </Link>
                  ))}
                  {!dashboard.data.deadlines.length && <p className="text-sm text-slate-500">На ближайшее время задач нет</p>}
                </div>
              </div>
              <div className="rounded-2xl border bg-white p-5">
                <h2 className="font-black">Последние отчёты</h2>
                <div className="mt-3 space-y-2">
                  {dashboard.data.reports.map((report) => (
                    <Link key={report.id} to={`/staff/pek/reports/${report.id}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
                      <span>Отчёт ПЭК · {report.periodStart}—{report.periodEnd}</span>
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
