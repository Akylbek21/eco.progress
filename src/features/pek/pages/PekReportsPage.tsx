import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekReportFilters, PekReportStatus } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import EntityName from '../components/common/EntityName';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import { canCreateReport } from '../permissions/pekAccess';

const PekReportsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const companyId = Number(params.get('companyId')) || 0;
  const objectId = Number(params.get('objectId')) || 0;
  const filters: PekReportFilters = {
    companyId,
    objectId,
    programId: Number(params.get('programId')) || undefined,
    status: (params.get('status') || undefined) as PekReportStatus | undefined,
    issue: (params.get('issue') || undefined) as PekReportFilters['issue'],
    page: Math.max(0, Number(params.get('page')) || 0),
    size: [10, 20, 50].includes(Number(params.get('size'))) ? Number(params.get('size')) : 20,
    sort: params.get('sort') || undefined,
  };
  const reports = useQuery({
    queryKey: pekKeys.reports(filters, user?.id), queryFn: ({ signal }) => pekApi.getReports(filters, signal),
    retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
    enabled: Boolean(companyId && objectId),
  });
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
  return <div className="space-y-5">
    <PekPageHeader title="Отчёты ПЭК" description="Отчёты и связанные с ними протоколы по выбранному объекту" actions={canCreateReport(user) ? <Link to="/staff/pek/reports/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать отчёт</Link> : undefined} />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-5">
      <PekCompanyObjectFilters companyId={companyId || undefined} objectId={objectId || undefined} onCompanyChange={(value) => update('companyId', value)} onObjectChange={(value) => update('objectId', value)} />
      <label className="text-xs font-bold text-slate-600">Статус<select value={filters.status || ''} onChange={(event) => update('status', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Все</option>{(['DRAFT', 'COLLECTING', 'READY_FOR_REVIEW', 'RETURNED', 'APPROVED', 'SIGNED', 'ARCHIVED'] as PekReportStatus[]).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
      <label className="text-xs font-bold text-slate-600">Проблема<select value={filters.issue || ''} onChange={(event) => update('issue', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2"><option value="">Все</option><option value="OPEN_EXCEEDANCE">Открытые превышения</option><option value="UNMATCHED_SOURCE">Несопоставленные источники</option><option value="MISSING_PROTOCOL">Нет протокола</option></select></label>
      <button type="button" onClick={() => setParams({}, { replace: true })} className="rounded-xl border px-3 py-2 text-sm font-bold">Сбросить</button>
    </section>
    {!companyId || !objectId ? <PekState title="Выберите компанию и объект" message="После выбора будет загружен список отчётов ПЭК." /> : reports.isLoading ? <PekLoading /> : reports.isError ? <PekQueryError error={reports.error} resource="Отчёты ПЭК" retry={() => void reports.refetch()} /> : !reports.data?.content.length ? <PekState title="Для выбранного объекта отчётов нет" /> : <>
      <div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[980px] text-sm"><thead className="sticky top-0 bg-slate-50 text-left"><tr>{['ID', 'Компания', 'Объект', 'Период', 'Статус', 'Протоколы', 'Последний сбор', 'Ответственный', 'Действия'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{reports.data.content.map((report) => <tr key={report.id} className="border-t"><td className="px-4 py-3 font-bold">{report.id}</td><td className="px-4 py-3"><EntityName value={report.company} fallback="—" /></td><td className="px-4 py-3"><EntityName value={report.object} fallback="—" /></td><td className="px-4 py-3">{report.periodStart} — {report.periodEnd}</td><td className="px-4 py-3"><PekStatusBadge status={report.status} /></td><td className="px-4 py-3">{report.linkedProtocolCount}</td><td className="px-4 py-3">{report.lastCollectedAt || '—'}</td><td className="px-4 py-3"><EntityName value={report.responsibleUser} fallback="—" /></td><td className="px-4 py-3"><Link className="font-bold text-eco-700" to={`/staff/pek/reports/${report.id}`}>Открыть</Link></td></tr>)}</tbody></table></div>
      <div className="flex items-center justify-between"><button type="button" disabled={!filters.page} onClick={() => update('page', String((filters.page || 0) - 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Назад</button><span>Страница {(filters.page || 0) + 1} из {reports.data.totalPages || 1} · всего {reports.data.totalElements}</span><button type="button" disabled={(filters.page || 0) + 1 >= reports.data.totalPages} onClick={() => update('page', String((filters.page || 0) + 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Далее</button></div>
    </>}
  </div>;
};
export default PekReportsPage;
