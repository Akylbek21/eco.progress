import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { getCompanies, getCompanyById, getCompanyObjects } from '../../services/companyService';
import { getApiErrorMessage } from '../../services/apiHelpers';
import type { Company, CompanyObject } from '../../types/companies';
import type {
  CreateProtocolPayload,
  ProtocolEnvironmentalConditions,
  ProtocolSubtype,
  ProtocolTemplate,
  ProtocolTemplateId,
} from '../../types/protocols';
import { physicalFactorTypes, protocolTemplates, subtypeName, templateName } from '../../data/protocolTemplates';

type Props = {
  open: boolean;
  loading?: boolean;
  templates?: ProtocolTemplate[];
  onClose: () => void;
  onCreate: (payload: CreateProtocolPayload) => void | Promise<void>;
};

type MainData = {
  protocolNumber: string;
  protocolDate: string;
  samplingDate: string;
  testingStartDate: string;
  testingEndDate: string;
  productName: string;
  testingBasis: string;
  productNormativeDocument: string;
  samplingMethodDocument: string;
  testingMethodDocument: string;
  purpose: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
const allowedTemplateIds = new Set(protocolTemplates.map((item) => item.id));
const emptyMain: MainData = {
  protocolNumber: '',
  protocolDate: today(),
  samplingDate: '',
  testingStartDate: '',
  testingEndDate: '',
  productName: '',
  testingBasis: '',
  productNormativeDocument: '',
  samplingMethodDocument: '',
  testingMethodDocument: '',
  purpose: '',
};
const emptyEnvironment: ProtocolEnvironmentalConditions = {
  temperature: '',
  minTemperature: '',
  maxTemperature: '',
  humidity: '',
  minHumidity: '',
  maxHumidity: '',
  pressureKpa: '',
  windSpeed: '',
  comment: '',
};

const Field = ({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <label className={`space-y-1.5 text-sm font-semibold text-slate-700 ${wide ? 'sm:col-span-2' : ''}`}>
    <span>{label}</span>
    {children}
  </label>
);

const PreviewRows = ({ rows }: { rows: Array<[string, string | undefined]> }) => (
  <dl className="grid gap-3 sm:grid-cols-2">
    {rows.map(([label, value]) => (
      <div key={label} className="rounded-xl bg-slate-50 p-3">
        <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value || '—'}</dd>
      </div>
    ))}
  </dl>
);

const CreateProtocolModal = ({ open, loading = false, templates, onClose, onCreate }: Props) => {
  const [step, setStep] = useState(1);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [objectId, setObjectId] = useState('');
  const [templateId, setTemplateId] = useState<ProtocolTemplateId | ''>('');
  const [subtype, setSubtype] = useState<ProtocolSubtype | ''>('');
  const [main, setMain] = useState<MainData>(emptyMain);
  const [environment, setEnvironment] = useState<ProtocolEnvironmentalConditions>(emptyEnvironment);
  const [busyCompany, setBusyCompany] = useState(false);
  const [busyObjects, setBusyObjects] = useState(false);
  const [error, setError] = useState('');
  const [objectWarning, setObjectWarning] = useState('');

  const visibleTemplates = useMemo(() => {
    const backendTemplates = (templates || []).filter((item) => allowedTemplateIds.has(item.id));
    return protocolTemplates.map((fallback) => backendTemplates.find((item) => item.id === fallback.id) || fallback);
  }, [templates]);

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    return companies
      .filter((item) => item.status === 'ACTIVE')
      .filter((item) => !query || `${item.name} ${item.bin}`.toLowerCase().includes(query))
      .slice(0, 20);
  }, [companies, companySearch]);

  const selectedObject = objects.find((item) => item.id === objectId);

  useEffect(() => {
    if (!open) return;
    setError('');
    getCompanies({ status: 'ACTIVE' })
      .then(setCompanies)
      .catch((loadError) => setError(getApiErrorMessage(loadError, 'Не удалось загрузить компании')));
  }, [open]);

  useEffect(() => {
    if (open) return;
    setStep(1);
    setCompanySearch('');
    setCompany(null);
    setObjects([]);
    setObjectId('');
    setTemplateId('');
    setSubtype('');
    setMain({ ...emptyMain, protocolDate: today() });
    setEnvironment({ ...emptyEnvironment });
    setError('');
    setObjectWarning('');
  }, [open]);

  const selectCompany = async (id: string) => {
    setBusyCompany(true);
    setError('');
    setObjectWarning('');
    setObjects([]);
    setObjectId('');
    try {
      const fullCompany = await getCompanyById(id);
      setCompany(fullCompany);
      setCompanySearch(`${fullCompany.name}${fullCompany.bin ? `, ${fullCompany.bin}` : ''}`);
      setStep(2);
      setBusyObjects(true);
      try {
        const items = await getCompanyObjects(id);
        setObjects(items.filter((item) => item.status === 'ACTIVE'));
        if (items.filter((item) => item.status === 'ACTIVE').length === 1) {
          setObjectId(items.find((item) => item.status === 'ACTIVE')?.id || '');
        }
      } catch (objectError) {
        setObjectWarning(getApiErrorMessage(objectError, 'Не удалось загрузить объекты компании. Компания остаётся выбранной, повторите попытку.'));
      } finally {
        setBusyObjects(false);
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить полные данные компании'));
    } finally {
      setBusyCompany(false);
    }
  };

  const validateStep = () => {
    setError('');
    if (step === 1 && !company) return setError('Выберите компанию.'), false;
    if (step === 2 && !objectId) return setError('Выберите объект компании.'), false;
    if (step === 3 && !templateId) return setError('Выберите тип протокола.'), false;
    if (step === 4 && templateId === 'physical_factors' && !subtype) return setError('Выберите подтип физических факторов.'), false;
    if (step === 5) {
      if (!main.protocolDate) return setError('Укажите дату протокола.'), false;
      if (main.samplingDate && main.testingStartDate && main.samplingDate > main.testingStartDate) {
        return setError('Дата отбора не может быть позже начала испытаний.'), false;
      }
      if (main.testingStartDate && main.testingEndDate && main.testingStartDate > main.testingEndDate) {
        return setError('Начало испытаний не может быть позже окончания.'), false;
      }
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step === 3 && templateId !== 'physical_factors') setStep(5);
    else setStep((current) => Math.min(7, current + 1));
  };

  const back = () => {
    if (step === 5 && templateId !== 'physical_factors') setStep(3);
    else setStep((current) => Math.max(1, current - 1));
  };

  const submit = async () => {
    if (!company || !objectId || !templateId || !main.protocolDate) return;
    if (!validateStep()) return;
    setError('');
    try {
      await onCreate({
        companyId: company.id,
        objectId,
        templateId,
        subtype: templateId === 'physical_factors' ? subtype || undefined : undefined,
        ...main,
        environment,
      });
    } catch (createError) {
      setError(getApiErrorMessage(createError, 'Не удалось создать протокол'));
    }
  };

  const setMainField = (key: keyof MainData, value: string) => setMain((current) => ({ ...current, [key]: value }));
  const setEnvironmentField = (key: keyof ProtocolEnvironmentalConditions, value: string) =>
    setEnvironment((current) => ({ ...current, [key]: value }));

  return (
    <Modal open={open} onClose={onClose} title="Создать лабораторный протокол" description={`Шаг ${step} из 7`} size="xl" loading={loading}>
      <div className="mb-6 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, index) => index + 1).map((item) => (
          <div key={item} className={`h-2 rounded-full ${item <= step ? 'bg-eco-600' : 'bg-slate-100'}`} />
        ))}
      </div>

      {step === 1 && (
        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900">Компания</h3>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={companySearch}
              onChange={(event) => {
                setCompanySearch(event.target.value);
                setCompany(null);
              }}
              placeholder="Поиск по названию или БИН"
              className={`${inputClass} pl-10`}
            />
          </label>
          <div className="grid max-h-[48vh] gap-2 overflow-y-auto sm:grid-cols-2">
            {filteredCompanies.map((item) => (
              <button key={item.id} type="button" onClick={() => selectCompany(item.id)} disabled={busyCompany} className="rounded-xl border border-slate-200 p-3 text-left hover:border-eco-400 hover:bg-eco-50">
                <span className="block font-bold text-slate-900">{item.name}</span>
                <span className="text-sm text-slate-500">{item.bin || 'БИН не указан'}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900">Объект компании</h3>
          <p className="text-sm font-semibold text-slate-600">{company?.name} · {company?.bin}</p>
          {objectWarning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{objectWarning}</div>}
          {busyObjects ? <p className="text-sm text-slate-500">Загрузка объектов…</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {objects.map((item) => (
                <button key={item.id} type="button" onClick={() => setObjectId(item.id)} className={`rounded-xl border p-4 text-left ${objectId === item.id ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200'}`}>
                  <span className="flex justify-between gap-3 font-bold text-slate-900">{item.name}{objectId === item.id && <Check className="h-5 w-5 text-eco-700" />}</span>
                  <span className="mt-1 block text-sm text-slate-600">{item.address || 'Адрес не указан'}</span>
                  <span className="mt-1 block text-xs font-semibold text-slate-500">{item.activityType || 'Вид деятельности не указан'}</span>
                </button>
              ))}
            </div>
          )}
          {!busyObjects && objects.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Активные объекты не найдены. Создание протокола продолжится после выбора объекта.</p>}
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900">Тип протокола</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((item) => (
              <button key={item.id} type="button" onClick={() => { setTemplateId(item.id); if (item.id !== 'physical_factors') setSubtype(''); }} className={`min-h-24 rounded-2xl border p-4 text-left font-bold ${templateId === item.id ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200 hover:border-eco-300'}`}>
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <h3 className="text-lg font-black text-slate-900">Подтип физических факторов</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {physicalFactorTypes.map((item) => (
              <button key={item.value} type="button" onClick={() => setSubtype(item.value)} className={`rounded-2xl border p-4 text-left font-bold ${subtype === item.value ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200'}`}>
                {item.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="text-lg font-black text-slate-900 sm:col-span-2">Основные данные</h3>
          <Field label="Номер протокола"><input value={main.protocolNumber} onChange={(e) => setMainField('protocolNumber', e.target.value)} className={inputClass} /></Field>
          <Field label="Дата протокола *"><input type="date" value={main.protocolDate} onChange={(e) => setMainField('protocolDate', e.target.value)} className={inputClass} /></Field>
          <Field label="Дата отбора"><input type="date" value={main.samplingDate} onChange={(e) => setMainField('samplingDate', e.target.value)} className={inputClass} /></Field>
          <Field label="Начало испытаний"><input type="date" value={main.testingStartDate} onChange={(e) => setMainField('testingStartDate', e.target.value)} className={inputClass} /></Field>
          <Field label="Окончание испытаний"><input type="date" value={main.testingEndDate} onChange={(e) => setMainField('testingEndDate', e.target.value)} className={inputClass} /></Field>
          <Field label="Наименование продукции"><input value={main.productName} onChange={(e) => setMainField('productName', e.target.value)} className={inputClass} /></Field>
          <Field label="Основание испытаний" wide><textarea value={main.testingBasis} onChange={(e) => setMainField('testingBasis', e.target.value)} className={inputClass} rows={2} /></Field>
          <Field label="НД на продукцию"><input value={main.productNormativeDocument} onChange={(e) => setMainField('productNormativeDocument', e.target.value)} className={inputClass} /></Field>
          <Field label="НД на методы отбора"><input value={main.samplingMethodDocument} onChange={(e) => setMainField('samplingMethodDocument', e.target.value)} className={inputClass} /></Field>
          <Field label="НД на методы испытаний"><input value={main.testingMethodDocument} onChange={(e) => setMainField('testingMethodDocument', e.target.value)} className={inputClass} /></Field>
          <Field label="Цель испытаний" wide><textarea value={main.purpose} onChange={(e) => setMainField('purpose', e.target.value)} className={inputClass} rows={2} /></Field>
        </section>
      )}

      {step === 6 && (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <h3 className="text-lg font-black text-slate-900 sm:col-span-2 lg:col-span-3">Условия среды</h3>
          {([
            ['temperature', 'Температура'],
            ['minTemperature', 'Минимальная температура'],
            ['maxTemperature', 'Максимальная температура'],
            ['humidity', 'Влажность'],
            ['minHumidity', 'Минимальная влажность'],
            ['maxHumidity', 'Максимальная влажность'],
            ['pressureKpa', 'Давление, кПа'],
            ['windSpeed', 'Скорость ветра, м/с'],
          ] as Array<[keyof ProtocolEnvironmentalConditions, string]>).map(([key, label]) => (
            <Field key={key} label={label}>
              <input type="number" step="any" value={environment[key] || ''} onChange={(e) => setEnvironmentField(key, e.target.value)} className={inputClass} />
            </Field>
          ))}
          <Field label="Комментарий" wide><textarea value={environment.comment || ''} onChange={(e) => setEnvironmentField('comment', e.target.value)} className={inputClass} rows={3} /></Field>
        </section>
      )}

      {step === 7 && (
        <section className="space-y-5">
          <h3 className="text-lg font-black text-slate-900">Предпросмотр данных</h3>
          <PreviewRows rows={[
            ['Компания', company?.name],
            ['БИН', company?.bin],
            ['Адрес', company?.actualAddress || company?.legalAddress],
            ['Объект', selectedObject?.name],
            ['Адрес объекта', selectedObject?.address],
            ['Вид деятельности', selectedObject?.activityType],
            ['Шаблон', templateId ? templateName(templateId) : undefined],
            ['Подтип', templateId === 'physical_factors' ? subtypeName(subtype) : '—'],
            ['Дата протокола', main.protocolDate],
            ['Дата отбора', main.samplingDate],
            ['Начало испытаний', main.testingStartDate],
            ['Окончание испытаний', main.testingEndDate],
            ['Температура', environment.temperature],
            ['Влажность', environment.humidity],
            ['Давление, кПа', environment.pressureKpa],
            ['Скорость ветра, м/с', environment.windSpeed],
            ['Комментарий', environment.comment],
          ]} />
        </section>
      )}

      {error && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
        <Button type="button" variant="secondary" onClick={step === 1 ? onClose : back} disabled={loading}>
          {step === 1 ? 'Отмена' : <><ChevronLeft className="h-4 w-4" /> Назад</>}
        </Button>
        {step < 7 ? (
          <Button type="button" onClick={next} disabled={loading || busyCompany || busyObjects}>Далее <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button type="button" onClick={submit} disabled={loading}>{loading ? 'Создание…' : 'Создать протокол'}</Button>
        )}
      </div>
    </Modal>
  );
};

export default CreateProtocolModal;
