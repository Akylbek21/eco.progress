import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Building2, ImagePlus, Pencil, Plus, RefreshCw, RotateCcw, Star, Trash2, UserMinus, UserPlus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import AuthenticatedImage from '../components/ui/AuthenticatedImage';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import LaboratoryForm from '../components/laboratories/LaboratoryForm';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  accreditationState, activateLaboratoryEmployee, addLaboratoryEmployee, archiveLaboratory, createLaboratory,
  deactivateLaboratoryEmployee, getEligibleLaboratoryEmployees, getLaboratories, getLaboratory, getLaboratoryEmployees,
  getLaboratoryLogoUrl, removeLaboratoryLogo, restoreLaboratory, setDefaultLaboratory, updateLaboratory,
  updateLaboratoryEmployee, uploadLaboratoryLogo,
} from '../services/laboratorySettingsService';
import type { AccreditationStatus, LaboratoryDetails, LaboratoryEmployee, LaboratoryEmployeeFormValues, LaboratoryFormValues, LaboratoryListItem } from '../types/laboratories';
import { getLaboratoryPermissions } from '../utils/laboratoryPermissions';
import { parseLaboratoryApiError } from '../utils/laboratoryApiError';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const pageSizes = [10, 20, 50, 100];
const accreditationLabels: Record<AccreditationStatus, string> = { VALID: 'Действует', EXPIRING: 'Скоро истекает', EXPIRED: 'Истёк', NOT_CONFIGURED: 'Не настроен' };
const employeeDefaults: LaboratoryEmployeeFormValues = { userId: null, position: '', employeeNumber: '', qualification: '', canExecuteMeasurements: true, canApproveProtocols: false, canSignProtocols: false };
const logoTypes = ['image/png', 'image/jpeg'];
const logoMaxSize = 2 * 1024 * 1024;
type EmployeeFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';
type ConfirmAction = { type: 'DEFAULT' | 'ARCHIVE' | 'RESTORE'; laboratory: LaboratoryListItem | LaboratoryDetails } | { type: 'DEACTIVATE' | 'ACTIVATE'; employee: LaboratoryEmployee };

const LaboratorySettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get('search') || '');
  const [search, setSearch] = useState(params.get('search') || '');
  const page = Math.max(0, Number(params.get('page') || 0));
  const size = pageSizes.includes(Number(params.get('size'))) ? Number(params.get('size')) : 20;
  const status = (params.get('status') || 'ACTIVE') as 'ACTIVE' | 'ARCHIVED' | 'ALL';
  const accreditationFilter = (params.get('accreditationStatus') || '') as AccreditationStatus | '';
  const sort = params.get('sort') || 'updatedAt,desc';
  const selectedId = Number(params.get('laboratoryId') || 0);
  const [editing, setEditing] = useState<LaboratoryDetails | null | undefined>(undefined);
  const [laboratoryFormDirty, setLaboratoryFormDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<EmployeeFilter>('ACTIVE');
  const [employeeDraft, setEmployeeDraft] = useState<LaboratoryEmployeeFormValues | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<LaboratoryEmployee | null>(null);
  const [eligibleOpen, setEligibleOpen] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoError, setLogoError] = useState('');

  const updateUrl = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => value === undefined || value === '' ? next.delete(key) : next.set(key, String(value)));
    setParams(next, { replace: true });
  };
  useEffect(() => { const timer = window.setTimeout(() => { setSearch(searchText.trim()); updateUrl({ search: searchText.trim() || undefined, page: 0 }); }, 450); return () => window.clearTimeout(timer); }, [searchText]);

  const listQuery = useQuery({ queryKey: ['laboratories', { page, size, search, status, accreditationFilter, sort }], queryFn: ({ signal }) => getLaboratories({ page, size, search: search || undefined, status, accreditationStatus: accreditationFilter || undefined, sort }, signal), placeholderData: keepPreviousData });
  const selected = selectedId || listQuery.data?.items[0]?.id || 0;
  useEffect(() => { if (!selectedId && selected) updateUrl({ laboratoryId: selected }); }, [selectedId, selected]);
  const detailsQuery = useQuery({ queryKey: ['laboratory-details', selected], queryFn: ({ signal }) => getLaboratory(selected, signal), enabled: selected > 0 });
  const laboratory = detailsQuery.data;
  const permissions = getLaboratoryPermissions(user, laboratory);
  const employeesQuery = useQuery({ queryKey: ['laboratory-employees', selected, employeeFilter], queryFn: ({ signal }) => getLaboratoryEmployees(selected, { includeInactive: employeeFilter !== 'ACTIVE', signal }).then((items) => employeeFilter === 'INACTIVE' ? items.filter((item) => !item.active) : employeeFilter === 'ACTIVE' ? items.filter((item) => item.active) : items), enabled: selected > 0 });
  const employees = employeesQuery.data || [];
  const eligibleQuery = useQuery({ queryKey: ['eligible-employees', selected], queryFn: ({ signal }) => getEligibleLaboratoryEmployees(selected, signal).then((items) => items.filter((item) => !employees.some((existing) => existing.userId === item.userId))), enabled: eligibleOpen && permissions.canManageEmployees && selected > 0 });

  const invalidateLaboratory = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['laboratories'] }), queryClient.invalidateQueries({ queryKey: ['laboratory-details', selected] }),
      queryClient.invalidateQueries({ queryKey: ['default-laboratory'] }),
    ]);
  };
  const saveLaboratory = async (values: LaboratoryFormValues) => {
    setSaving(true);
    try {
      const saved = editing?.id ? await updateLaboratory(editing.id, values) : await createLaboratory(values);
      await invalidateLaboratory(); setLaboratoryFormDirty(false); setEditing(undefined); updateUrl({ laboratoryId: saved.id }); toast.success(editing?.id ? 'Лаборатория обновлена' : 'Лаборатория создана');
    } catch (error) { throw error; } finally { setSaving(false); }
  };
  const runConfirmation = async () => {
    if (!confirmAction || mutationBusy) return; setMutationBusy(true);
    try {
      if (confirmAction.type === 'DEFAULT') await setDefaultLaboratory(confirmAction.laboratory.id);
      if (confirmAction.type === 'ARCHIVE') await archiveLaboratory(confirmAction.laboratory.id);
      if (confirmAction.type === 'RESTORE') await restoreLaboratory(confirmAction.laboratory.id);
      if (confirmAction.type === 'DEACTIVATE') await deactivateLaboratoryEmployee(selected, confirmAction.employee.id);
      if (confirmAction.type === 'ACTIVATE') await activateLaboratoryEmployee(selected, confirmAction.employee.id);
      if (confirmAction.type === 'DEACTIVATE' || confirmAction.type === 'ACTIVATE') {
        await queryClient.invalidateQueries({ queryKey: ['laboratory-employees', selected] });
        await queryClient.invalidateQueries({ queryKey: ['eligible-employees', selected] });
      } else await invalidateLaboratory();
      toast.success({ DEFAULT: 'Лаборатория назначена основной', ARCHIVE: 'Лаборатория архивирована', RESTORE: 'Лаборатория восстановлена', DEACTIVATE: 'Сотрудник деактивирован', ACTIVATE: 'Сотрудник активирован' }[confirmAction.type]); setConfirmAction(null);
    } catch (error) { const parsed = parseLaboratoryApiError(error); toast.error(parsed.message); } finally { setMutationBusy(false); }
  };

  const openEmployee = (employee?: LaboratoryEmployee) => {
    if (!permissions.canManageEmployees) return;
    setEditingEmployee(employee || null);
    setEmployeeDraft(employee ? { userId: employee.userId, position: employee.position || '', employeeNumber: employee.employeeNumber || '', qualification: employee.qualification || '', canExecuteMeasurements: employee.canExecuteMeasurements, canApproveProtocols: employee.canApproveProtocols, canSignProtocols: employee.canSignProtocols } : { ...employeeDefaults });
    setEligibleOpen(!employee);
  };
  const saveEmployee = async () => {
    if (!employeeDraft || !permissions.canManageEmployees || mutationBusy) return;
    setMutationBusy(true);
    try {
      if (editingEmployee) await updateLaboratoryEmployee(selected, editingEmployee.id, employeeDraft); else await addLaboratoryEmployee(selected, employeeDraft);
      await queryClient.invalidateQueries({ queryKey: ['laboratory-employees', selected] }); await queryClient.invalidateQueries({ queryKey: ['eligible-employees', selected] });
      setEmployeeDraft(null); setEligibleOpen(false); toast.success(editingEmployee ? 'Сотрудник обновлён' : 'Сотрудник добавлен');
    } catch (error) { toast.error(parseLaboratoryApiError(error).message); } finally { setMutationBusy(false); }
  };
  const validateLogo = (file: File) => {
    if (!logoTypes.includes(file.type)) { setLogoError('Поддерживаются только PNG и JPEG'); return; }
    if (!file.size || file.size > logoMaxSize) { setLogoError('Максимальный размер логотипа — 2 МБ'); return; }
    setLogoError(''); setLogoFile(file); const url = URL.createObjectURL(file); setLogoPreview((current) => { if (current.startsWith('blob:')) URL.revokeObjectURL(current); return url; });
  };
  const uploadLogo = async () => {
    if (!logoFile || !laboratory || !permissions.canUploadLogo || mutationBusy) return; setMutationBusy(true);
    try { await uploadLaboratoryLogo(laboratory.id, logoFile); await queryClient.invalidateQueries({ queryKey: ['laboratory-details', selected] }); setLogoFile(null); setLogoPreview(''); toast.success('Логотип загружен'); }
    catch (error) { setLogoError(parseLaboratoryApiError(error).message); } finally { setMutationBusy(false); }
  };
  const deleteLogo = async () => {
    if (!laboratory || !permissions.canUploadLogo || mutationBusy) return; setMutationBusy(true);
    try { await removeLaboratoryLogo(laboratory.id); await queryClient.invalidateQueries({ queryKey: ['laboratory-details', selected] }); toast.success('Логотип удалён'); }
    catch (error) { setLogoError(parseLaboratoryApiError(error).message); } finally { setMutationBusy(false); }
  };
  const certificate = accreditationState(laboratory?.accreditationValidUntil, laboratory?.accreditationStatus);
  const stats = laboratory ? [['Сотрудники', laboratory.employeesCount], ['Протоколы', laboratory.protocolsCount], ['Средства измерений', laboratory.measurementDevicesCount], ['Журналы', laboratory.journalsCount]].filter(([, value]) => value !== undefined) : [];
  if (!permissions.canView && user) return <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 font-semibold text-amber-900">Недостаточно прав для просмотра настроек лаборатории</div>;
  const errorMessage = listQuery.error ? parseLaboratoryApiError(listQuery.error).message : '';

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-black text-slate-950">Лаборатории</h1><p className="text-sm text-slate-500">Настройки лабораторий, аттестатов и сотрудников.</p></div>{permissions.canCreate && <Button type="button" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> Создать лабораторию</Button>}</header>
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 xl:grid-cols-6">
      <label className="md:col-span-2"><span className="sr-only">Поиск</span><input aria-label="Поиск лаборатории" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Название, БИН, аттестат, адрес" className={inputClass} /></label>
      <select aria-label="Статус" value={status} onChange={(event) => updateUrl({ status: event.target.value, page: 0 })} className={inputClass}><option value="ACTIVE">Активные</option><option value="ARCHIVED">Архивные</option><option value="ALL">Все</option></select>
      <select aria-label="Статус аккредитации" value={accreditationFilter} onChange={(event) => updateUrl({ accreditationStatus: event.target.value || undefined, page: 0 })} className={inputClass}><option value="">Все аттестаты</option>{Object.entries(accreditationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <select aria-label="Сортировка" value={sort} onChange={(event) => updateUrl({ sort: event.target.value, page: 0 })} className={inputClass}><option value="updatedAt,desc">Сначала обновлённые</option><option value="name,asc">По названию</option><option value="accreditationValidUntil,asc">По сроку аттестата</option></select>
      <Button type="button" variant="secondary" onClick={() => { setSearchText(''); setParams(new URLSearchParams({ page: '0', size: String(size), status: 'ACTIVE' })); }}><RotateCcw className="h-4 w-4" /> Сбросить</Button>
    </div>
    {errorMessage && <div className="flex items-center justify-between rounded-xl bg-rose-50 p-4 text-rose-800"><span>Не удалось загрузить лаборатории: {errorMessage}</span><Button type="button" variant="secondary" onClick={() => listQuery.refetch()}>Повторить</Button></div>}
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-3">
        {listQuery.isLoading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />) : listQuery.data?.items.map((item) => <article key={item.id} className={`rounded-xl border bg-white p-4 ${selected === item.id ? 'border-eco-400 ring-2 ring-eco-100' : 'border-slate-200'}`}>
          <button type="button" className="w-full text-left focus:outline-none focus:ring-2 focus:ring-eco-500" onClick={() => updateUrl({ laboratoryId: item.id })}><div className="flex gap-2"><h2 className="flex-1 break-words font-black">{item.name}</h2>{item.defaultLaboratory && <span className="h-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">По умолчанию</span>}</div><p className="mt-2 break-words text-sm text-slate-600">{item.address || 'Адрес не указан'}</p><p className="mt-2 text-xs text-slate-600">Аттестат: {item.accreditationNumber || 'не указан'} · до {item.accreditationValidUntil || '—'}</p><p className="mt-1 text-xs text-slate-500">Обновлено: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('ru-RU') : '—'}</p><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">{accreditationLabels[item.accreditationStatus]}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs">Сотрудников: {item.activeEmployeesCount}/{item.employeesCount}</span><span className={`rounded-full px-2 py-1 text-xs ${item.archived ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.archived ? 'Архивная' : 'Активная'}</span></div></button>
        </article>)}
        {!listQuery.isLoading && !listQuery.data?.items.length && <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">Лаборатории не найдены</div>}
        {listQuery.data && <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm"><span className="mr-auto">Показано {listQuery.data.items.length ? page * size + 1 : 0}–{page * size + listQuery.data.items.length} из {listQuery.data.totalElements}</span><select aria-label="Строк на странице" value={size} onChange={(event) => updateUrl({ size: event.target.value, page: 0 })} className="rounded-lg border p-2">{pageSizes.map((value) => <option key={value}>{value}</option>)}</select><Button type="button" variant="secondary" disabled={listQuery.data.first} onClick={() => updateUrl({ page: Math.max(0, page - 1) })}>Назад</Button><Button type="button" variant="secondary" disabled={listQuery.data.last} onClick={() => updateUrl({ page: Math.min(listQuery.data.totalPages - 1, page + 1) })}>Далее</Button></div>}
      </aside>
      <main>
        {detailsQuery.isLoading ? <div className="grid animate-pulse gap-4 rounded-xl border bg-white p-5 md:grid-cols-2">{Array.from({ length: 10 }).map((_, index) => <div key={index} className="h-16 rounded-xl bg-slate-100" />)}</div> : laboratory ? <div className="space-y-5">
          <section className="rounded-xl border bg-white p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-black">{laboratory.name}</h2>{laboratory.defaultLaboratory && <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">По умолчанию</span>}<span className={`rounded-full px-2 py-1 text-xs font-bold ${laboratory.archived ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>{laboratory.archived ? 'Архивная' : 'Активная'}</span></div><p className="mt-2 text-sm text-slate-600">{laboratory.address || 'Адрес не указан'}</p><p className="mt-1 text-sm font-semibold">Аттестат: {accreditationLabels[laboratory.accreditationStatus]}</p>{certificate.status === 'EXPIRING' && <p className="mt-1 text-sm text-amber-700">Срок действия аттестата истекает через {certificate.daysLeft} дней</p>}{certificate.status === 'EXPIRED' && <p className="mt-1 text-sm text-rose-700">Срок действия аттестата истёк</p>}</div><div className="flex flex-wrap gap-2">{permissions.canEdit && <Button type="button" variant="secondary" onClick={() => setEditing(laboratory)}><Pencil className="h-4 w-4" /> Изменить</Button>}{permissions.canSetDefault && !laboratory.defaultLaboratory && <Button type="button" variant="secondary" onClick={() => setConfirmAction({ type: 'DEFAULT', laboratory })}><Star className="h-4 w-4" /> Сделать основной</Button>}{permissions.canArchive && <Button type="button" variant="secondary" onClick={() => setConfirmAction({ type: 'ARCHIVE', laboratory })}><Archive className="h-4 w-4" /> Архивировать</Button>}{permissions.canRestore && <Button type="button" onClick={() => setConfirmAction({ type: 'RESTORE', laboratory })}><RefreshCw className="h-4 w-4" /> Восстановить</Button>}</div></div></section>
          <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2"><h3 className="font-black md:col-span-2">Основные данные и аккредитация</h3>{[['Краткое название', laboratory.shortName], ['БИН', laboratory.bin], ['Город', laboratory.city], ['Телефон', laboratory.phone], ['Email', laboratory.email], ['Сайт', laboratory.website], ['Номер аттестата', laboratory.accreditationNumber], ['Дата начала', laboratory.accreditationValidFrom], ['Дата окончания', laboratory.accreditationValidUntil], ['Кем выдан', laboratory.accreditationIssuedBy]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="break-words font-semibold">{value || '—'}</p></div>)}</section>
          <section className="grid gap-4 rounded-xl border bg-white p-5 md:grid-cols-2"><h3 className="font-black md:col-span-2">Руководство</h3><div><p className="text-xs text-slate-500">Директор</p><p className="font-semibold">{laboratory.directorName || employees.find((item) => item.id === laboratory.directorEmployeeId)?.fullName || 'Не назначен'}</p>{laboratory.directorEmployeeId && !employees.some((item) => item.id === laboratory.directorEmployeeId && item.active) && <p className="mt-1 text-xs text-amber-700">Назначенный руководитель неактивен. Выберите другого сотрудника.</p>}</div><div><p className="text-xs text-slate-500">Заведующий лабораторией</p><p className="font-semibold">{laboratory.laboratoryHeadName || employees.find((item) => item.id === laboratory.headEmployeeId)?.fullName || 'Не назначен'}</p>{laboratory.headEmployeeId && !employees.some((item) => item.id === laboratory.headEmployeeId && item.active) && <p className="mt-1 text-xs text-amber-700">Назначенный руководитель неактивен. Выберите другого сотрудника.</p>}</div></section>
          {stats.length > 0 && <section className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value]) => <div key={String(label)} className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-xl font-black">{value}</p></div>)}</section>}
          <section className="rounded-xl border bg-white p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Сотрудники</h3><p className="text-sm text-slate-500">Для операций используется ID сотрудника лаборатории.</p></div><div className="flex gap-2"><select aria-label="Фильтр сотрудников" value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value as EmployeeFilter)} className="rounded-lg border p-2"><option value="ACTIVE">Активные</option><option value="INACTIVE">Неактивные</option><option value="ALL">Все</option></select>{permissions.canManageEmployees && <Button type="button" onClick={() => openEmployee()}><Plus className="h-4 w-4" /> Добавить сотрудника</Button>}</div></div>{employeesQuery.isLoading ? <p className="text-sm text-slate-500">Загрузка сотрудников</p> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Ф.И.О.', 'Должность', 'Email', 'Телефон', 'Табельный номер', 'Квалификация', 'Измерения', 'Утверждение', 'Подписание', 'Статус', 'Действия'].map((heading) => <th key={heading} className="p-3">{heading}</th>)}</tr></thead><tbody>{employees.map((employee) => <tr key={employee.id} className="border-t"><td className="p-3 font-bold">{employee.fullName}</td><td className="p-3">{employee.position || '—'}</td><td className="p-3">{employee.email || '—'}</td><td className="p-3">{employee.phone || '—'}</td><td className="p-3">{employee.employeeNumber || '—'}</td><td className="p-3">{employee.qualification || '—'}</td><td className="p-3">{employee.canExecuteMeasurements ? 'Да' : 'Нет'}</td><td className="p-3">{employee.canApproveProtocols ? 'Да' : 'Нет'}</td><td className="p-3">{employee.canSignProtocols ? 'Да' : 'Нет'}</td><td className="p-3">{employee.active ? 'Активен' : 'Неактивен'}</td><td className="p-3"><div className="flex gap-2">{permissions.canManageEmployees && <Button type="button" variant="secondary" className="px-3" aria-label={`Изменить ${employee.fullName}`} onClick={() => openEmployee(employee)}><Pencil className="h-4 w-4" /></Button>}{permissions.canManageEmployees && employee.active && <Button type="button" variant="secondary" onClick={() => setConfirmAction({ type: 'DEACTIVATE', employee })}><UserMinus className="h-4 w-4" /> Деактивировать</Button>}{permissions.canManageEmployees && !employee.active && <Button type="button" onClick={() => setConfirmAction({ type: 'ACTIVATE', employee })}><UserPlus className="h-4 w-4" /> Активировать</Button>}</div></td></tr>)}{!employees.length && <tr><td colSpan={11} className="p-8 text-center text-slate-500">Сотрудники не найдены</td></tr>}</tbody></table></div>}</section>
          <section className="rounded-xl border bg-white p-5"><h3 className="mb-3 font-black">Логотип и документы</h3><div className="grid gap-4 md:grid-cols-[200px_1fr]"><div className="flex h-36 items-center justify-center rounded-xl border bg-slate-50">{logoPreview || laboratory.logoUrl || laboratory.logoFileId ? <AuthenticatedImage src={logoPreview || laboratory.logoUrl || getLaboratoryLogoUrl(laboratory.id)} alt="Логотип лаборатории" className="h-full w-full object-contain p-3" fallback={<span className="text-sm text-slate-500">Логотип не загружен</span>} /> : <span className="text-sm text-slate-500">Логотип не загружен</span>}</div><div className="space-y-3">{permissions.canUploadLogo && <div className="rounded-xl border-2 border-dashed p-4" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) validateLogo(file); }}><p className="mb-2 text-sm">Перетащите PNG или JPEG сюда</p><input type="file" accept="image/png,image/jpeg" aria-label="Выбрать логотип" onChange={(event) => { const file = event.target.files?.[0]; if (file) validateLogo(file); }} /></div>}{logoError && <p className="text-sm text-rose-700">{logoError}</p>}<p className="text-xs text-slate-500">PNG, JPEG. Максимальный размер 2 МБ.</p><div className="flex gap-2">{permissions.canUploadLogo && logoFile && <Button type="button" disabled={mutationBusy} onClick={uploadLogo}>Загрузить логотип</Button>}{permissions.canUploadLogo && (laboratory.logoUrl || laboratory.logoFileId) && <Button type="button" variant="secondary" disabled={mutationBusy} onClick={deleteLogo}><Trash2 className="h-4 w-4" /> Удалить</Button>}</div></div></div></section>
        </div> : <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">Выберите лабораторию</div>}
      </main>
    </div>
    <Modal open={editing !== undefined} onClose={() => { if (!saving && (!laboratoryFormDirty || window.confirm('Есть несохранённые изменения. Закрыть форму?'))) { setLaboratoryFormDirty(false); setEditing(undefined); } }} title={editing?.id ? 'Изменить лабораторию' : 'Создать лабораторию'} size="xl" loading={saving}>{editing !== undefined && <LaboratoryForm initial={editing} employees={employees} busy={saving} canEditAccreditation={getLaboratoryPermissions(user, editing).canEditAccreditation} onDirtyChange={setLaboratoryFormDirty} onCancel={() => { setLaboratoryFormDirty(false); setEditing(undefined); }} onSave={saveLaboratory} />}</Modal>
    <Modal open={Boolean(employeeDraft)} onClose={() => { if (!mutationBusy) { setEmployeeDraft(null); setEligibleOpen(false); } }} title={editingEmployee ? 'Изменить сотрудника' : 'Добавить сотрудника'} size="lg" loading={mutationBusy}>{employeeDraft && <div className="space-y-4">{!editingEmployee && <label className="space-y-1 text-sm font-semibold"><span>Пользователь</span><select value={employeeDraft.userId || ''} onChange={(event) => setEmployeeDraft((current) => current ? { ...current, userId: event.target.value ? Number(event.target.value) : null } : current)} className={inputClass}>{eligibleQuery.isLoading && <option>Загрузка доступных сотрудников</option>}<option value="">Выберите пользователя</option>{eligibleQuery.data?.map((item) => <option key={item.id} value={item.userId}>{item.fullName}</option>)}</select>{!eligibleQuery.isLoading && eligibleQuery.data?.length === 0 && <span className="block text-xs text-slate-500">Нет доступных сотрудников для добавления</span>}{eligibleQuery.error && <span className="block text-xs text-rose-700">Не удалось загрузить список сотрудников</span>}</label>}<div className="grid gap-3 md:grid-cols-2">{(['position', 'employeeNumber', 'qualification'] as const).map((field) => <label key={field} className="space-y-1 text-sm font-semibold"><span>{{ position: 'Должность', employeeNumber: 'Табельный номер', qualification: 'Квалификация' }[field]}</span><input value={employeeDraft[field]} onChange={(event) => setEmployeeDraft((current) => current ? { ...current, [field]: event.target.value } : current)} className={inputClass} /></label>)}</div>{([['canExecuteMeasurements', 'Может выполнять измерения'], ['canApproveProtocols', 'Может утверждать протоколы'], ['canSignProtocols', 'Может подписывать протоколы']] as const).map(([field, label]) => <label key={field} className="flex gap-2 text-sm"><input type="checkbox" checked={employeeDraft[field]} onChange={(event) => setEmployeeDraft((current) => current ? { ...current, [field]: event.target.checked } : current)} /> {label}</label>)}<div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setEmployeeDraft(null)}>Отмена</Button><Button type="button" disabled={mutationBusy || !employeeDraft.userId} onClick={saveEmployee}>Сохранить</Button></div></div>}</Modal>
    <Modal open={Boolean(confirmAction)} onClose={() => { if (!mutationBusy) setConfirmAction(null); }} title={confirmAction?.type === 'DEFAULT' ? `Использовать «${'laboratory' in (confirmAction || {}) ? confirmAction.laboratory.name : ''}» как лабораторию по умолчанию?` : confirmAction?.type === 'ARCHIVE' ? `Архивировать лабораторию «${'laboratory' in (confirmAction || {}) ? confirmAction.laboratory.name : ''}»?` : confirmAction?.type === 'DEACTIVATE' ? `Деактивировать сотрудника «${'employee' in (confirmAction || {}) ? confirmAction.employee.fullName : ''}»?` : 'Подтвердите действие'}><p className="text-sm text-slate-600">{confirmAction?.type === 'DEFAULT' ? 'Эта лаборатория будет автоматически выбираться при создании новых протоколов.' : confirmAction?.type === 'ARCHIVE' ? 'Лаборатория станет недоступна для новых протоколов, журналов и назначения сотрудников. Существующие данные сохранятся.' : confirmAction?.type === 'DEACTIVATE' ? 'Сотрудник перестанет быть доступен для назначения в новые протоколы. Старые протоколы сохранят его данные.' : 'Изменение будет применено после подтверждения.'}</p><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={mutationBusy} onClick={() => setConfirmAction(null)}>Отмена</Button><Button type="button" disabled={mutationBusy} onClick={runConfirmation}>{mutationBusy ? 'Выполнение...' : 'Подтвердить'}</Button></div></Modal>
  </div>;
};
export default LaboratorySettingsPage;
