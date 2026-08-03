import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../hooks/useToast';
import type { PageResponse, PekPlanFactRow, PekReport, PekReportActionCode, PekUnmatchedSource } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import PekReadinessPanel from '../components/common/PekReadinessPanel';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import PekHistoryTimeline from '../components/sections/PekHistoryTimeline';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabs = ['Обзор', 'План/факт', 'Источники данных', 'Сопоставления', 'Превышения', 'Замечания', 'Корректирующие мероприятия', 'Документы', 'История', 'Подписи'];
const supportedActions: PekReportActionCode[] = ['COLLECT', 'RECOLLECT', 'VALIDATE', 'SUBMIT_REVIEW', 'APPROVE', 'ARCHIVE'];
const dash = (value?: number | null) => value === undefined || value === null ? '—' : value;

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const [params, setParams] = useSearchParams();
  const tab = Math.max(0, tabs.indexOf(params.get('tab') || 'Обзор'));
  const setTab = (index: number) => { const next = new URLSearchParams(params); index ? next.set('tab', tabs[index]) : next.delete('tab'); setParams(next, { replace: true }); };
  const client = useQueryClient();
  const toast = useToast();
  const [pendingAction, setPendingAction] = useState<PekReportActionCode | null>(null);
  const [conflict, setConflict] = useState(false);
  const report = useQuery({ queryKey: pekKeys.report(id), queryFn: ({ signal }) => pekApi.getReport(id, signal), enabled: Number.isSafeInteger(id) && id > 0, retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS });
  const readiness = useQuery({ queryKey: pekKeys.reportReadiness(id), queryFn: ({ signal }) => pekApi.getReportIssues(id, signal), enabled: Boolean(report.data) && (tab === 0 || tab === 5), retry: retryPekQuery });
  const collection = useQuery({ queryKey: pekKeys.reportCollection(id), queryFn: ({ signal }) => pekApi.getLatestCollection(id, signal), enabled: Boolean(report.data) && (tab === 0 || tab === 2), retry: false });
  const planFact = useQuery<PageResponse<PekPlanFactRow>, Error>({ queryKey: pekKeys.reportPlanFact(id), queryFn: ({ signal }) => pekApi.getPlanFact(id, signal), enabled: tab === 1 || tab === 4, placeholderData: keepPreviousData, retry: retryPekQuery });
  const unmatched = useQuery<PageResponse<PekUnmatchedSource>, Error>({ queryKey: pekKeys.reportUnmatched(id), queryFn: ({ signal }) => pekApi.getUnmatchedSources(id, signal), enabled: tab === 3, placeholderData: keepPreviousData, retry: retryPekQuery });
  const history = useQuery({ queryKey: pekKeys.reportHistory(id), queryFn: ({ signal }) => pekApi.getReportHistory(id, signal), enabled: tab === 8, retry: retryPekQuery });

  const refresh = async (saved?: PekReport) => {
    if (saved) client.setQueryData(pekKeys.report(id), saved);
    await Promise.all([
      client.invalidateQueries({ queryKey: pekKeys.report(id) }), client.invalidateQueries({ queryKey: pekKeys.reports() }),
      client.invalidateQueries({ queryKey: pekKeys.reportReadiness(id) }), client.invalidateQueries({ queryKey: pekKeys.reportCollection(id) }),
      client.invalidateQueries({ queryKey: pekKeys.reportPlanFact(id) }), client.invalidateQueries({ queryKey: pekKeys.reportUnmatched(id) }),
      client.invalidateQueries({ queryKey: pekKeys.dashboard() }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (code: PekReportActionCode) => {
      const fresh = await pekApi.getReport(id);
      const currentAction = fresh.availableActions.find((item) => item.code === code && item.enabled);
      if (!currentAction) throw new Error('Backend больше не разрешает это действие. Карточка будет обновлена.');
      if (code === 'COLLECT' || code === 'RECOLLECT') return { report: await pekApi.collectReport(id, fresh.version) };
      if (code === 'VALIDATE') return { readiness: await pekApi.validateReport(id, fresh.version) };
      if (code === 'SUBMIT_REVIEW') return { report: await pekApi.submitReportReview(id, fresh.version) };
      if (code === 'APPROVE') return { report: await pekApi.approveReport(id, fresh.version) };
      if (code === 'ARCHIVE') return { report: await pekApi.archiveReport(id, fresh.version) };
      throw new Error('Endpoint действия ещё не опубликован backend.');
    },
    retry: false,
    onSuccess: async (result, code) => {
      setPendingAction(null);
      if (result.readiness) client.setQueryData(pekKeys.reportReadiness(id), result.readiness);
      await refresh(result.report);
      toast.success(code === 'COLLECT' || code === 'RECOLLECT' ? 'Сбор данных завершён' : 'Действие выполнено');
    },
    onError: async (error) => {
      setPendingAction(null);
      const mapped = mapPekError(error);
      if (mapped.status === 409 || mapped.code === 'VERSION_CONFLICT') { setConflict(true); await report.refetch(); }
      else await report.refetch();
      toast.error(mapped.message);
    },
  });
  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) return <PekQueryError error={report.error} resource="Отчёт ПЭК" retry={() => void report.refetch()} />;
  const item = report.data;
  const actions = item.availableActions.filter((candidate) => supportedActions.includes(candidate.code));
  const reportReady = readiness.data?.ready ?? item.readiness?.ready;
  const protocolParams = new URLSearchParams({ companyId: String(item.companyId || item.company?.id || ''), objectId: String(item.objectId || item.object?.id || ''), dateFrom: item.periodStart, dateTo: item.periodEnd });
  return <div className="space-y-5">
    <PekPageHeader title={item.number || `Отчёт ПЭК №${item.id}`} description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.periodStart}—${item.periodEnd}`} actions={<><PekStatusBadge status={item.status} />{actions.map((candidate) => <Button key={candidate.code} disabled={!candidate.enabled || action.isPending || (candidate.code === 'SUBMIT_REVIEW' && reportReady === false)} title={candidate.disabledReason || undefined} onClick={() => setPendingAction(candidate.code)}>{candidate.label}</Button>)}</>} />
    <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-6"><Info label="Версия программы" value={item.program?.version ?? '—'} /><Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} /><Info label="План" value={dash(item.plannedCount)} /><Info label="Факт" value={dash(item.actualCount)} /><Info label="Не выполнено" value={dash(item.missingCount)} /><Info label="Превышения" value={dash(item.exceedanceCount)} /></section>
    {item.readOnly && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold">Отчёт доступен только для чтения.</div>}
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Разделы отчёта">{tabs.map((label, index) => <button key={label} type="button" onClick={() => setTab(index)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === index ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}</nav>
    {tab === 0 && <div className="space-y-4"><PekReadinessPanel readiness={readiness.data || item.readiness} onIssueClick={(issue) => setTab(issue.section?.toUpperCase().includes('MATCH') ? 3 : issue.section?.toUpperCase().includes('PLAN') ? 1 : 0)} /><CollectionSummary data={collection.data} loading={collection.isLoading} error={collection.isError} retry={() => collection.refetch()} /></div>}
    {tab === 1 && <PlanFact query={planFact} />}
    {tab === 2 && <section className="rounded-2xl border bg-white p-5"><CollectionSummary data={collection.data} loading={collection.isLoading} error={collection.isError} retry={() => collection.refetch()} /><div className="mt-4 flex gap-2"><Link to={`/staff/protocols?${protocolParams}`} className="rounded-full border px-4 py-2 text-sm font-bold">Открыть протоколы</Link></div></section>}
    {tab === 3 && <Unmatched query={unmatched} />}
    {tab === 4 && <PlanFact query={planFact} exceedancesOnly />}
    {tab === 5 && <PekReadinessPanel readiness={readiness.data || item.readiness} />}
    {[6, 7, 9].includes(tab) && <PekState title="Backend-контракт раздела ещё не опубликован" message="Frontend не создаёт локальные заглушки и не имитирует данные этого раздела." />}
    {tab === 8 && (history.isLoading ? <PekLoading /> : history.isError ? <PekQueryError error={history.error} resource="История отчёта" retry={() => void history.refetch()} /> : <section className="rounded-2xl border bg-white p-5"><PekHistoryTimeline items={history.data?.content || []} /></section>)}
    {!actions.length && <PekState title="Для текущего состояния нет доступных действий" message="Действия определяет backend availableActions." />}
    <Modal open={Boolean(pendingAction)} title="Подтвердите действие" description={actions.find((candidate) => candidate.code === pendingAction)?.label} loading={action.isPending} onClose={() => setPendingAction(null)} footer={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Отмена</Button><Button disabled={action.isPending} onClick={() => pendingAction && action.mutate(pendingAction)}>Подтвердить</Button></>}><p className="text-sm text-slate-600">Перед выполнением будет загружена актуальная версия отчёта и отправлен If-Match.</p></Modal>
    <Modal open={conflict} title="Данные изменены другим пользователем" description="Операция не повторялась автоматически. Загружена актуальная версия отчёта." onClose={() => setConflict(false)} footer={<Button onClick={() => setConflict(false)}>Понятно</Button>}><p className="text-sm text-slate-600">Проверьте актуальные данные и повторите действие вручную.</p></Modal>
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
const CollectionSummary = ({ data, loading, error, retry }: { data?: Awaited<ReturnType<typeof pekApi.getLatestCollection>>; loading: boolean; error: boolean; retry: () => unknown }) => loading ? <PekLoading /> : error ? <PekState title="Не удалось загрузить результат сбора" retry={() => void retry()} /> : !data ? <PekState title="Сбор данных ещё не запускался" /> : <section className="rounded-2xl border bg-white p-5"><h2 className="text-lg font-black">Результат сбора · {data.status}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-7"><Info label="Протоколы" value={dash(data.protocolsFound)} /><Info label="Результаты" value={dash(data.resultsFound)} /><Info label="Точные" value={dash(data.exactMatches)} /><Info label="На проверку" value={dash(data.requiresReview)} /><Info label="Не сопоставлено" value={dash(data.unmatched)} /><Info label="Отклонено" value={dash(data.rejected)} /><Info label="Ошибки" value={dash(data.errors)} /></div></section>;
const PlanFact = ({ query, exceedancesOnly = false }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof pekApi.getPlanFact>>>>; exceedancesOnly?: boolean }) => query.isLoading ? <PekLoading /> : query.isError ? <PekQueryError error={query.error} resource="План/факт" retry={() => void query.refetch()} /> : <section className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left"><tr>{['Объект контроля', 'Показатель', 'Единица', 'План', 'Факт', 'Не выполнено', 'Максимум', 'Норматив', 'Статус'].map((label) => <th className="px-4 py-3" key={label}>{label}</th>)}</tr></thead><tbody>{(query.data?.content || []).filter((row) => !exceedancesOnly || row.status === 'EXCEEDANCE').map((row) => <tr className="border-t" key={row.id}><td className="px-4 py-3">{row.controlItemName}</td><td className="px-4 py-3">{row.indicatorName}</td><td className="px-4 py-3">{row.unit || '—'}</td><td className="px-4 py-3">{dash(row.planned)}</td><td className="px-4 py-3">{dash(row.actual)}</td><td className="px-4 py-3">{dash(row.missing)}</td><td className="px-4 py-3">{dash(row.maximum)}</td><td className="px-4 py-3">{dash(row.normative)}</td><td className="px-4 py-3"><PekStatusBadge status={row.status} /></td></tr>)}</tbody></table>{!query.data?.content.length && <PekState title="Сервер не вернул строки план/факт" />}</section>;
const Unmatched = ({ query }: { query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof pekApi.getUnmatchedSources>>>> }) => query.isLoading ? <PekLoading /> : query.isError ? <PekQueryError error={query.error} resource="Сопоставления" retry={() => void query.refetch()} /> : <section className="space-y-3 rounded-2xl border bg-white p-5">{(query.data?.content || []).map((source) => <article className="rounded-xl border p-4" key={source.id}><div className="flex flex-wrap justify-between gap-2"><div><strong>{source.protocolNumber || 'Протокол без номера'}</strong><p className="text-sm text-slate-600">{source.indicatorName || 'Показатель не указан'} · {String(source.value ?? '—')} {source.unit || ''}</p><p className="text-xs text-slate-500">{source.pointName || 'Точка не указана'} · {source.protocolDate || 'дата не указана'}</p></div><PekStatusBadge status={source.status} /></div>{source.reason && <p className="mt-2 text-sm text-amber-800">{source.reason}</p>}</article>)}{!query.data?.content.length && <PekState title="Результатов, требующих сопоставления, нет" />}</section>;
export default PekReportWorkspacePage;
