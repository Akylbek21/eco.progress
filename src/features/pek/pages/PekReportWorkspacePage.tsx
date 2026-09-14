import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button as MuiButton, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ActionMenu from '../../../components/ui/ActionMenu';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekReport, PekReportSource } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekReadiness, PekState, PekStatusBadge } from '../components/common/PekUi';
import PekReportActions from '../components/workflow/PekReportActions';
import { isPekVersionConflict, mapPekError } from '../utils/pekErrorMapper';
import { handlePekMutationError as handleVersionedPekError } from '../utils/pekMutationError';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';
import { labelPekMatchStatus, labelPekPlanFactStatus, labelPekReportType } from '../utils/pekLabels';
import PekReportDocuments from '../components/documents/PekReportDocuments';
import PekReportPackageCard from '../components/documents/PekReportPackageCard';
import PekReportExceedances from '../components/exceedances/PekReportExceedances';
import PekInventoryEditor from '../components/inventory/PekInventoryEditor';
import PekReportSubmissionDialog, { pekSubmissionMethodLabels, type PekSubmissionDraft } from '../components/submission/PekReportSubmissionDialog';
import PekOfficialReport from '../components/official/PekOfficialReport';

const tabs = [
  { key: 'overview', label: 'Общие сведения' },
  { key: 'official', label: 'Официальный отчёт' },
  { key: 'sources', label: 'Производственный мониторинг' },
  { key: 'plan-fact', label: 'PLAN / FACT' },
  { key: 'exceedances', label: 'Превышения' },
  { key: 'waste-movements', label: 'Отходы' },
  { key: 'documents', label: 'Документы' },
  { key: 'history', label: 'История' },
] as const;
type TabKey = typeof tabs[number]['key'];

