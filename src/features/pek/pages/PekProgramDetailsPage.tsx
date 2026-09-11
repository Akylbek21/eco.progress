import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekAvailableAction, PekProgram } from '../api/pekContracts';
import { commitPekProgramMutation } from '../api/pekProgramCache';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { PekLoading, PekPageHeader, PekPrimaryAction, PekStatusBadge } from '../components/common/PekUi';
import PekQueryError from '../components/common/PekQueryError';
import PekProgramDocuments from '../components/documents/PekProgramDocuments';
import PekProgramMonitoring from '../components/monitoring/PekProgramMonitoring';
import PekActionModal from '../components/workflow/PekActionModal';
import PekProgramStructuredSections from '../components/sections/PekProgramStructuredSections';
import PekProgramStructure, { type PekWorkspaceSection } from '../components/workspace/PekProgramStructure';
import { handlePekMutationError } from '../utils/pekMutationError';
import PekInventoryEditor from '../components/inventory/PekInventoryEditor';
import PekReadinessPanel from '../components/common/PekReadinessPanel';
import { pekInventoryApi } from '../api/pekInventory';

const tabs = ['Программа ПЭК', 'Производственный мониторинг', 'Показатели', 'Мероприятия', 'Организация контроля', 'Разрешения и документы', 'История', 'Отчёты', 'Реестры'];
const sectionTabs: Record<PekWorkspaceSection, number> = { overview: 0, controls: 1, organization: 4, documents: 5 };

