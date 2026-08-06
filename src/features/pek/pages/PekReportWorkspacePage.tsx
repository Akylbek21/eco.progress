import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button as MuiButton, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { parseApiError } from '../../../services/apiHelpers';
import type { PekReport, PekReportSource } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { canUsePekPermission } from '../permissions/pekAccess';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabs = [
  { key: 'overview', label: 'Обзор' },
  { key: 'sources', label: 'Источники данных' },
  { key: 'plan-fact', label: 'План / факт' },
  { key: 'exceedances', label: 'Превышения' },
  { key: 'actions', label: 'Мероприятия' },
  { key: 'documents', label: 'Документы' },
  { key: 'history', label: 'История' },
] as const;
type TabKey = typeof tabs[number]['key'];

const matchLabels: Record<string, string> = {
  MATCHED: 'Сопоставлен', MANUAL: 'Сопоставлен вручную', MANUALLY_MATCHED: 'Сопоставлен вручную',
  UNMATCHED: 'Не сопоставлен', AMBIGUOUS: 'Неоднозначный', STALE: 'Устаревшая связь', EXCLUDED: 'Исключён',
};
const planLabels: Record<string, string> = {
  NOT_STARTED: 'Не выполнено', PARTIALLY_COMPLETED: 'Выполнено частично', COMPLETED: 'Выполнено',
  OVERDUE: 'Просрочено', EXCEEDED: 'Есть превышение', NOT_APPLICABLE: 'Не применяется',
};

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') as TabKey | null;
  const tab = tabs.some((item) => item.key === requestedTab) ? requestedTab as TabKey : 'overview';
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selectedSource, setSelectedSource] = useState<PekReportSource | null>(null);
  const [indicatorId, setIndicatorId] = useState('');
  const [excludeSource, setExcludeSource] = useState<PekReportSource | null>(null);
  const [excludeReason, setExcludeReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [collectionSummary, setCollectionSummary] = useState<Awaited<ReturnType<typeof pekApi.collectReport>> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const report = useQuery({
    queryKey: pekKeys.report(id), queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0, retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
  });
  const program = useQuery({
    queryKey: pekKeys.program(report.data?.programId || 'pending'),
    queryFn: ({ signal }) => pekApi.getProgram(report.data!.programId, signal),
    enabled: Boolean(report.data?.programId), retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
  });
  const sources = useQuery({
    queryKey: pekKeys.reportSources(id, sourceFilter === 'ALL' ? {} : sourceFilter === 'EXCLUDED' ? { excluded: true } : { matchStatus: sourceFilter }),
    queryFn: ({ signal }) => pekApi.getReportSources(id, sourceFilter === 'ALL' ? {} : sourceFilter === 'EXCLUDED' ? { excluded: true } : { matchStatus: sourceFilter }, signal),
    enabled: Boolean(report.data) && tab === 'sources', retry: retryPekQuery,
  });
  const sourceSummary = useQuery({
    queryKey: pekKeys.reportSourcesSummary(id), queryFn: ({ signal }) => pekApi.getReportSourcesSummary(id, signal),
    enabled: Boolean(report.data), retry: retryPekQuery,
  });
  const planFact = useQuery({
    queryKey: pekKeys.planFact(id), queryFn: ({ signal }) => pekApi.getReportPlanFact(id, signal),
    enabled: Boolean(report.data) && ['overview', 'plan-fact', 'exceedances'].includes(tab), retry: retryPekQuery,
  });
  const readiness = useQuery({
    queryKey: pekKeys.readiness(id), queryFn: ({ signal }) => pekApi.getReportReadiness(id, signal),
    enabled: Boolean(report.data) && tab === 'overview', retry: retryPekQuery,
  });

  const invalidateReportData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pekKeys.report(id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSourcesRoot(id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSourcesSummary(id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.planFact(id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.readiness(id) }),
      queryClient.invalidateQueries({ queryKey: ['pek', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['pek', 'reports'] }),
    ]);
  };
  const refreshAfterWorkflow = async (expected: string[]) => {
    const actual = await pekApi.getReport(id);
    queryClient.setQueryData(pekKeys.report(id), actual);
    if (!expected.includes(actual.status)) throw new Error(`Операция выполнена, но сервер вернул статус ${actual.status}. Обновите данные.`);
    await invalidateReportData();
    return actual;
  };

  const collect = useMutation({
    mutationFn: () => pekApi.collectReport(id),
    onSuccess: async (result) => { setCollectionSummary(result); setActionError(null); await invalidateReportData(); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось собрать данные из протоколов.').message),
  });
  const submitReview = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.getReportReadiness(id).then((value) => { if (!value.ready) throw new Error('Отчёт пока не готов к отправке. Исправьте блокирующие ошибки.'); }); await pekApi.submitReportReview(id, item.version); return refreshAfterWorkflow(['READY_FOR_REVIEW']); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось отправить отчёт на проверку.').message),
  });
  const returnReport = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.returnReport(id, item.version, returnReason.trim()); return refreshAfterWorkflow(['RETURNED']); },
    onSuccess: () => { setReturnOpen(false); setReturnReason(''); setActionError(null); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось вернуть отчёт.').message),
  });
  const approve = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.approveReport(id, item.version); return refreshAfterWorkflow(['APPROVED']); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось утвердить отчёт.').message),
  });
  const archive = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.archiveReport(id, item.version); return refreshAfterWorkflow(['ARCHIVED']); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось архивировать отчёт.').message),
  });
  const match = useMutation({
    mutationFn: () => pekApi.matchReportSource(id, selectedSource!.id, Number(indicatorId), selectedSource!.version),
    onSuccess: async () => { setSelectedSource(null); setIndicatorId(''); setActionError(null); await invalidateReportData(); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось сопоставить результат.').message),
  });
  const exclude = useMutation({
    mutationFn: () => pekApi.excludeReportSource(id, excludeSource!.id, excludeReason.trim(), excludeSource!.version),
    onSuccess: async () => { setExcludeSource(null); setExcludeReason(''); setActionError(null); await invalidateReportData(); },
    onError: (error) => setActionError(parseApiError(error, 'Не удалось исключить источник.').message),
  });
  const restore = useMutation({
    mutationFn: (source: PekReportSource) => pekApi.restoreReportSource(id, source.id, source.version),
    onSuccess: invalidateReportData,
    onError: (error) => setActionError(parseApiError(error, 'Не удалось восстановить источник.').message),
  });

  const indicators = useMemo(() => program.data?.indicators || [], [program.data?.indicators]);
  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) return <PekQueryError error={report.error} resource="отчёт ПЭК" retry={() => void report.refetch()} />;
  const item = report.data;
  const actions = item.availableActions || {};
  const canEdit = canUsePekPermission(user, 'PEK_REPORT_EDIT');
  const canReview = canUsePekPermission(user, 'PEK_REPORT_REVIEW');
  const pending = collect.isPending || submitReview.isPending || returnReport.isPending || approve.isPending || archive.isPending;
  const setTab = (nextTab: TabKey) => { const next = new URLSearchParams(params); nextTab === 'overview' ? next.delete('tab') : next.set('tab', nextTab); setParams(next, { replace: true }); };

  return <div className="space-y-5">
    <PekPageHeader title={`Отчёт ПЭК за ${item.periodStart} — ${item.periodEnd}`} description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · версия ${item.version}`} actions={<PekStatusBadge status={item.status} />} />
    {actionError && <Alert severity="error" action={<MuiButton color="inherit" size="small" onClick={() => void report.refetch()}>Обновить данные</MuiButton>}>{actionError}</Alert>}
    <div className="flex flex-wrap gap-2">
      {actions.collect && canEdit && <MuiButton variant="contained" disabled={pending} onClick={() => collect.mutate()}>Собрать данные из протоколов</MuiButton>}
      {actions.submitReview && canUsePekPermission(user, 'PEK_REPORT_SUBMIT') && <MuiButton variant="contained" disabled={pending || readiness.isFetching || readiness.data?.ready === false} onClick={() => submitReview.mutate(item)}>Отправить на проверку</MuiButton>}
      {actions.returnForRevision && canReview && <MuiButton color="warning" variant="outlined" disabled={pending} onClick={() => setReturnOpen(true)}>Вернуть на доработку</MuiButton>}
      {actions.approve && canReview && <MuiButton variant="contained" disabled={pending} onClick={() => approve.mutate(item)}>Утвердить</MuiButton>}
      {actions.archive && canReview && <MuiButton variant="outlined" disabled={pending} onClick={() => archive.mutate(item)}>Архивировать</MuiButton>}
    </div>
    {collectionSummary && <Alert severity={collectionSummary.warnings.length ? 'warning' : 'success'}>
      Найдено протоколов: {collectionSummary.linkedProtocolCount}. Сопоставлено: {collectionSummary.matchedCount}. Не сопоставлено: {collectionSummary.unmatchedCount}. Неоднозначно: {collectionSummary.ambiguousCount}. Устаревших связей удалено: {collectionSummary.removedStaleSourceCount}.
      {collectionSummary.warnings.length > 0 && <ul className="mt-2 list-disc pl-5">{collectionSummary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    </Alert>}
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Разделы отчёта">{tabs.map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === key ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}</nav>

    {tab === 'overview' && <div className="space-y-4">
      <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} /><Info label="Программа" value={program.data ? `${program.data.number} · ${program.data.name}` : 'Загрузка…'} /><Info label="Связано протоколов" value={item.linkedProtocolCount} /><Info label="Последний сбор" value={item.lastCollectedAt || 'Сбор ещё не выполнялся'} /><Info label="Ответственный" value={item.responsibleUser?.name || 'Не назначен'} /><Info label="Результатов" value={sourceSummary.data?.linkedResultCount ?? '—'} />
      </section>
      <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Готовность отчёта</h2>
        {readiness.isLoading ? <p className="mt-2">Проверяем…</p> : readiness.isError ? <PekQueryError error={readiness.error} resource="готовность отчёта" retry={() => void readiness.refetch()} /> : readiness.data && <>
          <p className="mt-2 text-2xl font-black">{readiness.data.progressPercent}%</p>
          {readiness.data.issues.length ? <ul className="mt-3 space-y-2">{readiness.data.issues.map((issue) => <li key={issue.code}><button className={`w-full rounded-xl border p-3 text-left ${issue.blocking ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`} onClick={() => setTab(issue.section === 'SOURCES' ? 'sources' : issue.section === 'EXCEEDANCES' ? 'exceedances' : 'plan-fact')}>{issue.blocking ? 'Блокирует отправку: ' : 'Предупреждение: '}{issue.message}</button></li>)}</ul> : <Alert className="mt-3" severity="success">Отчёт готов к отправке.</Alert>}
        </>}
        <Link className="mt-4 inline-flex font-bold text-eco-700" to={`/staff/pek/programs/${item.programId}`}>Открыть программу ПЭК</Link>
      </section>
    </div>}

    {tab === 'sources' && <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-black">Источники данных</h2><p className="text-sm text-slate-600">Только фактически сохранённые backend связи отчёта.</p></div><TextField select size="small" label="Статус" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} sx={{ minWidth: 220 }}><MenuItem value="ALL">Все</MenuItem><MenuItem value="MATCHED">Сопоставленные</MenuItem><MenuItem value="MANUALLY_MATCHED">Сопоставленные вручную</MenuItem><MenuItem value="UNMATCHED">Несопоставленные</MenuItem><MenuItem value="AMBIGUOUS">Неоднозначные</MenuItem><MenuItem value="STALE">Устаревшие</MenuItem><MenuItem value="EXCLUDED">Исключённые</MenuItem></TextField></div>
      {sources.isLoading ? <PekLoading /> : sources.isError ? <PekQueryError error={sources.error} resource="источники отчёта" retry={() => void sources.refetch()} /> : !sources.data?.length ? <PekState title="Источники не найдены" message="Запустите сбор данных или измените фильтр." /> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Протокол</th><th>Показатель программы</th><th>Ед.</th><th>Позиция</th><th>Статус</th><th>Причина</th><th>Действия</th></tr></thead><tbody>{sources.data.map((source) => <tr key={source.id} className={`border-b ${source.excluded ? 'bg-slate-100 text-slate-500' : ''}`}><td className="p-2">№ {source.protocolNumber}</td><td>{source.indicatorName || 'Не сопоставлен'}</td><td>{source.unit || '—'}</td><td>{source.controlItemId || '—'}</td><td>{source.excluded ? 'Исключён' : matchLabels[source.matchStatus] || source.matchStatus}</td><td>{source.exclusionReason || source.matchReason || '—'}</td><td><div className="flex flex-wrap gap-2">{!source.excluded && ['UNMATCHED', 'AMBIGUOUS'].includes(source.matchStatus) && actions.matchSources && canEdit && <MuiButton size="small" onClick={() => { setSelectedSource(source); setIndicatorId(''); }}>Сопоставить вручную</MuiButton>}{!source.excluded && canEdit && <MuiButton size="small" color="error" onClick={() => setExcludeSource(source)}>Исключить</MuiButton>}{source.excluded && canEdit && <MuiButton size="small" disabled={restore.isPending} onClick={() => restore.mutate(source)}>Восстановить</MuiButton>}</div></td></tr>)}</tbody></table></div>}
    </section>}

    {tab === 'plan-fact' && <PlanFactContent loading={planFact.isLoading} error={planFact.error} data={planFact.data} retry={() => void planFact.refetch()} />}
    {tab === 'exceedances' && <section className="rounded-2xl border bg-white p-5"><h2 className="font-black">Превышения</h2>{planFact.isLoading ? <PekLoading /> : planFact.data?.items.some((row) => row.hasExceedance) ? <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th>Позиция</th><th>Показатель</th><th>Норматив</th><th>Худшее значение</th><th>Количество</th></tr></thead><tbody>{planFact.data.items.filter((row) => row.hasExceedance).map((row) => <tr key={row.planFactRowId} className="border-b"><td className="py-3">{row.controlItemName}</td><td>{row.indicatorName}</td><td>{row.normativeValue ?? '—'}</td><td>{row.worstValue ?? '—'}</td><td>{row.exceedanceCount}</td></tr>)}</tbody></table></div> : <PekState title="Превышения не обнаружены" message="Показаны только результаты, рассчитанные backend plan/fact." />}</section>}
    {tab === 'actions' && <PekState title="Мероприятия отчёта недоступны" message="В актуальном backend нет API корректирующих мероприятий отчёта. Данные не подменяются локальной таблицей." />}
    {tab === 'documents' && <PekState title="Документы отчёта недоступны" message="В актуальном backend нет API документов отчёта. Документы программы доступны в карточке программы." />}
    {tab === 'history' && <PekState title="История отчёта недоступна" message="Backend предоставляет историю программ, но не отдельную историю отчётов." />}

    <Dialog open={Boolean(selectedSource)} onClose={() => !match.isPending && setSelectedSource(null)} fullWidth maxWidth="sm"><DialogTitle>Сопоставить результат вручную</DialogTitle><DialogContent className="space-y-4"><Alert severity="info">Протокол № {selectedSource?.protocolNumber}. Исходный результат: {selectedSource?.protocolResultId}. Backend не возвращает название и значение исходного показателя в DTO источника.</Alert><TextField select fullWidth margin="normal" label="Показатель программы" value={indicatorId} onChange={(event) => setIndicatorId(event.target.value)}>{indicators.map((indicator) => <MenuItem key={indicator.id} value={indicator.id}>{indicator.indicatorName} · {indicator.unit || 'без единицы'}</MenuItem>)}</TextField></DialogContent><DialogActions><MuiButton onClick={() => setSelectedSource(null)}>Отмена</MuiButton><MuiButton variant="contained" disabled={!indicatorId || match.isPending} onClick={() => match.mutate()}>Сопоставить</MuiButton></DialogActions></Dialog>
    <Dialog open={Boolean(excludeSource)} onClose={() => !exclude.isPending && setExcludeSource(null)} fullWidth maxWidth="sm"><DialogTitle>Исключить источник из отчёта</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} margin="normal" label="Причина исключения *" value={excludeReason} onChange={(event) => setExcludeReason(event.target.value)} /></DialogContent><DialogActions><MuiButton onClick={() => setExcludeSource(null)}>Отмена</MuiButton><MuiButton color="error" variant="contained" disabled={!excludeReason.trim() || exclude.isPending} onClick={() => exclude.mutate()}>Исключить</MuiButton></DialogActions></Dialog>
    <Dialog open={returnOpen} onClose={() => !returnReport.isPending && setReturnOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Вернуть отчёт на доработку</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} margin="normal" label="Причина возврата *" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></DialogContent><DialogActions><MuiButton onClick={() => setReturnOpen(false)}>Отмена</MuiButton><MuiButton color="warning" variant="contained" disabled={!returnReason.trim() || returnReport.isPending} onClick={() => returnReport.mutate(item)}>Вернуть</MuiButton></DialogActions></Dialog>
  </div>;
};

const PlanFactContent = ({ loading, error, data, retry }: { loading: boolean; error: unknown; data?: Awaited<ReturnType<typeof pekApi.getReportPlanFact>>; retry: () => void }) => {
  if (loading) return <PekLoading />;
  if (error) return <PekQueryError error={error} resource="план/факт" retry={retry} />;
  if (!data?.items.length) return <PekState title="План/факт не сформирован" message="Запустите сбор данных из протоколов." />;
  return <section className="space-y-4 rounded-2xl border bg-white p-5"><div className="grid gap-3 sm:grid-cols-5"><Info label="План" value={data.summary.planned} /><Info label="Выполнено" value={data.summary.completed} /><Info label="Не хватает" value={data.summary.missing} /><Info label="Выполнение" value={`${data.summary.completionPercent}%`} /><Info label="Превышения" value={data.summary.exceedances} /></div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Позиция</th><th>Показатель</th><th>План</th><th>Факт</th><th>Не хватает</th><th>Выполнение</th><th>Последний результат</th><th>Статус</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.planFactRowId} className="border-b"><td className="p-2">{row.controlItemName}</td><td>{row.indicatorName}</td><td>{row.plannedCount}</td><td>{row.actualCount}</td><td>{row.missingCount}</td><td>{row.completionPercent}%</td><td>{row.worstValue ?? row.averageValue ?? '—'}</td><td>{planLabels[row.status] || row.status}{row.hasExceedance ? ' · превышение' : ''}</td></tr>)}</tbody></table></div></section>;
};
const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
export default PekReportWorkspacePage;