const reportSectionLabels: Record<string, string> = {
  SOURCES: 'Производственный мониторинг', EXCEEDANCES: 'Превышения', PLAN_FACT: 'PLAN / FACT',
  DOCUMENTS: 'Документы', SUBMISSION: 'Сдача', GENERAL: 'Общие сведения',
};
const deadlineRemaining = (submissionDueDate: string | null) => {
  if (!submissionDueDate) return 'Backend не установил срок';
  const due = new Date(`${submissionDueDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000);
  if (days < 0) return `Просрочено на ${Math.abs(days)} дн.`;
  if (days === 0) return 'Срок сегодня';
  return `Осталось: ${days} дн.`;
};

const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
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
  const [controlItemId, setControlItemId] = useState('');
  const [indicatorId, setIndicatorId] = useState('');
  const [excludeSource, setExcludeSource] = useState<PekReportSource | null>(null);
  const [excludeReason, setExcludeReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [collectionSummary, setCollectionSummary] = useState<Awaited<ReturnType<typeof pekApi.collectReport>> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [conflictOpen, setConflictOpen] = useState(false);
  const [collectConfirmOpen, setCollectConfirmOpen] = useState(false);
  const [actualCapacity, setActualCapacity] = useState('');
  const [actualCapacityUnit, setActualCapacityUnit] = useState('');

  const report = useQuery({
    queryKey: pekKeys.report(id, undefined, user?.id), queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0, retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
  });
  const program = useQuery({
    queryKey: pekKeys.programDetail(report.data?.companyId, report.data?.programId || 'pending'),
    queryFn: ({ signal }) => pekApi.getProgram(report.data!.programId, signal),
    enabled: Boolean(report.data?.programId), retry: retryPekQuery, staleTime: PEK_STALE_TIME_MS,
  });
  const sources = useQuery({
    queryKey: pekKeys.reportSources(id, sourceFilter === 'ALL' ? {} : sourceFilter === 'EXCLUDED' ? { excluded: true } : { matchStatus: sourceFilter }, report.data?.companyId, user?.id),
    queryFn: ({ signal }) => pekApi.getReportSources(id, sourceFilter === 'ALL' ? {} : sourceFilter === 'EXCLUDED' ? { excluded: true } : { matchStatus: sourceFilter }, signal),
    enabled: Boolean(report.data) && tab === 'sources', retry: retryPekQuery,
  });
  const sourceSummary = useQuery({
    queryKey: pekKeys.reportSourcesSummary(id, report.data?.companyId, user?.id), queryFn: ({ signal }) => pekApi.getReportSourcesSummary(id, signal),
    enabled: Boolean(report.data), retry: retryPekQuery,
  });
  const planFact = useQuery({
    queryKey: pekKeys.planFact(id, report.data?.companyId, user?.id), queryFn: ({ signal }) => pekApi.getReportPlanFact(id, signal),
    enabled: Boolean(report.data) && ['overview', 'plan-fact'].includes(tab), retry: retryPekQuery,
  });
  const readiness = useQuery({
    queryKey: pekKeys.readiness(id, report.data?.companyId, user?.id), queryFn: ({ signal }) => pekApi.getReportReadiness(id, signal),
    enabled: Boolean(report.data) && ['overview', 'official'].includes(tab), retry: retryPekQuery,
  });
  const officialData = useQuery({
    queryKey: ['pek', 'reports', id, 'official-data', user?.id],
    queryFn: ({ signal }) => pekApi.getOfficialReportData(id, signal),
    enabled: Boolean(report.data) && tab === 'official',
    retry: retryPekQuery,
  });
  const history = useQuery({
    queryKey: pekKeys.reportHistory(id, report.data?.companyId, user?.id),
    queryFn: ({ signal }) => pekApi.getReportHistory(id, signal),
    enabled: Boolean(report.data) && tab === 'history',
    retry: retryPekQuery,
  });

  useEffect(() => {
    setActualCapacity(report.data?.actualCapacity || '');
    setActualCapacityUnit(report.data?.actualCapacityUnit || '');
  }, [report.data?.actualCapacity, report.data?.actualCapacityUnit]);

  const invalidateReportData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pekKeys.report(id, undefined, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSourcesRoot(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSourcesSummary(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.planFact(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.readiness(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.dashboardRoot(report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportHistory(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportDocuments(id, undefined, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportPackage(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSignatures(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: ['pek', 'reports', id, 'official-data', user?.id] }),
    ]);
  };
  const invalidateWorkflowData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: pekKeys.report(id, undefined, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportsRoot(report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.readiness(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportDocuments(id, undefined, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportPackage(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportSignatures(id, report.data?.companyId, user?.id) }),
      queryClient.invalidateQueries({ queryKey: pekKeys.reportHistory(id, report.data?.companyId, user?.id) }),
    ]);
  };
  const handleMutationError = async (error: unknown, fallback: string) => {
    const mapped = await handleVersionedPekError(error, invalidateReportData);
    const diagnostics = [mapped.code && `код ${mapped.code}`, mapped.traceId && `traceId ${mapped.traceId}`]
      .filter(Boolean)
      .join(', ');
    const message = `${mapped.message || fallback}${diagnostics ? ` (${diagnostics})` : ''}`;
    if (mapped.code === 'PEK_REPORT_NOT_EDITABLE') {
      await report.refetch();
      setActionError(`${message}. Отчёт уже перешёл в статус, в котором изменения запрещены.`);
      return;
    }
    if (isPekVersionConflict(mapped)) {
      setConflictOpen(true);
      setActionError(message);
      return;
    }
    setActionError(message);
  };
  const refreshAfterWorkflow = async (expected: string[]) => {
    const actual = await pekApi.getReport(id);
    queryClient.setQueryData(pekKeys.report(id, undefined, user?.id), actual);
    if (!expected.includes(actual.status)) throw new Error(`Операция выполнена, но сервер вернул статус ${actual.status}. Обновите данные.`);
    await invalidateWorkflowData();
    return actual;
  };

  const updateGeneral = useMutation({
    mutationFn: () => pekApi.updateReportGeneral(id, report.data!.version, {
      actualCapacity: actualCapacity.trim() || null,
      actualCapacityUnit: actualCapacityUnit.trim() || null,
    }),
    onSuccess: async (actual) => {
      queryClient.setQueryData(pekKeys.report(id, undefined, user?.id), actual);
      setActionError(null);
      await invalidateReportData();
    },
    onError: (error) => void handleMutationError(error, 'Не удалось сохранить фактическую мощность.'),
    retry: false,
  });

  const collect = useMutation({
    mutationFn: async () => {
      const result = await pekApi.collectReport(id, report.data!.version);
      const actual = await pekApi.getReport(id);
      if (actual.linkedProtocolCount !== result.linkedProtocolCount) {
        throw new Error('Сбор завершён, но повторный GET не подтвердил пересчёт связанных протоколов.');
      }
      queryClient.setQueryData(pekKeys.report(id, undefined, user?.id), actual);
      return { ...result, report: actual };
    },
    onSuccess: async (result) => { setCollectConfirmOpen(false); setCollectionSummary(result); setActionError(null); await invalidateReportData(); },
    onError: async (error) => {
      const mapped = mapPekError(error);
      if (isPekVersionConflict(mapped)) {
        await invalidateReportData();
        setActionError('Данные были изменены другим сотрудником.\nОбновите страницу и повторите действие.');
        setCollectConfirmOpen(false);
        return;
      }
      await handleMutationError(error, 'Не удалось собрать данные из протоколов.');
    },
    retry: false,
  });
  const submitReview = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.submitReportReview(id, item.version); return refreshAfterWorkflow(['READY_FOR_REVIEW']); },
    onError: (error) => void handleMutationError(error, 'Не удалось отправить отчёт на проверку.'),
    retry: false,
  });
  const returnReport = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.returnReport(id, item.version, returnReason.trim()); return refreshAfterWorkflow(['RETURNED']); },
    onSuccess: () => { setReturnOpen(false); setReturnReason(''); setActionError(null); },
    onError: (error) => void handleMutationError(error, 'Не удалось вернуть отчёт.'),
    retry: false,
  });
  const approve = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.approveReport(id, item.version); return refreshAfterWorkflow(['APPROVED']); },
    onError: (error) => void handleMutationError(error, 'Не удалось утвердить отчёт.'),
    retry: false,
  });
  const submitAuthority = useMutation({
    mutationFn: async (draft: PekSubmissionDraft) => {
      const uploaded = draft.confirmationFile
        ? await pekApi.uploadReportSubmissionConfirmation(id, draft.confirmationFile)
        : null;
      const current = report.data!;
      const confirmationFileId = uploaded?.fileId || current.submission?.confirmationFileId || null;
      if (current.status === 'SIGNED' && current.availableActions.submit === true) {
        return pekApi.submitReport(id, current.version, {
          submissionMethod: draft.submissionMethod,
          registrationNumber: draft.registrationNumber.trim() || null,
          submittedAt: draft.submittedAt,
          comment: draft.submissionComment.trim() || null,
          confirmationFileId,
        });
      }
      return pekApi.recordReportSubmission(id, current.version, {
        submissionMethod: draft.submissionMethod,
        registrationNumber: draft.registrationNumber.trim() || null,
        submittedAt: draft.submittedAt,
        submissionComment: draft.submissionComment.trim() || null,
        confirmationFileId,
      });
    },
    onSuccess: async (actual) => {
      queryClient.setQueryData(pekKeys.report(id, undefined, user?.id), actual);
      setSubmitConfirmOpen(false);
      setActionError(null);
      await invalidateWorkflowData();
    },
    onError: async (error) => {
      await invalidateWorkflowData();
      await handleMutationError(error, 'Не удалось сохранить сведения о сдаче официального отчёта.');
    },
    retry: false,
  });
  const accept = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.acceptReport(id, item.version); return refreshAfterWorkflow(['ACCEPTED']); },
    onSuccess: () => { setAcceptConfirmOpen(false); setActionError(null); },
    onError: (error) => void handleMutationError(error, 'Не удалось принять отчёт.'),
    retry: false,
  });
  const reject = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.rejectReport(id, item.version, rejectionReason.trim()); return refreshAfterWorkflow(['REJECTED']); },
    onSuccess: () => { setRejectOpen(false); setRejectionReason(''); setActionError(null); },
    onError: (error) => void handleMutationError(error, 'Не удалось отклонить отчёт.'),
    retry: false,
  });
  const archive = useMutation({
    mutationFn: async (item: PekReport) => { await pekApi.archiveReport(id, item.version); return refreshAfterWorkflow(['ARCHIVED']); },
    onError: (error) => void handleMutationError(error, 'Не удалось архивировать отчёт.'),
    retry: false,
  });
  const match = useMutation({
    mutationFn: async () => {
      const sourceId = selectedSource!.id;
      await pekApi.matchReportSource(id, sourceId, Number(indicatorId), selectedSource!.version);
      const actual = (await pekApi.getReportSources(id)).find((source) => source.id === sourceId);
      if (!actual || !['MANUAL', 'MANUALLY_MATCHED', 'MATCHED'].includes(actual.matchStatus)) {
        throw new Error('Сопоставление отправлено, но повторный GET не подтвердил связь.');
      }
      return actual;
    },
    onSuccess: async () => { setSelectedSource(null); setIndicatorId(''); setActionError(null); await invalidateReportData(); },
    onError: (error) => void handleMutationError(error, 'Не удалось сопоставить результат.'),
    retry: false,
  });
  const exclude = useMutation({
    mutationFn: async () => {
      const sourceId = excludeSource!.id;
      await pekApi.excludeReportSource(id, sourceId, excludeReason.trim(), excludeSource!.version);
      const actual = (await pekApi.getReportSources(id)).find((source) => source.id === sourceId);
      if (!actual?.excluded) throw new Error('Исключение отправлено, но повторный GET не подтвердил изменение источника.');
      return actual;
    },
    onSuccess: async () => { setExcludeSource(null); setExcludeReason(''); setActionError(null); await invalidateReportData(); },
    onError: (error) => void handleMutationError(error, 'Не удалось исключить источник.'),
    retry: false,
  });
  const restore = useMutation({
    mutationFn: async (source: PekReportSource) => {
      await pekApi.restoreReportSource(id, source.id, source.version);
      const actual = (await pekApi.getReportSources(id)).find((item) => item.id === source.id);
      if (!actual || actual.excluded) throw new Error('Восстановление отправлено, но повторный GET не подтвердил изменение источника.');
      return actual;
    },
    onSuccess: invalidateReportData,
    onError: (error) => void handleMutationError(error, 'Не удалось восстановить источник.'),
    retry: false,
  });
  const downloadSubmissionConfirmation = useMutation({
    mutationFn: () => pekApi.downloadReportSubmissionConfirmation(id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (error) => setActionError(mapPekError(error).message),
  });

  const indicators = useMemo(() => program.data?.indicators || [], [program.data?.indicators]);
  const controlItems = useMemo(() => program.data?.controlItems || [], [program.data?.controlItems]);
  const filteredIndicators = useMemo(() => indicators.filter((indicator) => String(indicator.controlItemId || '') === controlItemId), [controlItemId, indicators]);
  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) return <PekQueryError error={report.error} resource="отчёт ПЭК" retry={() => void report.refetch()} />;
  const item = report.data;
  const canMutateSources = item.availableActions.matchSources === true;
  const pending = collect.isPending || updateGeneral.isPending || submitReview.isPending || returnReport.isPending || approve.isPending || submitAuthority.isPending || accept.isPending || reject.isPending || archive.isPending;
  const setTab = (nextTab: TabKey) => { const next = new URLSearchParams(params); nextTab === 'overview' ? next.delete('tab') : next.set('tab', nextTab); setParams(next, { replace: true }); };

  return <div className="space-y-4">
    <PekPageHeader title="ПЭК Отчёт" description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.periodStart} — ${item.periodEnd}`} actions={<><PekReadiness value={readiness.data?.progressPercent} /><PekStatusBadge status={item.status} /><PekReportActions report={item} isPending={pending} onCollect={() => setCollectConfirmOpen(true)} onSubmit={() => submitReview.mutate(item)} onReturn={() => setReturnOpen(true)} onApprove={() => setApproveConfirmOpen(true)} onSubmitAuthority={() => setSubmitConfirmOpen(true)} onAccept={() => setAcceptConfirmOpen(true)} onReject={() => setRejectOpen(true)} onArchive={() => setArchiveConfirmOpen(true)} /></>} />
    {actionError && <Alert severity="error" action={<MuiButton color="inherit" size="small" onClick={() => void report.refetch()}>Обновить данные</MuiButton>}>{actionError}</Alert>}
    {['SUBMITTED', 'ACCEPTED', 'REJECTED'].includes(item.status) && <Alert severity="info">Статус сдачи, принятия или отклонения отмечен сотрудником вручную. Автоматическое подтверждение государственного органа не поступает.</Alert>}
    {item.status === 'REJECTED' && <Alert severity="error"><strong>Отмечено отклонение отчёта.</strong><div className="mt-1">Причина: {item.rejectionReason || 'не указана'} · дата: {item.rejectedAt || 'не указана'}</div></Alert>}
    {item.status === 'RETURNED' && <Alert severity="warning">
      <strong>Отчёт возвращён на доработку</strong>
      {item.returnInfo ? <div className="mt-2 space-y-1">
        <div><strong>Причина:</strong> {item.returnInfo.reason || 'не указана'}</div>
        {item.returnInfo.comment && <div><strong>Комментарий:</strong> {item.returnInfo.comment}</div>}
        <div><strong>Кто вернул:</strong> {item.returnInfo.returnedBy?.name || 'не указано'}</div>
        <div><strong>Дата возврата:</strong> {item.returnInfo.returnedAt || 'не указана'}</div>
      </div> : <div className="mt-2">Причина, автор и дата возврата отсутствуют в ответе сервиса. Текущая версия: {item.version}.</div>}
    </Alert>}
    {collect.isPending && <Alert severity="info">Ищем подходящие подписанные протоколы...</Alert>}
    {collectionSummary && <Alert severity={collectionSummary.warnings.length ? 'warning' : 'success'}>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4"><span>Найдено протоколов: {collectionSummary.linkedProtocolCount}</span><span>Добавлено: {collectionSummary.addedCount}</span><span>Обновлено: {collectionSummary.updatedCount}</span><span>Сопоставлено: {collectionSummary.matchedCount} результатов</span><span>Требуют проверки: {collectionSummary.reviewRequiredCount}</span><span>Не сопоставлено: {collectionSummary.unmatchedCount}</span><span>Превышений: {collectionSummary.exceedanceCount}</span></div>
      {collectionSummary.warnings.length > 0 && <ul className="mt-2 list-disc pl-5">{collectionSummary.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    </Alert>}
    <nav className="pek-section-nav sticky top-0 z-20 flex max-w-full gap-0 overflow-x-auto border-y border-slate-300 bg-white" aria-label="Разделы отчёта">{tabs.map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`shrink-0 whitespace-nowrap px-3 py-2 text-sm font-bold ${tab === key ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}</nav>

    {tab === 'overview' && <div className="space-y-4">
      <section className="grid gap-x-6 gap-y-2 border-b border-slate-200 bg-white px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Вид отчётности" value={labelPekReportType(item.reportType)} /><Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} /><Info label="Срок представления" value={item.submissionDueDate || 'Не установлен'} /><Info label="До срока" value={deadlineRemaining(item.submissionDueDate)} /><Info label="Программа" value={program.data ? `${program.data.number} · ${program.data.name}` : 'Загрузка…'} /><Info label="Форма / НПА" value={`${item.templateVersion || '—'} / ${item.regulationVersion || '—'}`} /><Info label="Связано протоколов" value={item.linkedProtocolCount} /><Info label="Последний сбор" value={item.lastCollectedAt || 'Сбор ещё не выполнялся'} /><Info label="Сдан" value={item.submittedAt || '—'} /><Info label="Принят" value={item.acceptedAt || '—'} /><Info label="Ответственный" value={item.responsibleUser?.name || 'Не назначен'} /><Info label="Результатов" value={sourceSummary.data?.linkedResultCount ?? '—'} />
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-black">Фактическая мощность за период</h2><p className="mt-1 text-sm text-slate-500">Эти данные относятся только к текущему отчёту, а не к многолетней программе.</p></div><MuiButton variant="contained" size="small" disabled={updateGeneral.isPending || item.availableActions.edit !== true} onClick={() => updateGeneral.mutate()}>{updateGeneral.isPending ? 'Сохранение…' : 'Сохранить'}</MuiButton></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]"><TextField size="small" label="Фактическая мощность" value={actualCapacity} disabled={item.availableActions.edit !== true} onChange={(event) => setActualCapacity(event.target.value)} /><TextField size="small" label="Единица измерения" placeholder="т/год, м³/сут" value={actualCapacityUnit} disabled={item.availableActions.edit !== true} onChange={(event) => setActualCapacityUnit(event.target.value)} /></div>
      </section>
      {item.submission && <section className="rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-black">Сведения о сдаче</h2><p className="mt-1 text-sm text-slate-500">Фактическая передача отчёта в государственный орган</p></div>
          {item.submission.confirmationFileId && <MuiButton size="small" variant="outlined" disabled={downloadSubmissionConfirmation.isPending} onClick={() => downloadSubmissionConfirmation.mutate()}>{downloadSubmissionConfirmation.isPending ? 'Скачивание…' : 'Скачать подтверждение'}</MuiButton>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Способ сдачи" value={item.submission.submissionMethod ? pekSubmissionMethodLabels[item.submission.submissionMethod] : '—'} />
          <Info label="Регистрационный номер" value={item.submission.registrationNumber || '—'} />
          <Info label="Дата сдачи" value={item.submission.submittedAt || item.submittedAt || '—'} />
          <Info label="Кто зафиксировал" value={item.submission.submittedBy?.name || '—'} />
        </div>
        {item.submission.submissionComment && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm"><strong>Комментарий:</strong> {item.submission.submissionComment}</div>}
      </section>}
      <section className="border border-slate-300 bg-white"><div className="border-b border-slate-200 px-4 py-3"><h2 className="font-black">Готовность отчёта</h2></div>
        {readiness.isLoading ? <p className="mt-2">Проверяем…</p> : readiness.isError ? <PekQueryError error={readiness.error} resource="готовность отчёта" retry={() => void readiness.refetch()} /> : readiness.data && <>
          <div className="flex gap-6 px-4 py-3 text-sm"><strong>Готовность: {readiness.data.progressPercent}%</strong><span><b className="text-rose-700">{readiness.data.issues.filter((issue) => issue.blocking).length}</b> ошибок</span><span><b className="text-amber-700">{readiness.data.issues.filter((issue) => !issue.blocking).length}</b> предупреждений</span></div>
          {readiness.data.issues.length ? <ul className="divide-y divide-slate-200">{readiness.data.issues.map((issue) => <li key={issue.code}><button className="flex w-full gap-3 px-4 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setTab(issue.section === 'OFFICIAL_TABLES' ? 'official' : issue.section === 'SOURCES' ? 'sources' : issue.section === 'EXCEEDANCES' ? 'exceedances' : issue.section === 'DOCUMENTS' ? 'documents' : issue.section === 'GENERAL' ? 'overview' : 'plan-fact')}><span className={issue.blocking ? 'text-rose-700' : 'text-amber-700'}>{issue.blocking ? 'Ошибка' : 'Предупреждение'}</span><span className="flex-1"><b>{issue.message}</b><span className="block text-xs text-slate-500">{reportSectionLabels[issue.section || ''] || 'Проверка отчёта'}</span></span><span className="text-xs font-bold text-eco-800">Открыть →</span></button></li>)}</ul> : <Alert className="m-3" severity="success">Отчёт готов к отправке.</Alert>}
        </>}
        <Link className="mt-4 inline-flex font-bold text-eco-700" to={`/staff/pek/programs/${item.programId}`}>Открыть программу ПЭК</Link>
      </section>
    </div>}
    {tab === 'official' && (officialData.isLoading || readiness.isLoading ? <PekLoading /> : officialData.isError ? <PekQueryError error={officialData.error} resource="официальный отчёт" retry={() => void officialData.refetch()} /> : readiness.isError ? <PekQueryError error={readiness.error} resource="готовность отчёта" retry={() => void readiness.refetch()} /> : officialData.data ? <PekOfficialReport data={officialData.data} readiness={readiness.data} /> : null)}

    {tab === 'sources' && <section className="space-y-4 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-black">Источники данных</h2><p className="text-sm text-slate-600">Только фактически сохранённые backend связи отчёта.</p></div><TextField select size="small" label="Статус" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} sx={{ minWidth: 220 }}><MenuItem value="ALL">Все</MenuItem><MenuItem value="MATCHED">Сопоставленные</MenuItem><MenuItem value="MANUALLY_MATCHED">Сопоставленные вручную</MenuItem><MenuItem value="UNMATCHED">Несопоставленные</MenuItem><MenuItem value="AMBIGUOUS">Неоднозначные</MenuItem><MenuItem value="STALE">Устаревшие</MenuItem><MenuItem value="EXCLUDED">Исключённые</MenuItem></TextField></div>
      {sources.isLoading ? <PekLoading /> : sources.isError ? <PekQueryError error={sources.error} resource="источники отчёта" retry={() => void sources.refetch()} /> : !sources.data?.length ? <PekState title="Источники не найдены" message="Запустите сбор данных или измените фильтр." /> : <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1500px] text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left"><th className="p-2">Протокол</th><th>Дата</th><th>Точка</th><th>Показатель</th><th>Результат</th><th>Программа</th><th>Статус сопоставления</th><th>Действия</th></tr></thead><tbody>{sources.data.map((source) => {
         const highlighted = (params.get('protocolId') && String(source.protocolId) === params.get('protocolId'))
           || (params.get('controlItemId') && String(source.controlItemId) === params.get('controlItemId'))
           || (params.get('monitoringPointId') && String(source.monitoringPointId) === params.get('monitoringPointId'))
           || (params.get('programIndicatorId') && String(source.programIndicatorId) === params.get('programIndicatorId'));
         return <tr key={source.id} className={`border-b align-top ${highlighted ? 'bg-amber-100 ring-2 ring-amber-400' : source.excluded || source.matchStatus === 'STALE' ? 'bg-slate-100 text-slate-500' : ''}`}>
           <td className="p-2 font-semibold"><p>№ {source.protocolNumber}</p><p className="text-xs font-normal text-slate-500">{source.protocolStatus || 'Статус не указан'}</p></td>
           <td><p>{source.protocolDate || source.measurementDate || '—'}</p><p className="text-xs text-slate-500">{source.laboratoryName || 'Лаборатория не указана'}</p></td>
           <td><p>{source.samplingPlace || '—'}</p><p className="text-xs text-slate-500">{source.methodology || ''}</p></td>
            <td><p>{source.indicatorName || '—'}</p><p className="text-xs text-slate-500">{source.indicatorCode || 'без кода'} · {source.unit || 'без единицы'}</p></td>
            <td><p>{source.value ?? source.valueText ?? '—'} {source.unit || ''}</p><p className="text-xs text-slate-500">Норматив: {source.normativeValue ?? '—'} · {source.comparisonType || 'без сравнения'}</p>{source.isExceedance && <p className="text-xs font-bold text-rose-700">Превышение</p>}</td>
           <td><p>{source.controlItemName || '—'}</p><p className="text-xs">{source.programIndicatorName || '—'}</p></td>
           <td>{source.excluded ? labelPekMatchStatus('EXCLUDED') : labelPekMatchStatus(source.matchStatus)}</td>
           <td className="relative text-right"><ActionMenu label={`Действия с источником ${source.protocolNumber}`} widthClass="w-64">{canMutateSources && !source.excluded && ['UNMATCHED', 'AMBIGUOUS'].includes(source.matchStatus) && <MuiButton size="small" onClick={() => { setSelectedSource(source); setControlItemId(''); setIndicatorId(''); }}>{source.matchStatus === 'AMBIGUOUS' ? 'Выбрать показатель' : 'Сопоставить вручную'}</MuiButton>}{canMutateSources && !source.excluded && source.matchStatus === 'UNMATCHED' && <MuiButton size="small" color="error" onClick={() => setExcludeSource(source)}>Исключить</MuiButton>}{canMutateSources && source.matchStatus === 'STALE' && <MuiButton size="small" onClick={() => setCollectConfirmOpen(true)}>Обновить данные</MuiButton>}{canMutateSources && source.excluded && <MuiButton size="small" disabled={restore.isPending} onClick={() => restore.mutate(source)}>Восстановить</MuiButton>}</ActionMenu></td>
         </tr>;
      })}</tbody></table></div>}
    </section>}

    {tab === 'plan-fact' && <PlanFactContent report={item} loading={planFact.isLoading} error={planFact.error} data={planFact.data} retry={() => void planFact.refetch()} />}
    {tab === 'exceedances' && <PekReportExceedances report={item} />}
    {tab === 'waste-movements' && <PekInventoryEditor key={`waste-${item.id}`} kind="waste-movements" parentId={item.id} programId={item.programId} companyId={item.companyId} canEdit={item.availableActions.edit === true} />}
    {tab === 'documents' && <div className="space-y-4"><PekReportPackageCard report={item} /><PekReportDocuments report={item} /></div>}
    {tab === 'history' && <section className="space-y-4 rounded-2xl border bg-white p-5"><h2 className="font-black">История отчёта</h2>{history.isLoading ? <PekLoading /> : history.isError ? <PekQueryError error={history.error} resource="историю отчёта" retry={() => void history.refetch()} /> : !history.data?.length ? <PekState title="История пока пуста" /> : <ol className="space-y-3">{history.data.map((entry, index) => <li key={`${entry.performedAt}-${index}`} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{entry.action}</p><span className="text-xs text-slate-500">Версия {entry.version}</span></div><p className="mt-1 text-sm">{entry.fromStatus || '—'} → {entry.toStatus}</p><p className="mt-1 text-sm text-slate-600">{entry.performedBy?.name || entry.performedBy?.fullName || 'Сотрудник'} · {new Date(entry.performedAt).toLocaleString('ru-RU')}</p>{entry.comment && <p className="mt-2 text-sm">{entry.comment}</p>}</li>)}</ol>}</section>}
    <Dialog open={collectConfirmOpen} onClose={() => !collect.isPending && setCollectConfirmOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Получить протоколы?</DialogTitle>
      <DialogContent><Alert severity="info">Backend заново проверит подходящие протоколы, обновит сопоставления, план/факт и готовность отчёта. Ручные решения будут обработаны по серверным правилам reconciliation.</Alert></DialogContent>
      <DialogActions><MuiButton disabled={collect.isPending} onClick={() => setCollectConfirmOpen(false)}>Отмена</MuiButton><MuiButton variant="contained" disabled={collect.isPending} onClick={() => collect.mutate()}>{collect.isPending ? 'Ищем подходящие подписанные протоколы...' : 'Получить протоколы'}</MuiButton></DialogActions>
    </Dialog>
    <Dialog open={Boolean(selectedSource)} onClose={() => !match.isPending && setSelectedSource(null)} fullWidth maxWidth="sm"><DialogTitle>Сопоставить результат вручную</DialogTitle><DialogContent className="space-y-4"><Alert severity="info">Протокол № {selectedSource?.protocolNumber} от {selectedSource?.protocolDate || '—'}. Показатель: {selectedSource?.indicatorCode || '—'} · {selectedSource?.indicatorName || '—'}. Значение: {selectedSource?.value ?? selectedSource?.valueText ?? '—'} {selectedSource?.unit || ''}. Норматив: {selectedSource?.normativeValue ?? '—'}.</Alert><TextField select fullWidth margin="normal" label="Позиция программы" value={controlItemId} onChange={(event) => { setControlItemId(event.target.value); setIndicatorId(''); }}>{controlItems.map((controlItem) => <MenuItem key={controlItem.id} value={controlItem.id}>{controlItem.code} · {controlItem.name}</MenuItem>)}</TextField><TextField select fullWidth margin="normal" label="Показатель программы" value={indicatorId} disabled={!controlItemId} onChange={(event) => setIndicatorId(event.target.value)}>{filteredIndicators.map((indicator) => <MenuItem key={indicator.id} value={indicator.id}>{indicator.indicatorName} · {indicator.unit || 'без единицы'}</MenuItem>)}</TextField></DialogContent><DialogActions><MuiButton onClick={() => setSelectedSource(null)}>Отмена</MuiButton><MuiButton variant="contained" disabled={!controlItemId || !indicatorId || match.isPending} onClick={() => match.mutate()}>Сопоставить</MuiButton></DialogActions></Dialog>
    <Dialog open={Boolean(excludeSource)} onClose={() => !exclude.isPending && setExcludeSource(null)} fullWidth maxWidth="sm"><DialogTitle>Исключить источник из отчёта</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} margin="normal" label="Причина исключения *" value={excludeReason} onChange={(event) => setExcludeReason(event.target.value)} /></DialogContent><DialogActions><MuiButton onClick={() => setExcludeSource(null)}>Отмена</MuiButton><MuiButton color="error" variant="contained" disabled={!excludeReason.trim() || exclude.isPending} onClick={() => exclude.mutate()}>Исключить</MuiButton></DialogActions></Dialog>
    <Dialog open={returnOpen} onClose={() => !returnReport.isPending && setReturnOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Вернуть отчёт на доработку</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} margin="normal" label="Причина возврата *" value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></DialogContent><DialogActions><MuiButton onClick={() => setReturnOpen(false)}>Отмена</MuiButton><MuiButton color="warning" variant="contained" disabled={!returnReason.trim() || returnReport.isPending} onClick={() => returnReport.mutate(item)}>Вернуть</MuiButton></DialogActions></Dialog>
    <Dialog open={approveConfirmOpen} onClose={() => !approve.isPending && setApproveConfirmOpen(false)}><DialogTitle>Утвердить отчёт?</DialogTitle><DialogContent><Alert severity="success">Актуальная проверка готовности не содержит блокирующих проблем.</Alert></DialogContent><DialogActions><MuiButton onClick={() => setApproveConfirmOpen(false)}>Отмена</MuiButton><MuiButton variant="contained" disabled={approve.isPending} onClick={() => { setApproveConfirmOpen(false); approve.mutate(item); }}>Утвердить</MuiButton></DialogActions></Dialog>
    <PekReportSubmissionDialog
      open={submitConfirmOpen}
      pending={submitAuthority.isPending}
      submission={item.submission}
      defaultSubmittedAt={item.submittedAt}
      onClose={() => setSubmitConfirmOpen(false)}
      onSubmit={(draft) => submitAuthority.mutate(draft)}
    />
    <Dialog open={acceptConfirmOpen} onClose={() => !accept.isPending && setAcceptConfirmOpen(false)}><DialogTitle>Принять официальный отчёт?</DialogTitle><DialogActions><MuiButton onClick={() => setAcceptConfirmOpen(false)}>Отмена</MuiButton><MuiButton color="success" variant="contained" disabled={accept.isPending} onClick={() => accept.mutate(item)}>Принять</MuiButton></DialogActions></Dialog>
    <Dialog open={rejectOpen} onClose={() => !reject.isPending && setRejectOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Отклонить официальный отчёт</DialogTitle><DialogContent><TextField autoFocus fullWidth multiline minRows={3} margin="normal" label="Причина отклонения *" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} /></DialogContent><DialogActions><MuiButton onClick={() => setRejectOpen(false)}>Отмена</MuiButton><MuiButton color="error" variant="contained" disabled={!rejectionReason.trim() || reject.isPending} onClick={() => reject.mutate(item)}>Отклонить</MuiButton></DialogActions></Dialog>
    <Dialog open={archiveConfirmOpen} onClose={() => !archive.isPending && setArchiveConfirmOpen(false)}><DialogTitle>Архивировать отчёт?</DialogTitle><DialogContent><Alert severity="warning">После архивирования изменение отчёта и его источников будет недоступно.</Alert></DialogContent><DialogActions><MuiButton onClick={() => setArchiveConfirmOpen(false)}>Отмена</MuiButton><MuiButton variant="contained" disabled={archive.isPending} onClick={() => { setArchiveConfirmOpen(false); archive.mutate(item); }}>Архивировать</MuiButton></DialogActions></Dialog>
    <Dialog open={conflictOpen} onClose={() => setConflictOpen(false)}><DialogTitle>Данные были изменены другим сотрудником</DialogTitle><DialogContent>Обновите страницу и повторите действие. Старый запрос не будет отправлен повторно автоматически.</DialogContent><DialogActions><MuiButton onClick={() => setConflictOpen(false)}>Закрыть</MuiButton><MuiButton variant="contained" onClick={() => { setConflictOpen(false); void report.refetch(); }}>Обновить данные</MuiButton></DialogActions></Dialog>
  </div>;
};

const PlanFactContent = ({ report, loading, error, data, retry }: { report: PekReport; loading: boolean; error: unknown; data?: Awaited<ReturnType<typeof pekApi.getReportPlanFact>>; retry: () => void }) => {
  if (loading) return <PekLoading />;
  if (error) return <PekQueryError error={error} resource="план/факт" retry={retry} />;
  if (!data?.items.length) return <PekState title="План/факт не сформирован" message="Запустите сбор данных из протоколов." />;
  const createParams = new URLSearchParams({ companyId: String(report.companyId), objectId: String(report.objectId), pekReportId: String(report.id) });
  return <section className="space-y-4 rounded-2xl border bg-white p-5"><div className="grid gap-3 sm:grid-cols-5"><Info label="План" value={data.summary.planned} /><Info label="Выполнено" value={data.summary.completed} /><Info label="Не хватает" value={data.summary.missing} /><Info label="Выполнение" value={`${data.summary.completionPercent}%`} /><Info label="Превышения" value={data.summary.exceedances} /></div><div className="overflow-x-auto"><table className="w-full min-w-[1200px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Период</th><th>Направление</th><th>Точка</th><th>Показатель</th><th>План</th><th>Факт</th><th>Выполнение %</th><th>Протокол</th><th>Результат</th><th>Статус</th></tr></thead><tbody>{data.items.map((row) => <tr key={row.planFactRowId} className="border-b"><td className="p-2">{row.period || (report.quarter ? `Q${report.quarter}` : report.year)}</td><td>{row.directionName || row.controlItemName}</td><td>{row.monitoringPointName || row.measurementPlace || '—'}</td><td>{row.indicatorName}</td><td>{row.plannedCount}</td><td>{row.actualCount}</td><td>{row.completionPercent}%</td><td>{row.protocolNumber || (row.missingCount > 0 ? <Link className="font-bold text-eco-700" to={`/staff/protocols/new?${createParams}`}>Создать протокол</Link> : '—')}</td><td>{row.resultValue ?? row.worstValue ?? row.averageValue ?? '—'}</td><td>{labelPekPlanFactStatus(row.status)}{row.hasExceedance ? ' · превышение' : ''}</td></tr>)}</tbody></table></div></section>;
};
const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
export default PekReportWorkspacePage;
