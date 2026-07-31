import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../hooks/useToast';
import type { PekReport } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState, PekStatusBadge } from '../components/common/PekUi';
import { getReportWorkflowActions, type PekReportWorkflowAction } from '../mappers/reportMappers';
import { mapPekError } from '../utils/pekErrorMapper';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

const labels: Record<PekReportWorkflowAction, string> = {
  COLLECT: 'Собрать протоколы',
  SUBMIT_REVIEW: 'Отправить на проверку',
  APPROVE: 'Утвердить',
  ARCHIVE: 'Архивировать',
};

const PekReportWorkspacePage = () => {
  const id = Number(useParams().reportId);
  const client = useQueryClient();
  const toast = useToast();
  const [conflict, setConflict] = useState(false);
  const report = useQuery({
    queryKey: pekKeys.report(id),
    queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isFinite(id),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  });
  const refresh = async (saved: PekReport) => {
    client.setQueryData(pekKeys.report(id), saved);
    await Promise.all([
      client.invalidateQueries({ queryKey: pekKeys.reports({
        companyId: saved.company?.id,
        objectId: saved.object?.id,
      }) }),
      client.invalidateQueries({ queryKey: pekKeys.dashboard() }),
    ]);
  };
  const action = useMutation({
    mutationFn: async (code: PekReportWorkflowAction) => {
      if (!report.data) throw new Error('Отчёт не загружен.');
      if (code === 'COLLECT') return pekApi.collectReport(id);
      if (code === 'SUBMIT_REVIEW') return pekApi.submitReportReview(id, report.data.version);
      if (code === 'APPROVE') return pekApi.approveReport(id, report.data.version);
      return pekApi.archiveReport(id, report.data.version);
    },
    retry: false,
    onSuccess: async (saved, code) => {
      await refresh({
        ...saved,
        linkedProtocolNumbers: saved.linkedProtocolNumbers.length
          ? saved.linkedProtocolNumbers
          : report.data?.linkedProtocolNumbers || [],
      });
      toast.success(code === 'COLLECT' ? 'Сбор протоколов завершён' : 'Действие выполнено');
    },
    onError: async (error) => {
      const mapped = mapPekError(error);
      if (mapped.status === 409) {
        setConflict(true);
        await report.refetch();
      }
      toast.error(mapped.message);
    },
  });

  if (report.isLoading) return <PekLoading />;
  if (report.isError || !report.data) return <PekQueryError error={report.error} resource="Отчёт ПЭК" retry={() => void report.refetch()} />;
  const item = report.data;
  const actions = getReportWorkflowActions(item.status);
  const protocolParams = new URLSearchParams({
    companyId: String(item.companyId || item.company?.id || ''),
    objectId: String(item.objectId || item.object?.id || ''),
    dateFrom: item.periodStart,
    dateTo: item.periodEnd,
  });
  const createParams = new URLSearchParams({
    create: '1',
    companyId: String(item.companyId || item.company?.id || ''),
    objectId: String(item.objectId || item.object?.id || ''),
    date: item.periodStart,
  });

  return <div className="space-y-5">
    <PekPageHeader
      title={item.number || `Отчёт ПЭК №${item.id}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.periodStart}—${item.periodEnd}`}
      actions={<>
        <PekStatusBadge status={item.status} />
        {actions.map((code) => <Button key={code} disabled={action.isPending} aria-busy={action.isPending} onClick={() => action.mutate(code)}>{labels[code]}</Button>)}
      </>}
    />
    {action.isPending && action.variables === 'COLLECT' && (
      <section aria-busy="true" className="rounded-2xl border border-eco-200 bg-eco-50 p-5 font-bold">
        Выполняется сбор протоколов…
      </section>
    )}
    <section className="grid gap-3 rounded-2xl border bg-white p-5 md:grid-cols-4">
      <Info label="Период" value={`${item.periodStart} — ${item.periodEnd}`} />
      <Info label="Программа" value={item.programId ? `№${item.programId}` : '—'} />
      <Info label="Версия" value={item.version} />
      <Info label="Последний сбор" value={item.lastCollectedAt || '—'} />
    </section>
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="text-lg font-black">Связанные протоколы</h2>
      <p className="mt-2">Количество: <strong>{item.linkedProtocolCount}</strong></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {item.linkedProtocolNumbers.map((number) => <span key={number} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{number}</span>)}
        {!item.linkedProtocolNumbers.length && <p className="text-sm text-slate-500">Подходящие финализированные протоколы не связаны.</p>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to={`/staff/protocols?${protocolParams}`} className="rounded-full border px-4 py-2 text-sm font-bold">Открыть список протоколов</Link>
        <Link to={`/staff/protocols?${createParams}`} className="rounded-full border px-4 py-2 text-sm font-bold">Создать протокол</Link>
        <Button variant="secondary" disabled={action.isPending} onClick={() => action.mutate('COLLECT')}>Повторить сбор</Button>
      </div>
      <p className="mt-3 text-xs text-slate-500">Связь отчёт ↔ протокол хранится backend. Черновики протоколов не включаются frontend-расчётом.</p>
    </section>
    {!actions.length && <PekState title="Для текущего статуса нет доступных действий" message="Frontend не имитирует отсутствующие операции backend." />}
    <Modal
      open={conflict}
      title="Версия отчёта изменилась"
      description="Мутация не была повторена автоматически. Загружена актуальная версия отчёта; проверьте её перед повторным действием."
      onClose={() => setConflict(false)}
      footer={<Button onClick={() => setConflict(false)}>Понятно</Button>}
    ><p className="text-sm text-slate-600">Повторите действие вручную, если актуальное состояние это допускает.</p></Modal>
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;

export default PekReportWorkspacePage;
