import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekAssignExceedanceRequest, PekExceedance, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import PekQueryError from '../common/PekQueryError';
import { PekLoading, PekState } from '../common/PekUi';

const statusLabels: Record<string, string> = {
  OPEN: 'Открыто', UNDER_REVIEW: 'На рассмотрении', CONFIRMED: 'Подтверждено', FALSE_POSITIVE: 'Ложное срабатывание',
  IN_PROGRESS: 'В работе', RESOLVED: 'Устранено', VERIFIED: 'Проверено', CLOSED: 'Закрыто', CANCELLED: 'Отменено',
};

const transitionStatus = (key: string) => key.slice('transitionTo'.length)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .toUpperCase();

const PekReportExceedances = ({ report }: { report: PekReport }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const listKey = pekKeys.exceedances(report.id, report.companyId, user?.id);
  const reportKey = pekKeys.report(report.id, undefined, user?.id);
  const list = useQuery({ queryKey: listKey, queryFn: ({ signal }) => pekApi.getReportExceedances(report.id, signal) });
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE'], user?.id),
    queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailKey = pekKeys.exceedance(selectedId || 'none', user?.id);
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => pekApi.getExceedance(selectedId!, signal),
    enabled: selectedId !== null,
  });
  const selected = detail.data;
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [evidenceFileId, setEvidenceFileId] = useState('');
  const [transition, setTransition] = useState('');
  const [comment, setComment] = useState('');
  const [resolutionComment, setResolutionComment] = useState('');

  useEffect(() => {
    if (!selected) return;
    setResponsibleUserId(selected.responsibleUserId ? String(selected.responsibleUserId) : '');
    setDueDate(selected.dueDate || '');
    setCorrectiveAction(selected.correctiveAction || '');
    setEvidenceFileId('');
    setTransition('');
    setComment('');
    setResolutionComment(selected.resolutionComment || '');
  }, [selected]);

  const refreshAfterMutation = async (id: number): Promise<PekExceedance> => {
    const [actual, actualList, actualReport] = await Promise.all([
      pekApi.getExceedance(id),
      pekApi.getReportExceedances(report.id),
      pekApi.getReport(report.id),
    ]);
    queryClient.setQueryData(pekKeys.exceedance(id, user?.id), actual);
    queryClient.setQueryData(listKey, actualList);
    queryClient.setQueryData(reportKey, actualReport);
    await queryClient.invalidateQueries({ queryKey: pekKeys.readiness(report.id, report.companyId, user?.id) });
    return actual;
  };

  const assign = useMutation({
    mutationFn: async () => {
      await pekApi.assignExceedance(selected!.id, {
        version: selected!.version,
        responsibleUserId: Number(responsibleUserId),
        dueDate,
        correctiveAction: correctiveAction.trim(),
      } satisfies PekAssignExceedanceRequest);
      return refreshAfterMutation(selected!.id);
    },
  });
  const evidence = useMutation({
    mutationFn: async () => {
      await pekApi.attachExceedanceEvidence(selected!.id, selected!.version, evidenceFileId.trim());
      return refreshAfterMutation(selected!.id);
    },
    onSuccess: () => setEvidenceFileId(''),
  });
  const transitionMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      await pekApi.transitionExceedance(selected!.id, {
        version: selected!.version,
        status: targetStatus,
        comment: comment.trim() || undefined,
        resolutionComment: resolutionComment.trim() || undefined,
      });
      return refreshAfterMutation(selected!.id);
    },
  });

  if (list.isLoading) return <PekLoading />;
  if (list.isError) return <PekQueryError error={list.error} resource="превышения отчёта" retry={() => void list.refetch()} />;
  if (!list.data?.length) return <PekState title="Превышения не обнаружены" message="Backend не вернул превышений для этого отчёта." />;

  const selectedActions = selected?.availableActions || {};
  const allowedTransitions = selected ? Object.entries(selectedActions)
    .filter(([key, enabled]) => key.startsWith('transitionTo') && enabled === true)
    .map(([key]) => transitionStatus(key)) : [];
  const ordinaryTransitions = allowedTransitions.filter((status) => status !== 'CLOSED');
  const canClose = allowedTransitions.includes('CLOSED');
  const pending = assign.isPending || evidence.isPending || transitionMutation.isPending;
  const mutationError = assign.error || evidence.error || transitionMutation.error;

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div><h2 className="font-black">Превышения и корректирующие мероприятия</h2><p className="text-sm text-slate-500">Ответственные, сроки, подтверждения и закрытие превышений</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Факт / норматив</th><th>Критичность</th><th>Ответственный</th><th>Срок</th><th>Мероприятие</th><th>Комментарий</th><th>Файлы</th><th>Статус</th><th /></tr></thead><tbody>{list.data.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.actualValue ?? '—'} / {item.normativeValue ?? '—'}</td><td>{item.severity || '—'}</td><td>{item.responsibleUser?.fullName || item.responsibleUser?.name || (item.responsibleUserId ? `№${item.responsibleUserId}` : 'Не назначен')}</td><td>{item.dueDate || '—'}</td><td className="max-w-64 truncate">{item.correctiveAction || '—'}</td><td className="max-w-56 truncate">{item.comment || item.resolutionComment || '—'}</td><td>{item.evidenceFileIds?.length || 0}</td><td>{statusLabels[item.status] || item.status}</td><td><Button size="small" onClick={() => setSelectedId(item.id)}>{Object.values(item.availableActions).some(Boolean) ? 'Управлять' : 'Открыть'}</Button></td></tr>)}</tbody></table></div>
    <Dialog open={selectedId !== null} onClose={() => !pending && setSelectedId(null)} fullWidth maxWidth="md"><DialogTitle>Превышение №{selectedId}</DialogTitle><DialogContent className="space-y-4">{detail.isLoading ? <PekLoading /> : detail.isError ? <PekQueryError error={detail.error} resource="превышение" retry={() => void detail.refetch()} /> : selected && <>
      <div className="grid gap-3 sm:grid-cols-3"><div><strong>Статус:</strong> {statusLabels[selected.status] || selected.status}</div><div><strong>Факт:</strong> {selected.actualValue ?? '—'}</div><div><strong>Норматив:</strong> {selected.normativeValue ?? '—'}</div></div>
      {selected.comment && <div><strong>Комментарий:</strong> {selected.comment}</div>}
      {selected.resolutionComment && <div><strong>Комментарий об устранении:</strong> {selected.resolutionComment}</div>}
      {mutationError && <Alert severity="error">{mutationError instanceof Error ? mutationError.message : 'Изменение превышения не сохранено.'}</Alert>}
      {selectedActions.assignResponsible === true && <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><TextField select label="Ответственный" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)}><MenuItem value="">Не выбран</MenuItem>{assignees.data?.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField type="date" label="Срок устранения" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><TextField className="sm:col-span-2" multiline minRows={3} label="Корректирующее мероприятие" value={correctiveAction} onChange={(event) => setCorrectiveAction(event.target.value)} /><div className="sm:col-span-2"><Button variant="contained" disabled={pending || !responsibleUserId || !dueDate || !correctiveAction.trim()} onClick={() => assign.mutate()}>Сохранить ответственного и мероприятие</Button></div></section>}
      {selectedActions.attachEvidence === true && <section className="rounded-xl border p-4"><TextField fullWidth label="ID файла подтверждения" helperText="Укажите fileId уже загруженного файла — endpoint подтверждения принимает именно это поле." value={evidenceFileId} onChange={(event) => setEvidenceFileId(event.target.value)} /><Button className="!mt-3" variant="outlined" disabled={pending || !evidenceFileId.trim()} onClick={() => evidence.mutate()}>Прикрепить файл</Button></section>}
      <div><strong>Прикреплённые файлы:</strong>{!selected.evidenceFileIds?.length ? <span className="ml-2 text-slate-500">нет</span> : <ul className="mt-1 list-disc pl-5">{selected.evidenceFileIds.map((fileId) => <li key={fileId} className="font-mono text-xs">{fileId}</li>)}</ul>}</div>
      {(ordinaryTransitions.length > 0 || canClose) && <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        {ordinaryTransitions.length > 0 && <TextField select label="Новый статус" value={transition} onChange={(event) => setTransition(event.target.value)}>{ordinaryTransitions.map((status) => <MenuItem key={status} value={status}>{statusLabels[status] || status}</MenuItem>)}</TextField>}
        <TextField label="Комментарий" value={comment} onChange={(event) => setComment(event.target.value)} />
        <TextField className="sm:col-span-2" multiline minRows={2} label="Комментарий об устранении / закрытии" value={resolutionComment} onChange={(event) => setResolutionComment(event.target.value)} />
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {ordinaryTransitions.length > 0 && <Button variant="contained" disabled={pending || !transition || (transition === 'RESOLVED' && !resolutionComment.trim())} onClick={() => transitionMutation.mutate(transition)}>Изменить статус</Button>}
          {canClose && <Button color="success" variant="contained" disabled={pending || !resolutionComment.trim()} onClick={() => transitionMutation.mutate('CLOSED')}>Закрыть превышение</Button>}
        </div>
      </section>}
    </>}</DialogContent><DialogActions><Button disabled={pending} onClick={() => setSelectedId(null)}>Закрыть окно</Button></DialogActions></Dialog>
  </section>;
};

export default PekReportExceedances;
