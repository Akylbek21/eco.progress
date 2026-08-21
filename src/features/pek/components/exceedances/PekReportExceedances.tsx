import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField } from '@mui/material';
import { useAuth } from '../../../../contexts/AuthContext';
import type { PekAssignExceedanceRequest, PekExceedance, PekReport } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekApi } from '../../api/pekService';
import PekQueryError from '../common/PekQueryError';
import { PekLoading, PekState } from '../common/PekUi';
import { mapPekError } from '../../utils/pekErrorMapper';
import { handlePekMutationError } from '../../utils/pekMutationError';
import { uploadAndAttachExceedanceEvidence } from './evidenceFlow';

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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const detailKey = pekKeys.exceedance(selectedId || 'none', user?.id);
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) => pekApi.getExceedance(selectedId!, signal),
    enabled: selectedId !== null,
  });
  const selected = detail.data;
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['PEK_RESPONSIBLE'], user?.id),
    queryFn: ({ signal }) => pekApi.getAssignees(['PEK_RESPONSIBLE'], signal),
    enabled: selected?.availableActions.assignResponsible === true || selected?.availableActions.edit === true,
  });
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceNames, setEvidenceNames] = useState<Record<string, string>>({});
  const [transition, setTransition] = useState('');
  const [comment, setComment] = useState('');
  const [resolutionComment, setResolutionComment] = useState('');

  useEffect(() => {
    if (!selected) return;
    setResponsibleUserId(selected.responsibleUserId ? String(selected.responsibleUserId) : '');
    setDueDate(selected.dueDate || '');
    setCorrectiveAction(selected.correctiveAction || '');
    setEvidenceFile(null);
    setEvidenceOpen(false);
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
    onError: (error) => {
      void handlePekMutationError(error, () => refreshAfterMutation(selected!.id));
    },
  });
  const evidence = useMutation({
    mutationFn: async () => {
      if (!evidenceFile) throw new Error('Выберите файл подтверждения.');
      const uploaded = await uploadAndAttachExceedanceEvidence({ file: evidenceFile, exceedanceId: selected!.id, reportId: report.id, version: selected!.version });
      const fileId = uploaded.fileId;
      const actual = await refreshAfterMutation(selected!.id);
      return { actual, fileId, fileName: uploaded.fileName || evidenceFile.name };
    },
    onSuccess: ({ fileId, fileName }) => {
      setEvidenceNames((current) => ({ ...current, [fileId]: fileName }));
      setEvidenceFile(null);
      setEvidenceOpen(false);
    },
    onError: (error) => {
      void handlePekMutationError(error, () => refreshAfterMutation(selected!.id));
    },
  });
  const transitionMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      if (targetStatus === 'CLOSED') {
        await pekApi.closeExceedance(selected!.id, selected!.version, resolutionComment.trim());
      } else if (targetStatus === 'OPEN') {
        await pekApi.reopenExceedance(selected!.id, selected!.version, comment.trim() || undefined);
      } else {
        await pekApi.transitionExceedance(selected!.id, {
          version: selected!.version,
          status: targetStatus,
          comment: comment.trim() || undefined,
          resolutionComment: resolutionComment.trim() || undefined,
        });
      }
      return refreshAfterMutation(selected!.id);
    },
    onError: (error) => {
      void handlePekMutationError(error, () => refreshAfterMutation(selected!.id));
    },
  });

  if (list.isLoading) return <PekLoading />;
  if (list.isError) return <PekQueryError error={list.error} resource="превышения отчёта" retry={() => void list.refetch()} />;
  if (!list.data?.length) return <PekState title="Превышения не обнаружены" message="Backend не вернул превышений для этого отчёта." />;

  const selectedActions = selected?.availableActions || {};
  const allowedTransitions = selected ? Object.entries(selectedActions)
    .filter(([key, enabled]) => key.startsWith('transitionTo') && enabled === true)
    .map(([key]) => transitionStatus(key)) : [];
  const ordinaryTransitions = allowedTransitions.filter((status) => status !== 'CLOSED' && status !== 'OPEN');
  const canAssign = selectedActions.assignResponsible === true;
  const canEdit = selectedActions.edit === true;
  const canAddEvidence = selectedActions.addEvidence === true;
  const canChangeStatus = selectedActions.changeStatus === true;
  const canClose = selectedActions.close === true;
  const canReopen = selectedActions.reopen === true;
  const pending = assign.isPending || evidence.isPending || transitionMutation.isPending;
  const mutationError = assign.error || evidence.error || transitionMutation.error;
  const mutationFailure = mutationError ? mapPekError(mutationError) : null;

  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <div><h2 className="font-black">Превышения и корректирующие мероприятия</h2><p className="text-sm text-slate-500">Ответственные, сроки, подтверждения и закрытие превышений</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Факт / норматив</th><th>Критичность</th><th>Ответственный</th><th>Срок</th><th>Мероприятие</th><th>Комментарий</th><th>Файлы</th><th>Статус</th><th /></tr></thead><tbody>{list.data.map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.actualValue ?? '—'} / {item.normativeValue ?? '—'}</td><td>{item.severity || '—'}</td><td>{item.responsibleUser?.fullName || item.responsibleUser?.name || (item.responsibleUserId ? `№${item.responsibleUserId}` : 'Не назначен')}</td><td>{item.dueDate || '—'}</td><td className="max-w-64 truncate">{item.correctiveAction || '—'}</td><td className="max-w-56 truncate">{item.comment || item.resolutionComment || '—'}</td><td>{item.evidenceFileIds?.length || 0}</td><td>{statusLabels[item.status] || item.status}</td><td><Button size="small" onClick={() => setSelectedId(item.id)}>{Object.values(item.availableActions).some(Boolean) ? 'Управлять' : 'Открыть'}</Button></td></tr>)}</tbody></table></div>
    <Dialog open={selectedId !== null} onClose={() => !pending && setSelectedId(null)} fullWidth maxWidth="md"><DialogTitle>Превышение №{selectedId}</DialogTitle><DialogContent className="space-y-4">{detail.isLoading ? <PekLoading /> : detail.isError ? <PekQueryError error={detail.error} resource="превышение" retry={() => void detail.refetch()} /> : selected && <>
      <div className="grid gap-3 sm:grid-cols-3"><div><strong>Статус:</strong> {statusLabels[selected.status] || selected.status}</div><div><strong>Факт:</strong> {selected.actualValue ?? '—'}</div><div><strong>Норматив:</strong> {selected.normativeValue ?? '—'}</div></div>
      {selected.comment && <div><strong>Комментарий:</strong> {selected.comment}</div>}
      {selected.resolutionComment && <div><strong>Комментарий об устранении:</strong> {selected.resolutionComment}</div>}
      {mutationFailure && <Alert severity={mutationFailure.status === 403 ? 'warning' : 'error'}>{mutationFailure.code && <strong>{mutationFailure.code}: </strong>}{mutationFailure.message}{Object.entries(mutationFailure.fieldErrors).map(([field, message]) => <div key={field}>{field}: {message}</div>)}</Alert>}
      {(canAssign || canEdit) && <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2"><TextField select label="Ответственный" value={responsibleUserId} onChange={(event) => setResponsibleUserId(event.target.value)}><MenuItem value="">Не выбран</MenuItem>{assignees.data?.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}</TextField><TextField type="date" label="Срок устранения" InputLabelProps={{ shrink: true }} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><TextField className="sm:col-span-2" multiline minRows={3} label="Корректирующее мероприятие" value={correctiveAction} onChange={(event) => setCorrectiveAction(event.target.value)} /><div className="sm:col-span-2"><Button variant="contained" disabled={pending || !responsibleUserId || !dueDate || !correctiveAction.trim()} onClick={() => assign.mutate()}>{canEdit ? 'Изменить' : 'Назначить ответственного'}</Button></div></section>}
      {canAddEvidence && <section className="rounded-xl border p-4">{!evidenceOpen ? <Button variant="outlined" onClick={() => setEvidenceOpen(true)}>Добавить доказательство</Button> : <><label className="block text-sm font-semibold">Файл подтверждения</label><input className="mt-2 block w-full rounded-lg border p-2 text-sm" type="file" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} /><p className="mt-2 text-xs text-slate-500">{evidenceFile ? evidenceFile.name : 'Файл не выбран'}</p><div className="mt-3 flex gap-2"><Button variant="contained" disabled={pending || !evidenceFile} onClick={() => evidence.mutate()}>Загрузить и прикрепить</Button><Button variant="outlined" disabled={pending} onClick={() => { setEvidenceFile(null); setEvidenceOpen(false); }}>Отмена</Button></div></>}</section>}
      <div><strong>Прикреплённые файлы:</strong>{!selected.evidenceFileIds?.length ? <span className="ml-2 text-slate-500">нет</span> : <ul className="mt-2 space-y-2">{selected.evidenceFileIds.map((fileId, index) => <li key={fileId} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">{evidenceNames[fileId] || `Подтверждение ${index + 1}`}</li>)}</ul>}</div>
      {(canChangeStatus || canClose || canReopen) && <section className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
        {canChangeStatus && ordinaryTransitions.length > 0 && <TextField select label="Новый статус" value={transition} onChange={(event) => setTransition(event.target.value)}>{ordinaryTransitions.map((status) => <MenuItem key={status} value={status}>{statusLabels[status] || status}</MenuItem>)}</TextField>}
        <TextField label="Комментарий" value={comment} onChange={(event) => setComment(event.target.value)} />
        <TextField className="sm:col-span-2" multiline minRows={2} label="Комментарий об устранении / закрытии" value={resolutionComment} onChange={(event) => setResolutionComment(event.target.value)} />
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {canChangeStatus && ordinaryTransitions.length > 0 && <Button variant="contained" disabled={pending || !transition || (transition === 'RESOLVED' && !resolutionComment.trim())} onClick={() => transitionMutation.mutate(transition)}>Изменить статус</Button>}
          {canClose && <Button color="success" variant="contained" disabled={pending || !resolutionComment.trim()} onClick={() => transitionMutation.mutate('CLOSED')}>Закрыть превышение</Button>}
          {canReopen && <Button variant="outlined" disabled={pending} onClick={() => transitionMutation.mutate('OPEN')}>Переоткрыть</Button>}
        </div>
      </section>}
    </>}</DialogContent><DialogActions><Button disabled={pending} onClick={() => setSelectedId(null)}>Закрыть окно</Button></DialogActions></Dialog>
  </section>;
};

export default PekReportExceedances;
