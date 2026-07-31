import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ReplaceProtocolModal from '../components/protocols/ReplaceProtocolModal';
import ProtocolList from '../components/protocols/ProtocolList';
import CreateProtocolWizardModal from '../features/protocols/components/CreateProtocolWizardModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getActiveCompanies } from '../services/companyService';
import { getCompanyObjects } from '../services/companyService';
import { getActiveLaboratories, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { parseApiError } from '../services/apiHelpers';
import protocolService from '../services/protocolService';
import type { Protocol, ProtocolListQuery, ProtocolStatus, ProtocolTemplateId } from '../types/protocols';
import { hasPermission } from '../config/permissions';

const sizes = [10, 20, 50, 100];
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const integer = (value: string | null, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback; };
const positiveInteger = (value: string | null) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined; };
const protocolStatuses = new Set<ProtocolStatus>(['DRAFT', 'CALCULATED', 'READY', 'READY_FOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED', 'SIGNED', 'REPLACED', 'CANCELLED', 'ARCHIVED']);
const protocolTemplates = new Set<ProtocolTemplateId>(['ambient_air', 'workplace_air', 'soil', 'water', 'microclimate', 'lighting', 'noise_vibration', 'uv_emf_laser']);
const saveBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };

const ProtocolsPage = () => {
  const navigate = useNavigate(); const toast = useToast(); const { user } = useAuth(); const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = integer(params.get('page'), 0); const requestedSize = integer(params.get('size'), 20); const size = sizes.includes(requestedSize) ? requestedSize : 20;
  const companyId = params.get('companyId') || '';
  const laboratoryId = params.get('laboratoryId') || '';
  const [searchInput, setSearchInput] = useState(params.get('search') || '');
  const [busyId, setBusyId] = useState(''); const [archiveTarget, setArchiveTarget] = useState<Protocol | null>(null); const [replaceTarget, setReplaceTarget] = useState<Protocol | null>(null); const [createModalOpen, setCreateModalOpen] = useState(params.get('create') === '1');
  const update = (changes: Record<string, string | number | boolean | undefined>) => { const next = new URLSearchParams(params); Object.entries(changes).forEach(([key, value]) => { if (value === undefined || value === '') next.delete(key); else next.set(key, String(value)); }); setParams(next, { replace: true }); };

  const companiesQuery = useQuery({ queryKey: ['companies', 'protocol-filter'], queryFn: () => getActiveCompanies() });
  const objectsQuery = useQuery({ queryKey: ['company-objects', companyId], queryFn: ({ signal }) => getCompanyObjects(companyId, false, signal), enabled: Boolean(companyId) });
  const laboratoriesQuery = useQuery({ queryKey: ['laboratories', 'protocol-filter'], queryFn: ({ signal }) => getActiveLaboratories(signal) });
  const executorsQuery = useQuery({ queryKey: ['laboratory-employees', laboratoryId, 'protocol-filter'], queryFn: ({ signal }) => getLaboratoryEmployees(laboratoryId, { signal }), enabled: Boolean(laboratoryId) });
  const templatesQuery = useQuery({ queryKey: ['protocol-types', 'filter'], queryFn: () => protocolService.getProtocolTemplates() });
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
  const protocolsQuery = useQuery({ queryKey: ['protocols', query], queryFn: ({ signal }) => protocolService.getProtocolsPage(query, signal), placeholderData: keepPreviousData });
  const data = protocolsQuery.data; const protocols = data?.items || [];
  useEffect(() => { if (data && data.totalPages > 0 && page >= data.totalPages) update({ page: data.totalPages - 1 }); }, [data?.totalPages, page]);

  const download = async (protocol: Protocol, kind: 'pdf' | 'docx') => { if (busyId) return; setBusyId(protocol.id); try { const file = kind === 'pdf' ? await protocolService.downloadPdf(protocol.id) : await protocolService.downloadDocx(protocol.id); saveBlob(file.blob, file.fileName || `${protocol.protocolNumber}.${kind}`); } catch (error) { const parsed = parseApiError(error, `Не удалось скачать ${kind.toUpperCase()}`); toast.error(parsed.message); } finally { setBusyId(''); } };
  const archive = async () => { if (!archiveTarget || busyId) return; setBusyId(archiveTarget.id); try { await protocolService.archiveProtocol(archiveTarget.id, { version: Number(archiveTarget.version) }); setArchiveTarget(null); toast.success('Протокол архивирован'); await queryClient.invalidateQueries({ queryKey: ['protocols'] }); } catch (error) { toast.error(parseApiError(error, 'Не удалось архивировать протокол').message); } finally { setBusyId(''); } };
  const replace = async (reason: string) => { if (!replaceTarget || busyId) return; setBusyId(replaceTarget.id); try { const created = await protocolService.createCorrection(replaceTarget.id, { version: Number(replaceTarget.version), reason: reason.trim() }); setReplaceTarget(null); navigate(`/staff/protocols/${created.id}`); } catch (error) { toast.error(parseApiError(error, 'Не удалось создать исправленную версию').message); } finally { setBusyId(''); } };
  const hasFilters = ['search', 'status', 'templateId', 'subtype', 'companyId', 'objectId', 'laboratoryId', 'executorId', 'compliance', 'dateFrom', 'dateTo', 'sort', 'includeArchived'].some((key) => params.has(key));
  const from = data && protocols.length ? data.page * data.size + 1 : 0; const to = data ? data.page * data.size + protocols.length : 0;

  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-eco-700">Испытательная лаборатория</p><h1 className="mt-1 text-3xl font-black text-slate-950">Протоколы</h1><p className="mt-2 text-sm text-slate-500">Создание, расчёт, утверждение, подписание и документы.</p></div>{hasPermission(user, 'create_protocols') && <Button type="button" onClick={() => { setCreateModalOpen(true); update({ create: 1 }); }}><Plus className="h-4 w-4" /> Создать протокол</Button>}</header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input aria-label="Поиск протоколов" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className={inputClass} placeholder="Номер, компания, объект…" />
        <select aria-label="Статус" value={params.get('status') || ''} onChange={(event) => update({ status: event.target.value, page: 0 })} className={inputClass}><option value="">Все статусы</option>{[...protocolStatuses].filter((status) => status !== 'UNKNOWN').map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <select aria-label="Тип протокола" value={params.get('templateId') || ''} onChange={(event) => update({ templateId: event.target.value, page: 0 })} className={inputClass}><option value="">Все типы</option>{templatesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <input aria-label="Подтип" value={params.get('subtype') || ''} onChange={(event) => update({ subtype: event.target.value, page: 0 })} className={inputClass} placeholder="Подтип" />
        <select aria-label="Компания" value={companyId} onChange={(event) => update({ companyId: event.target.value, objectId: undefined, page: 0 })} className={inputClass}><option value="">Все компании</option>{companiesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Объект" value={params.get('objectId') || ''} disabled={!companyId} onChange={(event) => update({ objectId: event.target.value, page: 0 })} className={inputClass}><option value="">Все объекты</option>{objectsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Лаборатория" value={laboratoryId} onChange={(event) => update({ laboratoryId: event.target.value, executorId: undefined, page: 0 })} className={inputClass}><option value="">Все лаборатории</option>{laboratoriesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <select aria-label="Исполнитель" value={params.get('executorId') || ''} disabled={!laboratoryId} onChange={(event) => update({ executorId: event.target.value, page: 0 })} className={inputClass}><option value="">Все исполнители</option>{executorsQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}</select>
        <select aria-label="Соответствие" value={params.get('compliance') || ''} onChange={(event) => update({ compliance: event.target.value, page: 0 })} className={inputClass}><option value="">Любое соответствие</option><option value="COMPLIANT">Соответствует</option><option value="NON_COMPLIANT">Не соответствует</option><option value="NOT_EVALUATED">Не проверено</option></select>
        <input aria-label="Дата с" type="date" value={params.get('dateFrom') || ''} onChange={(event) => update({ dateFrom: event.target.value, page: 0 })} className={inputClass} />
        <input aria-label="Дата по" type="date" value={params.get('dateTo') || ''} onChange={(event) => update({ dateTo: event.target.value, page: 0 })} className={inputClass} />
        <select aria-label="Сортировка" value={params.get('sort') || ''} onChange={(event) => update({ sort: event.target.value, page: 0 })} className={inputClass}><option value="">По умолчанию</option><option value="protocolDate,desc">Сначала новые</option><option value="protocolDate,asc">Сначала старые</option><option value="updatedAt,desc">Недавно изменённые</option></select>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={params.get('includeArchived') === 'true'} onChange={(event) => update({ includeArchived: event.target.checked || undefined, page: 0 })} /> Включая архивные</label>{hasFilters && <Button type="button" variant="secondary" onClick={() => { setSearchInput(''); setParams(new URLSearchParams(), { replace: true }); }}>Сбросить фильтры</Button>}</div>
    </section>
    {protocolsQuery.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-900">{parseApiError(protocolsQuery.error, 'Не удалось загрузить протоколы').message}</p><Button type="button" variant="secondary" className="mt-3" onClick={() => protocolsQuery.refetch()}>Повторить</Button></div>}
    {!protocolsQuery.isError && !protocolsQuery.isLoading && !protocols.length ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-900">{hasFilters ? 'У выбранной компании протоколы не найдены' : 'Протоколы пока не созданы'}</h2></section> : !protocolsQuery.isError && <ProtocolList protocols={protocols} role={user?.role} loading={protocolsQuery.isLoading} busyId={busyId} onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)} onArchive={setArchiveTarget} onReplace={setReplaceTarget} onDownload={download} />}
    {data && protocols.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span>{data.totalElementsExact === false ? `Показано ${protocols.length}; общее количество недоступно` : `Показано ${from}–${to} из ${data.totalElements}`}</span><select aria-label="Размер страницы" value={size} onChange={(event) => update({ size: Number(event.target.value), page: 0 })} className="rounded-lg border border-slate-200 px-2 py-1">{sizes.map((item) => <option key={item}>{item}</option>)}</select></div><div className="flex items-center gap-2"><Button type="button" variant="secondary" disabled={data.first || protocolsQuery.isFetching} onClick={() => update({ page: Math.max(0, page - 1) })}>Назад</Button><span>Страница {data.page + 1}{data.totalElementsExact !== false && ` из ${Math.max(1, data.totalPages)}`}</span><Button type="button" variant="secondary" disabled={data.last || protocolsQuery.isFetching} onClick={() => update({ page: Math.min(page + 1, Math.max(0, data.totalPages - 1)) })}>Далее</Button></div></div>}
    <Modal open={Boolean(archiveTarget)} loading={busyId === archiveTarget?.id} onClose={() => !busyId && setArchiveTarget(null)} title={`Архивировать протокол «${archiveTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={archive}>{busyId ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Протокол останется доступен только для просмотра и скачивания существующих документов.</p></Modal>
    <ReplaceProtocolModal open={Boolean(replaceTarget)} loading={busyId === replaceTarget?.id} onClose={() => !busyId && setReplaceTarget(null)} onConfirm={replace} />
    <CreateProtocolWizardModal open={createModalOpen} orderId={params.get('orderId') || ''} orderServiceItemId={params.get('orderServiceItemId') || ''} pekPrefill={{ companyId: params.get('companyId') || '', objectId: params.get('objectId') || '', pekProgramId: params.get('pekProgramId') || '', pekControlItemId: params.get('pekControlItemId') || '', pekControlEventId: params.get('pekControlEventId') || '', pekReportId: params.get('pekReportId') || '', monitoringPointId: params.get('monitoringPointId') || '', emissionSourceId: params.get('emissionSourceId') || '', waterOutletId: params.get('waterOutletId') || '', measurementDate: params.get('measurementDate') || undefined, measurementPlace: params.get('measurementPlace') || undefined }} onClose={() => { setCreateModalOpen(false); update({ create: undefined }); }} onCreated={(protocol) => { setCreateModalOpen(false); void queryClient.invalidateQueries({ queryKey: ['protocols'] }); if (protocol.orderId) void queryClient.invalidateQueries({ queryKey: ['order', String(protocol.orderId)] }); const navigation = new URLSearchParams(); const pekReportId = params.get('pekReportId'); if (pekReportId) { navigation.set('pekReportId', pekReportId); navigation.set('returnTo', `/staff/pek/reports/${pekReportId}`); } navigate(`/staff/protocols/${protocol.id}${navigation.size ? `?${navigation}` : ''}`); }} />
  </div>;
};

export default ProtocolsPage;
