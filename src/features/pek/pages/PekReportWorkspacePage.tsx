import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../hooks/useToast';
import type { PekReport, PekReportActionCode } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const tabs = ['Обзор', 'План/факт', 'Источники данных', 'Сопоставления', 'Превышения', 'Замечания', 'Корректирующие мероприятия', 'Документы', 'История', 'Подписи'];
const supportedActions: PekReportActionCode[] = ['COLLECT', 'RECOLLECT', 'SUBMIT_REVIEW', 'APPROVE', 'ARCHIVE'];
const dash = (value?: number | null) => value === undefined || value === null ? '—' : value;

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const [params, setParams] = useSearchParams();
  const tab = Math.max(0, tabs.indexOf(params.get('tab') || 'Обзор'));
  const setTab = (index: number) => {
    const next = new URLSearchParams(params);
    index ? next.set('tab', tabs[index]) : next.delete('tab');
    setParams(next, { replace: true });
  };
  const client = useQueryClient();
  const toast = useToast();
  const [pendingAction, setPendingAction] = useState<PekReportActionCode | null>(null);
  const [conflict, setConflict] = useState(false);
  const report = useQuery({
    queryKey: pekKeys.report(id),
    queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });

  const refresh = async (saved?: PekReport) => {
    if (saved) client.setQueryData(pekKeys.report(id), saved);
    await Promise.all([
      client.invalidateQueries({ queryKey: pekKeys.report(id) }),
      client.invalidateQueries({ queryKey: pekKeys.reports() }),
      client.invalidateQueries({ queryKey: pekKeys.dashboard() }),
    ]);
  };

  const action = useMutation({
    mutationFn: async (code: PekReportActionCode) => {
      const fresh = await pekApi.getReport(id);
      if (!fresh.availableActions.some((item) => item.code === code && item.enabled)) {
        throw new Error('Backend не разрешил это действие. Карточка будет обновлена.');
      }
      if (code === 'COLLECT' || code === 'RECOLLECT') return pekApi.collectReport(id);
      if (code === 'SUBMIT_REVIEW') return pekApi.submitReportReview(id, fresh.version);
      if (code === 'APPROVE') return pekApi.approveReport(id, fresh.version);
      if (code === 'ARCHIVE') return pekApi.archiveReport(id, fresh.version);
      throw new Error('Backend endpoint для действия отсутствует.');
    },
    retry: false,
    onSuccess: async (saved) => {
      setPendingAction(null);
      await refresh(saved);
      toast.success('Действие выполнено');
    },
    onError: async (error) => {
      setPendingAction(null);
      const mapped = mapPekError(error);
      if (mapped.status === 409 || mapped.status === 412 || mapped.code === 'VERSION_CONFLICT') setConflict(true);
      await report.refetch();
      toast.error(mapped.message);
    },
  });

  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) return <PekQueryError error={report.error} resource="Отчёт ПЭК" retry={() => void report.refetch()} />;
  const item = report.data;
  const actions = item.availableActions.filter((candidate) => supportedActions.includes(candidate.code));
  const protocolParams = new URLSearchParams({
    companyId: String(item.companyId || item.company?.id || ''),
    objectId: String(item.objectId || item.object?.id || ''),
    dateFrom: item.periodStart,
    dateTo: item.periodEnd,
  });

  return <div className="space-y-5">
    <PekPageHeader
      title={item.number || `Отчёт ПЭК №${item.id}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.periodStart}—${item.periodEnd}`}
      actions={<><PekStatusBadge status={item.status} />{actions.map((candidate) => <Button key={candidate.code} disabled={!candidate.enabled || action.isPending} title={candidate.disabledReason || undefined} onClick={() => setPendingAction(candidate.code)}>{candidate.label}</Button>)}</>}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} />
      <Info label="Связано протоколов" value={dash(item.linkedProtocolCount)} />
      <Info label="Последний сбор" value={item.lastCollectedAt || '—'} />
      <Info label="Версия" value={item.version} />
    </section>
    {item.readOnly && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold">Отчёт доступен только для чтения.</div>}
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Разделы отчёта">{tabs.map((label, index) => <button key={label} type="button" onClick={() => setTab(index)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === index ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}</nav>
    {tab === 0 && <section className="rounded-2xl border bg-white p-5"><p>Backend возвращает только агрегат отчёта и количество связанных протоколов.</p></section>}
    {tab === 2 && <section className="rounded-2xl border bg-white p-5"><Link to={`/staff/protocols?${protocolParams}`} className="rounded-full border px-4 py-2 text-sm font-bold">Открыть протоколы</Link></section>}
    {tab !== 0 && tab !== 2 && <PekState title="Backend endpoint для раздела отсутствует" message="Раздел отключён: frontend не отправляет фиктивный запрос и не имитирует данные." />}
    {!actions.length && <PekState title="Backend не вернул доступных действий" message="Frontend не вычисляет workflow по роли или статусу." />}
    <Modal open={Boolean(pendingAction)} title="Подтвердите действие" description={actions.find((candidate) => candidate.code === pendingAction)?.label} loading={action.isPending} onClose={() => setPendingAction(null)} footer={<><Button variant="secondary" onClick={() => setPendingAction(null)}>Отмена</Button><Button disabled={action.isPending} onClick={() => pendingAction && action.mutate(pendingAction)}>Подтвердить</Button></>}><p className="text-sm text-slate-600">Перед операцией загружается актуальная версия отчёта.</p></Modal>
    <Modal open={conflict} title="Данные изменены другим пользователем" description="Старая форма больше не отправляется. Загружена актуальная версия отчёта." onClose={() => setConflict(false)} footer={<Button onClick={() => setConflict(false)}>Понятно</Button>}><p className="text-sm text-slate-600">Проверьте данные и начните действие повторно.</p></Modal>
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;

export default PekReportWorkspacePage;
