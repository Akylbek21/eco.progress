import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import ActionMenu from '../../../components/ui/ActionMenu';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../contexts/AuthContext';
import type { PekAvailableAction, PekControlItem, PekIndicator, PekProgram } from '../api/pekContracts';
import { commitPekProgramMutation } from '../api/pekProgramCache';
import { pekKeys } from '../api/pekQueryKeys';
import { pekApi } from '../api/pekService';
import { PekLoading, PekPageHeader, PekPrimaryAction, PekReadiness, PekStatusBadge } from '../components/common/PekUi';
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
import { parsePekProgramTab, pekProgramTabs, targetForReadinessIssue, type PekProgramTabKey } from './pekProgramNavigation';

const sectionTabs: Record<PekWorkspaceSection, PekProgramTabKey> = { overview: 'general', controls: 'monitoring', organization: 'organization', documents: 'documents' };

const PekProgramDetailsPage = () => {
  const id = Number(useParams().programId);
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = Number(searchParams.get('companyId')) || undefined;
  const programDetailKey = pekKeys.programDetail(companyId, id);
  const tab = parsePekProgramTab(searchParams.get('tab'));
  const structuredSection = searchParams.get('section') || undefined;
  const setTab = (value: PekProgramTabKey, section?: string) => setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('tab', value); section ? next.set('section', section) : next.delete('section'); return next; });
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
      if (item.code === 'RETEMPLATE') return pekApi.retemplateProgram(id, version);
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
  const workflowActions: PekAvailableAction[] = [];
  if (item.availableActions.submit) workflowActions.push({ code: 'SUBMIT_REVIEW', label: 'Отправить на согласование', enabled: true });
  if (item.availableActions.returnForRevision) workflowActions.push({ code: 'RETURN', label: 'Вернуть на доработку', enabled: true, requiresComment: true });
  if (item.availableActions.approve) workflowActions.push({ code: 'APPROVE', label: 'Согласовать', enabled: true });
  if (item.availableActions.activate) workflowActions.push({ code: 'ACTIVATE', label: 'Активировать', enabled: true });
  if (item.availableActions.archive) workflowActions.push({ code: 'ARCHIVE', label: 'Архивировать', enabled: true });
  if (item.availableActions.clone) workflowActions.push({ code: 'CLONE', label: 'Клонировать', enabled: true });
  if (item.availableActions.retemplate) workflowActions.push({ code: 'RETEMPLATE', label: 'Обновить шаблон', enabled: true, confirmationRequired: true });
  const primaryWorkflowAction = workflowActions.find((candidate) => ['SUBMIT_REVIEW', 'APPROVE', 'ACTIVATE'].includes(candidate.code));
  const secondaryWorkflowActions = workflowActions.filter((candidate) => candidate !== primaryWorkflowAction);

  return <div className="space-y-4">
    <PekPageHeader
      title={`Программа ПЭК № ${item.number}`}
      description={`${item.company?.name || 'Компания не указана'} · ${item.object?.name || 'Объект не указан'} · ${item.validFrom} — ${item.validUntil}`}
      actions={<>
        <PekReadiness value={readiness.data?.progressPercent} />
        <PekStatusBadge status={item.status} />
        {item.availableActions.edit && (
          <button type="button" onClick={() => navigate(`/staff/pek/programs/${id}/edit?companyId=${companyId || item.company?.id || ''}`)} className="border border-slate-300 px-3 py-1.5 text-sm font-bold">Сохранить</button>
        )}
        {primaryWorkflowAction && <PekPrimaryAction action={primaryWorkflowAction} pending={workflow.isPending} onClick={(selected) => setAction(selected)} />}
        {secondaryWorkflowActions.length > 0 && <ActionMenu label="Дополнительные действия" widthClass="w-56"><div className="py-1">{secondaryWorkflowActions.map((candidate) => <button key={candidate.code} type="button" className="block w-full px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50" onClick={() => candidate.code === 'CLONE' ? setCloneAction(candidate) : setAction(candidate)}>{candidate.label}</button>)}</div></ActionMenu>}
      </>}
    />
    {workflowErrors.length > 0 && <section role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900"><strong>Программа не готова к выполнению действия:</strong><ul className="mt-2 list-disc pl-5">{workflowErrors.map((message) => <li key={message}>{message}</li>)}</ul></section>}
    <section className="grid gap-x-6 gap-y-2 border-b border-slate-200 bg-white px-3 py-3 sm:grid-cols-2 lg:grid-cols-4">
      <Info label="Версия" value={item.version} />
      <Info label="Период" value={`${item.validFrom} — ${item.validUntil}`} />
      <Info label="Версия формы" value={item.templateVersion || '—'} />
      <Info label="Версия НПА" value={item.regulationVersion || '—'} />
      <Info label="Ревизия данных" value={item.contentRevision} />
      <Info label="Ответственный" value={item.responsible?.name || '—'} />
      <Info label="Режим" value={item.readOnly ? 'Только чтение' : 'Редактирование разрешено'} />
    </section>
    <nav className="pek-section-nav sticky top-0 z-20 flex max-w-full gap-0 overflow-x-auto border-y border-slate-300 bg-white" aria-label="Разделы программы ПЭК">
      {pekProgramTabs.map(({ key, label }) => <button key={key} type="button" onClick={() => setTab(key)} className={`shrink-0 whitespace-nowrap px-4 py-3 font-bold ${tab === key ? 'border-b-2 border-eco-600 text-eco-800' : 'text-slate-500'}`}>{label}</button>)}
    </nav>
    {(tab === 'general' || tab === 'readiness') && <div className="space-y-5">
      {readiness.isPending && <p role="status">Проверка готовности программы…</p>}
      {readiness.isError && <PekQueryError error={readiness.error} resource="Готовность программы" retry={() => void readiness.refetch()} />}
      {readiness.data && <PekReadinessPanel readiness={{ ...readiness.data, completionPercent: readiness.data.progressPercent }} onIssueClick={issue => {
        const target = targetForReadinessIssue(issue);
        if (target.editGeneral) { navigate(`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=0`); return; }
        setTab(target.tab, target.structuredSection);
      }} />}
      {counts.isPending && <p role="status">Загрузка состава реестров…</p>}
      {counts.isError && <PekQueryError error={counts.error} resource="Состав реестров" retry={() => void counts.refetch()} />}
      {counts.data && <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Состав программы</h3><ul className="mt-3 space-y-2">{counts.data.map(([label, count], index) => <li key={label}><button type="button" className="text-left underline" onClick={() => setTab(index === 0 ? 'emissions' : index === 1 ? 'discharges' : index === 2 ? 'waste' : 'monitoring')}>{count ? '✓' : '—'} {label} — {count || 'отсутствуют'}</button></li>)}</ul><p className="mt-3 text-sm text-slate-500">Обязательность разделов и блокирующие проблемы определяются проверкой готовности выше.</p></section>}
      <section className="rounded-2xl border bg-white p-5"><h3 className="font-bold">Заполненные сведения</h3><ul className="mt-3 space-y-2"><li>{item.responsible ? '✓ Ответственный назначен' : '✕ Ответственный не назначен'}</li><li>Позиции контроля — {item.controlItems?.length || 0}</li><li>Показатели — {item.indicators?.length || 0}</li><li>Направления мониторинга — {item.monitoring?.items.length || 0}</li></ul></section>
      <PekProgramStructure program={item} readinessPercent={readiness.data?.progressPercent} onOpenSection={(section) => setTab(sectionTabs[section])} />
      <section className="rounded-2xl border bg-white p-5"><h2 className="mb-4 text-lg font-black">Общие сведения</h2><div className="grid gap-3 md:grid-cols-2"><Info label="Компания" value={item.company?.name || '—'} /><Info label="Объект" value={item.object?.name || '—'} /><Info label="Описание" value={item.description || '—'} /><Info label="Последнее изменение" value={item.updatedAt || '—'} /><Info label="Проектная мощность" value={[item.designCapacity, item.designCapacityUnit].filter(Boolean).join(' ') || '—'} /></div></section>
    </div>}
    {tab !== 'general' && tab !== 'readiness' && <section className="border border-slate-300 bg-white p-4">
      {['monitoring', 'gas-monitoring', 'atmospheric-air', 'water', 'soil'].includes(tab) && <div className="space-y-6"><PekProgramMonitoring program={item} /><div><h3 className="mb-3 font-black">Позиции контроля</h3><ProgramControlTable program={item} canEdit={item.availableActions.edit === true} /></div></div>}
      {tab === 'calculated-control' && <><DataRows rows={item.indicators || []} />{item.availableActions.edit && <Link className="text-eco-700 underline" to={`/staff/pek/programs/${id}/edit?companyId=${item.company?.id || ''}&step=6`}>Редактировать показатели</Link>}</>}
      {tab === 'waste' && <PekInventoryEditor kind="waste-items" parentId={id} programId={id} companyId={item.company?.id} canEdit={item.availableActions.edit === true && !item.readOnly} />}
      {tab === 'emissions' && <PekInventoryEditor kind="emission-sources" parentId={id} programId={id} companyId={item.company?.id} canEdit={item.availableActions.edit === true && !item.readOnly} />}
      {tab === 'discharges' && <PekInventoryEditor kind="discharge-sources" parentId={id} programId={id} companyId={item.company?.id} canEdit={item.availableActions.edit === true && !item.readOnly} />}
      {(tab === 'inspections' || tab === 'organization') && <PekProgramStructuredSections program={item} section={(structuredSection || (tab === 'inspections' ? 'internal-inspections' : undefined)) as Parameters<typeof PekProgramStructuredSections>[0]['section']} />}
      {tab === 'documents' && <div className="space-y-6"><div><h2 className="font-black">Разрешительные документы</h2><div className="mt-3 grid gap-3 md:grid-cols-2">{permits.data?.filter((permit) => item.permitIds?.includes(permit.id)).map((permit) => <article key={permit.id} className="border p-4"><strong>{permit.type} № {permit.number}</strong><p className="mt-1 text-sm">Дата выдачи: {permit.issuedAt || '—'}</p><p className="text-sm">Срок действия: {permit.validFrom} — {permit.validTo}</p><p className="text-sm">Статус: {permit.status}</p></article>)}{!permits.isLoading && !permits.data?.some((permit) => item.permitIds?.includes(permit.id)) && <p className="text-sm text-slate-500">Разрешения не выбраны.</p>}</div></div><PekProgramDocuments companyId={companyId} programId={id} version={item.version} documents={item.documents || []} canUpload={item.availableActions.uploadDocument} /></div>}
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
  return <div key={String(row.id || row.clientId || index)} className="border-b border-slate-200 px-2 py-2"><strong>{String(row.name || row.indicatorName || `Запись ${index + 1}`)}</strong></div>;
})}{!rows.length && <p className="text-slate-500">Данные не добавлены</p>}</div>;

