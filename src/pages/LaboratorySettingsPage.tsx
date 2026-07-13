import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ImagePlus, Pencil, Plus, RefreshCw, Save, Star, Trash2, UserCheck, UserMinus } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import AuthenticatedImage from '../components/ui/AuthenticatedImage';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  accreditationState,
  deactivateLaboratoryEmployee,
  deleteLaboratoryLogo,
  getEligibleLaboratoryEmployees,
  getLaboratories,
  getLaboratory,
  getLaboratoryEmployees,
  laboratoryLogoUrl,
  saveLaboratory,
  saveLaboratoryEmployee,
  setLaboratoryActive,
  uploadLaboratoryLogo,
} from '../services/laboratorySettingsService';
import type { LaboratoryEmployee, LaboratoryProfile, LaboratorySummary } from '../types/protocols';

type EmployeeDraft = {
  id?: string;
  userId?: string;
  fullName: string;
  position: string;
  email: string;
  role: string;
  active: boolean;
};

const emptyProfile = (): LaboratoryProfile => ({
  id: '',
  name: '',
  legalName: '',
  bin: '',
  address: '',
  phone: '',
  email: '',
  accreditationNumber: '',
  accreditationIssuedAt: '',
  accreditationValidUntil: '',
  directorId: '',
  directorName: '',
  laboratoryHeadId: '',
  laboratoryHeadName: '',
  logoUrl: '',
  standardNote: '',
  isDefault: false,
  active: true,
  employees: [],
});

const emptyEmployee = (): EmployeeDraft => ({
  fullName: '',
  position: '',
  email: '',
  role: 'LABORATORY',
  active: true,
});

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-5 shadow-sm';
const LOGO_MAX_SIZE = 2 * 1024 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg'];

const toEmployeeValue = (employee: LaboratoryEmployee) => employee.id;
const selectedEmployeeName = (employees: LaboratoryEmployee[], id?: string) =>
  employees.find((item) => item.id === id)?.fullName || '';
