import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import CompanyDetailsBlock from '../components/companies/CompanyDetailsBlock';
import CompanyForm from '../components/companies/CompanyForm';
import Modal from '../components/ui/Modal';
import { useToast } from '../hooks/useToast';
import {
  archiveCompany,
  archiveCompanyObject,
  createCompany,
  createCompanyObject,
  getCompanies,
  getCompanyById,
  getCompanyObjects,
  updateCompany,
  updateCompanyObject,
} from '../services/companyService';
import type { Company, CompanyObject, CompanyObjectPayload, CompanyPayload, CompanyStatus } from '../types/companies';

const formatDate = (date?: string) => {
  if (!date) return '-';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ru-RU');
};

const text = (value?: string | number) => value || '-';
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const PageShell = ({ children }: { children: ReactNode }) => <div className="space-y-6 pb-10">{children}</div>;
const LoadingBox = ({ label }: { label: string }) => <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">{label}</div>;
const ErrorBox = ({ message, onBack }: { message: string; onBack?: () => void }) => (
  <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
    <p className="font-bold">{message}</p>
    {onBack && <Button type="button" variant="secondary" onClick={onBack}>Назад</Button>}
  </div>
);

const StatusPill = ({ status }: { status: CompanyStatus | CompanyObject['status'] }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
    {status === 'ARCHIVED' ? 'Архив' : 'Активна'}
  </span>
);

