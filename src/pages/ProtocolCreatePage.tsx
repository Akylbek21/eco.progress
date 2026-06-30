import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { getCompanies, getCompanyObjects } from '../services/companyService';
import { getLaboratories, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import protocolService from '../services/protocolService';
import { useToast } from '../hooks/useToast';
import type { Company, CompanyObject } from '../types/companies';
import type { CreateProtocolPayload, LaboratoryEmployee, LaboratorySummary, ProtocolSubtype, ProtocolTemplateId } from '../types/protocols';

type TemplateChoice = {
  key: string;
  label: string;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
};

const templateChoices: TemplateChoice[] = [
  { key: 'ambient_air', label: 'Атмосферный воздух / СЗЗ', templateId: 'ambient_air' },
  { key: 'industrial_emissions', label: 'Промышленные выбросы', templateId: 'industrial_emissions' },
  { key: 'water_wastewater', label: 'Вода / сточная вода', templateId: 'water_wastewater' },
  { key: 'soil', label: 'Почва', templateId: 'soil' },
  { key: 'microclimate', label: 'Микроклимат', templateId: 'physical_factors', subtype: 'MICROCLIMATE' },
  { key: 'lighting', label: 'Освещённость', templateId: 'physical_factors', subtype: 'LIGHTING' },
  { key: 'noise_vibration', label: 'Шум / вибрация', templateId: 'physical_factors', subtype: 'NOISE_VIBRATION' },
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100';
const today = () => new Date().toISOString().slice(0, 10);

const ProtocolCreatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [employees, setEmployees] = useState<LaboratoryEmployee[]>([]);
  const [warning, setWarning] = useState('');
  const [employeeWarning, setEmployeeWarning] = useState('');
  const [form, setForm] = useState({
    templateKey: 'ambient_air',
    companyId: '',
    objectId: '',
    protocolDate: today(),
    samplingDate: today(),
    testingStartDate: today(),
    testingEndDate: today(),
    measurementPlace: '',
    laboratoryId: '',
    executorId: '',
    temperature: '',
    humidity: '',
    pressureKpa: '',
    windSpeed: '',
    comment: '',
  });

  const selectedTemplate = useMemo(
    () => templateChoices.find((item) => item.key === form.templateKey) || templateChoices[0],
    [form.templateKey],
  );

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setBooting(true);
      setWarning('');
      try {
        await protocolService.getProtocolTemplates().catch(() => []);
        const [companyItems, laboratoryItems] = await Promise.all([
          getCompanies({ status: 'ACTIVE' }).catch((error) => {
            toast.error('Не удалось загрузить компании', error instanceof Error ? error.message : undefined);
            return [];
          }),
          getLaboratories().catch((error) => {
            toast.warning('Лаборатория не настроена', error instanceof Error ? error.message : undefined);
            return [];
          }),
        ]);
        if (!mounted) return;
        setCompanies(companyItems);
        setLaboratories(laboratoryItems);
        if (!companyItems.length) setWarning('Компании не найдены. Создать протокол можно будет после добавления компании.');
        const defaultLab = laboratoryItems.find((item) => item.isDefault) || (laboratoryItems.length === 1 ? laboratoryItems[0] : undefined);
        if (defaultLab) setForm((current) => ({ ...current, laboratoryId: defaultLab.id }));
        if (!laboratoryItems.length) setWarning((current) => current || 'Лаборатория не настроена. Заполните справочник лаборатории.');
      } finally {
        if (mounted) setBooting(false);
      }
    };
    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!form.companyId) {
      setObjects([]);
      setForm((current) => ({ ...current, objectId: '' }));
      return;
    }
    getCompanyObjects(form.companyId)
      .then((items) => {
        const active = items.filter((item) => item.status === 'ACTIVE');
        setObjects(active);
        setForm((current) => ({ ...current, objectId: active.find((item) => item.id === current.objectId)?.id || active[0]?.id || '' }));
      })
      .catch((error) => {
        setObjects([]);
        toast.error('Не удалось загрузить объекты компании', error instanceof Error ? error.message : undefined);
      });
  }, [form.companyId]);

  useEffect(() => {
    if (!form.laboratoryId) {
      setEmployees([]);
      setEmployeeWarning('');
      setForm((current) => ({ ...current, executorId: '' }));
      return;
    }
    setEmployees([]);
    setEmployeeWarning('');
    setForm((current) => ({ ...current, executorId: '' }));
    getLaboratoryEmployees(form.laboratoryId)
      .then((items) => {
        setEmployees(items);
        if (!items.length) setEmployeeWarning('Сотрудники лаборатории не найдены');
        setForm((current) => ({ ...current, executorId: items[0]?.id || '' }));
      })
      .catch((error) => {
        setEmployees([]);
        setEmployeeWarning('Сотрудники лаборатории не найдены');
        toast.error('Не удалось загрузить исполнителей лаборатории', error instanceof Error ? error.message : undefined);
      });
  }, [form.laboratoryId]);

  const setField = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const changeLaboratory = (value: string) => {
    setEmployees([]);
    setEmployeeWarning('');
    setForm((current) => ({ ...current, laboratoryId: value, executorId: '' }));
  };

  const validate = () => {
    if (!selectedTemplate.templateId) return 'Выберите тип протокола';
    if (!form.companyId) return 'Выберите компанию';
    if (!form.objectId) return 'Выберите объект';
    if (!form.protocolDate) return 'Укажите дату протокола';
    if (!form.samplingDate) return 'Укажите дату отбора';
    if (!form.laboratoryId) return 'Выберите лабораторию';
    if (!form.executorId) return 'Выберите исполнителя';
    return '';
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = validate();
    if (message) {
      toast.warning(message);
      return;
    }
    const payload: CreateProtocolPayload = {
      companyId: form.companyId,
      objectId: form.objectId,
      templateId: selectedTemplate.templateId,
      subtype: selectedTemplate.subtype,
      protocolDate: form.protocolDate,
      samplingDate: form.samplingDate,
      testingStartDate: form.testingStartDate || form.samplingDate,
      testingEndDate: form.testingEndDate || form.samplingDate,
      measurementDate: form.samplingDate,
      measurementPlace: form.measurementPlace,
      laboratoryId: form.laboratoryId,
      executorId: form.executorId,
      purpose: 'Лабораторные испытания',
      environment: {
        temperature: form.temperature,
        humidity: form.humidity,
        pressureKpa: form.pressureKpa,
        windSpeed: form.windSpeed,
        comment: form.comment,
        source: 'MANUAL',
        dataSource: 'manual',
      },
    };

    setLoading(true);
    try {
      const protocol = await protocolService.createProtocol(payload);
      if (!protocol.id) throw new Error('Backend не вернул id протокола');
      toast.success('Протокол создан');
      navigate(`/staff/protocols/${protocol.id}`, { replace: true });
    } catch (error) {
      toast.error('Не удалось создать протокол', error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/protocols')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700">
            <ArrowLeft className="h-4 w-4" /> Назад к протоколам
          </button>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Создать протокол</h1>
          <p className="mt-1 text-sm text-slate-500">Заполните основные данные. Результаты испытаний добавляются в редакторе.</p>
        </div>
        <Button type="submit" disabled={loading || booting}>
          <Save className="h-4 w-4" /> Создать протокол
        </Button>
      </header>

      {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{warning}</div>}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <h2 className="text-lg font-black text-slate-900 lg:col-span-2">1. Тип протокола</h2>
        <select value={form.templateKey} onChange={(event) => setField('templateKey', event.target.value)} className={inputClass}>
          {templateChoices.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <h2 className="text-lg font-black text-slate-900 lg:col-span-2">2. Заказчик и объект</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Компания</span>
          <select value={form.companyId} onChange={(event) => setField('companyId', event.target.value)} className={inputClass} disabled={booting || !companies.length}>
            <option value="">Выберите компанию</option>
            {companies.map((item) => <option key={item.id} value={item.id}>{item.name} {item.bin ? `· ${item.bin}` : ''}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Объект</span>
          <select value={form.objectId} onChange={(event) => setField('objectId', event.target.value)} className={inputClass} disabled={!form.companyId || !objects.length}>
            <option value="">Выберите объект</option>
            {objects.map((item) => <option key={item.id} value={item.id}>{item.name} {item.address ? `· ${item.address}` : ''}</option>)}
          </select>
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">3. Даты и место измерения</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Дата протокола</span><input type="date" value={form.protocolDate} onChange={(event) => setField('protocolDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Дата отбора</span><input type="date" value={form.samplingDate} onChange={(event) => setField('samplingDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Начало испытаний</span><input type="date" value={form.testingStartDate} onChange={(event) => setField('testingStartDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Окончание испытаний</span><input type="date" value={form.testingEndDate} onChange={(event) => setField('testingEndDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-4"><span>Место измерения</span><input value={form.measurementPlace} onChange={(event) => setField('measurementPlace', event.target.value)} className={inputClass} /></label>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <h2 className="text-lg font-black text-slate-900 lg:col-span-2">4. Лаборатория и исполнитель</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Лаборатория</span>
          <select value={form.laboratoryId} onChange={(event) => changeLaboratory(event.target.value)} className={inputClass} disabled={!laboratories.length}>
            <option value="">Выберите лабораторию</option>
            {laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · по умолчанию' : ''}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Исполнитель</span>
          <select value={form.executorId} onChange={(event) => setField('executorId', event.target.value)} className={inputClass} disabled={!employees.length}>
            <option value="">Выберите исполнителя</option>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} {item.position ? `· ${item.position}` : ''}</option>)}
          </select>
          {employeeWarning && <p className="text-sm font-semibold text-amber-700">{employeeWarning}</p>}
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-5">5. Условия измерений</h2>
        <input value={form.temperature} onChange={(event) => setField('temperature', event.target.value)} placeholder="Температура, °C" className={inputClass} />
        <input value={form.humidity} onChange={(event) => setField('humidity', event.target.value)} placeholder="Влажность, %" className={inputClass} />
        <input value={form.pressureKpa} onChange={(event) => setField('pressureKpa', event.target.value)} placeholder="Давление, кПа" className={inputClass} />
        <input value={form.windSpeed} onChange={(event) => setField('windSpeed', event.target.value)} placeholder="Скорость ветра, м/с" className={inputClass} />
        <input value={form.comment} onChange={(event) => setField('comment', event.target.value)} placeholder="Комментарий" className={inputClass} />
      </section>
    </form>
  );
};

export default ProtocolCreatePage;
