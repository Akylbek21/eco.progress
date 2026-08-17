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
import { parseApiError } from '../services/apiHelpers';
import protocolService from '../services/protocolService';
import type { Protocol, ProtocolListQuery, ProtocolStatus, ProtocolTemplateId } from '../types/protocols';
import { hasPermission } from '../config/permissions';
import { protocolStatusConfig } from '../config/protocolStatus';
import { protocolQueryKeys, protocolScope } from '../features/protocols/hooks/queryKeys';

const sizes = [10, 20, 50, 100];
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const integer = (value: string | null, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback; };
const positiveInteger = (value: string | null) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; };
const protocolStatuses = new Set<ProtocolStatus>(['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED']);
const visibleStatusFilters: ProtocolStatus[] = ['DRAFT', 'CALCULATED', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED'];
const protocolTemplates = new Set<ProtocolTemplateId>(['ambient_air', 'workplace_air', 'soil', 'water', 'microclimate', 'lighting', 'noise_vibration', 'uv_emf_laser']);
const saveBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };

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
    onError: (message) => { setSignTargetId(''); toast.error(message); },
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
      sort: params.get('sort') || undefined,
    };
  }, [params, page, size]);
  const protocolsQuery = useQuery({ queryKey: protocolQueryKeys.list(scope, query), queryFn: ({ signal }) => protocolService.getProtocolsPage(query, signal), enabled: Boolean(user?.id), placeholderData: keepPreviousData });
  const data = protocolsQuery.data; const protocols = data?.items || [];
  useEffect(() => { if (data && data.totalPages > 0 && page >= data.totalPages) update({ page: data.totalPages - 1 }); }, [data?.totalPages, page]);

  const download = async (protocol: Protocol, kind: 'pdf' | 'docx') => { if (busyId) return; setBusyId(protocol.id); try { const file = kind === 'pdf' ? await protocolService.downloadPdf(protocol.id) : await protocolService.downloadDocx(protocol.id); saveBlob(file.blob, file.fileName || `${protocol.protocolNumber}.${kind}`); } catch (error) { const parsed = parseApiError(error, `Не удалось скачать ${kind.toUpperCase()}`); toast.error(parsed.message); } finally { setBusyId(''); } };
  const sign = (protocol: Protocol) => { if (busyId || signMutation.isPending) return; setSignTargetId(protocol.id); signMutation.sign({ protocol }); };
  const remove = async () => { if (!deleteTarget || busyId) return; setBusyId(deleteTarget.id); try { await protocolService.deleteProtocol(deleteTarget.id, Number(deleteTarget.version)); setDeleteTarget(null); toast.success('Протокол удалён'); await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }); } catch (error) { toast.error(parseApiError(error, 'Не удалось удалить протокол').message); } finally { setBusyId(''); } };
  const archive = async () => { if (!archiveTarget || busyId) return; setBusyId(archiveTarget.id); try { await protocolService.archiveProtocol(archiveTarget.id, { version: Number(archiveTarget.version) }); await protocolService.getProtocol(archiveTarget.id); setArchiveTarget(null); toast.success('Протокол архивирован'); await queryClient.invalidateQueries({ queryKey: protocolQueryKeys.lists(scope) }); } catch (error) { toast.error(parseApiError(error, 'Не удалось архивировать протокол').message); } finally { setBusyId(''); } };
  const replace = async (reason: string) => { if (!replaceTarget || busyId) return; setBusyId(replaceTarget.id); try { const originalId = replaceTarget.id; const created = await protocolService.createCorrection(originalId, { version: Number(replaceTarget.version), reason: reason.trim() }); await protocolService.getProtocol(originalId); setReplaceTarget(null); navigate(`/staff/protocols/${created.id}`); } catch (error) { toast.error(parseApiError(error, 'Не удалось создать исправленную версию').message); } finally { setBusyId(''); } };
  const hasFilters = ['search', 'status', 'templateId', 'subtype', 'companyId', 'objectId', 'laboratoryId', 'executorId', 'compliance', 'dateFrom', 'dateTo', 'sort', 'includeArchived'].some((key) => params.has(key));
  const from = data && protocols.length ? data.page * data.size + 1 : 0; const to = data ? data.page * data.size + protocols.length : 0;

  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-eco-700">Испытательная лаборатория</p><h1 className="mt-1 text-3xl font-black text-slate-950">Протоколы</h1><p className="mt-2 text-sm text-slate-500">Заполните результаты, подпишите протокол и скачайте готовый документ.</p></div>{canCreate && <Button type="button" onClick={() => { setCreateModalOpen(true); update({ create: 1 }); }}><Plus className="h-4 w-4" /> Создать протокол</Button>}</header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <input aria-label="Поиск протоколов" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className={inputClass} placeholder="Номер, компания, объект…" />
        <select aria-label="Статус" value={params.get('status') || ''} onChange={(event) => update({ status: event.target.value, page: 0 })} className={inputClass}><option value="">Все статусы</option>{visibleStatusFilters.map((status) => <option key={status} value={status}>{protocolStatusConfig[status].label}</option>)}</select>
        <select aria-label="Компания" value={companyId} onChange={(event) => update({ companyId: event.target.value, objectId: undefined, page: 0 })} className={inputClass}><option value="">Все компании</option>{companiesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Тип протокола" value={params.get('templateId') || ''} onChange={(event) => update({ templateId: event.target.value, page: 0 })} className={inputClass}><option value="">Все типы</option>{templatesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input aria-label="Дата с" type="date" value={params.get('dateFrom') || ''} onChange={(event) => update({ dateFrom: event.target.value, page: 0 })} className={inputClass} />
        <input aria-label="Дата по" type="date" value={params.get('dateTo') || ''} onChange={(event) => update({ dateTo: event.target.value, page: 0 })} className={inputClass} />
      </div>
      {hasFilters && <div className="mt-3 flex justify-end"><Button type="button" variant="secondary" onClick={() => { setSearchInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Сбросить фильтры</Button></div>}
    </section>
    {protocolsQuery.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-900">{parseApiError(protocolsQuery.error, 'Не удалось загрузить протоколы').message}</p><Button type="button" variant="secondary" className="mt-3" onClick={() => protocolsQuery.refetch()}>Повторить</Button></div>}
    {!protocolsQuery.isError && !protocolsQuery.isLoading && !protocols.length ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-900">{hasFilters ? 'У выбранной компании протоколы не найдены' : 'Протоколы пока не созданы'}</h2></section> : !protocolsQuery.isError && <ProtocolList protocols={protocols} loading={protocolsQuery.isLoading} busyId={busyId || signTargetId} onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)} onHistory={(protocol) => navigate(`/staff/protocols/${protocol.id}?tab=history`)} onSign={sign} onEdit={(protocol) => navigate(`/staff/protocols/${protocol.id}/edit`)} onDelete={setDeleteTarget} onArchive={setArchiveTarget} onReplace={setReplaceTarget} onDownload={download} />}
    {data && protocols.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span>{data.totalElementsExact === false ? `Показано ${protocols.length}; общее количество недоступно` : `Показано ${from}–${to} из ${data.totalElements}`}</span><select aria-label="Размер страницы" value={size} onChange={(event) => update({ size: Number(event.target.value), page: 0 })} className="rounded-lg border border-slate-200 px-2 py-1">{sizes.map((item) => <option key={item}>{item}</option>)}</select></div><div className="flex items-center gap-2"><Button type="button" variant="secondary" disabled={data.first || protocolsQuery.isFetching} onClick={() => update({ page: Math.max(0, page - 1) })}>Назад</Button><span>Страница {data.page + 1}{data.totalElementsExact !== false && ` из ${Math.max(1, data.totalPages)}`}</span><Button type="button" variant="secondary" disabled={data.last || protocolsQuery.isFetching} onClick={() => update({ page: Math.min(page + 1, Math.max(0, data.totalPages - 1)) })}>Далее</Button></div></div>}
    <Modal open={Boolean(archiveTarget)} loading={busyId === archiveTarget?.id} onClose={() => !busyId && setArchiveTarget(null)} title={`Архивировать протокол «${archiveTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={archive}>{busyId ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Протокол останется доступен только для просмотра и скачивания существующих документов.</p></Modal>
    <Modal open={Boolean(deleteTarget)} loading={busyId === deleteTarget?.id} onClose={() => !busyId && setDeleteTarget(null)} title={`Удалить протокол «${deleteTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setDeleteTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={remove}>{busyId ? 'Удаление…' : 'Удалить'}</Button></>}><p className="text-sm text-slate-600">Неподписанный протокол будет удалён из рабочего списка. Подписанные документы удалить нельзя.</p></Modal>
    <ReplaceProtocolModal open={Boolean(replaceTarget)} loading={busyId === replaceTarget?.id} onClose={() => !busyId && setReplaceTarget(null)} onConfirm={replace} />
    <CreateProtocolWizardModalV2 open={createModalOpen && canCreate} orderId={params.get('orderId') || ''} orderServiceItemId={params.get('orderServiceItemId') || ''} pekPrefill={{ companyId: params.get('companyId') || '', objectId: params.get('objectId') || '', pekProgramId: params.get('pekProgramId') || '', pekControlItemId: params.get('pekControlItemId') || '', pekControlEventId: params.get('pekControlEventId') || '', pekReportId: params.get('pekReportId') || '', monitoringPointId: params.get('monitoringPointId') || '', emissionSourceId: params.get('emissionSourceId') || '', waterOutletId: params.get('waterOutletId') || '', measurementDate: params.get('measurementDate') || undefined, measurementPlace: params.get('measurementPlace') || undefined }} onClose={() => { setCreateModalOpen(false); update({ create: undefined }); }} onCreated={(protocol) => { setCreateModalOpen(false); void queryClient.invalidateQueries({ queryKey: protocolQueryKeys.all(scope) }); if (protocol.orderId) void queryClient.invalidateQueries({ queryKey: ['order', String(protocol.orderId)] }); const navigation = new URLSearchParams(); const pekReportId = params.get('pekReportId'); if (pekReportId) { navigation.set('pekReportId', pekReportId); navigation.set('returnTo', `/staff/pek/reports/${pekReportId}`); } navigate(`/staff/protocols/${protocol.id}${navigation.size ? `?${navigation}` : ''}`); }} />
  </div>;
};

export default ProtocolsPage;
