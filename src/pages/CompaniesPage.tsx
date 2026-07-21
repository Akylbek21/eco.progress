import { type MouseEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, Edit3, Eye, Plus, RefreshCw, Search } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, type SubmitHandler } from 'react-hook-form';
import Button from '../components/ui/Button';
import CompanyDetailsBlock from '../components/companies/CompanyDetailsBlock';
import CompanyForm from '../components/companies/CompanyForm';
import Modal from '../components/ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { getApiErrorMessage, getApiStatus } from '../services/apiHelpers';
import {
  archiveCompany, archiveCompanyObject, createCompany, createCompanyObject, getCompanies,
  getCompanyById, getCompanyObjects, updateCompany, updateCompanyObject,
} from '../services/companyService';
import type {
  CompanyCreateRequest, CompanyDetails, CompanyListItem, CompanyObject, CompanyObjectFormValues,
  CompanyObjectRequest, CompanyStatus, CompanyStatusFilter,
} from '../types/companies';
import type { UserRole } from '../types';
import { companyRoleMatrix } from '../config/permissions';

const readRoles: UserRole[] = [...companyRoleMatrix.read];
const writeRoles: UserRole[] = [...companyRoleMatrix.write];
const archiveRoles: UserRole[] = [...companyRoleMatrix.archive];
const hasRole = (role: UserRole | undefined, roles: UserRole[]) => Boolean(role && roles.includes(role));
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const pageSizes = [10, 20, 50, 100];
const formatDate = (date?: string) => date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toLocaleDateString('ru-RU') : '—';
const value = (item?: string | number | null) => item || '—';
const stop = (event: MouseEvent) => event.stopPropagation();

const PageShell = ({ children }: { children: ReactNode }) => <div className="space-y-6 pb-10">{children}</div>;
const StatusPill = ({ status }: { status: CompanyStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'ARCHIVED' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>
    {status === 'ARCHIVED' ? 'Архивная' : 'Активна'}
  </span>
);
const ErrorBox = ({ message, retry, back }: { message: string; retry?: () => void; back?: () => void }) => (
  <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900" role="alert">
    <p className="font-bold">{message}</p>
    <div className="flex gap-2">
      {retry && <Button type="button" variant="secondary" onClick={retry}>Повторить</Button>}
      {back && <Button type="button" variant="secondary" onClick={back}>Назад</Button>}
    </div>
  </div>
);
const TableSkeleton = ({ rows = 8 }: { rows?: number }) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Загрузка компаний">
    <div className="h-12 animate-pulse bg-slate-100" />
    {Array.from({ length: rows }).map((_, index) => <div key={index} className="grid h-16 grid-cols-5 gap-5 border-t border-slate-100 p-4"><span className="animate-pulse rounded bg-slate-100" /><span className="animate-pulse rounded bg-slate-100" /><span className="animate-pulse rounded bg-slate-100" /><span className="animate-pulse rounded bg-slate-100" /><span className="animate-pulse rounded bg-slate-100" /></div>)}
  </section>
);

const parseInteger = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
};

