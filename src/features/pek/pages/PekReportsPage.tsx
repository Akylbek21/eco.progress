import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { hasPermission } from '../../../config/permissions';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekReportFilters } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import EntityName from '../components/common/EntityName';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { getReportWorkflowActions } from '../mappers/reportMappers';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const actionLabel = (status: string) => {
  const action = getReportWorkflowActions(status)[0];
  return action === 'COLLECT' ? 'Собрать протоколы'
    : action === 'SUBMIT_REVIEW' ? 'Отправить на проверку'
      : action === 'APPROVE' ? 'Утвердить'
        : action === 'ARCHIVE' ? 'Архивировать'
          : 'Открыть';
};

const PekReportsPage = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const companyId = Number(params.get('companyId')) || undefined;
  const objectId = Number(params.get('objectId')) || undefined;
  const page = Number(params.get('page')) || 0;
  const size = Number(params.get('size')) || 20;
  const ready = Boolean(companyId && objectId);
  const filters = ready ? { companyId, objectId, page, size } as PekReportFilters : undefined;
  const reports = useQuery({
    queryKey: pekKeys.reports(filters),
    queryFn: ({ signal }) => pekApi.getReports(filters!, signal),
    enabled: ready,
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
      title="Отчёты ПЭК"
      description="Список отчётов текущего backend"
      actions={hasPermission(user, 'PEK_REPORT_CREATE')
        ? <Link to="/staff/pek/reports/new" className="rounded-full bg-eco-600 px-5 py-2.5 text-sm font-bold text-white">Создать отчёт</Link>
        : undefined}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
      <PekCompanyObjectFilters
        companyId={companyId}
        objectId={objectId}
        onCompanyChange={(value) => update('companyId', value)}
        onObjectChange={(value) => update('objectId', value)}
        required
      />
      <label className="text-xs font-bold text-slate-600">На странице
        <select value={size} onChange={(event) => update('size', event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2">
          {[10, 20, 50].map((value) => <option key={value}>{value}</option>)}
        </select>
      </label>
      <button type="button" onClick={() => setParams({}, { replace: true })} className="self-end rounded-xl border px-3 py-2 text-sm font-bold">Сбросить</button>
    </section>
    {!ready
      ? <PekState title="Выберите компанию и объект для просмотра отчётов" />
      : reports.isLoading
        ? <PekLoading />
        : reports.isError
          ? <PekQueryError error={reports.error} resource="Отчёты ПЭК" retry={() => void reports.refetch()} />
          : !reports.data?.content.length
            ? <PekState title="Для выбранных компании и объекта отчётов нет" />
            : <>
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-slate-50 text-left"><tr>
                    {['Период', 'Компания', 'Объект', 'Программа', 'Статус', 'Связано протоколов', 'Последний сбор', 'Версия', 'Действия'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}
                  </tr></thead>
                  <tbody>{reports.data.content.map((report) => <tr key={report.id} className="border-t">
                    <td className="px-4 py-3">{report.periodStart} — {report.periodEnd}</td>
                    <td className="px-4 py-3"><EntityName value={report.company} fallback="—" /></td>
                    <td className="px-4 py-3"><EntityName value={report.object} fallback="—" /></td>
                    <td className="px-4 py-3">{report.programId ? `№${report.programId}` : '—'}</td>
                    <td className="px-4 py-3"><PekStatusBadge status={report.status} /></td>
                    <td className="px-4 py-3">{report.linkedProtocolCount}</td>
                    <td className="px-4 py-3">{report.lastCollectedAt || '—'}</td>
                    <td className="px-4 py-3">{report.version}</td>
                    <td className="px-4 py-3"><Link className="font-bold text-eco-700" to={`/staff/pek/reports/${report.id}`}>{actionLabel(report.status)}</Link></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <button type="button" disabled={!page} onClick={() => update('page', String(page - 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Назад</button>
                <span>Страница {page + 1} из {reports.data.totalPages || 1}</span>
                <button type="button" disabled={page + 1 >= reports.data.totalPages} onClick={() => update('page', String(page + 1))} className="rounded-full border px-4 py-2 disabled:opacity-40">Далее</button>
              </div>
            </>}
  </div>;
};

export default PekReportsPage;
