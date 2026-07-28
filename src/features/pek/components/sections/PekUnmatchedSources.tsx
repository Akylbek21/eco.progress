import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../../components/ui/Button';
import Modal from '../../../../components/ui/Modal';
import { useToast } from '../../../../hooks/useToast';
import type { PekUnmatchedSource } from '../../api/pekContracts';
import { pekKeys } from '../../api/pekQueryKeys';
import { pekService } from '../../api/pekService';
import { mapPekError } from '../../utils/pekErrorMapper';
import { retryPekQuery } from '../../utils/pekQueryPolicy';
import PekLookupSelect from '../common/PekLookupSelect';

type Target = { row: PekUnmatchedSource; mode: 'link' | 'exclude' };

const PekUnmatchedSources = ({ reportId, version, rows, readOnly }: {
  reportId: number;
  version: number;
  rows: PekUnmatchedSource[];
  readOnly: boolean;
}) => {
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState('');
  const [controlItemId, setControlItemId] = useState<number | null>(null);
  const [indicatorId, setIndicatorId] = useState<number | null>(null);
  const toast = useToast();
  const client = useQueryClient();
  const linkOptions = useQuery({
    queryKey: pekKeys.linkOptions(reportId, target?.row.id || 0),
    queryFn: ({ signal }) => pekService.getUnmatchedLinkOptions(reportId, target?.row.id || 0, signal),
    enabled: target?.mode === 'link' && Boolean(target.row.id),
    retry: retryPekQuery,
  });
  const selectedControl = linkOptions.data?.find((item) => item.id === controlItemId);
  const close = () => {
    setTarget(null);
    setReason('');
    setControlItemId(null);
    setIndicatorId(null);
  };
  const mutation = useMutation({
    mutationFn: () => {
      if (!target) throw new Error('Источник не выбран');
      return target.mode === 'link'
        ? pekService.linkUnmatchedSource(reportId, target.row.id, { version, controlItemId, indicatorId, reason })
        : pekService.excludeUnmatchedSource(reportId, target.row.id, { version, reason });
    },
    retry: false,
    onSuccess: async () => {
      close();
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.unmatched(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.report(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.planFact(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.issues(reportId) }),
        client.invalidateQueries({ queryKey: pekKeys.history(reportId) }),
      ]);
      toast.success('Источник обработан');
    },
    onError: (failure) => toast.error(mapPekError(failure).message),
  });

  return <div className="space-y-3">
    <h2 className="text-lg font-black">Несопоставленные источники</h2>
    {rows.map((row) => <article key={row.id} className="rounded-xl border p-4">
      <div className="grid gap-2 md:grid-cols-3">
        <div><strong>{row.protocolNumber}</strong><p className="text-sm text-slate-500">{row.date} · {row.point}</p></div>
        <div><strong>{row.indicator}</strong><p className="text-sm">{row.result}</p></div>
        <div><p className="text-sm">{row.reason}</p>{row.suggestedControlItem && <p className="text-xs text-slate-500">Возможно: {row.suggestedControlItem} ({row.confidenceLabel || 'требует проверки'})</p>}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="rounded-full border px-4 py-2 text-sm font-bold" to={`/staff/protocols/${row.protocolId}`}>Открыть протокол</Link>
        <Button variant="secondary" disabled={readOnly} onClick={() => setTarget({ row, mode: 'link' })}>Указать связь</Button>
        <Button variant="danger" disabled={readOnly} onClick={() => setTarget({ row, mode: 'exclude' })}>Исключить с причиной</Button>
      </div>
    </article>)}
    {!rows.length && <p className="text-slate-500">Несопоставленных источников нет</p>}
    <Modal
      open={Boolean(target)}
      title={target?.mode === 'link' ? 'Указать связь' : 'Исключить источник'}
      onClose={() => !mutation.isPending && close()}
      loading={mutation.isPending}
      footer={<>
        <Button variant="secondary" disabled={mutation.isPending} onClick={close}>Отмена</Button>
        <Button disabled={mutation.isPending || !reason.trim() || (target?.mode === 'link' && (!controlItemId || !indicatorId))} onClick={() => mutation.mutate()}>Подтвердить</Button>
      </>}
    >
      <div className="space-y-4">
        {target?.mode === 'link' && <>
          <PekLookupSelect
            label="Позиция программы"
            required
            value={controlItemId}
            options={linkOptions.data || []}
            loading={linkOptions.isLoading}
            error={linkOptions.isError}
            onRetry={() => void linkOptions.refetch()}
            onChange={(id) => { setControlItemId(id); setIndicatorId(null); }}
          />
          <PekLookupSelect
            label="Показатель"
            required
            value={indicatorId}
            options={selectedControl?.indicators || []}
            disabled={!controlItemId}
            onChange={setIndicatorId}
          />
          <p className="text-sm text-amber-700">Ручное сопоставление будет записано backend в историю аудита.</p>
        </>}
        <label className="text-sm font-bold">Причина *
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-1 w-full rounded-xl border p-3" />
        </label>
        {target?.mode === 'exclude' && <p className="text-sm text-amber-700">Источник не войдёт в отчёт. Исключение и причина сохраняются backend.</p>}
      </div>
    </Modal>
  </div>;
};

export default PekUnmatchedSources;