const ProgramControlTable = ({ program, canEdit }: { program: PekProgram; canEdit: boolean }) => {
  const rows: { control: PekControlItem; indicator: PekIndicator | null }[] = [];
  (program.controlItems || []).forEach(control => {
    const indicators = (program.indicators || []).filter(indicator => indicator.controlItemId === control.id || indicator.controlItemClientId === control.clientId);
    if (indicators.length) indicators.forEach(indicator => rows.push({ control, indicator }));
    else rows.push({ control, indicator: null });
  });
  if (!rows.length) return <p className="text-slate-500">Данные не добавлены</p>;
  return <div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[950px] text-sm"><thead className="sticky top-0 z-10 bg-white"><tr className="border-b text-left"><th className="p-2">Источник</th><th>Точка</th><th>Показатель</th><th>Периодичность</th><th>Метод</th><th>Статус</th><th>Действия</th></tr></thead><tbody>{rows.map(({ control, indicator }, index) => <tr key={`${String(control.id || control.clientId)}-${String(indicator?.id || indicator?.clientId || index)}`} className="border-b"><td className="p-2">{control.name}</td><td>{control.monitoringPointId ? `№ ${control.monitoringPointId}` : '—'}</td><td>{indicator?.indicatorName || '—'}</td><td>{[control.frequencyType, control.frequencyValue].filter(Boolean).join(' · ') || '—'}</td><td>{control.measurementMethod || control.samplingMethod || '—'}</td><td>{control.active ? 'Активна' : 'Неактивна'}</td><td>{canEdit ? <Link className="font-bold text-eco-700 underline" to={`/staff/pek/programs/${program.id}/edit?companyId=${program.company?.id || ''}&step=5`}>Изменить</Link> : '—'}</td></tr>)}</tbody></table></div>;
};

export default PekProgramDetailsPage;
