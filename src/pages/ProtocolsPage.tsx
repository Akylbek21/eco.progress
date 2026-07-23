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
import { parseApiError } from '../services/apiHelpers';
import protocolService from '../services/protocolService';
import type { Protocol, ProtocolListQuery } from '../types/protocols';
import { canCreateProtocol } from '../utils/protocolPermissions';

const sizes = [10, 20, 50, 100];
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const integer = (value: string | null, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback; };
const saveBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url); };

const ProtocolsPage = () => {
  const navigate = useNavigate(); const toast = useToast(); const { user } = useAuth(); const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const page = integer(params.get('page'), 0); const requestedSize = integer(params.get('size'), 20); const size = sizes.includes(requestedSize) ? requestedSize : 20;
  const companyId = params.get('companyId') || '';
  const [busyId, setBusyId] = useState(''); const [archiveTarget, setArchiveTarget] = useState<Protocol | null>(null); const [replaceTarget, setReplaceTarget] = useState<Protocol | null>(null); const [createModalOpen, setCreateModalOpen] = useState(false);
  const update = (changes: Record<string, string | number | undefined>) => { const next = new URLSearchParams(); const values = { page, size, companyId, ...changes }; Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') next.set(key, String(value)); }); setParams(next, { replace: true }); };

  const companiesQuery = useQuery({ queryKey: ['companies', 'protocol-filter'], queryFn: () => getActiveCompanies() });
  const query = useMemo<ProtocolListQuery>(() => ({ page, size, companyId: companyId ? Number(companyId) : undefined }), [page, size, companyId]);
  const protocolsQuery = useQuery({ queryKey: ['protocols', query], queryFn: ({ signal }) => protocolService.getProtocolsPage(query, signal), placeholderData: keepPreviousData });
  const data = protocolsQuery.data; const protocols = data?.items || [];
  useEffect(() => { if (data && data.totalPages > 0 && page >= data.totalPages) update({ page: data.totalPages - 1 }); }, [data?.totalPages, page]);

  const download = async (protocol: Protocol, kind: 'pdf' | 'docx') => { if (busyId) return; setBusyId(protocol.id); try { const file = kind === 'pdf' ? await protocolService.downloadPdf(protocol.id) : await protocolService.downloadDocx(protocol.id); saveBlob(file.blob, file.fileName || `${protocol.protocolNumber}.${kind}`); } catch (error) { const parsed = parseApiError(error, `Не удалось скачать ${kind.toUpperCase()}`); toast.error(parsed.message); } finally { setBusyId(''); } };
  const archive = async () => { if (!archiveTarget || busyId) return; setBusyId(archiveTarget.id); try { await protocolService.archiveProtocol(archiveTarget.id); setArchiveTarget(null); toast.success('Протокол архивирован'); await queryClient.invalidateQueries({ queryKey: ['protocols'] }); } catch (error) { toast.error(parseApiError(error, 'Не удалось архивировать протокол').message); } finally { setBusyId(''); } };
  const replace = async (reason: string) => { if (!replaceTarget || busyId) return; setBusyId(replaceTarget.id); try { const created = await protocolService.createCorrection(replaceTarget.id, reason.trim()); setReplaceTarget(null); navigate(`/staff/protocols/${created.id}`); } catch (error) { toast.error(parseApiError(error, 'Не удалось создать исправленную версию').message); } finally { setBusyId(''); } };
  const hasFilters = Boolean(companyId);
  const from = data && protocols.length ? data.page * data.size + 1 : 0; const to = data ? data.page * data.size + protocols.length : 0;

  return <div className="space-y-6 pb-10">
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold uppercase tracking-wide text-eco-700">Испытательная лаборатория</p><h1 className="mt-1 text-3xl font-black text-slate-950">Протоколы</h1><p className="mt-2 text-sm text-slate-500">Создание, расчёт, утверждение, подписание и документы.</p></div>{canCreateProtocol(user) && <Button type="button" onClick={() => setCreateModalOpen(true)}><Plus className="h-4 w-4" /> Создать протокол</Button>}</header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <select aria-label="Компания" value={companyId} onChange={(event) => update({ companyId: event.target.value, page: 0 })} className={inputClass}><option value="">Все компании</option>{companiesQuery.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
    </section>
    {protocolsQuery.isError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-5"><p className="font-bold text-rose-900">{parseApiError(protocolsQuery.error, 'Не удалось загрузить протоколы').message}</p><Button type="button" variant="secondary" className="mt-3" onClick={() => protocolsQuery.refetch()}>Повторить</Button></div>}
    {!protocolsQuery.isError && !protocolsQuery.isLoading && !protocols.length ? <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><h2 className="text-lg font-bold text-slate-900">{hasFilters ? 'У выбранной компании протоколы не найдены' : 'Протоколы пока не созданы'}</h2></section> : !protocolsQuery.isError && <ProtocolList protocols={protocols} role={user?.role} loading={protocolsQuery.isLoading} busyId={busyId} onOpen={(protocol) => navigate(`/staff/protocols/${protocol.id}`)} onArchive={setArchiveTarget} onReplace={setReplaceTarget} onDownload={download} />}
    {data && protocols.length > 0 && <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span>{data.totalElementsExact === false ? `Показано ${protocols.length}; общее количество недоступно` : `Показано ${from}–${to} из ${data.totalElements}`}</span><select aria-label="Размер страницы" value={size} onChange={(event) => update({ size: Number(event.target.value), page: 0 })} className="rounded-lg border border-slate-200 px-2 py-1">{sizes.map((item) => <option key={item}>{item}</option>)}</select></div><div className="flex items-center gap-2"><Button type="button" variant="secondary" disabled={data.first || protocolsQuery.isFetching} onClick={() => update({ page: Math.max(0, page - 1) })}>Назад</Button><span>Страница {data.page + 1}{data.totalElementsExact !== false && ` из ${Math.max(1, data.totalPages)}`}</span><Button type="button" variant="secondary" disabled={data.last || protocolsQuery.isFetching} onClick={() => update({ page: Math.min(page + 1, Math.max(0, data.totalPages - 1)) })}>Далее</Button></div></div>}
    <Modal open={Boolean(archiveTarget)} loading={busyId === archiveTarget?.id} onClose={() => !busyId && setArchiveTarget(null)} title={`Архивировать протокол «${archiveTarget?.protocolNumber || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={Boolean(busyId)} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={Boolean(busyId)} onClick={archive}>{busyId ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Протокол останется доступен только для просмотра и скачивания существующих документов.</p></Modal>
    <ReplaceProtocolModal open={Boolean(replaceTarget)} loading={busyId === replaceTarget?.id} onClose={() => !busyId && setReplaceTarget(null)} onConfirm={replace} />
    <CreateProtocolWizardModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} onCreated={(protocol) => { setCreateModalOpen(false); void queryClient.invalidateQueries({ queryKey: ['protocols'] }); navigate(`/staff/protocols/${protocol.id}`); }} />
  </div>;
};

export default ProtocolsPage;
