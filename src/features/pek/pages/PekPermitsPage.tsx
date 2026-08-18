import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { History, Pencil, Plus, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useAuth } from '../../../contexts/AuthContext';
import type {
  PekPermit,
  PekPermitCreateRequest,
  PekPermitStatus,
  PekPermitUpdateRequest,
  PekPermitContext,
} from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import PekCompanyObjectFilters from '../components/common/PekCompanyObjectFilters';
import PekQueryError from '../components/common/PekQueryError';
import { PekLoading, PekPageHeader, PekState } from '../components/common/PekUi';
import { usePekAccessContext } from '../hooks/usePekAccessContext';
import { mapPekError } from '../utils/pekErrorMapper';
import { retryPekQuery } from '../utils/pekQueryPolicy';

const statusLabels: Record<PekPermitStatus, string> = {
  ACTIVE: 'Действует',
  EXPIRED: 'Истёк',
  REVOKED: 'Отозван',
};

const statusClasses: Record<PekPermitStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-800',
  EXPIRED: 'bg-amber-50 text-amber-800',
  REVOKED: 'bg-rose-50 text-rose-800',
};

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm';

type PermitEditorProps = {
  permit: PekPermit | null;
  companyId: number;
  objectId: number;
  pending: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (body: PekPermitCreateRequest | PekPermitUpdateRequest) => void;
  context: PekPermitContext;
};

const PermitEditor = ({ permit, companyId, objectId, pending, error, onClose, onSubmit, context }: PermitEditorProps) => {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const validFrom = String(form.get('validFrom') || '');
    const validTo = String(form.get('validTo') || '');
    const validToInput = event.currentTarget.elements.namedItem('validTo') as HTMLInputElement;
    if (validTo < validFrom) {
      validToInput.setCustomValidity('Дата окончания должна быть не раньше даты начала');
      validToInput.reportValidity();
      return;
    }
    const values = {
      type: String(form.get('type') || '').trim(),
      number: String(form.get('number') || '').trim(),
      issuedAt: String(form.get('issuedAt') || '') || null,
      validFrom,
      validTo,
      authority: String(form.get('authority') || '').trim(),
      fileId: String(form.get('fileId') || '').trim() || null,
      note: String(form.get('note') || '').trim() || null,
      pekProgramId: Number(form.get('pekProgramId')) || null,
    };
    onSubmit(permit
      ? { ...values, version: permit.version }
      : { ...values, companyId, objectId });
  };

  return <Modal
    isOpen
    title={permit ? `Изменить разрешение № ${permit.number}` : 'Новое разрешение'}
    description="Данные разрешительного документа для выбранного объекта"
    loading={pending}
    onClose={onClose}
  >
    <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 md:col-span-2">{error}</p>}
      <label className="text-sm font-semibold text-slate-700">Тип *
        <input name="type" required defaultValue={permit?.type || ''} placeholder="Например, EMISSION" className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Номер *
        <input name="number" required defaultValue={permit?.number || ''} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Дата выдачи
        <input name="issuedAt" type="date" defaultValue={permit?.issuedAt || ''} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Орган выдачи
        <input name="authority" defaultValue={permit?.authority || ''} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Действует с *
        <input name="validFrom" type="date" required defaultValue={permit?.validFrom || ''} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Действует до *
        <input name="validTo" type="date" required defaultValue={permit?.validTo || ''} min={permit?.validFrom || undefined} onInput={(event) => event.currentTarget.setCustomValidity('')} className={fieldClass} />
      </label>
      <label className="text-sm font-semibold text-slate-700">Файл/документ
        <select name="fileId" defaultValue={permit?.fileId || ''} className={fieldClass}><option value="">Удалить файл</option>{context.files.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}</select>
      </label>
      <label className="text-sm font-semibold text-slate-700">Программа ПЭК
        <select name="pekProgramId" defaultValue={permit?.pekProgramId || ''} className={fieldClass}><option value="">Очистить программу</option>{context.programs.map((program) => <option key={program.id} value={program.id}>{program.number} · {program.name}</option>)}</select>
      </label>
      <label className="text-sm font-semibold text-slate-700 md:col-span-2">Примечание
        <textarea name="note" rows={3} defaultValue={permit?.note || ''} className={fieldClass} />
      </label>
      <div className="flex justify-end gap-3 md:col-span-2">
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Отмена</Button>
        <Button type="submit" disabled={pending}>{pending ? 'Сохранение…' : 'Сохранить'}</Button>
      </div>
    </form>
  </Modal>;
};

const PekPermitsPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const companyId = Number(params.get('companyId')) || 0;
  const objectId = Number(params.get('objectId')) || 0;
  const [editing, setEditing] = useState<PekPermit | 'new' | null>(null);
  const [historyPermit, setHistoryPermit] = useState<PekPermit | null>(null);
  const [mutationError, setMutationError] = useState('');
  const access = usePekAccessContext(companyId || undefined);
  const canCreate = access.data?.availableActions.createPermit === true || access.data?.permissions.includes('PEK_PROGRAM_EDIT') === true;
  const listKey = pekKeys.permits(objectId, user?.id);

  const updateFilter = (key: 'companyId' | 'objectId', value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    if (key === 'companyId') next.delete('objectId');
    setParams(next, { replace: true });
  };

  const permits = useQuery({
    queryKey: listKey,
    queryFn: ({ signal }) => pekApi.getPermits(objectId, signal),
    enabled: objectId > 0,
    retry: retryPekQuery,
  });
  const permitContext = useQuery({
    queryKey: pekKeys.permitContext(companyId || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getPermitContext(companyId, signal),
    enabled: companyId > 0,
    retry: retryPekQuery,
  });

  const save = useMutation({
    mutationFn: (body: PekPermitCreateRequest | PekPermitUpdateRequest) => editing && editing !== 'new'
      ? pekApi.updatePermit(editing.id, body as PekPermitUpdateRequest)
      : pekApi.createPermit(body as PekPermitCreateRequest),
    onSuccess: async () => {
      setEditing(null);
      setMutationError('');
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    onError: async (error) => {
      setMutationError(mapPekError(error).message);
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    retry: false,
  });

  const changeStatus = useMutation({
    mutationFn: ({ permit, status, comment }: { permit: PekPermit; status: PekPermitStatus; comment: string }) =>
      pekApi.changePermitStatus(permit.id, permit.version, status, comment),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: listKey }),
    onError: async (error) => {
      window.alert(mapPekError(error).message);
      await queryClient.invalidateQueries({ queryKey: listKey });
    },
    retry: false,
  });

  const history = useQuery({
    queryKey: pekKeys.permitHistory(historyPermit?.id || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getPermitHistory(historyPermit!.id, signal),
    enabled: Boolean(historyPermit),
    retry: retryPekQuery,
  });

  const requestStatus = (permit: PekPermit, status: PekPermitStatus) => {
    const comment = window.prompt(status === 'REVOKED' ? 'Укажите причину отзыва разрешения' : 'Комментарий к смене статуса', '');
    if (comment === null) return;
    changeStatus.mutate({ permit, status, comment: comment.trim() });
  };

  return <div className="space-y-5">
    <PekPageHeader
      title="Разрешительные документы"
      description="Реестр разрешений объектов, сроки действия, статусы и история изменений"
      actions={canCreate && companyId > 0 && objectId > 0 && permitContext.isSuccess
        ? <Button type="button" onClick={() => { setMutationError(''); setEditing('new'); }}><Plus size={16} /> Добавить разрешение</Button>
        : undefined}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-2">
      <PekCompanyObjectFilters
        companyId={companyId || undefined}
        objectId={objectId || undefined}
        onCompanyChange={(value) => updateFilter('companyId', value)}
        onObjectChange={(value) => updateFilter('objectId', value)}
        required
      />
    </section>

    {!objectId
      ? <PekState title="Выберите объект" message="Разрешения загружаются отдельно для каждого объекта компании." />
      : permits.isLoading
        ? <PekLoading />
        : permits.isError
          ? <PekQueryError error={permits.error} resource="разрешительные документы" retry={() => void permits.refetch()} />
          : !permits.data?.length
            ? <PekState title="Разрешений пока нет" message={canCreate ? 'Добавьте первый разрешительный документ для выбранного объекта.' : 'Для выбранного объекта разрешительные документы не найдены.'} />
            : <div className="overflow-x-auto rounded-2xl border bg-white">
              <table className="w-full min-w-[1050px] text-sm">
                <thead className="bg-slate-50 text-left"><tr>{['Тип и номер', 'Орган выдачи', 'Дата выдачи', 'Срок действия', 'Статус', 'Связи', 'Действия'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead>
                <tbody>{permits.data.map((permit) => <tr key={permit.id} className="border-t align-top">
                  <td className="px-4 py-3"><p className="font-bold text-slate-900">{permit.type}</p><p className="mt-1 text-slate-600">№ {permit.number}</p></td>
                  <td className="px-4 py-3">{permit.authority || '—'}</td>
                  <td className="px-4 py-3">{permit.issuedAt || '—'}</td>
                  <td className="px-4 py-3"><p>{permit.validFrom} — {permit.validTo}</p>{permit.status === 'ACTIVE' && !permit.effectivelyActive && <p className="mt-1 text-xs font-semibold text-amber-700">Вне срока действия</p>}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses[permit.status]}`}>{statusLabels[permit.status]}</span></td>
                  <td className="px-4 py-3 text-xs text-slate-600"><p>Файл: {permit.fileId || '—'}</p><p className="mt-1">Программа: {permit.pekProgramId || '—'}</p></td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-2">
                    {permit.availableActions.edit && <Button type="button" variant="secondary" onClick={() => { setMutationError(''); setEditing(permit); }}><Pencil size={14} /> Изменить</Button>}
                    {permit.availableActions.markExpired && <Button type="button" variant="secondary" disabled={changeStatus.isPending} onClick={() => requestStatus(permit, 'EXPIRED')}><ShieldAlert size={14} /> Истёк</Button>}
                    {permit.availableActions.revoke && <Button type="button" variant="danger" disabled={changeStatus.isPending} onClick={() => requestStatus(permit, 'REVOKED')}><ShieldAlert size={14} /> Отозвать</Button>}
                    <Button type="button" variant="secondary" onClick={() => setHistoryPermit(permit)}><History size={14} /> История</Button>
                  </div></td>
                </tr>)}</tbody>
              </table>
            </div>}

    {editing && permitContext.data && <PermitEditor
      permit={editing === 'new' ? null : editing}
      companyId={companyId}
      objectId={objectId}
      pending={save.isPending}
      error={mutationError}
      onClose={() => { if (!save.isPending) setEditing(null); }}
      onSubmit={(body) => save.mutate(body)}
      context={permitContext.data}
    />}

    {historyPermit && <Modal isOpen title={`История разрешения № ${historyPermit.number}`} onClose={() => setHistoryPermit(null)}>
      {history.isLoading
        ? <PekLoading />
        : history.isError
          ? <PekQueryError error={history.error} resource="историю разрешения" retry={() => void history.refetch()} />
          : !history.data?.length
            ? <p className="text-sm text-slate-600">История пока пуста.</p>
            : <ol className="space-y-3">{history.data.map((item, index) => <li key={`${item.performedAt}-${index}`} className="rounded-xl border border-slate-200 p-4">
              <p className="font-bold text-slate-900">{item.fromStatus ? `${statusLabels[item.fromStatus]} → ` : ''}{statusLabels[item.toStatus]}</p>
              <p className="mt-1 text-sm text-slate-600">{item.performedBy?.name || 'Сотрудник'} · {new Date(item.performedAt).toLocaleString('ru-RU')}</p>
              {item.comment && <p className="mt-2 text-sm text-slate-700">{item.comment}</p>}
            </li>)}</ol>}
    </Modal>}
  </div>;
};

export default PekPermitsPage;
