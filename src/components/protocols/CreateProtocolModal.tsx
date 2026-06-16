import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPlus, Search } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { getCompanies, getCompanyById, getCompanyObjects } from '../../services/companyService';
import type { Company, CompanyObject } from '../../types/companies';
import type { CreateProtocolPayload, ProtocolTemplate, ProtocolTemplateId } from '../../types/protocols';
import { protocolTemplates } from '../../data/protocolTemplates';

type CreateProtocolModalProps = {
  open: boolean;
  loading?: boolean;
  templates?: ProtocolTemplate[];
  onClose: () => void;
  onCreate: (payload: CreateProtocolPayload) => void | Promise<void>;
};

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';

const companyLabel = (company: Company) => `${company.name || 'Без названия'}${company.bin ? `, ${company.bin}` : ''}`;

const PreviewGrid = ({ title, rows }: { title: string; rows: Array<[string, string | undefined]> }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">{title}</h3>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="mt-1 text-sm font-semibold text-slate-800">{value || '-'}</dd>
        </div>
      ))}
    </dl>
  </div>
);

const CreateProtocolModal = ({ open, loading = false, templates, onClose, onCreate }: CreateProtocolModalProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<ProtocolTemplateId | ''>('');
  const [companyLoading, setCompanyLoading] = useState(false);
  const [objectLoading, setObjectLoading] = useState(false);
  const [error, setError] = useState('');
  const visibleTemplates = useMemo(() => templates?.length ? templates : protocolTemplates, [templates]);

  useEffect(() => {
    if (!open) return;
    setError('');
    getCompanies({ status: 'ACTIVE' })
      .then((items) => setCompanies(items.filter((company) => company.status !== 'ARCHIVED')))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Не удалось загрузить компании'));
  }, [open]);

  useEffect(() => {
    if (open) return;
    setCompanySearch('');
    setSelectedCompany(null);
    setObjects([]);
    setSelectedObjectId('');
    setSelectedTemplate('');
    setError('');
  }, [open]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const activeCompanies = companies.filter((company) => company.status !== 'ARCHIVED');
    if (!query) return activeCompanies.slice(0, 8);
    return activeCompanies
      .filter((company) => `${company.name} ${company.bin}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [companies, companySearch]);

  const selectedObject = useMemo(() => objects.find((object) => object.id === selectedObjectId) || null, [objects, selectedObjectId]);

  const selectCompany = async (companyId: string) => {
    setCompanyLoading(true);
    setObjectLoading(true);
    setError('');
    setSelectedObjectId('');
    try {
      const company = await getCompanyById(companyId);
      if (company.status === 'ARCHIVED') {
        setSelectedCompany(null);
        setObjects([]);
        setError('Эта компания архивирована');
        return;
      }
      setSelectedCompany(company);
      setCompanySearch(companyLabel(company));
      const companyObjects = await getCompanyObjects(company.id);
      const activeObjects = companyObjects.filter((object) => object.status !== 'ARCHIVED');
      setObjects(activeObjects);
      if (activeObjects.length === 1) setSelectedObjectId(activeObjects[0].id);
    } catch (selectError) {
      setSelectedCompany(null);
      setObjects([]);
      setError(selectError instanceof Error ? selectError.message : 'Не удалось загрузить данные компании');
    } finally {
      setCompanyLoading(false);
      setObjectLoading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCompany || !selectedTemplate) return;
    const form = new FormData(event.currentTarget);
    const protocolDate = String(form.get('protocolDate') || '');
    if (!protocolDate) return;

    await onCreate({
      companyId: selectedCompany.id,
      objectId: selectedObjectId || undefined,
      templateId: selectedTemplate,
      protocolNumber: String(form.get('protocolNumber') || ''),
      protocolDate,
      samplingDate: String(form.get('samplingDate') || ''),
      testingStartDate: String(form.get('testingStartDate') || ''),
      testingEndDate: String(form.get('testingEndDate') || ''),
      purpose: String(form.get('purpose') || ''),
      environmentalConditions: String(form.get('environmentalConditions') || ''),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Создать протокол" size="xl">
      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">1. Компания</p>
          <label className="space-y-1.5 text-sm font-semibold text-slate-700">
            <span>Поиск по названию или БИН <span className="text-rose-600">*</span></span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={companySearch}
                onChange={(event) => {
                  setCompanySearch(event.target.value);
                  setSelectedCompany(null);
                  setObjects([]);
                  setSelectedObjectId('');
                }}
                placeholder="Начните вводить название или БИН"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
              />
            </div>
          </label>
          {!selectedCompany && filteredCompanies.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => selectCompany(company.id)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-eco-300 hover:bg-eco-50"
                >
                  <span className="block text-sm font-bold text-slate-900">{company.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{company.bin || 'БИН / ИИН не указан'}</span>
                </button>
              ))}
            </div>
          )}
          {companyLoading && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-500">Загрузка компании...</p>}
          {error && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{error}</p>}
        </section>

        {selectedCompany && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">2. Объект компании</p>
            {objectLoading && <p className="text-sm font-semibold text-slate-500">Загрузка объектов...</p>}
            {!objectLoading && objects.length === 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                У компании нет объектов. Добавьте объект в карточке компании или создайте протокол без объекта, если backend разрешает.
              </div>
            )}
            {!objectLoading && objects.length > 0 && (
              <select value={selectedObjectId} onChange={(event) => setSelectedObjectId(event.target.value)} className={inputClass}>
                <option value="">Без объекта</option>
                {objects.map((object) => <option key={object.id} value={object.id}>{object.name} · {object.address || 'адрес не указан'}</option>)}
              </select>
            )}
          </section>
        )}

        {selectedCompany && (
          <section>
            <p className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">3. Тип протокола</p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTemplates.map((template) => {
                const active = selectedTemplate === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedTemplate(template.id)}
                    className={`min-h-[104px] rounded-2xl border p-4 text-left transition hover:border-eco-500 hover:bg-eco-50 ${
                      active ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <ClipboardPlus className="mt-0.5 h-5 w-5 shrink-0 text-eco-700" />
                      {active && <Check className="h-5 w-5 shrink-0 text-eco-700" />}
                    </span>
                    <span className="mt-3 block text-sm font-bold text-slate-900">{template.name}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {selectedCompany && selectedTemplate && (
          <section className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500 sm:col-span-2">4. Данные протокола</p>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Номер протокола</span>
              <input name="protocolNumber" className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Дата протокола <span className="text-rose-600">*</span></span>
              <input name="protocolDate" type="date" required defaultValue={today()} className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Дата отбора</span>
              <input name="samplingDate" type="date" className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Начало испытаний</span>
              <input name="testingStartDate" type="date" className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Окончание испытаний</span>
              <input name="testingEndDate" type="date" className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Цель испытаний</span>
              <textarea name="purpose" rows={2} className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Условия окружающей среды</span>
              <textarea name="environmentalConditions" rows={2} className={inputClass} />
            </label>
          </section>
        )}

        {selectedCompany && (
          <section className="space-y-3">
            <p className="text-sm font-black uppercase tracking-wide text-slate-500">5. Preview данных</p>
            <PreviewGrid
              title="Организация"
              rows={[
                ['Название', selectedCompany.name],
                ['БИН', selectedCompany.bin],
                ['Юридический адрес', selectedCompany.legalAddress],
                ['Фактический адрес', selectedCompany.actualAddress],
                ['Руководитель', selectedCompany.director || selectedCompany.directorFullName],
                ['Контактное лицо', selectedCompany.contactPerson],
                ['Телефон', selectedCompany.phone],
                ['Email', selectedCompany.email],
              ]}
            />
            <PreviewGrid
              title="Объект"
              rows={[
                ['Название объекта', selectedObject?.name],
                ['Адрес объекта', selectedObject?.address],
                ['Вид деятельности', selectedObject?.activityType],
              ]}
            />
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={!selectedCompany || !selectedTemplate || loading}>{loading ? 'Создание...' : 'Создать протокол'}</Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateProtocolModal;
