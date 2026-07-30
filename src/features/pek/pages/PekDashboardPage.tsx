import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import { PekLoading, PekPageHeader } from '../components/common/PekUi';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekLookupSelect from '../components/common/PekLookupSelect';
import PekQueryError from '../components/common/PekQueryError';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import type { PekReportStatus } from '../api/pekContracts';
import { pekStatusLabels } from '../utils/pekLabels';

const metrics = [
  ['totalReportCount', 'Всего отчётов', ''], ['readinessPercent', 'Общая готовность', '%'], ['criticalIssueCount', 'Критические ошибки', ''],
  ['overdueRiskCount', 'Риск просрочки', ''], ['programExecutionPercent', 'Выполнение программы', '%'],
  ['openExceedanceCount', 'Открытые превышения', ''], ['overdueActionCount', 'Просроченные меры', ''],
  ['missingProtocolCount', 'Отсутствующие протоколы', ''],
] as const;
const dashboardStatuses: PekReportStatus[] = ['DRAFT','COLLECTING','REQUIRES_CORRECTION','READY_FOR_REVIEW','UNDER_REVIEW','RETURNED','READY_FOR_APPROVAL','APPROVED','READY_FOR_SIGNING','SIGNED','SUBMITTED','ACCEPTED','REJECTED','ARCHIVED'];
const metricReportFilters: Record<(typeof metrics)[number][0], string> = {
  totalReportCount: '',
  readinessPercent: '',
  criticalIssueCount: 'onlyWithErrors=true',
  overdueRiskCount: 'onlyOverdue=true',
  programExecutionPercent: '',
  openExceedanceCount: 'onlyWithExceedances=true',
  overdueActionCount: 'onlyOverdue=true',
  missingProtocolCount: 'onlyWithErrors=true',
};
const reportFilterNames = ['companyId', 'objectId', 'year', 'quarter', 'status', 'responsibleId'] as const;
const PekDashboardPage = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = Object.fromEntries(params.entries());
  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const query = useQuery({ queryKey: pekKeys.dashboard(filters), queryFn: ({ signal }) => pekService.getDashboard(filters, signal), retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS });
  const assignees = useQuery({ queryKey: pekKeys.assignees(['PEK_RESPONSIBLE']), queryFn: ({ signal }) => pekService.getAssignees(['PEK_RESPONSIBLE'], signal), retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS });
  const openMetricReports = (metric: (typeof metrics)[number][0]) => {
    const reportParams = new URLSearchParams();
    reportFilterNames.forEach((name) => {
      const value = params.get(name);
      if (value) reportParams.set(name, value);
    });
    const metricParams = new URLSearchParams(metricReportFilters[metric]);
    metricParams.forEach((value, name) => reportParams.set(name, value));
    navigate(`/staff/pek/reports${reportParams.size ? `?${reportParams.toString()}` : ''}`);
  };
  return <div className="space-y-5">
    <PekPageHeader title="Производственный экологический контроль" description="Готовность программ и отчётов ПЭК" actions={<><Link className="rounded-full border border-eco-300 px-5 py-2.5 text-sm font-bold text-eco-800" to="/staff/pek/programs">Программы</Link><Link className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white" to="/staff/pek/reports">Отчёты</Link></>} />
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6">
      <PekCompanyObjectFilters companyId={Number(params.get('companyId'))||undefined} objectId={Number(params.get('objectId'))||undefined} onCompanyChange={(value)=>update('companyId',value)} onObjectChange={(value)=>update('objectId',value)}/>
      <label className="text-xs font-bold text-slate-600">Год<input type="number" min={2000} max={2100} value={params.get('year')||''} onChange={(event)=>update('year',event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"/></label>
      <label className="text-xs font-bold text-slate-600">Квартал<select value={params.get('quarter')||''} onChange={(event)=>update('quarter',event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">Все</option>{[1,2,3,4].map(value=><option key={value} value={value}>{value}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Статус<select value={params.get('status')||''} onChange={(event)=>update('status',event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">Все статусы</option>{dashboardStatuses.map(status=><option key={status} value={status}>{pekStatusLabels[status]}</option>)}</select></label>
      <PekLookupSelect label="Ответственный" value={Number(params.get('responsibleId')) || undefined} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(value) => update('responsibleId', value ? String(value) : '')} />
    </section>
    {query.isLoading ? <PekLoading /> : query.isError ? <PekQueryError error={query.error} resource="Показатели ПЭК" retry={() => void query.refetch()} /> : query.data && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key, label, suffix]) => <button key={key} type="button" onClick={() => openMetricReports(key)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-eco-300"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-eco-900">{query.data[key]}{suffix}</p></button>)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Ближайшие сроки</h2><div className="mt-3 space-y-2">{query.data.deadlines?.map((item) => <Link key={`${item.reportId}-${item.dueDate}`} to={`/staff/pek/reports/${item.reportId}`} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{item.reportNumber} · {item.label}</span><strong>{item.dueDate}</strong></Link>)}{!query.data.deadlines?.length && <p className="text-sm text-slate-500">Ближайших сроков нет</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Следующие действия</h2><div className="mt-3 space-y-2">{query.data.reports?.map((item) => <Link key={item.reportId} to={`/staff/pek/reports/${item.reportId}`} className="block rounded-xl bg-slate-50 p-3 text-sm"><strong>{item.reportNumber}</strong><span className="ml-2">{item.nextAction || 'Открыть отчёт'} · {item.responsible || 'Ответственный не указан'}</span></Link>)}</div></div></section>
    </>}
  </div>;
};
export default PekDashboardPage;