const CompaniesList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') || '';
  const page = parseInteger(searchParams.get('page'), 0);
  const requestedSize = parseInteger(searchParams.get('size'), 20);
  const size = pageSizes.includes(requestedSize) ? requestedSize : 20;
  const statusValue = searchParams.get('status');
  const status: CompanyStatusFilter = statusValue === 'ARCHIVED' || statusValue === 'ALL' ? statusValue : 'ACTIVE';
  const sort = searchParams.get('sort') || 'updatedAt,desc';
  const [searchInput, setSearchInput] = useState(search);
  const [archiveTarget, setArchiveTarget] = useState<CompanyListItem | null>(null);
  const [archiving, setArchiving] = useState(false);
  const canWrite = hasRole(user?.role, writeRoles);
  const canArchive = hasRole(user?.role, archiveRoles);

  const updateParams = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, item]) => {
      if (item === undefined || item === '') next.delete(key); else next.set(key, String(item));
    });
    setSearchParams(next, { replace: true });
  };
  useEffect(() => setSearchInput(search), [search]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== search) updateParams({ search: trimmed || undefined, page: 0 });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);

  const companiesQuery = useQuery({
    queryKey: ['companies', { page, size, search, status, sort }],
    queryFn: ({ signal }) => getCompanies({ page, size, search: search || undefined, status, sort }, signal),
    placeholderData: keepPreviousData,
  });
  const pageData = companiesQuery.data;
  const companies = pageData?.items || [];

  useEffect(() => {
    if (pageData && pageData.totalPages > 0 && page >= pageData.totalPages) updateParams({ page: pageData.totalPages - 1 });
  }, [page, pageData?.totalPages]);

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({ page: '0', size: String(size), status: 'ACTIVE', sort: 'updatedAt,desc' }, { replace: true });
  };
  const confirmArchive = async () => {
    if (!archiveTarget || !canArchive || archiving) return;
    setArchiving(true);
    try {
      await archiveCompany(archiveTarget.id);
      setArchiveTarget(null);
      toast.success('Компания архивирована');
      if (status === 'ACTIVE' && companies.length === 1 && page > 0) updateParams({ page: page - 1 });
      await queryClient.invalidateQueries({ queryKey: ['companies'] });
    } catch (error) {
      toast.error('Не удалось архивировать компанию', getApiErrorMessage(error));
    } finally { setArchiving(false); }
  };

  const hasFilters = Boolean(search) || status !== 'ACTIVE' || sort !== 'updatedAt,desc';
  const from = pageData && pageData.items.length ? pageData.page * pageData.size + 1 : 0;
  const to = pageData ? pageData.page * pageData.size + pageData.items.length : 0;

  return <PageShell>
    <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold uppercase tracking-wide text-eco-700">CRM</p><h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Компании</h1></div>
      {canWrite && <Button asChild><Link to="/staff/companies/new"><Plus className="h-4 w-4" /> Добавить компанию</Link></Button>}
    </header>
    <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(260px,1fr)_180px_210px_120px]">
      <label className="relative"><span className="sr-only">Поиск компаний</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Название, БИН, телефон, email, адрес или контакт" className={`${inputClass} pl-10`} /></label>
      <label><span className="sr-only">Статус</span><select value={status} onChange={(event) => updateParams({ status: event.target.value, page: 0 })} className={inputClass}><option value="ACTIVE">Активные</option><option value="ARCHIVED">Архивные</option><option value="ALL">Все</option></select></label>
      <label><span className="sr-only">Сортировка</span><select value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: 0 })} className={inputClass}><option value="updatedAt,desc">Сначала новые</option><option value="updatedAt,asc">Сначала старые</option><option value="name,asc">По названию А–Я</option><option value="name,desc">По названию Я–А</option></select></label>
      <Button type="button" variant="secondary" aria-label="Обновить список" disabled={companiesQuery.isFetching} onClick={() => companiesQuery.refetch()}><RefreshCw className={`h-4 w-4 ${companiesQuery.isFetching ? 'animate-spin' : ''}`} /> Обновить</Button>
    </section>

    {companiesQuery.isLoading && <TableSkeleton rows={Math.min(size, 10)} />}
    {companiesQuery.isError && !companiesQuery.isLoading && <ErrorBox message={getApiStatus(companiesQuery.error) === 403 ? 'У вас нет доступа к списку компаний' : 'Не удалось загрузить компании'} retry={() => companiesQuery.refetch()} />}
    {!companiesQuery.isLoading && !companiesQuery.isError && companies.length === 0 && (
      <section className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">{hasFilters ? 'По заданным параметрам компании не найдены' : 'Компании пока не добавлены'}</h2>
        <div className="mt-4 flex justify-center gap-3">{hasFilters ? <Button type="button" variant="secondary" onClick={resetFilters}>Сбросить фильтры</Button> : canWrite && <Button asChild><Link to="/staff/companies/new">Добавить компанию</Link></Button>}</div>
      </section>
    )}
    {!companiesQuery.isLoading && !companiesQuery.isError && companies.length > 0 && (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="w-52 px-4 py-3">Наименование</th><th className="w-32 px-4 py-3">БИН</th><th className="w-44 px-4 py-3">Контактное лицо</th><th className="w-36 px-4 py-3">Телефон</th><th className="w-44 px-4 py-3">Email</th><th className="w-64 px-4 py-3">Адрес</th><th className="w-24 px-4 py-3">Объекты</th><th className="w-28 px-4 py-3">Статус</th><th className="w-28 px-4 py-3">Изменена</th><th className="w-36 px-4 py-3 text-right">Действия</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{companies.map((company) => <tr key={company.id} tabIndex={0} onClick={() => navigate(`/staff/companies/${company.id}`)} onKeyDown={(event) => { if (event.key === 'Enter') navigate(`/staff/companies/${company.id}`); }} className={`cursor-pointer align-top focus:bg-eco-50 focus:outline-none ${company.status === 'ARCHIVED' ? 'bg-slate-50/70 text-slate-600' : 'hover:bg-slate-50'}`}>
              <td className="truncate px-4 py-3 font-bold text-slate-900" title={company.name}>{value(company.name)}</td><td className="px-4 py-3 font-mono text-xs">{value(company.bin)}</td><td className="truncate px-4 py-3" title={company.contactPerson}>{value(company.contactPerson)}</td><td className="px-4 py-3">{value(company.contactPhone || company.phone)}</td><td className="truncate px-4 py-3" title={company.contactEmail || company.email}>{value(company.contactEmail || company.email)}</td><td className="truncate px-4 py-3" title={company.actualAddress || company.legalAddress}>{value(company.actualAddress || company.legalAddress)}</td><td className="px-4 py-3">{company.objectCount ?? 0}</td><td className="px-4 py-3"><StatusPill status={company.status} /></td><td className="px-4 py-3">{formatDate(company.updatedAt)}</td>
              <td className="px-4 py-3" onClick={stop}><div className="flex justify-end gap-2"><button type="button" aria-label={`Открыть ${company.name}`} onClick={() => navigate(`/staff/companies/${company.id}`)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-eco-800 ring-1 ring-eco-200 hover:bg-eco-50"><Eye className="h-4 w-4" /></button>{canWrite && company.status === 'ACTIVE' && <button type="button" aria-label={`Изменить ${company.name}`} onClick={() => navigate(`/staff/companies/${company.id}/edit`)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-eco-800 ring-1 ring-eco-200 hover:bg-eco-50"><Edit3 className="h-4 w-4" /></button>}{canArchive && company.status === 'ACTIVE' && <button type="button" aria-label={`Архивировать ${company.name}`} onClick={() => setArchiveTarget(company)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"><Archive className="h-4 w-4" /></button>}</div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><span>{pageData?.totalElementsExact === false ? `Показано ${companies.length}; backend не вернул общее количество` : `Показано ${from}–${to} из ${pageData?.totalElements || 0}`}</span><label className="flex items-center gap-2">На странице <select aria-label="Размер страницы" value={size} onChange={(event) => updateParams({ size: Number(event.target.value), page: 0 })} className="rounded-lg border border-slate-200 px-2 py-1">{pageSizes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div>
          <div className="flex items-center gap-3"><Button type="button" variant="secondary" disabled={pageData?.first !== false || companiesQuery.isFetching} onClick={() => updateParams({ page: Math.max(0, page - 1) })}>Назад</Button><span className="font-semibold">Страница {(pageData?.page ?? page) + 1}{pageData?.totalElementsExact !== false && ` из ${Math.max(pageData?.totalPages || 1, 1)}`}</span><Button type="button" variant="secondary" disabled={pageData?.last !== false || companiesQuery.isFetching} onClick={() => updateParams({ page: Math.min(page + 1, Math.max(0, (pageData?.totalPages || 1) - 1)) })}>Далее</Button></div>
        </div>
      </section>
    )}
    <Modal open={Boolean(archiveTarget)} loading={archiving} onClose={() => !archiving && setArchiveTarget(null)} title={`Архивировать компанию «${archiveTarget?.name || ''}»?`} description="Компания станет недоступна для создания новых протоколов. Существующие протоколы сохранятся." size="sm" footer={<><Button type="button" variant="secondary" disabled={archiving} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Это действие изменит статус компании и скроет её из списка активных.</p></Modal>
  </PageShell>;
};

const emptyObjectValues: CompanyObjectFormValues = { name: '', objectType: '', address: '', region: '', cityDistrict: '', coordinates: '', contactPerson: '', contactPhone: '', primary: false, activityType: '', sanitaryZone: '', samplingLocation: '', notes: '' };
const nullValue = (item: string) => item.trim() || null;
const toObjectRequest = (item: CompanyObjectFormValues): CompanyObjectRequest => ({ name: item.name.trim(), objectType: nullValue(item.objectType), address: item.address.trim(), region: nullValue(item.region), cityDistrict: nullValue(item.cityDistrict), coordinates: nullValue(item.coordinates), contactPerson: nullValue(item.contactPerson), contactPhone: nullValue(item.contactPhone), primary: item.primary, activityType: nullValue(item.activityType), sanitaryZone: nullValue(item.sanitaryZone), samplingLocation: nullValue(item.samplingLocation), notes: nullValue(item.notes) });
const validCoordinates = (item: string) => { if (!item.trim()) return true; const parts = item.split(/[;,]/).map((part) => Number(part.trim())); return parts.length === 2 && parts.every(Number.isFinite) && parts[0] >= -90 && parts[0] <= 90 && parts[1] >= -180 && parts[1] <= 180; };

const CompanyObjectModal = ({ open, object, loading, onClose, onSubmit }: { open: boolean; object: CompanyObject | null; loading: boolean; onClose: () => void; onSubmit: (request: CompanyObjectRequest) => Promise<void> }) => {
  const defaults = useMemo(() => ({ ...emptyObjectValues, ...(object || {}) }), [object]);
  const { register, handleSubmit, reset, setError, formState: { errors, isDirty, isSubmitting } } = useForm<CompanyObjectFormValues>({ defaultValues: defaults });
  useEffect(() => { if (open) reset(defaults); }, [open, defaults, reset]);
  useEffect(() => { if (!open || !isDirty) return undefined; const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [open, isDirty]);
  const close = () => { if (loading || isSubmitting) return; if (isDirty && !window.confirm('Есть несохранённые изменения. Закрыть форму?')) return; onClose(); };
  const submit: SubmitHandler<CompanyObjectFormValues> = async (values) => { try { await onSubmit(toObjectRequest(values)); reset(values); } catch (error) { setError('root.server', { type: 'server', message: getApiErrorMessage(error, 'Не удалось сохранить объект') }); } };
  const Field = ({ name, label, required }: { name: keyof CompanyObjectFormValues; label: string; required?: boolean }) => <label className="text-sm font-semibold text-slate-700"><span>{label}{required && <span className="text-rose-600"> *</span>}</span><input className={`${inputClass} mt-1.5`} {...register(name, { required: required ? `${label}: обязательное поле` : false, validate: name === 'coordinates' ? (item) => validCoordinates(String(item)) || 'Формат: широта, долгота' : undefined })} />{errors[name]?.message && <span role="alert" className="mt-1 block text-sm text-rose-700">{errors[name]?.message}</span>}</label>;
  return <Modal open={open} onClose={close} loading={loading || isSubmitting} title={object ? 'Изменить объект' : 'Добавить объект'} size="xl"><form onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">{errors.root?.server?.message && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 sm:col-span-2">{errors.root.server.message}</p>}<Field name="name" label="Название" required /><Field name="objectType" label="Тип объекта" /><Field name="address" label="Адрес" required /><Field name="region" label="Регион" /><Field name="cityDistrict" label="Город/район" /><Field name="coordinates" label="Координаты" /><Field name="contactPerson" label="Контактное лицо" /><Field name="contactPhone" label="Телефон" /><Field name="activityType" label="Вид деятельности" /><Field name="sanitaryZone" label="Санитарная зона" /><Field name="samplingLocation" label="Место отбора проб" /><label className="flex items-center gap-2 self-end pb-3 text-sm font-semibold text-slate-700"><input type="checkbox" {...register('primary')} /> Основной объект</label><label className="text-sm font-semibold text-slate-700 sm:col-span-2"><span>Примечание</span><textarea rows={3} className={`${inputClass} mt-1.5`} {...register('notes')} /></label><div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2"><Button type="button" variant="secondary" disabled={loading || isSubmitting} onClick={close}>Отмена</Button><Button type="submit" disabled={loading || isSubmitting}>{loading || isSubmitting ? 'Сохранение…' : 'Сохранить'}</Button></div></form></Modal>;
};

const CompanyObjectsSection = ({ companyId, companyArchived }: { companyId: string; companyArchived: boolean }) => {
  const { user } = useAuth(); const toast = useToast(); const queryClient = useQueryClient();
  const canWrite = hasRole(user?.role, writeRoles) && !companyArchived; const canArchive = hasRole(user?.role, archiveRoles) && !companyArchived;
  const [editing, setEditing] = useState<CompanyObject | null>(null); const [modalOpen, setModalOpen] = useState(false); const [archiveTarget, setArchiveTarget] = useState<CompanyObject | null>(null); const [saving, setSaving] = useState(false);
  const objectsQuery = useQuery({ queryKey: ['company-objects', companyId], queryFn: ({ signal }) => getCompanyObjects(companyId, signal) });
  const saveObject = async (request: CompanyObjectRequest) => { if (!canWrite || saving) return; setSaving(true); try { if (editing) await updateCompanyObject(companyId, editing.id, request); else await createCompanyObject(companyId, request); await queryClient.invalidateQueries({ queryKey: ['company-objects', companyId] }); await queryClient.invalidateQueries({ queryKey: ['company', companyId] }); toast.success(editing ? 'Объект обновлён' : 'Объект создан'); setModalOpen(false); setEditing(null); } catch (error) { throw error; } finally { setSaving(false); } };
  const confirmArchive = async () => { if (!archiveTarget || !canArchive || saving) return; setSaving(true); try { await archiveCompanyObject(companyId, archiveTarget.id); setArchiveTarget(null); await queryClient.invalidateQueries({ queryKey: ['company-objects', companyId] }); await queryClient.invalidateQueries({ queryKey: ['company', companyId] }); toast.success('Объект архивирован'); } catch (error) { toast.error('Не удалось архивировать объект', getApiErrorMessage(error)); } finally { setSaving(false); } };
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-bold text-slate-900">Объекты</h2>{companyArchived && <p className="mt-1 text-sm text-amber-700">Для архивной компании создание объектов недоступно.</p>}</div>{canWrite && <Button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Добавить объект</Button>}</div>
    {objectsQuery.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-slate-100" /> : objectsQuery.isError ? <ErrorBox message="Не удалось загрузить объекты" retry={() => objectsQuery.refetch()} /> : !objectsQuery.data?.length ? <p className="py-8 text-center text-sm font-semibold text-slate-500">Объекты пока не добавлены</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Название</th><th className="px-3 py-3">Тип</th><th className="px-3 py-3">Адрес</th><th className="px-3 py-3">Регион</th><th className="px-3 py-3">Город/район</th><th className="px-3 py-3">Координаты</th><th className="px-3 py-3">Контакт</th><th className="px-3 py-3">Основной</th><th className="px-3 py-3">Статус</th><th className="px-3 py-3 text-right">Действия</th></tr></thead><tbody className="divide-y divide-slate-100">{objectsQuery.data.map((object) => <tr key={object.id} className={object.status === 'ARCHIVED' ? 'bg-slate-50 text-slate-600' : ''}><td className="px-3 py-3 font-bold">{value(object.name)}{object.virtual && <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">старый объект</span>}</td><td className="px-3 py-3">{value(object.objectType)}</td><td className="px-3 py-3">{value(object.address)}</td><td className="px-3 py-3">{value(object.region)}</td><td className="px-3 py-3">{value(object.cityDistrict)}</td><td className="px-3 py-3">{value(object.coordinates)}</td><td className="px-3 py-3">{value(object.contactPerson)}<span className="block text-xs">{object.contactPhone}</span></td><td className="px-3 py-3">{object.primary ? 'Да' : 'Нет'}</td><td className="px-3 py-3"><StatusPill status={object.status} /></td><td className="px-3 py-3"><div className="flex justify-end gap-2">{canWrite && object.status === 'ACTIVE' && <button type="button" aria-label={`Изменить объект ${object.name}`} title={object.virtual ? 'При сохранении backend материализует старый объект' : undefined} onClick={() => { setEditing(object); setModalOpen(true); }} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-eco-800 ring-1 ring-eco-200"><Edit3 className="h-4 w-4" /></button>}{canArchive && object.status === 'ACTIVE' && !object.virtual && <button type="button" aria-label={`Архивировать объект ${object.name}`} onClick={() => setArchiveTarget(object)} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-rose-700 ring-1 ring-rose-200"><Archive className="h-4 w-4" /></button>}</div></td></tr>)}</tbody></table></div>}
    <CompanyObjectModal open={modalOpen} object={editing} loading={saving} onClose={() => { setModalOpen(false); setEditing(null); }} onSubmit={saveObject} />
    <Modal open={Boolean(archiveTarget)} loading={saving} onClose={() => !saving && setArchiveTarget(null)} title={`Архивировать объект «${archiveTarget?.name || ''}»?`} size="sm" footer={<><Button type="button" variant="secondary" disabled={saving} onClick={() => setArchiveTarget(null)}>Отмена</Button><Button type="button" variant="danger" disabled={saving} onClick={confirmArchive}>{saving ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Объект перестанет быть доступен для новых протоколов.</p></Modal>
  </section>;
};

const CompanyFormPage = ({ edit = false }: { edit?: boolean }) => {
  const { companyId } = useParams(); const navigate = useNavigate(); const toast = useToast(); const queryClient = useQueryClient(); const { user } = useAuth();
  const companyQuery = useQuery({ queryKey: ['company', companyId], queryFn: ({ signal }) => getCompanyById(companyId || '', signal), enabled: edit && Boolean(companyId) });
  const [saving, setSaving] = useState(false);
  const submit = async (request: CompanyCreateRequest) => { if (!hasRole(user?.role, writeRoles) || saving) return; setSaving(true); try { const saved = edit && companyId ? await updateCompany(companyId, request) : await createCompany(request); await queryClient.invalidateQueries({ queryKey: ['companies'] }); queryClient.setQueryData(['company', saved.id], saved); toast.success(edit ? 'Компания обновлена' : 'Компания создана'); navigate(`/staff/companies/${saved.id}`); } catch (error) { toast.error('Не удалось сохранить компанию', getApiErrorMessage(error)); throw error; } finally { setSaving(false); } };
  if (!hasRole(user?.role, writeRoles)) return <ErrorBox message="У вашей роли нет прав на изменение компаний" back={() => navigate('/staff/companies')} />;
  if (companyQuery.isLoading) return <TableSkeleton rows={5} />;
  if (companyQuery.isError) return <ErrorBox message="Не удалось загрузить компанию" retry={() => companyQuery.refetch()} back={() => navigate('/staff/companies')} />;
  return <PageShell><header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><Link to="/staff/companies" className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-eco-700"><ArrowLeft className="h-4 w-4" /> К компаниям</Link><h1 className="text-2xl font-black text-slate-950">{edit ? `Изменить «${companyQuery.data?.name || ''}»` : 'Добавить компанию'}</h1></header><CompanyForm initialValue={companyQuery.data} loading={saving} submitText={edit ? 'Сохранить изменения' : 'Создать компанию'} onSubmit={submit} onCancel={() => navigate('/staff/companies')} /></PageShell>;
};

const CompanyViewPage = () => {
  const { companyId } = useParams(); const navigate = useNavigate(); const toast = useToast(); const queryClient = useQueryClient(); const { user } = useAuth(); const [archiveOpen, setArchiveOpen] = useState(false); const [archiving, setArchiving] = useState(false);
  const companyQuery = useQuery({ queryKey: ['company', companyId], queryFn: ({ signal }) => getCompanyById(companyId || '', signal), enabled: Boolean(companyId) });
  const company = companyQuery.data;
  const confirmArchive = async () => { if (!company || !hasRole(user?.role, archiveRoles) || archiving) return; setArchiving(true); try { const saved = await archiveCompany(company.id); queryClient.setQueryData(['company', company.id], { ...company, ...saved, status: 'ARCHIVED' }); await queryClient.invalidateQueries({ queryKey: ['companies'] }); setArchiveOpen(false); toast.success('Компания архивирована'); } catch (error) { toast.error('Не удалось архивировать компанию', getApiErrorMessage(error)); } finally { setArchiving(false); } };
  if (companyQuery.isLoading) return <TableSkeleton rows={6} />;
  if (companyQuery.isError || !company) return <ErrorBox message={getApiStatus(companyQuery.error) === 403 ? 'У вас нет доступа к компании' : 'Не удалось загрузить компанию'} retry={() => companyQuery.refetch()} back={() => navigate('/staff/companies')} />;
  return <PageShell><header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between"><div><button type="button" onClick={() => navigate('/staff/companies')} className="mb-3 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-eco-700"><ArrowLeft className="h-4 w-4" /> К компаниям</button><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{company.name}</h1><StatusPill status={company.status} /></div><p className="mt-2 font-mono text-sm text-slate-600">БИН {value(company.bin)}</p></div>{company.status === 'ACTIVE' && <div className="flex flex-wrap gap-2">{hasRole(user?.role, archiveRoles) && <Button type="button" variant="danger" onClick={() => setArchiveOpen(true)}><Archive className="h-4 w-4" /> Архивировать</Button>}{hasRole(user?.role, writeRoles) && <Button type="button" onClick={() => navigate(`/staff/companies/${company.id}/edit`)}><Edit3 className="h-4 w-4" /> Изменить</Button>}</div>}</header><CompanyDetailsBlock company={company} /><CompanyObjectsSection companyId={company.id} companyArchived={company.status === 'ARCHIVED'} /><Modal open={archiveOpen} loading={archiving} onClose={() => !archiving && setArchiveOpen(false)} title={`Архивировать компанию «${company.name}»?`} description="Компания станет недоступна для создания новых протоколов. Существующие протоколы сохранятся." size="sm" footer={<><Button type="button" variant="secondary" disabled={archiving} onClick={() => setArchiveOpen(false)}>Отмена</Button><Button type="button" variant="danger" disabled={archiving} onClick={confirmArchive}>{archiving ? 'Архивирование…' : 'Архивировать'}</Button></>}><p className="text-sm text-slate-600">Просмотр старых данных останется доступен.</p></Modal></PageShell>;
};

const CompaniesPage = () => { const location = useLocation(); const { companyId } = useParams(); if (location.pathname.endsWith('/new')) return <CompanyFormPage />; if (location.pathname.endsWith('/edit')) return <CompanyFormPage edit />; if (companyId) return <CompanyViewPage />; return <CompaniesList />; };

export { readRoles, writeRoles, archiveRoles };
export default CompaniesPage;
