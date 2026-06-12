import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Archive, ArrowLeft, Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Button from '../components/ui/Button';
import CompanyDetailsBlock from '../components/companies/CompanyDetailsBlock';
import CompanyForm from '../components/companies/CompanyForm';
import ConfirmModal from '../components/modals/ConfirmModal';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { archiveCompany, createCompany, deleteCompany, getCompanies, getCompanyById, updateCompany } from '../services/companyService';
import type { Company, CompanyPayload, CompanyStatus } from '../types/companies';

const formatDate = (date?: string) => {
  if (!date) return '-';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('ru-RU');
};

const text = (value?: string) => value || '-';

const PageShell = ({ children }: { children: ReactNode }) => (
  <div className="space-y-6 pb-10">{children}</div>
);

const LoadingBox = ({ text: label }: { text: string }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500 shadow-sm">{label}</div>
);

const ErrorBox = ({ message, onBack }: { message: string; onBack?: () => void }) => (
  <div className="space-y-4 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
    <p className="font-bold">{message}</p>
    {onBack && <Button type="button" variant="secondary" onClick={onBack}>Назад</Button>}
  </div>
);

const StatusPill = ({ status }: { status: CompanyStatus }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${status === 'ARCHIVED' ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
    {status === 'ARCHIVED' ? 'Архив' : 'Активна'}
  </span>
);

const CompaniesList = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nameQuery, setNameQuery] = useState('');
  const [binQuery, setBinQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('ACTIVE');
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Company | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canDelete = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setCompanies(await getCompanies({ search: nameQuery || undefined, bin: binQuery || undefined, status: statusFilter || undefined }));
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
    const name = nameQuery.trim().toLowerCase();
    const bin = binQuery.trim().toLowerCase();
    return companies.filter((company) => {
      const matchesName = !name || company.name.toLowerCase().includes(name);
      const matchesBin = !bin || company.bin.toLowerCase().includes(bin);
      const matchesStatus = !statusFilter || company.status === statusFilter;
      return matchesName && matchesBin && matchesStatus;
    });
  }, [companies, nameQuery, binQuery, statusFilter]);

  const remove = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      const updated = await deleteCompany(deleteTarget.id);
      if (updated?.status === 'ARCHIVED') {
        setCompanies((items) => items.map((item) => item.id === updated.id ? updated : item));
        toast.success('Компания архивирована');
      } else {
        setCompanies((items) => items.filter((item) => item.id !== deleteTarget.id));
        toast.success('Компания удалена');
      }
      setDeleteTarget(null);
    } catch (deleteError) {
      toast.error('Не удалось удалить компанию', deleteError instanceof Error ? deleteError.message : undefined);
    } finally {
      setActionLoading(false);
    }
  };

  const archive = async () => {
    if (!archiveTarget) return;
    setActionLoading(true);
    try {
      const updated = await archiveCompany(archiveTarget.id);
      setCompanies((items) => items.map((item) => item.id === updated.id ? updated : item));
      toast.success('Компания архивирована');
      setArchiveTarget(null);
    } catch (archiveError) {
      toast.error('Не удалось архивировать компанию', archiveError instanceof Error ? archiveError.message : undefined);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">CRM контрагентов</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Компании</h1>
        </div>
        {canManage && (
          <Link to="/staff/companies/new">
            <Button type="button"><Plus className="h-4 w-4" /> Добавить компанию</Button>
          </Link>
        )}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_180px_auto] md:items-end">
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Поиск по названию компании</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={nameQuery}
                onChange={(event) => setNameQuery(event.target.value)}
                placeholder="Например: ECOPROGRESS"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
              />
            </div>
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Поиск по БИН / ИИН</span>
            <input
              value={binQuery}
              onChange={(event) => setBinQuery(event.target.value)}
              placeholder="000000000000"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
            />
          </label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Статус</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as CompanyStatus | '')}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
            >
              <option value="">Все</option>
              <option value="ACTIVE">Активные</option>
              <option value="ARCHIVED">Архивные</option>
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => { setNameQuery(''); setBinQuery(''); setStatusFilter('ACTIVE'); }}>Сбросить</Button>
        </div>
      </section>

      {loading && <LoadingBox text="Загрузка компаний..." />}
      {error && !loading && <ErrorBox message={error} onBack={load} />}

      {!loading && !error && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-[1380px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Название компании</th>
                  <th className="px-4 py-3">БИН / ИИН</th>
                  <th className="px-4 py-3">Юридический адрес</th>
                  <th className="px-4 py-3">Фактический адрес</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Руководитель</th>
                  <th className="px-4 py-3">Объект</th>
                  <th className="px-4 py-3">Дата добавления</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((company) => (
                  <tr key={company.id} className={`align-top transition ${company.status === 'ARCHIVED' ? 'bg-slate-50 text-slate-500' : 'hover:bg-eco-50/50'}`}>
                    <td className="px-4 py-3 font-bold text-slate-900">{text(company.name)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{text(company.bin)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.legalAddress)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.actualAddress)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.phone)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.email)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.directorFullName)}</td>
                    <td className="px-4 py-3 text-slate-600">{text(company.objectName)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(company.createdAt)}</td>
                    <td className="px-4 py-3"><StatusPill status={company.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" title="Посмотреть" onClick={() => navigate(`/staff/companies/${company.id}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-eco-800 ring-1 ring-eco-200 transition hover:bg-eco-50">
                          <Eye className="h-4 w-4" />
                        </button>
                        {canManage && company.status !== 'ARCHIVED' && (
                          <button type="button" title="Редактировать" onClick={() => navigate(`/staff/companies/${company.id}/edit`)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-eco-800 ring-1 ring-eco-200 transition hover:bg-eco-50">
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && company.status !== 'ARCHIVED' && (
                          <button type="button" title="Архивировать" onClick={() => setArchiveTarget(company)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50">
                            <Archive className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button type="button" title="Удалить" onClick={() => setDeleteTarget(company)} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-50">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="border-t border-slate-100 px-5 py-10 text-center text-sm font-semibold text-slate-500">
              Компании не найдены.
            </div>
          )}
        </section>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Удалить компанию?"
        description={deleteTarget ? `Если компания уже использовалась в протоколе, backend должен архивировать ее вместо физического удаления: "${deleteTarget.name}".` : undefined}
        confirmText="Удалить"
        cancelText="Отмена"
        variant="danger"
        loading={actionLoading}
        onConfirm={remove}
        onClose={() => setDeleteTarget(null)}
      />
      <ConfirmModal
        isOpen={!!archiveTarget}
        title="Архивировать компанию?"
        description={archiveTarget ? `Компания "${archiveTarget.name}" останется в старых протоколах и будет скрыта из активного списка.` : undefined}
        confirmText="Архивировать"
        cancelText="Отмена"
        loading={actionLoading}
        onConfirm={archive}
        onClose={() => setArchiveTarget(null)}
      />
    </PageShell>
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
    setError('');
    getCompanyById(companyId)
      .then(setCompany)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компанию'))
      .finally(() => setLoading(false));
  }, [companyId, edit]);

  const submit = async (payload: CompanyPayload) => {
    setSaving(true);
    try {
      const saved = edit && companyId ? await updateCompany(companyId, payload) : await createCompany(payload);
      toast.success(edit ? 'Компания обновлена' : 'Компания успешно создана');
      navigate(`/staff/companies/${saved.id}`);
    } catch (saveError) {
      toast.error(edit ? 'Не удалось обновить компанию' : 'Не удалось создать компанию', saveError instanceof Error ? saveError.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingBox text="Загрузка компании..." />;
  if (error) return <ErrorBox message={error} onBack={() => navigate('/staff/companies')} />;

  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/companies')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> К компаниям
          </button>
          <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">{edit ? 'Редактирование контрагента' : 'Новый контрагент'}</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{edit ? company?.name || 'Компания' : 'Добавить компанию'}</h1>
        </div>
      </div>
      <CompanyForm initialValue={company || undefined} loading={saving} submitText={edit ? 'Сохранить изменения' : 'Создать компанию'} onSubmit={submit} onCancel={() => navigate('/staff/companies')} />
    </PageShell>
  );
};

const CompanyViewPage = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [archiving, setArchiving] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [error, setError] = useState('');
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    setError('');
    getCompanyById(companyId)
      .then(setCompany)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компанию'))
      .finally(() => setLoading(false));
  }, [companyId]);

  const archive = async () => {
    if (!company) return;
    setArchiving(true);
    try {
      const updated = await archiveCompany(company.id);
      setCompany(updated);
      toast.success('Компания архивирована');
      setArchiveOpen(false);
    } catch (archiveError) {
      toast.error('Не удалось архивировать компанию', archiveError instanceof Error ? archiveError.message : undefined);
    } finally {
      setArchiving(false);
    }
  };

  if (loading) return <LoadingBox text="Загрузка компании..." />;
  if (error || !company) return <ErrorBox message={error || 'Компания не найдена'} onBack={() => navigate('/staff/companies')} />;

  return (
    <PageShell>
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/companies')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700 hover:text-eco-900">
            <ArrowLeft className="h-4 w-4" /> Назад
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-eco-700">Карточка компании</p>
            <StatusPill status={company.status} />
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{company.name}</h1>
          {company.status === 'ARCHIVED' && <p className="mt-2 text-sm font-semibold text-slate-500">Эта компания архивирована.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/staff/companies')}>Назад</Button>
          {canManage && company.status !== 'ARCHIVED' && (
            <>
              <Button type="button" variant="secondary" onClick={() => setArchiveOpen(true)}><Archive className="h-4 w-4" /> Архивировать</Button>
              <Button type="button" onClick={() => navigate(`/staff/companies/${company.id}/edit`)}><Edit3 className="h-4 w-4" /> Редактировать</Button>
            </>
          )}
        </div>
      </div>
      <CompanyDetailsBlock company={company} />
      <ConfirmModal
        isOpen={archiveOpen}
        title="Архивировать компанию?"
        description="Компания останется в старых протоколах, но будет скрыта из активного списка."
        confirmText="Архивировать"
        cancelText="Отмена"
        loading={archiving}
        onConfirm={archive}
        onClose={() => setArchiveOpen(false)}
      />
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
