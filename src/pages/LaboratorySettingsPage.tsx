import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ImagePlus, Plus, RefreshCw, Save } from 'lucide-react';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  accreditationState,
  getEligibleLaboratoryEmployees,
  getLaboratories,
  getLaboratory,
  saveLaboratory,
  uploadLaboratoryLogo,
} from '../services/laboratorySettingsService';
import type { LaboratoryEmployee, LaboratoryProfile, LaboratorySummary } from '../types/protocols';

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
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const Field = ({ label, error, children, wide = false }: { label: string; error?: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={`space-y-1.5 text-sm font-semibold text-slate-700 ${wide ? 'md:col-span-2' : ''}`}>
    <span>{label}</span>{children}{error && <span className="block text-xs font-bold text-rose-700">{error}</span>}
  </label>
);

const LaboratorySettingsPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [summaries, setSummaries] = useState<LaboratorySummary[]>([]);
  const [employees, setEmployees] = useState<LaboratoryEmployee[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [profile, setProfile] = useState<LaboratoryProfile>(emptyProfile);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isAdmin = user?.role === 'ADMIN';
  const isHead = user?.role === 'HEAD';
  const canEdit = isAdmin || isHead;

  const load = async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const [items, staff] = await Promise.all([getLaboratories(), getEligibleLaboratoryEmployees()]);
      setSummaries(items);
      setEmployees(staff.filter((employee) => employee.active));
      const id = preferredId || selectedId || items.find((item) => item.isDefault)?.id || items[0]?.id || '';
      setSelectedId(id);
      setProfile(id ? await getLaboratory(id) : emptyProfile());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'API настроек лаборатории недоступен.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectLaboratory = async (id: string) => {
    setSelectedId(id);
    setLoading(true);
    setError('');
    try {
      setProfile(await getLaboratory(id));
      setLogoFile(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить карточку лаборатории.');
    } finally {
      setLoading(false);
    }
  };

  const update = <K extends keyof LaboratoryProfile>(key: K, value: LaboratoryProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!profile.name.trim()) next.name = 'Укажите название лаборатории.';
    if (!profile.legalName?.trim()) next.legalName = 'Укажите юридическое название.';
    if (!/^\d{12}$/.test(profile.bin.trim())) next.bin = 'БИН должен содержать 12 цифр.';
    if (!profile.address.trim()) next.address = 'Укажите адрес.';
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) next.email = 'Проверьте email.';
    if (!profile.accreditationNumber?.trim()) next.accreditationNumber = 'Укажите номер аттестата.';
    if (profile.accreditationIssuedAt && profile.accreditationValidUntil && profile.accreditationIssuedAt > profile.accreditationValidUntil) next.accreditationValidUntil = 'Срок действия не может быть раньше даты выдачи.';
    if (!profile.accreditationValidUntil) next.accreditationValidUntil = 'Укажите срок действия.';
    if (!profile.laboratoryHeadId) next.laboratoryHeadId = 'Выберите заведующего лабораторией.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit || !validate()) return;
    setSaving(true);
    try {
      let saved = await saveLaboratory({
        ...profile,
        directorName: employees.find((item) => item.id === profile.directorId || item.userId === profile.directorId)?.fullName || profile.directorName,
        laboratoryHeadName: employees.find((item) => item.id === profile.laboratoryHeadId || item.userId === profile.laboratoryHeadId)?.fullName || profile.laboratoryHeadName,
      });
      if (logoFile) saved = await uploadLaboratoryLogo(saved.id, logoFile);
      setProfile(saved);
      setSelectedId(saved.id);
      setLogoFile(null);
      toast.success('Карточка лаборатории сохранена');
      await load(saved.id);
    } catch (saveError) {
      toast.error('Не удалось сохранить лабораторию', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const certificate = accreditationState(profile.accreditationValidUntil);
  const logoPreview = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : profile.logoUrl, [logoFile, profile.logoUrl]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Настройки</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Лаборатория</h1>
          <p className="mt-2 text-sm text-slate-500">Эти данные backend фиксирует в snapshot при создании протокола.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <Button type="button" variant="secondary" onClick={() => { setSelectedId(''); setProfile(emptyProfile()); setLogoFile(null); }}><Plus className="h-4 w-4" /> Добавить лабораторию</Button>}
          <Button type="button" variant="secondary" onClick={() => load()} disabled={loading}><RefreshCw className="h-4 w-4" /> Обновить</Button>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}
      {!loading && summaries.length > 1 && !summaries.some((item) => item.isDefault) && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">Лаборатория по умолчанию не выбрана. Новые протоколы потребуют ручного выбора лаборатории.</div>}
      {summaries.length > 1 && <label className="block max-w-xl text-sm font-bold text-slate-700">Лаборатория
        <select value={selectedId} onChange={(event) => selectLaboratory(event.target.value)} className={`${inputClass} mt-2`}>
          {summaries.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · по умолчанию' : ''}</option>)}
        </select>
      </label>}

      {loading ? <div className="grid animate-pulse gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">{Array.from({ length: 12 }).map((_, index) => <div key={index} className="h-16 rounded-xl bg-slate-100" />)}</div> : (
        <form onSubmit={submit} className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 className="h-5 w-5 text-eco-700" /> Карточка лаборатории</h2>
                <p className="mt-1 text-sm text-slate-500">{canEdit ? 'Доступно сохранение разрешённых полей.' : 'Режим просмотра.'}</p>
              </div>
              {certificate.status === 'VALID' && <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Аттестат действует</span>}
              {certificate.status === 'EXPIRING' && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><AlertTriangle className="h-4 w-4" /> Закончится через {certificate.daysLeft} дн.</span>}
              {certificate.status === 'EXPIRED' && <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4" /> Аттестат истёк</span>}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название лаборатории" error={errors.name}><input disabled={!canEdit} value={profile.name} onChange={(e) => update('name', e.target.value)} className={inputClass} /></Field>
              <Field label="Юридическое название" error={errors.legalName}><input disabled={!isAdmin} value={profile.legalName || ''} onChange={(e) => update('legalName', e.target.value)} className={inputClass} /></Field>
              <Field label="БИН" error={errors.bin}><input disabled={!isAdmin} inputMode="numeric" value={profile.bin} onChange={(e) => update('bin', e.target.value.replace(/\D/g, '').slice(0, 12))} className={inputClass} /></Field>
              <Field label="Адрес" error={errors.address}><input disabled={!canEdit} value={profile.address} onChange={(e) => update('address', e.target.value)} className={inputClass} /></Field>
              <Field label="Телефон"><input disabled={!canEdit} value={profile.phone} onChange={(e) => update('phone', e.target.value)} className={inputClass} /></Field>
              <Field label="Email" error={errors.email}><input disabled={!canEdit} type="email" value={profile.email} onChange={(e) => update('email', e.target.value)} className={inputClass} /></Field>
              <Field label="Номер аттестата" error={errors.accreditationNumber}><input disabled={!isAdmin} value={profile.accreditationNumber || ''} onChange={(e) => update('accreditationNumber', e.target.value)} className={inputClass} /></Field>
              <Field label="Дата выдачи"><input disabled={!isAdmin} type="date" value={profile.accreditationIssuedAt} onChange={(e) => update('accreditationIssuedAt', e.target.value)} className={inputClass} /></Field>
              <Field label="Срок действия" error={errors.accreditationValidUntil}><input disabled={!isAdmin} type="date" value={profile.accreditationValidUntil || ''} onChange={(e) => update('accreditationValidUntil', e.target.value)} className={inputClass} /></Field>
              <Field label="Директор"><select disabled={!isAdmin} value={profile.directorId || ''} onChange={(e) => update('directorId', e.target.value)} className={inputClass}><option value="">Не выбран</option>{employees.map((item) => <option key={item.id} value={item.userId || item.id}>{item.fullName} · {item.position || 'сотрудник'}</option>)}</select></Field>
              <Field label="Заведующий" error={errors.laboratoryHeadId}><select disabled={!canEdit} value={profile.laboratoryHeadId || ''} onChange={(e) => update('laboratoryHeadId', e.target.value)} className={inputClass}><option value="">Не выбран</option>{employees.map((item) => <option key={item.id} value={item.userId || item.id}>{item.fullName} · {item.position || 'сотрудник'}</option>)}</select></Field>
              <Field label="Стандартное примечание" wide><textarea disabled={!canEdit} rows={4} value={profile.standardNote || ''} onChange={(e) => update('standardNote', e.target.value)} className={inputClass} /></Field>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50">{logoPreview ? <img src={logoPreview} alt="Логотип лаборатории" className="h-full w-full object-contain p-3" /> : <ImagePlus className="h-8 w-8 text-slate-300" />}</div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-700">Логотип</p>
                <input disabled={!isAdmin} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return setLogoFile(null);
                  if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
                    event.target.value = '';
                    toast.warning('Поддерживаются PNG, JPG, WEBP и SVG.');
                    return;
                  }
                  if (file.size > 5 * 1024 * 1024) {
                    event.target.value = '';
                    toast.warning('Размер логотипа не должен превышать 5 МБ.');
                    return;
                  }
                  setLogoFile(file);
                }} className={inputClass} />
                <div className="flex flex-wrap gap-5">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={!isAdmin} type="checkbox" checked={profile.isDefault} onChange={(e) => update('isDefault', e.target.checked)} /> Лаборатория по умолчанию</label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input disabled={!isAdmin} type="checkbox" checked={profile.active} onChange={(e) => update('active', e.target.checked)} /> Активна</label>
                </div>
              </div>
            </div>
          </section>

          {canEdit && <div className="sticky bottom-4 flex justify-end"><Button type="submit" disabled={saving}><Save className="h-4 w-4" /> {saving ? 'Сохранение…' : 'Сохранить'}</Button></div>}
        </form>
      )}
    </div>
  );
};

export default LaboratorySettingsPage;
