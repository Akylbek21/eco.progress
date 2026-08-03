import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekStatusBadge } from '../components/common/PekUi';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabs = ['Обзор', 'Связанные протоколы'] as const;

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab');
  const tab = tabs.includes(requestedTab as typeof tabs[number])
    ? requestedTab as typeof tabs[number]
    : 'Обзор';
  const report = useQuery({
    queryKey: pekKeys.report(id),
    queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });

  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) {
    return <PekQueryError error={report.error} resource="Отчёт ПЭК" retry={() => void report.refetch()} />;
  }

  const item = report.data;
  const protocolParams = new URLSearchParams({
    companyId: String(item.companyId),
    objectId: String(item.objectId),
    dateFrom: item.periodStart,
    dateTo: item.periodEnd,
  });
  const setTab = (nextTab: typeof tabs[number]) => {
    const next = new URLSearchParams(params);
    nextTab === 'Обзор' ? next.delete('tab') : next.set('tab', nextTab);
    setParams(next, { replace: true });
  };

  return <div className="space-y-5">
    <PekPageHeader
      title={`Отчёт ПЭК ${item.id}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.periodStart}—${item.periodEnd}`}
      actions={<PekStatusBadge status={item.status} />}
    />
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Разделы отчёта">
      {tabs.map((label) => <button key={label} type="button" onClick={() => setTab(label)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === label ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    {tab === 'Обзор' && <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} />
      <Info label="Программа, ID" value={item.programId} />
      <Info label="Связано протоколов" value={item.linkedProtocolCount} />
      <Info label="Последний сбор" value={item.lastCollectedAt || '—'} />
      <Info label="Ответственный" value={item.responsibleUser?.name || '—'} />
      <Info label="Версия" value={item.version} />
    </section>}
    {tab === 'Связанные протоколы' && <section className="rounded-2xl border bg-white p-5">
      <p className="mb-4 text-sm text-slate-600">Список протоколов открывается с компанией, объектом и периодом текущего отчёта.</p>
      <Link to={`/staff/protocols?${protocolParams}`} className="rounded-full border px-4 py-2 text-sm font-bold">Открыть протоколы</Link>
    </section>}
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;

export default PekReportWorkspacePage;