const humanDate = (value?: string) => {
  if (!value) return 'не указано';
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const Field = ({ label, error, children, wide = false }: { label: string; error?: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={`space-y-1.5 text-sm font-semibold text-slate-700 ${wide ? 'md:col-span-2' : ''}`}>
    <span>{label}</span>
    {children}
    {error && <span className="block text-xs font-bold text-rose-700">{error}</span>}
  </label>
);

const LaboratorySettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [summaries, setSummaries] = useState<LaboratorySummary[]>([]);
  const [employees, setEmployees] = useState<LaboratoryEmployee[]>([]);
  const [eligibleEmployees, setEligibleEmployees] = useState<LaboratoryEmployee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [profile, setProfile] = useState<LaboratoryProfile>(emptyProfile);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [isLoadingLaboratories, setIsLoadingLaboratories] = useState(true);
  const [isSavingLaboratory, setIsSavingLaboratory] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isDeletingLogo, setIsDeletingLogo] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [employeeError, setEmployeeError] = useState('');
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const isHead = user?.role === 'HEAD';
  const canEdit = isAdmin || isHead;

  const activeEmployees = useMemo(() => employees.filter((employee) => employee.active), [employees]);
  const certificate = accreditationState(profile.accreditationValidUntil);

  const markDirty = () => setDirty(true);
  const update = <K extends keyof LaboratoryProfile>(key: K, value: LaboratoryProfile[K]) => {
    setProfile((current) => ({ ...current, [key]: value }));
    markDirty();
  };

  const confirmDiscard = () => !dirty || window.confirm('Есть несохраненные изменения. Продолжить без сохранения?');

  const loadEmployees = async (laboratoryId: string) => {
    setIsLoadingEmployees(true);
    try {
      const staff = laboratoryId ? await getLaboratoryEmployees(laboratoryId, { includeInactive: true }) : [];
      setEmployees(staff);
      return staff;
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const load = async (preferredId?: string, options: { skipDirtyCheck?: boolean } = {}) => {
    if (!options.skipDirtyCheck && !confirmDiscard()) return;
    setIsLoadingLaboratories(true);
    setError('');
    try {
      const items = await getLaboratories();
      setSummaries(items);
      try {
        setEligibleEmployees(await getEligibleLaboratoryEmployees());
      } catch (usersError) {
        toast.error('Не удалось загрузить пользователей системы', usersError instanceof Error ? usersError.message : undefined);
      }
      const id = preferredId || selectedId || items.find((item) => item.isDefault)?.id || items[0]?.id || '';
      setSelectedId(id);
      if (id) {
        const [nextProfile, staff] = await Promise.all([getLaboratory(id), getLaboratoryEmployees(id, { includeInactive: true })]);
        setProfile(nextProfile);
        setEmployees(staff);
      } else {
        setProfile(emptyProfile());
        setEmployees([]);
      }
      setLogoFile(null);
      setErrors({});
      setDirty(false);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'API настроек лаборатории недоступен.';
      setError(message);
      toast.error('Не удалось загрузить настройки лаборатории', message);
    } finally {
      setIsLoadingLaboratories(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!logoFile) {
      const logoUrl = profile.logoUrl || (profile.id ? laboratoryLogoUrl(profile.id) : '');
      setLogoPreview(logoUrl ? `${logoUrl}${logoUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(profile.updatedAt || 'current')}` : '');
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile, profile.logoUrl]);

  const selectLaboratory = async (id: string) => {
    if (id === selectedId) return;
    if (!confirmDiscard()) return;
    setSelectedId(id);
    setIsLoadingLaboratories(true);
    setError('');
    try {
      const [nextProfile, staff] = await Promise.all([getLaboratory(id), getLaboratoryEmployees(id, { includeInactive: true })]);
      setProfile(nextProfile);
      setEmployees(staff);
      setLogoFile(null);
      setErrors({});
      setDirty(false);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'Не удалось загрузить карточку лаборатории.';
      setError(message);
      toast.error('Не удалось загрузить лабораторию', message);
    } finally {
      setIsLoadingLaboratories(false);
    }
  };

  const createLaboratory = () => {
    if (!confirmDiscard()) return;
    setSelectedId('');
    setProfile(emptyProfile());
    setEmployees([]);
    setLogoFile(null);
    setErrors({});
    setDirty(true);
  };

  const deactivateLaboratory = async (laboratory: LaboratorySummary) => {
    if (!isAdmin || deactivatingId || !laboratory.active) return;
    if (!window.confirm('Лаборатория станет недоступна для выбора при создании новых протоколов. Продолжить?')) return;
    setDeactivatingId(laboratory.id);
    try {
      const updated = await setLaboratoryActive(laboratory.id, false);
      setSummaries((current) => current.map((item) => item.id === laboratory.id ? { ...item, active: false } : item));
      if (selectedId === laboratory.id) setProfile((current) => ({ ...current, ...updated, active: false }));
      toast.success('Лаборатория деактивирована');
    } catch (deactivateError) {
      toast.error('Не удалось деактивировать лабораторию', deactivateError instanceof Error ? deactivateError.message : undefined);
    } finally {
      setDeactivatingId('');
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!profile.name.trim()) next.name = 'Укажите название лаборатории.';
    if (profile.bin && !/^\d{12}$/.test(profile.bin.trim())) next.bin = 'БИН должен содержать 12 цифр.';
    if (!profile.address.trim()) next.address = 'Укажите адрес.';
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) next.email = 'Проверьте email.';
    if (profile.accreditationIssuedAt && profile.accreditationValidUntil && profile.accreditationIssuedAt > profile.accreditationValidUntil) next.accreditationValidUntil = 'Срок действия не может быть раньше даты выдачи.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || !validate()) return;
    setIsSavingLaboratory(true);
    try {
      let saved = await saveLaboratory({
        ...profile,
        directorName: selectedEmployeeName(activeEmployees, profile.directorId) || profile.directorName,
        laboratoryHeadName: selectedEmployeeName(activeEmployees, profile.laboratoryHeadId) || profile.laboratoryHeadName,
      });
      if (logoFile) {
        setIsUploadingLogo(true);
        try {
          const logoProfile = await uploadLaboratoryLogo(saved.id, logoFile);
          saved = {
            ...saved,
            logoUrl: logoProfile.logoUrl || saved.logoUrl,
            updatedAt: logoProfile.updatedAt || saved.updatedAt,
          };
        } catch (logoError) {
          toast.warning('Настройки сохранены, но логотип не удалось загрузить', logoError instanceof Error ? logoError.message : undefined);
        } finally {
          setIsUploadingLogo(false);
        }
      }
      setProfile(saved);
      setSelectedId(saved.id);
      setSummaries((current) => {
        const summary = { ...saved, employees: [] };
        const normalized = saved.isDefault ? current.map((item) => ({ ...item, isDefault: item.id === saved.id })) : current;
        const index = normalized.findIndex((item) => item.id === saved.id);
        if (index >= 0) return normalized.map((item, itemIndex) => (itemIndex === index ? summary : item));
        return [...normalized, summary];
      });
      setLogoFile(null);
      setDirty(false);
      toast.success('Карточка лаборатории сохранена');
    } catch (saveError) {
      toast.error('Не удалось сохранить лабораторию', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setIsSavingLaboratory(false);
    }
  };

  const onLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      markDirty();
      return;
    }
    if (file.size === 0) {
      event.target.value = '';
      toast.warning('Выбран пустой файл.');
      return;
    }
    if (!LOGO_TYPES.includes(file.type)) {
      event.target.value = '';
      toast.warning('Поддерживаются только PNG, JPG и JPEG.');
      return;
    }
    if (file.size > LOGO_MAX_SIZE) {
      event.target.value = '';
      toast.warning('Размер логотипа не должен превышать 2 МБ.');
      return;
    }
    setLogoFile(file);
    markDirty();
  };

  const removeLogo = async () => {
    if (!profile.id || isDeletingLogo || !window.confirm('Удалить логотип лаборатории?')) return;
    setIsDeletingLogo(true);
    try {
      await deleteLaboratoryLogo(profile.id);
      setLogoFile(null);
      setLogoPreview('');
      const refreshed = await getLaboratory(profile.id);
      setProfile({ ...refreshed, logoUrl: '' });
      setDirty(false);
      toast.success('Логотип удалён');
    } catch (logoError) {
      toast.error('Не удалось удалить логотип', logoError instanceof Error ? logoError.message : undefined);
    } finally {
      setIsDeletingLogo(false);
    }
  };

  const openEmployeeModal = (employee?: LaboratoryEmployee) => {
    setEmployeeError('');
    setEmployeeDraft(employee
      ? {
        id: employee.id,
        userId: employee.userId,
        fullName: employee.fullName,
        position: employee.position || '',
        email: employee.email || '',
        role: employee.role || 'LABORATORY',
        active: employee.active,
      }
      : emptyEmployee());
  };

  const saveEmployee = async (event: FormEvent) => {
    event.preventDefault();
    if (!employeeDraft || !profile.id) {
      setEmployeeError('Сначала сохраните карточку лаборатории.');
      return;
    }
    if (!employeeDraft.fullName.trim()) {
      setEmployeeError('Укажите ФИО сотрудника.');
      return;
    }
    if (employeeDraft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employeeDraft.email)) {
      setEmployeeError('Проверьте email сотрудника.');
      return;
    }
    setIsSavingEmployee(true);
    setEmployeeError('');
    try {
      await saveLaboratoryEmployee(profile.id, employeeDraft);
      await loadEmployees(profile.id);
      setEmployeeDraft(null);
      toast.success('Сотрудник лаборатории сохранен');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Не удалось сохранить сотрудника.';
      setEmployeeError(message);
      toast.error('Не удалось сохранить сотрудника', message);
    } finally {
      setIsSavingEmployee(false);
    }
  };

  const deactivateEmployee = async (employee: LaboratoryEmployee) => {
    if (!profile.id || !window.confirm(`Деактивировать сотрудника "${employee.fullName}"?`)) return;
    try {
      await deactivateLaboratoryEmployee(profile.id, employee.id);
      await loadEmployees(profile.id);
      if (profile.directorId === employee.id) {
        update('directorId', '');
        update('directorName', '');
      }
      if (profile.laboratoryHeadId === employee.id) {
        update('laboratoryHeadId', '');
        update('laboratoryHeadName', '');
      }
      toast.success('Сотрудник деактивирован');
    } catch (deactivateError) {
      toast.error('Не удалось деактивировать сотрудника', deactivateError instanceof Error ? deactivateError.message : undefined);
    }
  };

  const assignRole = (employee: LaboratoryEmployee, role: 'director' | 'head') => {
    const value = toEmployeeValue(employee);
    if (role === 'director') {
      update('directorId', value);
      update('directorName', employee.fullName);
      toast.success('Директор выбран. Не забудьте сохранить карточку.');
      return;
    }
    update('laboratoryHeadId', value);
    update('laboratoryHeadName', employee.fullName);
    toast.success('Заведующий выбран. Не забудьте сохранить карточку.');
  };

  const selectManager = (role: 'director' | 'head', employeeId: string) => {
    const employee = activeEmployees.find((item) => item.id === employeeId);
    if (role === 'director') {
      update('directorId', employee?.id || '');
      update('directorName', employee?.fullName || '');
      return;
    }
    update('laboratoryHeadId', employee?.id || '');
    update('laboratoryHeadName', employee?.fullName || '');
  };

  const changeActive = (active: boolean) => {
    if (!active && profile.active && !window.confirm('Лаборатория станет недоступна для выбора при создании новых протоколов. Продолжить?')) return;
    update('active', active);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Настройки</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Лаборатории</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-500">Данные лаборатории, аттестата, сотрудников и логотипа используются в snapshot при создании протокола.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Button type="button" variant="secondary" onClick={createLaboratory}><Plus className="h-4 w-4" /> Добавить лабораторию</Button>}
          <Button type="button" variant="secondary" onClick={() => load()} disabled={isLoadingLaboratories}><RefreshCw className="h-4 w-4" /> Обновить</Button>
          {canEdit && <Button type="submit" form="laboratory-settings-form" disabled={isSavingLaboratory || isLoadingLaboratories || !dirty}><Save className="h-4 w-4" /> Сохранить</Button>}
        </div>
      </header>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      {dirty && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Есть несохраненные изменения.</div>}
      {!profile.directorId && !isLoadingLaboratories && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Директор не выбран. Выберите сотрудника в карточке или добавьте его в блоке сотрудников.</div>}
      {!profile.laboratoryHeadId && !isLoadingLaboratories && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Заведующий лабораторией не выбран. Протоколы будут создаваться без подписи заведующего в snapshot.</div>}
      {certificate.status === 'EXPIRED' && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">Аттестат истек {humanDate(profile.accreditationValidUntil)}. Создание или подписание протокола может быть заблокировано бизнес-логикой backend.</div>}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <aside className={panelClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-black text-slate-900">Список лабораторий</h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">{summaries.length}</span>
          </div>
          {isLoadingLaboratories ? <div className="space-y-2">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div> : (
            <div className="space-y-2">
              {summaries.map((item) => {
                const active = item.id === selectedId;
                return (
                  <div key={item.id} className={`rounded-xl border p-3 transition ${active ? 'border-eco-300 bg-eco-50' : 'border-slate-200 bg-white'}`}>
                    <button type="button" onClick={() => selectLaboratory(item.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-slate-900">{item.name || 'Без названия'}</p>
                        {item.isDefault && <Star className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{item.accreditationNumber || 'Аттестат не указан'}</p>
                      <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{item.active ? 'Активна' : 'Неактивна'}</p>
                    </button>
                    <div className="mt-3 flex gap-2 border-t border-slate-200 pt-3">
                      {canEdit && <Button type="button" variant="secondary" className="flex-1 px-3 py-2 text-xs" onClick={() => selectLaboratory(item.id)} disabled={isLoadingLaboratories || Boolean(deactivatingId)}><Pencil className="h-3.5 w-3.5" /> Редактировать</Button>}
                      {isAdmin && item.active && <Button type="button" variant="ghost" className="px-3 py-2 text-xs text-rose-700 hover:bg-rose-50" onClick={() => deactivateLaboratory(item)} disabled={isLoadingLaboratories || Boolean(deactivatingId)}>{deactivatingId === item.id ? 'Деактивация...' : 'Деактивировать'}</Button>}
                    </div>
                  </div>
                );
              })}
              {!summaries.length && <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">Лаборатории еще не созданы.</div>}
            </div>
          )}
        </aside>

        {isLoadingLaboratories ? <div className="grid animate-pulse gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-16 rounded-xl bg-slate-100" />)}</div> : (
          <form id="laboratory-settings-form" onSubmit={submit} className="space-y-5">
            <section className={panelClass}>
              <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 className="h-5 w-5 text-eco-700" /> Карточка лаборатории</h2>
                  <p className="mt-1 text-sm text-slate-500">{canEdit ? 'Заполните реквизиты, аттестат и ответственных сотрудников.' : 'Режим просмотра.'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {certificate.status === 'VALID' && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Аттестат действует до {humanDate(profile.accreditationValidUntil)}</span>}
                  {certificate.status === 'EXPIRING' && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> Истекает через {certificate.daysLeft} дн.</span>}
                  {certificate.status === 'EXPIRED' && <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4" /> Аттестат истек</span>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Название лаборатории" error={errors.name}><input disabled={!canEdit} value={profile.name} onChange={(e) => update('name', e.target.value)} className={inputClass} /></Field>
                <Field label="Юридическое название" error={errors.legalName}><input disabled={!isAdmin} value={profile.legalName || ''} onChange={(e) => update('legalName', e.target.value)} className={inputClass} /></Field>
                <Field label="БИН" error={errors.bin}><input disabled={!isAdmin} inputMode="numeric" value={profile.bin} onChange={(e) => update('bin', e.target.value.replace(/\D/g, '').slice(0, 12))} className={inputClass} /></Field>
                <Field label="Адрес" error={errors.address}><input disabled={!canEdit} value={profile.address} onChange={(e) => update('address', e.target.value)} className={inputClass} /></Field>
                <Field label="Телефон"><input disabled={!canEdit} value={profile.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} /></Field>
                <Field label="Email" error={errors.email}><input disabled={!canEdit} type="email" value={profile.email} onChange={(e) => update('email', e.target.value)} className={inputClass} /></Field>
                <Field label="Номер аттестата" error={errors.accreditationNumber}><input disabled={!isAdmin} value={profile.accreditationNumber || ''} onChange={(e) => update('accreditationNumber', e.target.value)} className={inputClass} /></Field>
                <Field label="Дата выдачи" error={errors.accreditationIssuedAt}><input disabled={!isAdmin} type="date" value={profile.accreditationIssuedAt || ''} onChange={(e) => update('accreditationIssuedAt', e.target.value)} className={inputClass} /></Field>
                <Field label="Срок действия" error={errors.accreditationValidUntil}><input disabled={!isAdmin} type="date" value={profile.accreditationValidUntil || ''} onChange={(e) => update('accreditationValidUntil', e.target.value)} className={inputClass} /></Field>
                <Field label="Директор" error={errors.directorId}><select disabled={!isAdmin || !profile.id} value={profile.directorId || ''} onChange={(e) => selectManager('director', e.target.value)} className={inputClass}><option value="">Не выбран</option>{activeEmployees.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.position || 'сотрудник'}</option>)}</select></Field>
                <Field label="Заведующий" error={errors.laboratoryHeadId}><select disabled={!canEdit || !profile.id} value={profile.laboratoryHeadId || ''} onChange={(e) => selectManager('head', e.target.value)} className={inputClass}><option value="">Не выбран</option>{activeEmployees.map((item) => <option key={item.id} value={item.id}>{item.fullName} · {item.position || 'сотрудник'}</option>)}</select></Field>
                <Field label="Стандартное примечание" wide><textarea disabled={!canEdit} rows={4} value={profile.standardNote || ''} onChange={(e) => update('standardNote', e.target.value)} className={inputClass} /></Field>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="flex h-32 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  <AuthenticatedImage src={logoPreview} alt="Логотип лаборатории" className="h-full w-full object-contain p-3" fallback={<ImagePlus className="h-8 w-8 text-slate-300" />} />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-bold text-slate-700">Логотип</p>
                  <input disabled={!isAdmin} type="file" accept="image/png,image/jpeg" onChange={onLogoChange} className={inputClass} />
                  {profile.id && (profile.logoUrl || logoPreview) && (
                    <Button type="button" variant="ghost" className="text-rose-700 hover:bg-rose-50" onClick={removeLogo} disabled={!isAdmin || isDeletingLogo || isUploadingLogo}>
                      <Trash2 className="h-4 w-4" /> {isDeletingLogo ? 'Удаление...' : 'Удалить логотип'}
                    </Button>
                  )}
                  <p className="text-xs font-semibold text-slate-500">PNG, JPG или JPEG, до 2 МБ. Preview обновится сразу, файл отправится после сохранения.</p>
                  <div className="flex flex-wrap gap-5">
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={!isAdmin} type="checkbox" checked={profile.isDefault} onChange={(e) => update('isDefault', e.target.checked)} /> Лаборатория по умолчанию</label>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={!isAdmin} type="checkbox" checked={profile.active} onChange={(e) => changeActive(e.target.checked)} /> Активна</label>
                  </div>
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Сотрудники лаборатории</h2>
                  <p className="mt-1 text-sm text-slate-500">Исполнители, директор и заведующий выбираются из активных сотрудников.</p>
                </div>
                {canEdit && <Button type="button" variant="secondary" onClick={() => openEmployeeModal()} disabled={!profile.id || isLoadingEmployees}><Plus className="h-4 w-4" /> Добавить сотрудника</Button>}
              </div>
              {!profile.id && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Сначала сохраните лабораторию, затем добавьте сотрудников.</div>}
              {isLoadingEmployees && <p className="mb-4 text-sm font-semibold text-slate-500">Загрузка сотрудников...</p>}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-[980px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {['ФИО', 'Должность', 'Email', 'Роль', 'Активен', 'Действия'].map((heading) => <th key={heading} className="px-3 py-3">{heading}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {employees.map((employee) => (
                      <tr key={employee.id} className="align-top">
                        <td className="px-3 py-3 font-bold text-slate-900">{employee.fullName}</td>
                        <td className="px-3 py-3">{employee.position || '—'}</td>
                        <td className="px-3 py-3">{employee.email || '—'}</td>
                        <td className="px-3 py-3">{employee.role || '—'}</td>
                        <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-xs font-bold ${employee.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{employee.active ? 'Да' : 'Нет'}</span></td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" className="px-3 py-2" onClick={() => openEmployeeModal(employee)} disabled={!canEdit}><Pencil className="h-4 w-4" /> Редактировать</Button>
                            <Button type="button" variant="secondary" className="px-3 py-2" onClick={() => assignRole(employee, 'head')} disabled={!canEdit || !employee.active}><UserCheck className="h-4 w-4" /> Сделать заведующим</Button>
                            <Button type="button" variant="secondary" className="px-3 py-2" onClick={() => assignRole(employee, 'director')} disabled={!isAdmin || !employee.active}><Star className="h-4 w-4" /> Сделать директором</Button>
                            <Button type="button" variant="ghost" className="px-3 py-2 text-rose-700 hover:bg-rose-50" onClick={() => deactivateEmployee(employee)} disabled={!canEdit || !employee.active}><UserMinus className="h-4 w-4" /> Деактивировать</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!employees.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">Сотрудники лаборатории еще не добавлены.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {canEdit && <div className="sticky bottom-4 flex justify-end"><Button type="submit" disabled={isSavingLaboratory || !dirty}><Save className="h-4 w-4" /> {isSavingLaboratory ? 'Сохранение...' : 'Сохранить'}</Button></div>}
          </form>
        )}
      </div>

      <Modal open={Boolean(employeeDraft)} onClose={() => setEmployeeDraft(null)} title={employeeDraft?.id ? 'Редактировать сотрудника' : 'Добавить сотрудника'} size="lg" loading={isSavingEmployee}>
        {employeeDraft && (
          <form onSubmit={saveEmployee} className="space-y-4">
            {employeeError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{employeeError}</div>}
            {!employeeDraft.id && eligibleEmployees.length > 0 && <label className="space-y-1.5 text-sm font-bold text-slate-700">Выбрать из пользователей системы
              <select value={employeeDraft.userId || ''} onChange={(event) => {
                const selected = eligibleEmployees.find((item) => toEmployeeValue(item) === event.target.value);
                setEmployeeDraft((current) => selected && current ? { ...current, userId: toEmployeeValue(selected), fullName: selected.fullName, position: selected.position || current.position, email: selected.email || current.email, role: selected.role || current.role } : current);
              }} className={inputClass}>
                <option value="">Заполнить вручную</option>
                {eligibleEmployees.map((employee) => <option key={employee.id} value={toEmployeeValue(employee)}>{employee.fullName} · {employee.email || employee.position || 'пользователь'}</option>)}
              </select>
            </label>}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="ФИО"><input value={employeeDraft.fullName} onChange={(event) => setEmployeeDraft({ ...employeeDraft, fullName: event.target.value })} className={inputClass} /></Field>
              <Field label="Должность"><input value={employeeDraft.position} onChange={(event) => setEmployeeDraft({ ...employeeDraft, position: event.target.value })} className={inputClass} /></Field>
              <Field label="Email"><input type="email" value={employeeDraft.email} onChange={(event) => setEmployeeDraft({ ...employeeDraft, email: event.target.value })} className={inputClass} /></Field>
              <Field label="Роль"><input value={employeeDraft.role} onChange={(event) => setEmployeeDraft({ ...employeeDraft, role: event.target.value })} className={inputClass} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={employeeDraft.active} onChange={(event) => setEmployeeDraft({ ...employeeDraft, active: event.target.checked })} /> Активен</label>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setEmployeeDraft(null)}>Отмена</Button>
              <Button type="submit" disabled={isSavingEmployee}>Сохранить сотрудника</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default LaboratorySettingsPage;