const CompaniesList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('ACTIVE');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCompanies(await getCompanies({ search: query || undefined, status: statusFilter || undefined }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компании');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesQuery = !value || `${company.name} ${company.bin}`.toLowerCase().includes(value);
      const matchesStatus = !statusFilter || company.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [companies, query, statusFilter]);

  const archive = async (company: Company) => {
    if (!window.confirm(`Архивировать компанию "${company.name}"?`)) return;
    try {
      const updated = await archiveCompany(company.id);
      setCompanies((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast.success('Компания архивирована');
    } catch (archiveError) {
      toast.error('Не удалось архивировать компанию', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Справочник лаборатории</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Компании</h1>
        </div>
        <Link to="/staff/companies/new">
          <Button type="button"><Plus className="h-4 w-4" /> Добавить компанию</Button>
        </Link>
      </div>

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_220px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию и БИН" className={`${inputClass} pl-10`} />
        </label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CompanyStatus | '')} className={inputClass}>
          <option value="">Все статусы</option>
          <option value="ACTIVE">Активные</option>
          <option value="ARCHIVED">Архивные</option>
        </select>
        <Button type="button" variant="secondary" onClick={load}>Обновить</Button>
      </section>

      {loading && <LoadingBox label="Загрузка компаний..." />}
      {error && !loading && <ErrorBox message={error} onBack={load} />}

      {!loading && !error && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Название компании</th>
                  <th className="px-4 py-3">БИН / ИИН</th>
                  <th className="px-4 py-3">Юридический адрес</th>
                  <th className="px-4 py-3">Фактический адрес</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Руководитель</th>
                  <th className="px-4 py-3">Контактное лицо</th>
                  <th className="px-4 py-3">Количество объектов</th>
                  <th className="px-4 py-3">Дата добавления</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((company) => (
                  <tr key={company.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{text(company.name)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{text(company.bin)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.legalAddress)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.actualAddress)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.phone)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.email)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.director || company.directorFullName)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.contactPerson)}</td>
                    <td className="px-4 py-3 text-slate-600">{company.objects?.filter((object) => object.status !== 'ARCHIVED').length || 0}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(company.createdAt)}</td>
                    <td className="px-4 py-3"><StatusPill status={company.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" title="Открыть" onClick={() => navigate(`/staff/companies/${company.id}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-eco-800 ring-1 ring-eco-200 transition hover:bg-eco-50">
                          <Eye className="h-4 w-4" />
                        </button>
                        {company.status !== 'ARCHIVED' && (
                          <>
                            <button type="button" title="Редактировать" onClick={() => navigate(`/staff/companies/${company.id}/edit`)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-eco-800 ring-1 ring-eco-200 transition hover:bg-eco-50">
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button type="button" title="Архивировать" onClick={() => archive(company)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                              <Archive className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && <div className="px-5 py-10 text-center text-sm font-semibold text-slate-500">Компании не найдены.</div>}
        </section>
      )}
    </PageShell>
  );
};

const emptyObject: CompanyObjectPayload = {
  name: '',
  address: '',
  activityType: '',
  coordinates: '',
  sanitaryZone: '',
  notes: '',
};

const CompanyObjectModal = ({
  open,
  value,
  loading,
  onClose,
  onSubmit,
}: {
  open: boolean;
  value?: CompanyObject | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (payload: CompanyObjectPayload) => void | Promise<void>;
}) => {
  const defaults = { ...emptyObject, ...value };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit({
      name: String(form.get('name') || ''),
      address: String(form.get('address') || ''),
      activityType: String(form.get('activityType') || ''),
      coordinates: String(form.get('coordinates') || ''),
      sanitaryZone: String(form.get('sanitaryZone') || ''),
      notes: String(form.get('notes') || ''),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={value ? 'Редактировать объект' : 'Добавить объект'} size="xl">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Название <span className="text-rose-600">*</span></span>
          <input name="name" required defaultValue={defaults.name} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Адрес</span>
          <input name="address" defaultValue={defaults.address} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Вид деятельности</span>
          <input name="activityType" defaultValue={defaults.activityType} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Координаты</span>
          <input name="coordinates" defaultValue={defaults.coordinates} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700">
          <span>Санитарная зона</span>
          <input name="sanitaryZone" defaultValue={defaults.sanitaryZone} className={inputClass} />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
          <span>Заметки</span>
          <textarea name="notes" rows={3} defaultValue={defaults.notes} className={inputClass} />
        </label>
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Сохранение...' : 'Сохранить'}</Button>
        </div>
      </form>
    </Modal>
  );
};

const CompanyObjectsSection = ({ companyId }: { companyId: string }) => {
  const toast = useToast();
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CompanyObject | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setObjects(await getCompanyObjects(companyId));
    } catch (error) {
      toast.error('Не удалось загрузить объекты', error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId]);

  const submit = async (payload: CompanyObjectPayload) => {
    setSaving(true);
    try {
      if (editing) await updateCompanyObject(companyId, editing.id, payload);
      else await createCompanyObject(companyId, payload);
      toast.success(editing ? 'Объект обновлен' : 'Объект добавлен');
      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error('Не удалось сохранить объект', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (object: CompanyObject) => {
    if (!window.confirm(`Архивировать объект "${object.name}"?`)) return;
    try {
      await archiveCompanyObject(companyId, object.id);
      toast.success('Объект архивирован');
      await load();
    } catch (error) {
      toast.error('Не удалось архивировать объект', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Объекты</h2>
          <p className="mt-1 text-sm text-slate-500">У одной компании может быть несколько объектов для протоколов.</p>
        </div>
        <Button type="button" onClick={() => { setEditing(null); setModalOpen(true); }}><Plus className="h-4 w-4" /> Добавить объект</Button>
      </div>
      {loading ? <p className="text-sm font-semibold text-slate-500">Загрузка объектов...</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Название</th>
                <th className="px-3 py-3">Адрес</th>
                <th className="px-3 py-3">Вид деятельности</th>
                <th className="px-3 py-3">Координаты</th>
                <th className="px-3 py-3">Санитарная зона</th>
                <th className="px-3 py-3">Статус</th>
                <th className="px-3 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {objects.map((object) => (
                <tr key={object.id}>
                  <td className="px-3 py-3 font-bold text-slate-900">{text(object.name)}</td>
                  <td className="px-3 py-3 text-slate-600">{text(object.address)}</td>
                  <td className="px-3 py-3 text-slate-600">{text(object.activityType)}</td>
                  <td className="px-3 py-3 text-slate-600">{text(object.coordinates)}</td>
                  <td className="px-3 py-3 text-slate-600">{text(object.sanitaryZone)}</td>
                  <td className="px-3 py-3"><StatusPill status={object.status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {object.status !== 'ARCHIVED' && (
                        <>
                          <Button type="button" variant="secondary" className="px-3" onClick={() => { setEditing(object); setModalOpen(true); }}><Edit3 className="h-4 w-4" /></Button>
                          <Button type="button" variant="secondary" className="px-3" onClick={() => archive(object)}><Archive className="h-4 w-4" /></Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {objects.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-500">Объекты еще не добавлены.</p>}
        </div>
      )}
      <CompanyObjectModal open={modalOpen} value={editing} loading={saving} onClose={() => setModalOpen(false)} onSubmit={submit} />
    </section>
  );
};

const CompanyFormPage = ({ edit = false }: { edit?: boolean }) => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!edit || !companyId) return;
    setLoading(true);
    getCompanyById(companyId)
      .then(setCompany)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компанию'))
      .finally(() => setLoading(false));
  }, [companyId, edit]);

  const submit = async (payload: CompanyPayload) => {
    setSaving(true);
    try {
      const saved = edit && companyId ? await updateCompany(companyId, payload) : await createCompany(payload);
      toast.success(edit ? 'Компания обновлена' : 'Компания создана');
      navigate(`/staff/companies/${saved.id}`);
    } catch (saveError) {
      toast.error('Не удалось сохранить компанию', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBox label="Загрузка компании..." />;
  if (error) return <ErrorBox message={error} onBack={() => navigate('/staff/companies')} />;

  return (
    <PageShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <button type="button" onClick={() => navigate('/staff/companies')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
          <ArrowLeft className="h-4 w-4" /> К компаниям
        </button>
        <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">{edit ? company?.name || 'Компания' : 'Добавить компанию'}</h1>
      </div>
      <CompanyForm initialValue={company || undefined} loading={saving} submitText={edit ? 'Сохранить изменения' : 'Создать компанию'} onSubmit={submit} onCancel={() => navigate('/staff/companies')} />
    </PageShell>
  );
};

const CompanyViewPage = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    getCompanyById(companyId)
      .then(setCompany)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компанию'))
      .finally(() => setLoading(false));
  }, [companyId]);

  const archive = async () => {
    if (!company || !window.confirm(`Архивировать компанию "${company.name}"?`)) return;
    try {
      const updated = await archiveCompany(company.id);
      setCompany(updated);
      toast.success('Компания архивирована');
    } catch (archiveError) {
      toast.error('Не удалось архивировать компанию', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  if (loading) return <LoadingBox label="Загрузка компании..." />;
  if (error || !company) return <ErrorBox message={error || 'Компания не найдена'} onBack={() => navigate('/staff/companies')} />;

  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/companies')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> К компаниям
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Карточка компании</p>
            <StatusPill status={company.status} />
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{company.name}</h1>
        </div>
        {company.status !== 'ARCHIVED' && (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={archive}><Archive className="h-4 w-4" /> Архивировать</Button>
            <Button type="button" onClick={() => navigate(`/staff/companies/${company.id}/edit`)}><Edit3 className="h-4 w-4" /> Редактировать</Button>
          </div>
        )}
      </div>
      <CompanyDetailsBlock company={company} />
      <CompanyObjectsSection companyId={company.id} />
    </PageShell>
  );
};

const CompaniesPage = () => {
  const location = useLocation();
  const { companyId } = useParams();

  if (location.pathname.endsWith('/new')) return <CompanyFormPage />;
  if (location.pathname.endsWith('/edit')) return <CompanyFormPage edit />;
  if (companyId) return <CompanyViewPage />;
  return <CompaniesList />;
};

export default CompaniesPage;
