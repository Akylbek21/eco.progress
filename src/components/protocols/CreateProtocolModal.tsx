import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ClipboardPlus, Plus, Search } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import CompanyDetailsBlock from '../companies/CompanyDetailsBlock';
import CompanyForm from '../companies/CompanyForm';
import { useToast } from '../../hooks/useToast';
import { createCompany, getCompanies, getCompanyById } from '../../services/companyService';
import type { Company, CompanyPayload } from '../../types/companies';
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

const Field = ({
  label,
  name,
  required = false,
  type = 'text',
}: {
  label: string;
  name: keyof CreateProtocolPayload;
  required?: boolean;
  type?: string;
}) => (
  <label className="space-y-1.5 text-sm font-semibold text-slate-700">
    <span>{label}{required && <span className="text-rose-600"> *</span>}</span>
    <input
      name={name}
      type={type}
      required={required}
      defaultValue={type === 'date' && name === 'protocolDate' ? today() : undefined}
      className={inputClass}
    />
  </label>
);

const companyLabel = (company: Company) => `${company.name || 'Без названия'}${company.bin ? `, ${company.bin}` : ''}`;

const CreateProtocolModal = ({ open, loading = false, templates, onClose, onCreate }: CreateProtocolModalProps) => {
  const toast = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<ProtocolTemplateId | ''>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [companyFormOpen, setCompanyFormOpen] = useState(false);
  const [companyCreating, setCompanyCreating] = useState(false);
  const visibleTemplates = useMemo(() => templates?.length ? templates : protocolTemplates, [templates]);

  useEffect(() => {
    if (!open) return;
    setCompanyError('');
    getCompanies({ status: 'ACTIVE' })
      .then(setCompanies)
      .catch((error) => setCompanyError(error instanceof Error ? error.message : 'Не удалось загрузить компании'));
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelectedTemplate('');
      setCompanySearch('');
      setSelectedCompanyId('');
      setSelectedCompany(null);
      setCompanyError('');
      setCompanyFormOpen(false);
    }
  }, [open]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    const activeCompanies = companies.filter((company) => company.status !== 'ARCHIVED');
    if (!query) return activeCompanies.slice(0, 8);
    return activeCompanies
      .filter((company) => `${company.name} ${company.bin}`.toLowerCase().includes(query))
      .slice(0, 8);
  }, [companies, companySearch]);

  const selectCompany = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    setCompanyLoading(true);
    setCompanyError('');
    try {
      const company = await getCompanyById(companyId);
      if (company.status === 'ARCHIVED') {
        setSelectedCompany(null);
        setCompanyError('Эта компания архивирована');
        return;
      }
      setSelectedCompany(company);
      setCompanySearch(companyLabel(company));
      toast.success('Данные компании автоматически подставлены');
    } catch (error) {
      setSelectedCompany(null);
      setCompanyError(error instanceof Error ? error.message : 'Не удалось загрузить данные компании');
    } finally {
      setCompanyLoading(false);
    }
  };

  const createAndSelectCompany = async (payload: CompanyPayload) => {
    setCompanyCreating(true);
    try {
      const company = await createCompany(payload);
      setCompanies((items) => [company, ...items.filter((item) => item.id !== company.id)]);
      setCompanyFormOpen(false);
      setSelectedCompanyId(company.id);
      setSelectedCompany(company);
      setCompanySearch(companyLabel(company));
      setCompanyError('');
      toast.success('Компания успешно создана');
      toast.success('Данные компании автоматически подставлены');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось создать компанию';
      setCompanyError(message);
      toast.error('Не удалось создать компанию', message);
    } finally {
      setCompanyCreating(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTemplate) return;
    if (!selectedCompany) {
      setCompanyError('Выберите компанию для создания протокола');
      return;
    }
    if (selectedCompany.status === 'ARCHIVED') {
      setCompanyError('Эта компания архивирована');
      return;
    }

    const form = new FormData(event.currentTarget);
    const sampleDate = String(form.get('samplingDate') || '');
    const testPurpose = String(form.get('testingPurpose') || '');
    await onCreate({
      templateId: selectedTemplate,
      companyId: selectedCompany.id,
      organizationName: selectedCompany.name,
      organizationAddress: selectedCompany.legalAddress || selectedCompany.actualAddress,
      objectName: selectedCompany.objectName,
      productName: selectedCompany.objectName || selectedCompany.activityType,
      protocolDate: String(form.get('protocolDate') || ''),
      sampleDate,
      samplingDate: sampleDate,
      testingDate: String(form.get('testingDate') || ''),
      testPurpose,
      testingPurpose: testPurpose,
      environmentConditions: String(form.get('environmentConditions') || ''),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Создать протокол" size="xl">
      <form onSubmit={submit} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="min-w-0 flex-1 space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Компания / заказчик <span className="text-rose-600">*</span></span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={companySearch}
                  onChange={(event) => {
                    setCompanySearch(event.target.value);
                    setSelectedCompanyId('');
                    setSelectedCompany(null);
                  }}
                  placeholder="Поиск по названию или БИН"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100"
                />
              </div>
            </label>
            <Button type="button" variant="secondary" onClick={() => setCompanyFormOpen(true)}><Plus className="h-4 w-4" /> Новая компания</Button>
          </div>

          {!selectedCompanyId && filteredCompanies.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {filteredCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => selectCompany(company.id)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-eco-300 hover:bg-eco-50"
                >
                  <span className="block text-sm font-bold text-slate-900">{company.name}</span>
                  <span className="mt-0.5 block text-xs font-semibold text-slate-500">{company.bin || 'БИН / ИИН не указан'}</span>
                </button>
              ))}
            </div>
          )}

          {companyLoading && <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-500">Загрузка данных компании...</p>}
          {companyError && <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">{companyError}</p>}
          {selectedCompany && <div className="mt-4"><CompanyDetailsBlock company={selectedCompany} compact /></div>}
        </section>

        <section>
          <p className="mb-3 text-sm font-semibold text-slate-700">Выберите шаблон</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleTemplates.map((template) => {
              const active = selectedTemplate === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`min-h-[112px] rounded-2xl border p-4 text-left transition hover:border-eco-500 hover:bg-eco-50 ${
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

        {selectedTemplate && (
          <section className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
            <Field label="Дата протокола" name="protocolDate" type="date" required />
            <Field label="Дата отбора" name="samplingDate" type="date" required />
            <Field label="Дата испытаний" name="testingDate" type="date" required />
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Цель испытаний <span className="text-rose-600">*</span></span>
              <textarea name="testingPurpose" required rows={2} className={inputClass} />
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">
              <span>Условия окружающей среды <span className="text-rose-600">*</span></span>
              <textarea name="environmentConditions" required rows={2} className={inputClass} />
            </label>
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
          <Button type="submit" disabled={!selectedTemplate || !selectedCompany || loading}>{loading ? 'Создание...' : 'Создать протокол'}</Button>
        </div>
      </form>

      <Modal open={companyFormOpen} onClose={() => setCompanyFormOpen(false)} title="Новая компания" size="xl" loading={companyCreating}>
        {companyError && <p className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{companyError}</p>}
        <CompanyForm
          loading={companyCreating}
          submitText="Создать и выбрать"
          onSubmit={createAndSelectCompany}
          onCancel={() => setCompanyFormOpen(false)}
        />
      </Modal>
    </Modal>
  );
};

export default CreateProtocolModal;
