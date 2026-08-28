import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ReplaceProtocolModal from '../components/protocols/ReplaceProtocolModal';
import ProtocolList from '../components/protocols/ProtocolList';
import CreateProtocolWizardModalV2 from '../features/protocols/components/CreateProtocolWizardModalV2';
import { useSignProtocolMutation } from '../features/protocols/hooks/useSignProtocolMutation';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getActiveCompanies } from '../services/companyService';
import { getCompanyObjects } from '../services/companyService';
import { getActiveLaboratories, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { parseApiError } from '../services/apiHelpers';
import protocolService from '../services/protocolService';
import type { Protocol, ProtocolListQuery, ProtocolStatus, ProtocolTemplateId } from '../types/protocols';
import { hasPermission } from '../config/permissions';
import { protocolStatusConfig } from '../config/protocolStatus';
import { protocolQueryKeys, protocolScope } from '../features/protocols/hooks/queryKeys';
import { hasProtocolAction } from '../features/protocols/utils/protocolActions';
import { isProtocolVersionConflict, protocolVersionConflictMessage } from '../features/protocols/utils/protocolVersionConflict';
import { protocolAccessErrorMessage } from '../utils/protocolError';
import { openProtocolDownload } from '../features/protocols/utils/protocolFiles';

const sizes = [10, 20, 50, 100];
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const integer = (value: string | null, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback; };
const positiveInteger = (value: string | null) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; };
const protocolStatuses = new Set<ProtocolStatus>(['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED']);
const visibleStatusFilters: ProtocolStatus[] = ['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED'];
const protocolTemplates = new Set<ProtocolTemplateId>(['ambient_air', 'workplace_air', 'soil', 'water', 'microclimate', 'lighting', 'noise_vibration', 'uv_emf_laser']);
const ProtocolsPage = () => {
  const navigate = useNavigate(); const toast = useToast(); const { user } = useAuth(); const queryClient = useQueryClient();
  const scope = protocolScope(user?.id);
  const [params, setParams] = useSearchParams();
  const canCreate = hasPermission(user, 'create_protocols');
  const page = integer(params.get('page'), 0); const requestedSize = integer(params.get('size'), 20); const size = sizes.includes(requestedSize) ? requestedSize : 20;
  const companyId = params.get('companyId') || '';
  const [searchInput, setSearchInput] = useState(params.get('search') || '');
  const [busyId, setBusyId] = useState(''); const [signTargetId, setSignTargetId] = useState(''); const [archiveTarget, setArchiveTarget] = useState<Protocol | null>(null); const [deleteTarget, setDeleteTarget] = useState<Protocol | null>(null); const [replaceTarget, setReplaceTarget] = useState<Protocol | null>(null); const [createModalOpen, setCreateModalOpen] = useState(params.get('create') === '1' && canCreate);
  const signMutation = useSignProtocolMutation(undefined, {
    currentUserId: user?.id,
    onSigned: () => { setSignTargetId(''); toast.success('Протокол подписан'); },
    onError: async (message, error) => {
      setSignTargetId('');
      toast.error(message);
      if (isProtocolVersionConflict(error) && window.confirm(`${protocolVersionConflictMessage}\nПерезагрузить список?`)) await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) });
    },
  });
  const update = (changes: Record<string, string | number | boolean | undefined>) => { const next = new URLSearchParams(params); Object.entries(changes).forEach(([key, value]) => { if (value === undefined || value === '') next.delete(key); else next.set(key, String(value)); }); setParams(next, { replace: true }); };
  useEffect(() => {
    if (canCreate || params.get('create') !== '1') return;
    setCreateModalOpen(false);
    const next = new URLSearchParams(params);
    next.delete('create');
    setParams(next, { replace: true });
  }, [canCreate, params, setParams]);

  const companiesQuery = useQuery({ queryKey: ['companies', 'protocol-filter', user?.id], queryFn: () => getActiveCompanies() });
  const templatesQuery = useQuery({ queryKey: ['protocol-types', 'filter', user?.id], queryFn: () => protocolService.getProtocolTemplates() });
  const objectsQuery = useQuery({ queryKey: ['company-objects', 'protocol-filter', user?.id, companyId], queryFn: ({ signal }) => getCompanyObjects(companyId, false, signal), enabled: Boolean(companyId) });
  const laboratoryId = params.get('laboratoryId') || '';
  const laboratoriesQuery = useQuery({ queryKey: ['laboratories', 'protocol-filter', user?.id], queryFn: ({ signal }) => getActiveLaboratories(signal) });
  const executorsQuery = useQuery({ queryKey: ['laboratory-employees', 'protocol-filter', user?.id, laboratoryId], queryFn: ({ signal }) => getLaboratoryEmployees(laboratoryId, { signal }), enabled: Boolean(laboratoryId) });
  useEffect(() => {
    const timer = window.setTimeout(() => update({ search: searchInput.trim() || undefined, page: 0 }), 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const query = useMemo<ProtocolListQuery>(() => {
    const status = params.get('status');
    const templateId = params.get('templateId');
    return {
      page,
      size,
      search: params.get('search') || undefined,
      status: status && protocolStatuses.has(status as ProtocolStatus) ? status as ProtocolStatus : undefined,
      templateId: templateId && protocolTemplates.has(templateId as ProtocolTemplateId) ? templateId as ProtocolTemplateId : undefined,
      subtype: params.get('subtype') || undefined,
      companyId: positiveInteger(params.get('companyId')),
      objectId: positiveInteger(params.get('objectId')),
      laboratoryId: positiveInteger(params.get('laboratoryId')),
      executorId: positiveInteger(params.get('executorId')),
      compliance: (params.get('compliance') || undefined) as ProtocolListQuery['compliance'],
      dateFrom: params.get('dateFrom') || undefined,
      dateTo: params.get('dateTo') || undefined,
      includeArchived: params.get('includeArchived') === 'true' || undefined,
      published: params.get('published') === 'true' ? true : params.get('published') === 'false' ? false : undefined,
      sort: params.get('sort') || undefined,
    };
  }, [params, page, size]);
  const dateRangeValid = !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo;
  const protocolsQuery = useQuery({ queryKey: protocolQueryKeys.list(scope, query), queryFn: ({ signal }) => protocolService.getProtocolsPage(query, signal), enabled: Boolean(user?.id) && dateRangeValid, placeholderData: keepPreviousData });
  const data = protocolsQuery.data; const protocols = data?.items || [];
  useEffect(() => { if (data && data.totalPages > 0 && page >= data.totalPages) update({ page: data.totalPages - 1 }); }, [data?.totalPages, page]);

  const offerConflictReload = async (error: unknown) => {
    if (!isProtocolVersionConflict(error)) return false;
    toast.warning(protocolVersionConflictMessage);
    if (window.confirm(`${protocolVersionConflictMessage}\nПерезагрузить список?`)) await protocolsQuery.refetch();
    return true;
  };
  const protocolErrorMessage = (error: unknown, fallback: string) =>
    protocolAccessErrorMessage(error) || parseApiError(error, fallback).message;
  const download = async (protocol: Protocol, kind: 'pdf' | 'docx') => { if (busyId || !hasProtocolAction(protocol, kind === 'pdf' ? 'downloadPdf' : 'downloadDocx')) return; setBusyId(protocol.id); try { const file = await protocolService.downloadProtocolDocument(protocol.id, kind); openProtocolDownload(file, `${protocol.protocolNumber}.${kind}`); } catch (error) { const parsed = parseApiError(error, `Не удалось скачать ${kind.toUpperCase()}`); toast.error(parsed.status === 403 ? 'Нет доступа к протоколу' : parsed.message); } finally { setBusyId(''); } };
  const sign = (protocol: Protocol) => { if (busyId || signMutation.isPending) return; setSignTargetId(protocol.id); signMutation.sign({ protocol }); };
  const remove = async () => { if (!deleteTarget || busyId || !hasProtocolAction(deleteTarget, 'delete')) return; setBusyId(deleteTarget.id); try { await protocolService.deleteProtocol(deleteTarget.id, Number(deleteTarget.version)); setDeleteTarget(null); toast.success('Протокол удалён'); await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }); } catch (error) { if (!await offerConflictReload(error)) toast.error(protocolErrorMessage(error, 'Не удалось удалить протокол')); } finally { setBusyId(''); } };
  const archive = async () => { if (!archiveTarget || busyId || !hasProtocolAction(archiveTarget, 'archive')) return; setBusyId(archiveTarget.id); try { await protocolService.archiveProtocol(archiveTarget.id, { version: Number(archiveTarget.version) }); setArchiveTarget(null); toast.success('Протокол архивирован'); await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }); } catch (error) { if (!await offerConflictReload(error)) toast.error(protocolErrorMessage(error, 'Не удалось архивировать протокол')); } finally { setBusyId(''); } };
  const replace = async (reason: string) => { if (!replaceTarget || busyId || !hasProtocolAction(replaceTarget, 'createCorrection')) return; setBusyId(replaceTarget.id); try { const originalId = replaceTarget.id; const created = await protocolService.createCorrection(originalId, { version: Number(replaceTarget.version), reason: reason.trim() }); setReplaceTarget(null); await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }); if (hasProtocolAction(created, 'view')) navigate(`/staff/protocols/${created.id}`); else navigate('/staff/protocols'); } catch (error) { if (!await offerConflictReload(error)) toast.error(protocolErrorMessage(error, 'Не удалось создать исправленную версию')); } finally { setBusyId(''); } };
  const hasFilters = ['search', 'status', 'published', 'templateId', 'subtype', 'companyId', 'objectId', 'laboratoryId', 'executorId', 'compliance', 'dateFrom', 'dateTo', 'sort', 'includeArchived'].some((key) => params.has(key));
  const filterLabels: Record<string, string> = { search: 'Поиск', status: 'Статус', published: 'Публикация', templateId: 'Тип', subtype: 'Подтип', companyId: 'Компания', objectId: 'Объект', laboratoryId: 'Лаборатория', executorId: 'Исполнитель', compliance: 'Соответствие', dateFrom: 'Дата с', dateTo: 'Дата по', sort: 'Сортировка', includeArchived: 'С архивными' };
  const activeFilters = Object.keys(filterLabels).flatMap((key) => params.has(key) ? [{ key, value: params.get(key) || '' }] : []);
  const from = data && protocols.length ? data.page * data.size + 1 : 0; const to = data ? data.page * data.size + protocols.length : 0;

  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-eco-700">Испытательная лаборатория</p><h1 className="mt-1 text-3xl font-black text-slate-950">Протоколы</h1><p className="mt-2 text-sm text-slate-500">Заполните результаты, подпишите протокол и скачайте готовый документ.</p></div>{canCreate && <Button type="button" onClick={() => { setCreateModalOpen(true); update({ create: 1 }); }}><Plus className="h-4 w-4" /> Создать протокол</Button>}</header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input aria-label="Поиск протоколов" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className={inputClass} placeholder="Номер, компания, объект…" />
        <select aria-label="Статус" value={params.get('status') || ''} onChange={(event) => update({ status: event.target.value, page: 0 })} className={inputClass}><option value="">Все статусы</option>{visibleStatusFilters.map((status) => <option key={status} value={status}>{protocolStatusConfig[status].label}</option>)}</select>
        <select aria-label="Тип протокола" value={params.get('templateId') || ''} onChange={(event) => update({ templateId: event.target.value, subtype: undefined, page: 0 })} className={inputClass}><option value="">Все типы</option>{templatesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Подтип протокола" value={params.get('subtype') || ''} onChange={(event) => update({ subtype: event.target.value, page: 0 })} className={inputClass}><option value="">Все подтипы</option>{['MICROCLIMATE', 'LIGHTING', 'NOISE', 'VIBRATION'].map((value) => <option key={value} value={value}>{value}</option>)}</select>
        <select aria-label="Компания" value={companyId} onChange={(event) => update({ companyId: event.target.value, objectId: undefined, page: 0 })} className={inputClass}><option value="">Все компании</option>{companiesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Объект" value={params.get('objectId') || ''} disabled={!companyId || objectsQuery.isLoading} onChange={(event) => update({ objectId: event.target.value, page: 0 })} className={inputClass}><option value="">Все объекты</option>{objectsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Лаборатория" value={laboratoryId} onChange={(event) => update({ laboratoryId: event.target.value, executorId: undefined, page: 0 })} className={inputClass}><option value="">Все лаборатории</option>{laboratoriesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Исполнитель" value={params.get('executorId') || ''} disabled={!laboratoryId || executorsQuery.isLoading} onChange={(event) => update({ executorId: event.target.value, page: 0 })} className={inputClass}><option value="">Все исполнители</option>{executorsQuery.data?.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>
        <select aria-label="Соответствие" value={params.get('compliance') || ''} onChange={(event) => update({ compliance: event.target.value, page: 0 })} className={inputClass}><option value="">Любое соответствие</option><option value="COMPLIANT">Соответствует</option><option value="NON_COMPLIANT">Не соответствует</option><option value="NOT_EVALUATED">Не оценено</option></select>
        <select aria-label="Публикация" value={params.get('published') || ''} onChange={(event) => update({ published: event.target.value, page: 0 })} className={inputClass}><option value="">Любая публикация</option><option value="true">Опубликованные</option><option value="false">Не опубликованные</option></select>
        <input aria-label="Дата с" type="date" value={params.get('dateFrom') || ''} max={params.get('dateTo') || undefined} onChange={(event) => update({ dateFrom: event.target.value, page: 0 })} className={inputClass} />
        <input aria-label="Дата по" type="date" value={params.get('dateTo') || ''} min={params.get('dateFrom') || undefined} onChange={(event) => update({ dateTo: event.target.value, page: 0 })} className={inputClass} />
        <select aria-label="Сортировка" value={params.get('sort') || ''} onChange={(event) => update({ sort: event.target.value, page: 0 })} className={inputClass}><option value="">Сначала обновлённые</option><option value="protocolDate,desc">Дата: новые</option><option value="protocolDate,asc">Дата: старые</option><option value="protocolNumber,asc">Номер: по возрастанию</option><option value="updatedAt,desc">Недавно изменённые</option></select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold"><input type="checkbox" checked={params.get('includeArchived') === 'true'} onChange={(event) => update({ includeArchived: event.target.checked || undefined, page: 0 })} /> Включая архивные</label>
      </div>
      {!dateRangeValid && <p role="alert" className="mt-3 text-sm font-bold text-rose-700">Дата «с» не может быть позже даты «по».</p>}
      {activeFilters.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2">{activeFilters.map(({ key, value }) => <button key={key} type="button" onClick={() => { if (key === 'search') setSearchInput(''); update({ [key]: undefined, ...(key === 'companyId' ? { objectId: undefined } : {}), ...(key === 'laboratoryId' ? { executorId: undefined } : {}), page: 0 }); }} className="rounded-full bg-eco-50 px-3 py-1.5 text-xs font-bold text-eco-900">{filterLabels[key]}: {value} ×</button>)}<Button type="button" variant="secondary" onClick={() => { setSearchInput(''); const next = new URLSearchParams(); if (size !== 20) next.set('size', String(size)); setParams(next, { replace: true }); }}>Сбросить всё</Button></div>}
    </section>
    {protocolsQuery.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-900">{protocolErrorMessage(protocolsQuery.error, 'Не удалось загрузить протоколы')}</p><Button type="button" variant="secondary" className="mt-3" onClick={() => protocolsQuery.refetch()}>Повторить</Button></div>}
    {dateRangeValid && !protocolsQuery.isError && !protocolsQuery.isLoading && !protocols.length ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-900">{hasFilters ? 'По выбранным фильтрам протоколы не найдены' : 'Протоколы пока не созданы'}</h2><p className="mt-2 text-sm text-slate-500">{hasFilters ? 'Измените условия поиска или сбросьте фильтры.' : 'Создайте первый протокол, чтобы начать работу.'}</p>{hasFilters && <Button type="button" variant="secondary" className="mt-4" onClick={() => { setSearchInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Сбросить всё</Button>}</section> : dateRangeValid && !protocolsQuery.isError && <ProtocolList protocols={protocols} loading={protocolsQuery.isLoading} busyId={busyId || signTargetId} onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)} onHistory={(protocol) => navigate(`/staff/protocols/${protocol.id}?tab=history`)} onSign={sign} onEdit={(protocol) => navigate(`/staff/protocols/${protocol.id}/edit`)} onDelete={setDeleteTarget} onArchive={setArchiveTarget} onReplace={setReplaceTarget} onDownload={download} />}
    {data && protocols.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span>{data.totalElementsExact === false ? `Показано ${protocols.length}; общее количество недоступно` : `Показано ${from}–${to} из ${data.totalElements}`}</span><select aria-label="Размер страницы" value={size} onChange={(event) => update({ size: Number(event.target.value), page: 0 })} className="rounded-lg border border-slate-200 px-2 py-1">{sizes.map((item) => <option key={item}>{item}</option>)}</select></div><div className="flex items-center gap-2"><Button type="button" variant="secondary" disabled={data.first || protocolsQuery.isFetching} onClick={() => update({ page: Math.max(0, page - 1) })}>Назад</Button><span>Страница {data.page + 1}{data.totalElementsExact !== false && ` из ${Math.max(1, data.totalPages)}`}</span><Button type="button" variant="secondary" disabled={data.last || protocolsQuery.isFetching} onClick={() => update({ page: Math.min(page + 1, Math.max(0, data.totalPages - 1)) })}>Далее</Button></div></div>}
    <Modal open={Boolean(archiveTarget)} loading={busyId === archiveTarget?.id} onClose={() => !busyId && setArchiveTarget(null)} title={`Архивировать протокол «${archiveTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={archive}>{busyId ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Протокол останется доступен только для просмотра и скачивания существующих документов.</p></Modal>
    <Modal open={Boolean(deleteTarget)} loading={busyId === deleteTarget?.id} onClose={() => !busyId && setDeleteTarget(null)} title={`Удалить протокол «${deleteTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={remove}>{busyId ? 'Удаление…' : 'Удалить'}</Button></>}><p className="text-sm text-slate-600">Неподписанный протокол будет удалён из рабочего списка. Подписанные документы удалить нельзя.</p></Modal>
    <ReplaceProtocolModal open={Boolean(replaceTarget)} loading={busyId === replaceTarget?.id} onClose={() => !busyId && setReplaceTarget(null)} onConfirm={replace} />
    <CreateProtocolWizardModalV2 open={createModalOpen && canCreate} orderId={params.get('orderId') || ''} orderServiceItemId={params.get('orderServiceItemId') || ''} pekPrefill={{ companyId: params.get('companyId') || '', objectId: params.get('objectId') || '', pekProgramId: params.get('pekProgramId') || '', pekControlItemId: params.get('pekControlItemId') || '', pekControlEventId: params.get('pekControlEventId') || '', pekReportId: params.get('pekReportId') || '', monitoringPointId: params.get('monitoringPointId') || '', programIndicatorId: params.get('programIndicatorId') || '', emissionSourceId: params.get('emissionSourceId') || '', waterOutletId: params.get('waterOutletId') || '', measurementDate: params.get('measurementDate') || undefined, measurementPlace: params.get('measurementPlace') || undefined }} onClose={() => { setCreateModalOpen(false); update({ create: undefined }); }} onCreated={(protocol) => { setCreateModalOpen(false); void queryClient.invalidateQueries({ queryKey: protocolQueryKeys.all(scope) }); if (protocol.orderId) void queryClient.invalidateQueries({ queryKey: ['order', String(protocol.orderId)] }); const navigation = new URLSearchParams(); const pekReportId = params.get('pekReportId'); if (pekReportId) { navigation.set('pekReportId', pekReportId); navigation.set('returnTo', `/staff/pek/reports/${pekReportId}?tab=sources`); } navigate(hasProtocolAction(protocol, 'view') ? `/staff/protocols/${protocol.id}${navigation.size ? `?${navigation}` : ''}` : '/staff/protocols'); }} />
  </div>;
};

export default ProtocolsPage;
