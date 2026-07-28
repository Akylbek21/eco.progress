import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import { useToast } from '../../../../hooks/useToast';
import type { PekExceedance, PekMutationBody } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekService } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { pekExceedanceLabels } from '../../utils/pekLabels';
import { retryPekQuery } from '../../utils/pekQueryPolicy';
import PekLookupSelect from '../common/PekLookupSelect';

const emptyForm = {
  possibleCause: '',
  violationDescription: '',
  actionDescription: '',
  responsibleUserId: null as number | null,
  actionDeadline: '',
  repeatControlRequired: true,
};

const PekExceedances = ({ reportId, version, rows, readOnly }: {
  reportId: number;
  version: number;
  rows: PekExceedance[];
  readOnly: boolean;
}) => {
  const [target, setTarget] = useState<PekExceedance | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [document, setDocument] = useState<File | null>(null);
  const toast = useToast();
  const client = useQueryClient();
  const assignees = useQuery({
    queryKey: pekKeys.assignees(['ECOLOGIST', 'RESPONSIBLE']),
    queryFn: ({ signal }) => pekService.getAssignees(['ECOLOGIST', 'RESPONSIBLE'], signal),
    retry: retryPekQuery,
  });
  const refresh = () => Promise.all([
    client.invalidateQueries({ queryKey: pekKeys.exceedances(reportId) }),
    client.invalidateQueries({ queryKey: pekKeys.report(reportId) }),
    client.invalidateQueries({ queryKey: pekKeys.issues(reportId) }),
    client.invalidateQueries({ queryKey: pekKeys.history(reportId) }),
  ]);
  const close = () => {
    setTarget(null);
    setForm(emptyForm);
    setDocument(null);
  };
  const buildBody = (): PekMutationBody | FormData => {
    const values = { version, ...form };
    if (!document) return values;
    const body = new FormData();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== null && value !== undefined) body.append(key, String(value));
    });
    body.append('document', document);
    return body;
  };
  const save = useMutation({
    mutationFn: () => pekService.updateExceedance(reportId, target?.id || 0, buildBody()),
    retry: false,
    onSuccess: async () => {
      close();
      await refresh();
      toast.success('Меры по превышению сохранены');
    },
    onError: (failure) => toast.error(mapPekError(failure).message),
  });
  const repeat = useMutation({
    mutationFn: (id: number) => pekService.createRepeatControl(reportId, id, { version }),
    retry: false,
    onSuccess: async () => {
      await refresh();
      toast.success('Задача повторного контроля создана');
    },
    onError: (failure) => toast.error(mapPekError(failure).message),
  });

  return <div className="space-y-3">
    {rows.map((row) => <article key={row.id} className="rounded-xl border p-4">
      <div className="grid gap-3 md:grid-cols-5">
        <strong>{row.indicator}</strong>
        <span>{row.result} {row.unit}</span>
        <span>Норматив: {row.normative}</span>
        <span>Кратность: {row.multiplicity}</span>
        <span className="font-bold">{pekExceedanceLabels[row.status]}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {row.protocolId && <Link to={`/staff/protocols/${row.protocolId}`} className="rounded-full border px-4 py-2 text-sm font-bold">Открыть протокол</Link>}
        <Button disabled={readOnly} onClick={() => {
          setTarget(row);
          setForm({
            ...emptyForm,
            possibleCause: row.possibleCause || '',
            actionDescription: row.actionDescription || '',
            actionDeadline: row.actionDeadline || '',
          });
        }}>Заполнить меры</Button>
        {row.status === 'AWAITING_REPEAT_CONTROL' && !row.repeatControlId && <Button variant="secondary" disabled={readOnly || repeat.isPending} onClick={() => repeat.mutate(row.id)}>Создать повторный контроль</Button>}
        {row.repeatControlId && <Link to={`/staff/protocols?create=1&pekReportId=${reportId}&pekControlEventId=${row.repeatControlId}`} className="rounded-full bg-eco-50 px-4 py-2 text-sm font-bold text-eco-800">Создать протокол повторного контроля</Link>}
      </div>
    </article>)}
    {!rows.length && <p className="text-slate-500">Превышения не обнаружены</p>}
    <Modal
      open={Boolean(target)}
      title="Меры по превышению"
      loading={save.isPending}
      onClose={() => !save.isPending && close()}
      footer={<><Button variant="secondary" disabled={save.isPending} onClick={close}>Отмена</Button><Button disabled={save.isPending || !form.actionDescription.trim() || !form.actionDeadline || !form.responsibleUserId} onClick={() => save.mutate()}>Сохранить меры</Button></>}
    >
      <div className="grid gap-3">
        <label>Возможная причина<textarea value={form.possibleCause} onChange={(event) => setForm((value) => ({ ...value, possibleCause: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>Описание нарушения<textarea value={form.violationDescription} onChange={(event) => setForm((value) => ({ ...value, violationDescription: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>Принятые меры *<textarea value={form.actionDescription} onChange={(event) => setForm((value) => ({ ...value, actionDescription: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <PekLookupSelect label="Ответственный" required value={form.responsibleUserId} options={assignees.data || []} loading={assignees.isLoading} error={assignees.isError} onRetry={() => void assignees.refetch()} onChange={(id) => setForm((value) => ({ ...value, responsibleUserId: id }))} />
        <label>Срок *<input type="date" value={form.actionDeadline} onChange={(event) => setForm((value) => ({ ...value, actionDeadline: event.target.value }))} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>Подтверждающий документ<input type="file" onChange={(event) => setDocument(event.target.files?.[0] || null)} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={form.repeatControlRequired} onChange={(event) => setForm((value) => ({ ...value, repeatControlRequired: event.target.checked }))} />Требуется повторный контроль</label>
        <p className="text-xs text-slate-500">Статус превышения изменяет backend после подтверждённого контроля.</p>
      </div>
    </Modal>
  </div>;
};

export default PekExceedances;
