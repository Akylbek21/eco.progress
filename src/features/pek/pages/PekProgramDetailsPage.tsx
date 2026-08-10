import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekAvailableAction, PekProgram } from '../api/pekContracts';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { PekLoading, PekPageHeader, PekPrimaryAction, PekReadiness, PekStatusBadge } from '../components/common/PekUi';
import PekQueryError from '../components/common/PekQueryError';
import PekProgramDocuments from '../components/documents/PekProgramDocuments';
import PekActionModal from '../components/workflow/PekActionModal';
import { mapPekError } from '../utils/pekErrorMapper';

const tabs = ['Обзор', 'Объекты контроля', 'Показатели', 'Мероприятия', 'Документы', 'История', 'Версии', 'Отчёты'];

const PekProgramDetailsPage = () => {
  const id = Number(useParams().programId);
  const [tab, setTab] = useState(0);
  const [action, setAction] = useState<PekAvailableAction | null>(null);
  const [cloneAction, setCloneAction] = useState<PekAvailableAction | null>(null);
  const [cloneNumber, setCloneNumber] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneValidFrom, setCloneValidFrom] = useState('');
  const [cloneValidUntil, setCloneValidUntil] = useState('');
  const client = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const program = useQuery({
    queryKey: pekKeys.program(id, undefined, user?.id),
    queryFn: ({ signal }) => pekApi.getProgram(id, signal),
    enabled: Number.isFinite(id),
  });
  const workflow = useMutation({
    mutationFn: async ({ item, comment }: { item: PekAvailableAction; comment: string }) => {
      const fresh = await pekApi.getProgram(id);
      const currentAction = fresh.availableActions.find((candidate) => candidate.code === item.code && candidate.enabled);
      if (!currentAction) throw new Error('Действие больше недоступно. Карточка будет обновлена.');
      const version = fresh.version;
      if (item.code === 'SUBMIT_REVIEW') return pekApi.submitProgramReview(id, { version });
      if (item.code === 'RETURN') return pekApi.returnProgram(id, { version, reason: comment });
      if (item.code === 'APPROVE') return pekApi.approveProgram(id, { version });
      if (item.code === 'ACTIVATE') return pekApi.activateProgram(id, { version });
      if (item.code === 'ARCHIVE') return pekApi.archiveProgram(id, { version });
      if (item.code === 'CLONE') return pekApi.cloneProgram(id, {
        number: cloneNumber.trim(),
        name: cloneName.trim() || undefined,
        validFrom: cloneValidFrom || undefined,
        validUntil: cloneValidUntil || undefined,
      });
      throw new Error('Это действие сейчас недоступно.');
    },
    retry: false,
    onSuccess: async (saved) => {
      setAction(null);
      setCloneAction(null);
      client.setQueryData(pekKeys.program(saved.id, saved.company?.id, user?.id), saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.programs({}, user?.id) }),
        client.invalidateQueries({ queryKey: pekKeys.dashboard({}, user?.id) }),
        client.invalidateQueries({ queryKey: pekKeys.programHistory(id, user?.id) }),
      ]);
      toast.success('Действие выполнено');
      if (saved.id !== id) navigate(`/staff/pek/programs/${saved.id}`);
    },
    onError: async (error) => {
      const mapped = mapPekError(error);
      if (mapped.status === 409) await program.refetch();
      toast.error(mapped.message);
    },
  });

  if (program.isLoading) return <PekLoading />;
  if (program.isError || !program.data) return <PekQueryError error={program.error} resource="Программа ПЭК" retry={() => void program.refetch()} />;
  const item = program.data;
  const workflowActions = item.availableActions.filter((candidate) => candidate.code !== 'EDIT');
  const editAction = item.availableActions.find((candidate) => candidate.code === 'EDIT');

  return <div className="space-y-5">
    <PekPageHeader
      title={`${item.number} · ${item.name}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'}`}
      actions={<>
        <PekStatusBadge status={item.status} />
        {workflowActions.map((candidate) => (
          <PekPrimaryAction key={candidate.code} action={candidate} pending={workflow.isPending} onClick={(selected) => selected.code === 'CLONE' ? setCloneAction(selected) : setAction(selected)} />
        ))}
        {!item.readOnly && editAction?.enabled && (
          <button type="button" onClick={() => navigate(`/staff/pek/programs/${id}/edit`)} className="rounded-full border px-5 py-2 font-bold">Изменить</button>
        )}
      </>}
    />
    <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <Info label="Версия" value={item.version} />
      <Info label="Период" value={`${item.validFrom} — ${item.validUntil}`} />
      <Info label="Ответственный" value={item.responsible?.name || '—'} />
      <PekReadiness value={item.readinessPercent} />
      <Info label="Режим" value={item.readOnly ? 'Только чтение' : 'Редактирование разрешено'} />
    </section>
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((label, index) => <button key={label} type="button" onClick={() => setTab(index)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === index ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    <section className="rounded-2xl border bg-white p-5">
      {tab === 0 && <div className="grid gap-3 md:grid-cols-2"><Info label="Компания" value={item.company?.name || '—'} /><Info label="Объект" value={item.object?.name || '—'} /><Info label="Описание" value={item.description || '—'} /><Info label="Последнее изменение" value={item.updatedAt || '—'} /></div>}
      {tab === 1 && <DataRows rows={item.controlItems || []} />}
      {tab === 2 && <DataRows rows={item.indicators || []} />}
      {tab === 3 && <DataRows rows={item.measures || []} />}
      {tab === 4 && <PekProgramDocuments programId={id} version={item.version} documents={item.documents || []} readOnly={item.readOnly} />}
      {tab === 5 && <Link className="font-bold text-eco-700" to={`/staff/pek/programs/${id}/history`}>Открыть историю программы</Link>}
      {tab === 6 && <div className="space-y-2"><Info label="Текущая версия" value={item.version} /><p className="text-sm text-slate-500">Согласованные версии доступны только для чтения. Здесь отображаются только сохранённые версии программы.</p></div>}
      {tab === 7 && <Link className="font-bold text-eco-700" to={`/staff/pek/reports?companyId=${item.company?.id || ''}&objectId=${item.object?.id || ''}`}>Открыть отчёты объекта</Link>}
    </section>
    <PekActionModal action={action} pending={workflow.isPending} onClose={() => setAction(null)} onConfirm={(comment) => action && workflow.mutate({ item: action, comment })} />
    <Modal
      open={Boolean(cloneAction)}
      title="Клонировать программу"
      description="Укажите уникальный номер новой программы. Прикреплённые документы не копируются."
      loading={workflow.isPending}
      onClose={() => setCloneAction(null)}
      footer={<>
        <Button variant="secondary" onClick={() => setCloneAction(null)}>Отмена</Button>
        <Button
          disabled={!cloneNumber.trim() || workflow.isPending}
          onClick={() => cloneAction && workflow.mutate({ item: cloneAction, comment: '' })}
        >
          Клонировать
        </Button>
      </>}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <label>Новый номер *<input value={cloneNumber} onChange={(event) => setCloneNumber(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label>Название<input value={cloneName} onChange={(event) => setCloneName(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label>Действует с<input type="date" value={cloneValidFrom} onChange={(event) => setCloneValidFrom(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
        <label>Действует до<input type="date" value={cloneValidUntil} onChange={(event) => setCloneValidUntil(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" /></label>
      </div>
    </Modal>
  </div>;
};

const Info = ({ label, value }: { label: string; value: string | number }) => <div><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-1 font-semibold">{value}</p></div>;
const DataRows = ({ rows }: { rows: unknown[] }) => <div className="space-y-2">{rows.map((value, index) => {
  const row = value as Record<string, unknown>;
  return <div key={String(row.id || row.clientId || index)} className="rounded-xl bg-slate-50 p-3"><strong>{String(row.code || row.indicatorCode || '')}</strong> {String(row.name || row.indicatorName || `Запись ${index + 1}`)}</div>;
})}{!rows.length && <p className="text-slate-500">Данные не добавлены</p>}</div>;

export default PekProgramDetailsPage;
