import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekService } from '../api/pekService';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';

const metrics = [
  ['readinessPercent', 'Общая готовность', '%'], ['criticalIssueCount', 'Критические ошибки', ''],
  ['overdueRiskCount', 'Риск просрочки', ''], ['programExecutionPercent', 'Выполнение программы', '%'],
  ['openExceedanceCount', 'Открытые превышения', ''], ['overdueActionCount', 'Просроченные меры', ''],
  ['missingProtocolCount', 'Отсутствующие протоколы', ''],
] as const;
const PekDashboardPage = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = Object.fromEntries(params.entries());
  const query = useQuery({ queryKey: pekKeys.dashboard(filters), queryFn: ({ signal }) => pekService.getDashboard(filters, signal) });
  return <div className="space-y-5">
    <PekPageHeader title="Производственный экологический контроль" description="Готовность программ и отчётов ПЭК" actions={<><Link className="rounded-full border border-eco-300 px-5 py-2.5 text-sm font-bold text-eco-800" to="/staff/pek/programs">Программы</Link><Link className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white" to="/staff/pek/reports">Отчёты</Link></>} />
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      {['companyId', 'objectId', 'period', 'status', 'responsibleId'].map((key) => <label key={key} className="text-xs font-bold text-slate-600">{({ companyId: 'Компания', objectId: 'Объект', period: 'Период', status: 'Статус', responsibleId: 'Ответственный' } as Record<string, string>)[key]}<input value={params.get(key) || ''} onChange={(event) => { const next = new URLSearchParams(params); event.target.value ? next.set(key, event.target.value) : next.delete(key); setParams(next, { replace: true }); }} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" /></label>)}
    </section>
    {query.isLoading ? <PekLoading /> : query.isError ? <PekState title="Не удалось загрузить показатели ПЭК" retry={() => void query.refetch()} /> : query.data && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([key, label, suffix]) => <button key={key} type="button" onClick={() => navigate(`/staff/pek/reports?metric=${key}`)} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-eco-300"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-eco-900">{query.data[key]}{suffix}</p></button>)}</section>
      <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Ближайшие сроки</h2><div className="mt-3 space-y-2">{query.data.deadlines?.map((item) => <Link key={`${item.reportId}-${item.dueDate}`} to={`/staff/pek/reports/${item.reportId}`} className="flex justify-between rounded-xl bg-slate-50 p-3 text-sm"><span>{item.reportNumber} · {item.label}</span><strong>{item.dueDate}</strong></Link>)}{!query.data.deadlines?.length && <p className="text-sm text-slate-500">Ближайших сроков нет</p>}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-black">Следующие действия</h2><div className="mt-3 space-y-2">{query.data.reports?.map((item) => <Link key={item.reportId} to={`/staff/pek/reports/${item.reportId}`} className="block rounded-xl bg-slate-50 p-3 text-sm"><strong>{item.reportNumber}</strong><span className="ml-2">{item.nextAction || 'Открыть отчёт'} · {item.responsible || 'Ответственный не указан'}</span></Link>)}</div></div></section>
    </>}
  </div>;
};
export default PekDashboardPage;