const PekProgramDetailsPage = () => {
  const id = Number(useParams().programId);
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = Number(searchParams.get('companyId')) || undefined;
  const programDetailKey = pekKeys.programDetail(companyId, id);
  const requestedTab = Number(searchParams.get('tab'));
  const tab = Number.isInteger(requestedTab) && requestedTab >= 0 && requestedTab < tabs.length ? requestedTab : 0;
  const setTab = (value: number) => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('tab', String(value)); return next; });
  const [action, setAction] = useState<PekAvailableAction | null>(null);
  const [cloneAction, setCloneAction] = useState<PekAvailableAction | null>(null);
  const [cloneNumber, setCloneNumber] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneValidFrom, setCloneValidFrom] = useState('');
  const [cloneValidUntil, setCloneValidUntil] = useState('');
  const [workflowErrors, setWorkflowErrors] = useState<string[]>([]);
  const client = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const program = useQuery({
    queryKey: programDetailKey,
    queryFn: ({ signal }) => pekApi.getProgram(id, signal),
    enabled: Number.isSafeInteger(id) && id > 0,
  });
  const permits = useQuery({
    queryKey: pekKeys.permits(program.data?.object?.id || 0, user?.id),
    queryFn: ({ signal }) => pekApi.getPermits(program.data!.object!.id, signal),
    enabled: Boolean(program.data?.object?.id),
  });
  const readiness = useQuery({
    queryKey: pekKeys.programReadiness(id, user?.id, program.data?.contentRevision),
    queryFn: ({ signal }) => pekApi.getProgramReadiness(id, signal), enabled: Boolean(program.data),
  });
  const counts = useQuery({
    queryKey: ['pek', 'program', 'inventory-counts', id, user?.id, program.data?.contentRevision],
    enabled: Boolean(program.data),
    queryFn: async ({ signal }) => {
      const [emissions, discharges, wastes, ...points] = await Promise.all([
        pekInventoryApi.list(id, 'emission-sources', signal), pekInventoryApi.list(id, 'discharge-sources', signal),
        pekInventoryApi.list(id, 'waste-items', signal),
        ...(program.data?.monitoring?.items || []).map(direction => pekApi.getMonitoringPoints(id, direction.id, signal)),
      ]);
      return [['Источники выбросов', emissions.length], ['Выпуски сточных вод', discharges.length], ['Отходы', wastes.length], ['Точки мониторинга', points.flat().length]] as const;
    },
  });
  const workflow = useMutation({
    mutationFn: async ({ item, comment }: { item: PekAvailableAction; comment: string }) => {
      const version = program.data!.version;
      if (item.code === 'SUBMIT_REVIEW') return pekApi.submitProgramReview(id, version);
      if (item.code === 'RETURN') return pekApi.returnProgram(id, version, comment);
      if (item.code === 'APPROVE') return pekApi.approveProgram(id, version);
      if (item.code === 'ACTIVATE') return pekApi.activateProgram(id, version);
      if (item.code === 'ARCHIVE') return pekApi.archiveProgram(id, version);
      if (item.code === 'CLONE') return pekApi.cloneProgram(id, program.data!.version, {
        number: cloneNumber.trim(),
        name: cloneName.trim() || undefined,
        validFrom: cloneValidFrom || undefined,
        validUntil: cloneValidUntil || undefined,
      });
      throw new Error('Это действие сейчас недоступно.');
    },
    retry: false,
    onSuccess: async (saved) => {
      setWorkflowErrors([]);
      setAction(null);
      setCloneAction(null);
      await commitPekProgramMutation(client, saved.id === id ? companyId : saved.company?.id, saved);
      await Promise.all([
        client.invalidateQueries({ queryKey: pekKeys.dashboard({}, user?.id) }),
        client.invalidateQueries({ queryKey: pekKeys.programHistory(id, user?.id) }),
      ]);
      toast.success('Действие выполнено');
      if (saved.id !== id) navigate(`/staff/pek/programs/${saved.id}?companyId=${saved.company?.id || companyId || ''}`);
    },
    onError: async (error) => {
      const mapped = await handlePekMutationError(error, () => program.refetch());
      toast.error(mapped.message);
      setWorkflowErrors([
        ...mapped.issues.map((issue) => issue.message),
        ...mapped.missingFields,
      ]);
    },
  });

  if (program.isLoading) return <PekLoading />;
  if (program.isError || !program.data) return <PekQueryError error={program.error} resource="Программа ПЭК" retry={() => void program.refetch()} />;
  const item = program.data;
  const workflowActions: PekAvailableAction[] = [
    item.availableActions.submit && { code: 'SUBMIT_REVIEW', label: 'Отправить на согласование', enabled: true },
    item.availableActions.returnForRevision && { code: 'RETURN', label: 'Вернуть на доработку', enabled: true, requiresComment: true },
    item.availableActions.approve && { code: 'APPROVE', label: 'Согласовать', enabled: true },
    item.availableActions.activate && { code: 'ACTIVATE', label: 'Активировать', enabled: true },
    item.availableActions.archive && { code: 'ARCHIVE', label: 'Архивировать', enabled: true },
    item.availableActions.clone && { code: 'CLONE', label: 'Клонировать', enabled: true },
  ].filter((candidate): candidate is PekAvailableAction => Boolean(candidate));

  return <div className="space-y-5">
    <PekPageHeader
      title={`${item.number} · ${item.name}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'}`}
      actions={<>
        <PekStatusBadge status={item.status} />
        {workflowActions.map((candidate) => (
          <PekPrimaryAction key={candidate.code} action={candidate} pending={workflow.isPending} onClick={(selected) => selected.code === 'CLONE' ? setCloneAction(selected) : setAction(selected)} />
        ))}
        {item.availableActions.edit && (
          <button type="button" onClick={() => navigate(`/staff/pek/programs/${id}/edit?companyId=${companyId || item.company?.id || ''}`)} className="rounded-full border px-5 py-2 font-bold">Изменить</button>
        )}
      </>}
    />
    {workflowErrors.length > 0 && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900"><strong>Программа не готова к выполнению действия:</strong><ul className="mt-2 list-disc pl-5">{workflowErrors.map((message) => <li key={message}>{message}</li>)}</ul></section>}
    <section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Версия" value={item.version} />
      <Info label="Период" value={`${item.validFrom} — ${item.validUntil}`} />
      <Info label="Версия формы" value={item.templateVersion || '—'} />
      <Info label="Версия НПА" value={item.regulationVersion || '—'} />
      <Info label="Ревизия данных" value={item.contentRevision} />
      <Info label="Ответственный" value={item.responsible?.name || '—'} />
      <Info label="Режим" value={item.readOnly ? 'Только чтение' : 'Редактирование разрешено'} />
    </section>
    <nav className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((label, index) => <button key={label} type="button" onClick={() => setTab(index)} className={`whitespace-nowrap px-4 py-3 font-bold ${tab === index ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    {tab === 0 && <div className="space-y-5">
      {readiness.isPending && <p role="status">Проверка готовности программы…</p>}
      {readiness.isError && <PekQueryError error={readiness.error} resource="Готовность программы" retry={() => void readiness.refetch()} />}
      {readiness.data && <PekReadinessPanel readiness={{ ...readiness.data, completionPercent: readiness.data.progressPercent }} onIssueClick={issue => {
        const section = issue.section || '';
        if (section === 'GENERAL') { navigate(`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=0`); return; }
        setTab(/PERMIT|DOCUMENT/.test(section) ? 5 : /INDICATOR/.test(section) ? 2 : /INSPECTION|QA|EMERGENCY|RESPONSIBILITY/.test(section) ? 4 : /SOURCE|WASTE/.test(section) ? 8 : 1);
      }} />}
      {counts.isPending && <p role="status">Загрузка состава реестров…</p>}
      {counts.isError && <PekQueryError error={counts.error} resource="Состав реестров" retry={() => void counts.refetch()} />}
      {counts.data && <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Состав программы</h3><ul className="mt-3 space-y-2">{counts.data.map(([label, count]) => <li key={label}><button type="button" className="text-left underline" onClick={() => setTab(label === 'Точки мониторинга' ? 1 : 8)}>{count ? '✓' : '—'} {label} — {count || 'отсутствуют'}</button></li>)}</ul><p className="mt-3 text-sm text-slate-500">Обязательность разделов и блокирующие проблемы определяются проверкой готовности выше.</p></section>}
      <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Заполненные сведения</h3><ul className="mt-3 space-y-2"><li>{item.responsible ? '✓ Ответственный назначен' : '✕ Ответственный не назначен'}</li><li>Позиции контроля — {item.controlItems?.length || 0}</li><li>Показатели — {item.indicators?.length || 0}</li><li>Направления мониторинга — {item.monitoring?.items.length || 0}</li></ul></section>
      <PekProgramStructure program={item} readinessPercent={readiness.data?.progressPercent} onOpenSection={(section) => setTab(sectionTabs[section])} />
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-lg font-black">Общие сведения</h2><div className="grid gap-3 md:grid-cols-2"><Info label="Компания" value={item.company?.name || '—'} /><Info label="Объект" value={item.object?.name || '—'} /><Info label="Описание" value={item.description || '—'} /><Info label="Последнее изменение" value={item.updatedAt || '—'} /><Info label="Проектная мощность" value={item.designCapacity || '—'} /><Info label="Фактическая мощность" value={item.actualCapacity || '—'} /></div></section>
    </div>}
    {tab !== 0 && <section className="rounded-2xl border bg-white p-5">
      {tab === 1 && <div className="space-y-6"><PekProgramMonitoring program={item} /><div><h3 className="mb-3 font-black">Объекты контроля</h3>{item.availableActions.edit && <Link className="text-eco-700 underline" to={`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=5`}>Редактировать позиции и связи с источниками</Link>}<DataRows rows={item.controlItems || []} /></div></div>}
      {tab === 2 && <><DataRows rows={item.indicators || []} />{item.availableActions.edit && <Link className="text-eco-700 underline" to={`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=6`}>Редактировать показатели</Link>}</>}
      {tab === 8 && <div className="space-y-5">{(['emission-sources', 'discharge-sources', 'waste-items'] as const).map(kind => <PekInventoryEditor key={`${id}-${kind}`} kind={kind} parentId={id} programId={id} companyId={item.company?.id} canEdit={item.availableActions.edit === true && !item.readOnly} />)}</div>}
      {tab === 3 && <><DataRows rows={item.measures || []} />{item.availableActions.edit && <Link className="text-eco-700 underline" to={`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=11`}>Редактировать мероприятия</Link>}</>}
      {tab === 4 && <PekProgramStructuredSections program={item} />}
      {tab === 5 && <div className="space-y-6"><div><h2 className="font-black">Разрешительные документы</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{permits.data?.filter((permit) => item.permitIds?.includes(permit.id)).map((permit) => <article key={permit.id} className="rounded-xl border p-4"><strong>{permit.type} № {permit.number}</strong><p className="mt-1 text-sm">Дата выдачи: {permit.issuedAt || '—'}</p><p className="text-sm">Срок действия: {permit.validFrom} — {permit.validTo}</p><p className="text-sm">Статус: {permit.status}</p></article>)}{!permits.isLoading && !permits.data?.some((permit) => item.permitIds?.includes(permit.id)) && <p className="text-sm text-slate-500">Разрешения не выбраны.</p>}</div></div><PekProgramDocuments companyId={companyId} programId={id} version={item.version} documents={item.documents || []} canUpload={item.availableActions.uploadDocument} /></div>}
      {tab === 6 && <Link className="font-bold text-eco-700" to={`/staff/pek/programs/${id}/history`}>Открыть историю программы</Link>}
      {tab === 7 && <Link className="font-bold text-eco-700" to={`/staff/pek/reports?companyId=${item.company?.id || ''}&objectId=${item.object?.id || ''}&programId=${id}`}>Открыть отчёты объекта</Link>}
    </section>}
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
