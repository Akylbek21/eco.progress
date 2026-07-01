import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, CloudSun, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { getCompanies, getCompanyById, getCompanyObjects } from '../../services/companyService';
import { getMeasurementDevices } from '../../services/measurementDeviceService';
import { getApiErrorMessage, getApiStatus } from '../../services/apiHelpers';
import protocolService from '../../services/protocolService';
import { accreditationState, getLaboratories, getLaboratory, getLaboratoryEmployees } from '../../services/laboratorySettingsService';
import { useAuth } from '../../contexts/AuthContext';
import type { Company, CompanyObject } from '../../types/companies';
import type {
  CreateProtocolPayload,
  LaboratoryEmployee,
  LaboratoryProfile,
  LaboratorySummary,
  MeasurementDevice,
  NormativeRecord,
  Pollutant,
  ProtocolEnvironmentalConditions,
  ProtocolResultPayload,
  ProtocolSubtype,
  ProtocolTemplate,
  ProtocolTemplateId,
  WeatherConditionsStatus,
} from '../../types/protocols';
import { physicalFactorTypes, protocolTemplates, subtypeName, templateName } from '../../data/protocolTemplates';
import { filterPhysicalFactorIndicators, getPhysicalFactorIndicators } from '../../data/physicalFactors';

type Props = {
  open: boolean;
  loading?: boolean;
  templates?: ProtocolTemplate[];
  onClose: () => void;
  onCreate: (payload: CreateProtocolPayload, results: ProtocolResultPayload[]) => void | Promise<void>;
};

type DraftRow = {
  key: string;
  pollutant: Pollutant;
  reading: string;
  deviceId: string;
  normative?: NormativeRecord;
  normativeCandidates?: NormativeRecord[];
  warning?: string;
};

type SearchState = 'idle' | 'minLength' | 'searching' | 'empty' | 'ready' | 'error';

const today = () => new Date().toISOString().slice(0, 10);
const DEFAULT_WEATHER_TIME = '12:00';
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 700;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const automaticClass = `${inputClass} bg-slate-100 text-slate-600`;
const allowedTemplateIds = new Set(protocolTemplates.map((item) => item.id));
const searchUnavailableMessage = 'Поиск временно недоступен. Добавьте показатель вручную.';
const normativeNotFoundMessage = 'Норматив не найден. Можно выбрать вручную или добавить в справочник.';
const notFoundSearchMessage = 'Норматив или показатель не найден. Проверьте код или добавьте норматив в справочник.';
const canSearch = (value: string) => value.trim().length >= MIN_SEARCH_LENGTH;
const sourceDocumentCodeForTemplate = (templateId: ProtocolTemplateId | '', isPhysicalFactors: boolean) => {
  if (isPhysicalFactors) return 'DSM_15';
  if (templateId === 'soil') return 'DSM_32';
  if (['ambient_air', 'workplace_air', 'industrial_emissions'].includes(String(templateId))) return 'DSM_70';
  return '';
};
const weatherLabels: Record<WeatherConditionsStatus, string> = {
  IDLE: 'Ожидает даты, времени и объекта',
  LOADING: 'Загрузка условий…',
  LOADED: 'Условия загружены автоматически',
  API_UNAVAILABLE: 'Погодный API недоступен',
  COORDINATES_MISSING: 'У объекта отсутствуют координаты',
  MANUAL: 'Значения введены вручную',
};
const CreateProtocolModal = ({ open, loading = false, templates, onClose, onCreate }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState<ProtocolTemplateId | ''>('');
  const [subtype, setSubtype] = useState<ProtocolSubtype | ''>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [company, setCompany] = useState<Company | null>(null);
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [objectId, setObjectId] = useState('');
  const [place, setPlace] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const [measurementDate, setMeasurementDate] = useState(today());
  const [measurementTime, setMeasurementTime] = useState(DEFAULT_WEATHER_TIME);
  const [environment, setEnvironment] = useState<ProtocolEnvironmentalConditions>({ status: 'IDLE', source: 'API' });
  const [weatherDetails, setWeatherDetails] = useState(false);
  const [weatherRefresh, setWeatherRefresh] = useState(0);
  const [weatherEditOpen, setWeatherEditOpen] = useState(false);
  const [weatherEdit, setWeatherEdit] = useState<ProtocolEnvironmentalConditions>({});
  const [weatherReason, setWeatherReason] = useState('');
  const [devices, setDevices] = useState<MeasurementDevice[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [laboratoryId, setLaboratoryId] = useState('');
  const [laboratory, setLaboratory] = useState<LaboratoryProfile | null>(null);
  const [laboratoryEmployees, setLaboratoryEmployees] = useState<LaboratoryEmployee[]>([]);
  const [executorId, setExecutorId] = useState('');
  const [laboratoryLoading, setLaboratoryLoading] = useState(true);
  const [laboratoryError, setLaboratoryError] = useState('');
  const [laboratoryDetails, setLaboratoryDetails] = useState(false);
  const [lastDeviceId, setLastDeviceId] = useState('');
  const [pollutantQuery, setPollutantQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Pollutant[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [sourceParameters, setSourceParameters] = useState<Record<string, string>>({
    flowSpeed: '', ductShape: 'ROUND', diameter: '', width: '', height: '', temperature: '', pressureKpa: '',
  });
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const weatherAbortRef = useRef<AbortController | null>(null);
  const searchAbortRef = useRef(0);

  const visibleTemplates = useMemo(() => {
    const backendTemplates = (templates || []).filter((item) => allowedTemplateIds.has(item.id));
    return protocolTemplates.map((fallback) => backendTemplates.find((item) => item.id === fallback.id) || fallback);
  }, [templates]);
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    return companies.filter((item) => item.status === 'ACTIVE')
      .filter((item) => !query || `${item.name} ${item.bin}`.toLowerCase().includes(query)).slice(0, 12);
  }, [companies, companySearch]);
  const selectedObject = objects.find((item) => item.id === objectId);
  const canUseAdvanced = user?.role === 'ADMIN' || user?.role === 'HEAD' || user?.role === 'DIRECTOR';
  const laboratoryAccreditation = accreditationState(laboratory?.accreditationValidUntil);
  const isPhysicalFactors = templateId === 'physical_factors';

  useEffect(() => {
    if (!open) return;
    Promise.all([
      getCompanies({ status: 'ACTIVE' }).catch(() => []),
      getMeasurementDevices().catch(() => []),
      getLaboratories().catch(() => []),
    ]).then(([companyItems, deviceItems, laboratoryItems]) => {
      setCompanies(companyItems);
      setDevices(deviceItems.filter((item) => item.status === 'VALID' || item.status === 'EXPIRING'));
      const active = laboratoryItems.filter((item) => item.active);
      setLaboratories(active);
      const selected = active.length === 1 ? active[0] : active.find((item) => item.isDefault);
      setLaboratoryId(selected?.id || '');
      if (!selected) setLaboratory(null);
      setLaboratoryError(active.length > 1 && !selected ? 'Лаборатория по умолчанию не настроена. Выберите лабораторию.' : '');
    }).catch((loadError) => {
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить справочники'));
      setLaboratoryError('API лабораторий недоступен.');
    }).finally(() => setLaboratoryLoading(false));
  }, [open]);

  useEffect(() => {
    if (!laboratoryId) {
      setLaboratory(null);
      setLaboratoryEmployees([]);
      setExecutorId('');
      return;
    }
    setLaboratoryLoading(true);
    setLaboratoryError('');
    Promise.all([getLaboratory(laboratoryId), getLaboratoryEmployees(laboratoryId)])
      .then(([profile, employees]) => {
        const active = employees.filter((employee) => employee.active);
        setLaboratory(profile);
        setLaboratoryEmployees(active);
        const current = active.find((employee) => String(employee.userId || employee.id) === String(user?.id));
        setExecutorId((existing) => active.some((employee) => String(employee.userId || employee.id) === existing)
          ? existing
          : String(current?.userId || current?.id || ''));
        if (!profile.laboratoryHeadId && !profile.laboratoryHeadName) setLaboratoryError('В карточке лаборатории не выбран заведующий.');
        else if (!current) setLaboratoryError('Текущий пользователь не может быть исполнителем. Выберите активного сотрудника.');
      })
      .catch((loadError) => setLaboratoryError(getApiErrorMessage(loadError, 'Данные лаборатории загрузить не удалось.')))
      .finally(() => setLaboratoryLoading(false));
  }, [laboratoryId, user?.id]);

  useEffect(() => {
    if (!objectId || !measurementDate) return;
    const timer = window.setTimeout(async () => {
      weatherAbortRef.current?.abort();
      const controller = new AbortController();
      weatherAbortRef.current = controller;
      setEnvironment((current) => ({ ...current, status: 'LOADING', source: 'API' }));
      try {
        const weather = await protocolService.getWeatherConditions({
          objectId, date: measurementDate, time: measurementTime, signal: controller.signal,
        });
        setEnvironment({ ...weather });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setEnvironment((current) => ({ ...current, status: 'API_UNAVAILABLE', source: 'API' }));
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [objectId, measurementDate, measurementTime, weatherRefresh]);

  useEffect(() => {
    const query = pollutantQuery.trim();
    const requestId = ++searchAbortRef.current;
    if (!query) {
      setSuggestions([]);
      setSearching(false);
      setSearchState('idle');
      return;
    }
    if (!canSearch(query) || query.includes(',') || query.includes(';')) {
      setSuggestions([]);
      setSearching(false);
      setSearchState('minLength');
      return;
    }
    setSuggestions([]);
    setSearching(false);
    setSearchState('idle');
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchState('searching');
      try {
        const apiItems = await protocolService.searchPollutants(query, {
          templateId,
          subtype: subtype || '',
          objectId,
          code: query,
          pollutantCode: query,
          sourceDocumentCode: sourceDocumentCodeForTemplate(templateId, isPhysicalFactors),
          factorType: isPhysicalFactors ? subtype || '' : '',
          factorCode: isPhysicalFactors ? query : '',
        });
        if (requestId === searchAbortRef.current) {
          const localItems = isPhysicalFactors ? filterPhysicalFactorIndicators(query, subtype).slice(0, 10) : [];
          const next = (apiItems.length ? apiItems : localItems).slice(0, 10);
          setSuggestions(next);
          setSearchState(next.length ? 'ready' : 'empty');
        }
      } catch (searchError) {
        if (requestId === searchAbortRef.current) {
          if (getApiStatus(searchError) === 500) setError(searchUnavailableMessage);
          setSuggestions([]);
          setSearchState('error');
        }
      } finally {
        if (requestId === searchAbortRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [pollutantQuery, templateId, subtype, objectId, isPhysicalFactors]);

  const selectCompany = async (id: string) => {
    setError('');
    try {
      const fullCompany = await getCompanyById(id);
      setCompany(fullCompany);
      setCompanySearch(`${fullCompany.name}${fullCompany.bin ? `, ${fullCompany.bin}` : ''}`);
      setObjectId('');
      try {
        const items = (await getCompanyObjects(id)).filter((item) => item.status === 'ACTIVE');
        setObjects(items);
        if (items.length === 1) setObjectId(items[0].id);
      } catch (objectError) {
        setObjects([]);
        setError(getApiErrorMessage(objectError, 'Компания выбрана, но объекты загрузить не удалось. Повторите попытку.'));
      }
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Не удалось загрузить данные компании'));
    }
  };

  const copyLastQuarter = async () => {
    setError('');
    try {
      const previous = (await protocolService.getProtocols())
        .filter((item) => item.status !== 'CANCELLED')
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
      if (!previous) return setError('Подходящий прошлый протокол не найден.');
      setTemplateId(previous.templateId);
      setSubtype(previous.subtype || '');
      setPlace(previous.measurementPlace || String(previous.results[0]?.values.measurementPlace || previous.results[0]?.values.samplingPlace || ''));
      setSourceNumber(previous.sourceNumber || String(previous.results[0]?.values.sourceNumber || ''));
      setLaboratoryId(previous.laboratory.laboratoryId || laboratoryId);
      setExecutorId(previous.executorId || previous.laboratory.executorId || '');
      if (previous.companyId) {
        await selectCompany(String(previous.companyId));
        setObjectId(String(previous.objectId || ''));
      }
      setRows(previous.results.map((row) => ({
        key: `copy-${row.id}-${Date.now()}`,
        pollutant: {
          code: String(row.values.pollutantCode || row.values.code || ''),
          name: String(row.values.indicator || row.indicator || ''),
          cas: String(row.values.cas || ''),
          formula: String(row.values.formula || ''),
          unit: String(row.values.unit || row.unit || ''),
          testingMethod: String(row.values.testingMethod || row.testingMethod || ''),
        },
        reading: '',
        deviceId: row.measurementDeviceId || String(row.values.measurementDeviceId || ''),
      })));
      setStep(2);
    } catch (copyError) {
      setError(getApiErrorMessage(copyError, 'Не удалось загрузить прошлый протокол'));
    }
  };

  const loadNormative = async (pollutant: Pollutant): Promise<Pick<DraftRow, 'normative' | 'normativeCandidates' | 'warning'>> => {
    try {
      const found = await protocolService.searchNormative({
        templateId,
        subtype: subtype || '',
        code: pollutant.code,
        pollutantCode: isPhysicalFactors ? '' : pollutant.code,
        indicator: pollutant.name,
        query: `${pollutant.code} ${pollutant.name}`.trim(),
        unit: pollutant.unit || '',
        objectId,
        date: measurementDate,
        sourceDocumentCode: sourceDocumentCodeForTemplate(templateId, isPhysicalFactors),
        factorType: isPhysicalFactors ? subtype || '' : '',
        factorCode: isPhysicalFactors ? pollutant.code : '',
      });
      const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
      if (!candidates.length) return { warning: normativeNotFoundMessage };
      if (candidates.length > 1) return { normativeCandidates: candidates, warning: 'Выберите норматив' };
      return { normative: candidates[0] };
    } catch (searchError) {
      if (getApiStatus(searchError) === 500) return { warning: searchUnavailableMessage };
      return { warning: normativeNotFoundMessage };
    }
  };

  const addPollutant = async (pollutant: Pollutant) => {
    const normativeState = await loadNormative(pollutant);
    setRows((current) => (
      current.some((row) => row.pollutant.code.toLowerCase() === pollutant.code.toLowerCase())
        ? current
        : [...current, {
          key: `${pollutant.code}-${Date.now()}-${Math.random()}`,
          pollutant,
          reading: '',
          deviceId: lastDeviceId,
          ...normativeState,
        }]
    ));
    setPollutantQuery('');
    setSuggestions([]);
  };

  const addBulk = async () => {
    const tokens = pollutantQuery.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
    if (!tokens.length) {
      setError('Введите код или название показателя');
      return;
    }
    if (tokens.some((token) => !canSearch(token))) {
      setError('Введите минимум 3 символа для поиска');
      return;
    }
    setSearching(true);
    try {
      let hasMissing = false;
      for (const token of tokens) {
        const apiItems = await protocolService.searchPollutants(token, {
          templateId,
          subtype: subtype || '',
          objectId,
          code: token,
          pollutantCode: token,
          sourceDocumentCode: sourceDocumentCodeForTemplate(templateId, isPhysicalFactors),
          factorType: isPhysicalFactors ? subtype || '' : '',
          factorCode: isPhysicalFactors ? token : '',
        }).catch((searchError) => {
            if (getApiStatus(searchError) === 500) setError(searchUnavailableMessage);
            return [];
          });
        const found = apiItems.length || !isPhysicalFactors ? apiItems : getPhysicalFactorIndicators(subtype);
        const normalized = token.toLowerCase();
        const pollutant = found.find((item) => item.code.toLowerCase() === normalized)
          || found.find((item) => `${item.code} ${item.name}`.toLowerCase().includes(normalized));
        if (!pollutant) {
          hasMissing = true;
          setError(notFoundSearchMessage);
          continue;
        }
        await addPollutant(pollutant);
      }
      if (!hasMissing) setError('');
    } catch (searchError) {
      setError(getApiErrorMessage(searchError, 'Не удалось выполнить массовый поиск веществ'));
    } finally {
      setSearching(false);
    }
  };

  const addPhysicalMeasurement = async (pollutant?: Pollutant) => {
    if (!pollutant && !pollutantQuery.trim()) {
      setSuggestions(getPhysicalFactorIndicators(subtype).slice(0, 10));
      return;
    }
    if (!pollutant && !canSearch(pollutantQuery)) {
      setError('Введите минимум 3 символа для поиска');
      return;
    }
    const matches = filterPhysicalFactorIndicators(pollutantQuery, subtype);
    const selected = pollutant || matches[0];
    if (!selected) {
      setError('Показатель не найден. Выберите показатель из справочника.');
      return;
    }
    const normativeState = await loadNormative(selected);
    setRows((current) => [...current, { key: `${selected.code}-${Date.now()}`, pollutant: selected, reading: '', deviceId: lastDeviceId, ...normativeState }]);
    setPollutantQuery('');
    setSuggestions([]);
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (step === 1 && !templateId) next.templateId = 'Выберите тип протокола';
    if (step === 1 && templateId === 'physical_factors' && !subtype) next.subtype = 'Выберите подтип';
    if (step === 2 && !company) next.company = 'Выберите компанию';
    if (step === 2 && !objectId) next.objectId = 'Выберите объект';
    if (step === 2 && !measurementDate) next.measurementDate = 'Укажите дату';
    if (step === 2 && !measurementTime) next.measurementTime = 'Укажите время замера';
    if (step === 2 && !laboratoryId) next.laboratoryId = 'Выберите лабораторию';
    if (step === 2 && !executorId) next.executorId = 'Выберите исполнителя';
    if (step === 2 && laboratoryAccreditation.status === 'EXPIRED') next.laboratoryId = 'Аттестат лаборатории истёк';
    if (step === 2 && !['LOADED', 'MANUAL'].includes(environment.status || '')) next.environment = 'Загрузите погодные условия или заполните вручную';
    if (step === 3 && !rows.length) next.rows = 'Добавьте хотя бы одно измерение';
    if (step === 3 && rows.some((row) => !row.reading.trim())) next.rows = 'Заполните первичные показания';
    if (step === 3 && rows.some((row) => !row.deviceId)) next.rows = 'Выберите прибор для каждой строки';
    if (step === 3 && rows.some((row) => !row.normative)) next.rows = 'Выберите норматив для каждой строки или добавьте его в справочник';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (!validate()) return;
    setStep((current) => Math.min(4, current + 1));
  };

  const saveManualWeather = () => {
    if (!weatherReason.trim()) {
      setFieldErrors((current) => ({ ...current, weatherReason: 'Причина изменения обязательна' }));
      return;
    }
    setEnvironment({ ...environment, ...weatherEdit, status: 'MANUAL', source: 'MANUAL', dataSource: 'Введено сотрудником', observedAt: new Date().toISOString(), manualChangeReason: weatherReason.trim() });
    setWeatherEditOpen(false);
  };

  const submit = async () => {
    if (loading || !company || !objectId || !templateId || !validate()) return;
    const results: ProtocolResultPayload[] = rows.map((row) => ({
      normativeId: row.normative?.id,
      measurementDeviceId: row.deviceId || undefined,
      values: {
        pollutantCode: row.pollutant.code,
        indicator: row.pollutant.name,
        cas: row.pollutant.cas || '',
        formula: row.pollutant.formula || '',
        unit: row.normative?.unit || row.pollutant.unit || '',
        primaryReading: row.reading,
        measurementReadings: row.reading,
        measurementDeviceId: row.deviceId,
        normativeId: row.normative?.id || '',
        normative: row.normative?.value || '',
        normativeMin: row.normative?.min || '',
        normativeMax: row.normative?.max || row.normative?.value || '',
        minValue: row.normative?.min || '',
        maxValue: row.normative?.max || row.normative?.value || '',
        normativeDocument: row.normative?.normativeDocument || '',
        sourceDocumentCode: row.normative?.sourceDocumentCode || sourceDocumentCodeForTemplate(templateId, templateId === 'physical_factors'),
        sourceDocumentName: row.normative?.sourceDocumentName || '',
        appendixNo: row.normative?.appendixNo || '',
        tableNo: row.normative?.tableNo || '',
        factorCode: row.normative?.factorCode || row.pollutant.code,
        testingMethod: row.normative?.testingMethod || row.pollutant.testingMethod || '',
        comparisonType: row.normative?.comparisonType || '',
        measurementPlace: place,
        samplingPlace: place,
        ...(templateId === 'physical_factors' ? { factorType: subtype || '', subtype: subtype || '' } : {}),
        sourceNumber,
        measurementDate,
        measurementTime,
        ...sourceParameters,
      },
    }));
    try {
      setError('');
      await onCreate({
        companyId: company.id,
        objectId,
        templateId,
        subtype: templateId === 'physical_factors' ? subtype || undefined : undefined,
        protocolDate: measurementDate,
        sampleDate: measurementDate,
        samplingDate: measurementDate,
        testingStartDate: measurementDate,
        testingEndDate: measurementDate,
        measurementDate,
        measurementTime,
        measurementPlace: place,
        sourceNumber,
        laboratoryId,
        executorId,
        environment,
      }, results);
    } catch (createError) {
      setError(getApiErrorMessage(createError, 'Не удалось создать протокол. Введённые данные сохранены в форме.'));
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Быстрое создание протокола" description={`Шаг ${step} из 4 · обычно 2–5 минут`} size="xl" loading={loading}>
        <div className="mb-6 grid grid-cols-4 gap-2">
          {['Тип', 'Объект и время', 'Показания', 'Проверка'].map((label, index) => (
            <div key={label}>
              <div className={`h-2 rounded-full ${index + 1 <= step ? 'bg-eco-600' : 'bg-slate-100'}`} />
              <p className={`mt-1 hidden text-center text-xs font-bold sm:block ${index + 1 === step ? 'text-eco-800' : 'text-slate-400'}`}>{label}</p>
            </div>
          ))}
        </div>

        {step === 1 && <section className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
            <h3 className="text-lg font-black text-slate-900">Тип протокола</h3>
            <p className="mt-1 text-sm text-slate-500">Служебные поля backend заполнит автоматически.</p>
            </div>
            <Button type="button" variant="secondary" onClick={copyLastQuarter}>Создать как в прошлом квартале</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleTemplates.map((item) => (
              <button key={item.id} type="button" onClick={() => { setTemplateId(item.id); if (item.id !== 'physical_factors') setSubtype(''); }}
                className={`min-h-24 rounded-2xl border p-4 text-left ${templateId === item.id ? 'border-eco-600 bg-eco-50 ring-2 ring-eco-100' : 'border-slate-200 hover:border-eco-300'}`}>
                <span className="font-bold text-slate-900">{item.name}</span>
                <span className="mt-2 block text-xs font-semibold text-slate-500">{item.description}</span>
              </button>
            ))}
          </div>
          {fieldErrors.templateId && <p className="text-sm font-semibold text-rose-700">{fieldErrors.templateId}</p>}
          {templateId === 'physical_factors' && <div>
            <p className="mb-2 text-sm font-bold text-slate-700">Подтип физического фактора</p>
            <div className="flex flex-wrap gap-2">
              {physicalFactorTypes.map((item) => <button key={item.value} type="button" onClick={() => setSubtype(item.value)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${subtype === item.value ? 'border-eco-600 bg-eco-50 text-eco-800' : 'border-slate-200 text-slate-600'}`}>{item.label}</button>)}
            </div>
            {fieldErrors.subtype && <p className="mt-2 text-sm font-semibold text-rose-700">{fieldErrors.subtype}</p>}
          </div>}
        </section>}

        {step === 2 && <section className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">Компания</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input value={companySearch} onChange={(event) => { setCompanySearch(event.target.value); setCompany(null); }} placeholder="Название или БИН" className={`${inputClass} pl-10`} />
              </div>
              {!company && companySearch && <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {filteredCompanies.map((item) => <button key={item.id} type="button" onClick={() => selectCompany(item.id)} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-eco-50">
                  <span className="block font-bold">{item.name}</span><span className="text-xs text-slate-500">{item.bin || 'БИН не указан'}</span>
                </button>)}
              </div>}
              {fieldErrors.company && <p className="text-sm font-semibold text-rose-700">{fieldErrors.company}</p>}
            </div>
            <label className="space-y-2 text-sm font-bold text-slate-700">Объект
              <select value={objectId} onChange={(event) => setObjectId(event.target.value)} disabled={!company} className={inputClass}>
                <option value="">Выберите объект</option>
                {objects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldErrors.objectId && <span className="block text-sm text-rose-700">{fieldErrors.objectId}</span>}
            </label>
            <label className="space-y-2 text-sm font-bold text-slate-700">Место или источник
              <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder={selectedObject?.samplingLocation || 'Например, котёл №1'} className={inputClass} />
            </label>
            {templateId === 'industrial_emissions' && <label className="space-y-2 text-sm font-bold text-slate-700">Номер источника
              <input value={sourceNumber} onChange={(event) => setSourceNumber(event.target.value)} placeholder="0001" className={inputClass} />
            </label>}
            <label className="space-y-2 text-sm font-bold text-slate-700">Дата замера
              <input
                type="date"
                max={today()}
                value={measurementDate}
                onChange={(event) => {
                  setMeasurementDate(event.target.value);
                }}
                className={inputClass}
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-slate-700">Время замера
              <input type="time" value={measurementTime} onChange={(event) => setMeasurementTime(event.target.value)} className={inputClass} />
              <span className="block text-xs font-semibold text-slate-500">Погодные данные запрашиваются на фактическое время замера.</span>
              {fieldErrors.measurementTime && <span className="block text-sm text-rose-700">{fieldErrors.measurementTime}</span>}
            </label>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-black text-slate-900">Лаборатория</h3>
                <p className="mt-1 text-xs text-slate-500">Реквизиты загружаются из настроек и фиксируются backend в snapshot.</p>
              </div>
              {laboratories.length > 1 && <select value={laboratoryId} onChange={(event) => setLaboratoryId(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm sm:max-w-sm">
                <option value="">Выберите лабораторию</option>
                {laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · по умолчанию' : ''}</option>)}
              </select>}
            </div>
            {laboratoryLoading ? <div className="mt-4 grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 rounded-xl bg-slate-100" />)}</div>
              : laboratory ? <>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {[
                    ['Лаборатория', laboratory.name],
                    ['Аттестат', laboratory.accreditationNumber || '—'],
                    ['Действителен до', laboratory.accreditationValidUntil || '—'],
                    ['Заведующий', laboratory.laboratoryHeadName || 'Не выбран'],
                  ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>)}
                  <label className="rounded-xl bg-white text-xs font-bold uppercase text-slate-400">Исполнитель
                    <select value={executorId} onChange={(event) => { setExecutorId(event.target.value); if (laboratory?.laboratoryHeadId || laboratory?.laboratoryHeadName) setLaboratoryError(''); }} className={`${inputClass} mt-1 normal-case`}>
                      <option value="">Выберите исполнителя</option>
                      {laboratoryEmployees.map((employee) => <option key={employee.id} value={employee.userId || employee.id}>{employee.fullName} · {employee.position || 'сотрудник'}</option>)}
                    </select>
                  </label>
                </div>
                {laboratoryAccreditation.status === 'EXPIRED' && <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">Аттестат лаборатории истёк. Создать черновик можно, но подписание будет заблокировано.</div>}
                {laboratoryAccreditation.status === 'EXPIRING' && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Срок аттестата скоро закончится: осталось {laboratoryAccreditation.daysLeft} дн.</div>}
                <button type="button" onClick={() => setLaboratoryDetails((value) => !value)} className="mt-3 text-sm font-bold text-eco-700">{laboratoryDetails ? 'Скрыть подробности' : 'Подробнее'}</button>
                {laboratoryDetails && <dl className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[['Юридическое название', laboratory.legalName], ['БИН', laboratory.bin], ['Адрес', laboratory.address], ['Телефон', laboratory.phone], ['Email', laboratory.email], ['Директор', laboratory.directorName], ['Дата выдачи', laboratory.accreditationIssuedAt], ['Примечание', laboratory.standardNote]].map(([label, value]) => <div key={label}><dt className="text-xs font-bold text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-700">{value || '—'}</dd></div>)}
                </dl>}
              </> : <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                <p>Лаборатория будет заполнена позже в редакторе протокола.</p>
              </div>}
            {laboratoryError && laboratory && <p className="mt-3 text-sm font-semibold text-amber-700">{laboratoryError}</p>}
            {(fieldErrors.laboratoryId || fieldErrors.executorId) && <p className="mt-2 text-sm font-semibold text-rose-700">{fieldErrors.laboratoryId || fieldErrors.executorId}</p>}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="flex items-center gap-2 font-bold text-slate-900"><CloudSun className="h-5 w-5 text-eco-700" /> Условия среды</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">{weatherLabels[environment.status || 'IDLE']}</p></div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setWeatherRefresh((value) => value + 1)}><RefreshCw className="h-4 w-4" /> Обновить условия</Button>
                <Button type="button" variant="secondary" onClick={() => { setWeatherEdit(environment); setWeatherReason(''); setWeatherEditOpen(true); }}>Изменить вручную</Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[['temperature', 'Температура, °C'], ['humidity', 'Влажность, %'], ['pressureKpa', 'Давление, кПа'], ['windSpeed', 'Ветер, м/с']].map(([key, label]) =>
                <label key={key} className="text-xs font-bold text-slate-500">{label}<input readOnly value={String(environment[key as keyof ProtocolEnvironmentalConditions] || '')} className={`${automaticClass} mt-1`} /></label>)}
            </div>
            <button type="button" onClick={() => setWeatherDetails((value) => !value)} className="mt-3 text-sm font-bold text-eco-700">{weatherDetails ? 'Скрыть подробности' : 'Подробнее'}</button>
            {weatherDetails && <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[['minTemperature', 'Мин. температура'], ['maxTemperature', 'Макс. температура'], ['minHumidity', 'Мин. влажность'], ['maxHumidity', 'Макс. влажность']].map(([key, label]) =>
                <label key={key} className="text-xs font-bold text-slate-500">{label}<input readOnly value={String(environment[key as keyof ProtocolEnvironmentalConditions] || '')} className={`${automaticClass} mt-1`} /></label>)}
            </div>}
            <div className="mt-3 grid gap-3 rounded-xl bg-white p-3 text-sm sm:grid-cols-2">
              <div><p className="text-xs font-bold uppercase text-slate-400">Источник данных</p><p className="mt-1 font-semibold text-slate-700">{environment.dataSource || (environment.source === 'MANUAL' ? 'Введено сотрудником' : 'Погодный сервис')}</p></div>
              <div><p className="text-xs font-bold uppercase text-slate-400">Фактическое время погодной записи</p><p className="mt-1 font-semibold text-slate-700">{environment.observedAt ? new Date(environment.observedAt).toLocaleString('ru-RU') : 'Не указано'}</p></div>
            </div>
            {fieldErrors.environment && <p className="mt-2 text-sm font-semibold text-rose-700">{fieldErrors.environment}</p>}
          </div>
        </section>}

        {step === 3 && <section className="space-y-5">
          {templateId === 'industrial_emissions' && <div className="rounded-2xl border border-eco-100 bg-eco-50/50 p-4">
            <h3 className="font-black text-slate-900">Параметры источника</h3>
            <p className="mt-1 text-xs text-slate-500">Вводятся один раз и применяются ко всем веществам источника {sourceNumber || '—'}.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-bold text-slate-600">Скорость потока, м/с<input type="number" step="any" value={sourceParameters.flowSpeed} onChange={(e) => setSourceParameters({ ...sourceParameters, flowSpeed: e.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-600">Форма газохода<select value={sourceParameters.ductShape} onChange={(e) => setSourceParameters({ ...sourceParameters, ductShape: e.target.value })} className={`${inputClass} mt-1`}><option value="ROUND">Круглый</option><option value="RECTANGULAR">Прямоугольный</option></select></label>
              {sourceParameters.ductShape === 'ROUND'
                ? <label className="text-xs font-bold text-slate-600">Диаметр, м<input type="number" step="any" value={sourceParameters.diameter} onChange={(e) => setSourceParameters({ ...sourceParameters, diameter: e.target.value })} className={`${inputClass} mt-1`} /></label>
                : <><label className="text-xs font-bold text-slate-600">Ширина, м<input type="number" step="any" value={sourceParameters.width} onChange={(e) => setSourceParameters({ ...sourceParameters, width: e.target.value })} className={`${inputClass} mt-1`} /></label><label className="text-xs font-bold text-slate-600">Высота, м<input type="number" step="any" value={sourceParameters.height} onChange={(e) => setSourceParameters({ ...sourceParameters, height: e.target.value })} className={`${inputClass} mt-1`} /></label></>}
              <label className="text-xs font-bold text-slate-600">Температура, °C<input type="number" step="any" value={sourceParameters.temperature} onChange={(e) => setSourceParameters({ ...sourceParameters, temperature: e.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs font-bold text-slate-600">Давление, кПа<input type="number" step="any" value={sourceParameters.pressureKpa} onChange={(e) => setSourceParameters({ ...sourceParameters, pressureKpa: e.target.value })} className={`${inputClass} mt-1`} /></label>
            </div>
          </div>}

          <div>
            <label className="text-sm font-bold text-slate-700">{isPhysicalFactors ? 'Показатель' : 'Код или название вещества'}</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input value={pollutantQuery} onChange={(event) => setPollutantQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBulk(); } }}
                placeholder={isPhysicalFactors ? 'Показатель: освещённость, шум, температура…' : 'Код или название вещества: 0301, азот…'} className={`${inputClass} pl-10 pr-28`} />
              <button type="button" disabled={searching} onClick={addBulk} className="absolute right-2 top-1.5 rounded-lg bg-eco-700 px-3 py-2 text-xs font-bold text-white">Добавить</button>
            </div>
            {searchState === 'minLength' && (
              <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600">
                Введите минимум 3 символа для поиска
              </div>
            )}
            {searching && (
              <div className="mt-2 rounded-xl border border-eco-100 bg-eco-50 p-3 text-sm font-semibold text-eco-800">
                Поиск...
              </div>
            )}
            {!searching && suggestions.length > 0 && (
              <p className="mt-2 text-xs font-bold uppercase text-slate-500">Выберите норматив из списка</p>
            )}
            {suggestions.length > 0 && <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {suggestions.map((item) => <button key={`${item.code}-${item.id || item.name}`} type="button" onClick={() => isPhysicalFactors ? addPhysicalMeasurement(item) : addPollutant(item)} className="flex w-full flex-col border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-black text-eco-800">{item.code}</span><span className="font-bold text-slate-900">{item.name}</span><span className="text-sm text-slate-500">{item.formula || ''}</span><span className="text-sm text-slate-500">{item.unit || ''}</span>
              </button>)}
            </div>}
            {!searching && searchState === 'empty' && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                {notFoundSearchMessage}
              </div>
            )}
            {isPhysicalFactors && !pollutantQuery.trim() && (
              <Button type="button" variant="secondary" className="mt-2" onClick={() => setSuggestions(getPhysicalFactorIndicators(subtype).slice(0, 10))}><Plus className="h-4 w-4" /> Показать список: {subtypeName(subtype)}</Button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-3 py-3">Код</th><th className="px-3 py-3">Вещество / показатель</th><th className="px-3 py-3">Первичные показания</th><th className="px-3 py-3">Прибор</th><th className="px-3 py-3">Норматив</th><th className="px-3 py-3" /></tr></thead>
              <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.key}>
                <td className="px-3 py-3 font-black text-eco-800">{row.pollutant.code}</td>
                <td className="px-3 py-3"><p className="font-bold">{row.pollutant.name}</p><p className="text-xs text-slate-500">{row.pollutant.formula} {row.pollutant.cas}</p></td>
                <td className="px-3 py-3"><input type="text" inputMode="decimal" value={row.reading} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, reading: event.target.value } : item))} className={inputClass} /></td>
                <td className="px-3 py-3"><select value={row.deviceId} onChange={(event) => { const deviceId = event.target.value; setLastDeviceId(deviceId); setRows((current) => current.map((item) => item.key === row.key ? { ...item, deviceId } : item)); }} className={inputClass}><option value="">Не выбран</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} · {device.serialNumber}</option>)}</select></td>
                <td className="px-3 py-3 bg-slate-50">
                  {row.normativeCandidates?.length ? <select value={row.normative?.id || ''} onChange={(event) => setRows((current) => current.map((item) => item.key === row.key ? { ...item, normative: row.normativeCandidates?.find((candidate) => candidate.id === event.target.value), warning: undefined } : item))} className={inputClass}><option value="">Выберите норматив</option>{row.normativeCandidates.map((item) => <option key={item.id} value={item.id}>{item.value || `${item.min || '—'}–${item.max || '—'}`} {item.unit} · {item.normativeDocument}</option>)}</select>
                    : row.normative ? <><p className="font-bold text-slate-700">{row.normative.value || `${row.normative.min || '—'}–${row.normative.max || '—'}`} {row.normative.unit}</p><p className="text-xs text-slate-500">{row.normative.testingMethod}</p></>
                    : <p className="font-bold text-amber-700">{row.warning || 'Подбирается…'}</p>}
                </td>
                <td className="px-3 py-3"><button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="rounded-lg p-2 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button></td>
              </tr>)}</tbody>
            </table>
            {!rows.length && <p className="p-8 text-center text-sm text-slate-500">Добавьте коды веществ или измерение.</p>}
          </div>
          {fieldErrors.rows && <p className="text-sm font-semibold text-rose-700">{fieldErrors.rows}</p>}
        </section>}

        {step === 4 && <section className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[['Тип', templateName(templateId)], ['Компания', company?.name || '—'], ['Объект', selectedObject?.name || '—'], ['Дата', measurementDate], ['Время', measurementTime]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>)}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="flex items-center gap-2 font-black text-slate-900"><Check className="h-5 w-5 text-emerald-600" /> Готово к серверному расчёту</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">Будут сохранены {rows.length} строк(и) первичных показаний. Backend рассчитает официальный результат, применит норматив и вернёт статус. Значения без найденного норматива останутся с предупреждением и не получат случайную норму.</p>
          </div>
          {canUseAdvanced && <div>
            <button type="button" onClick={() => setAdvanced((value) => !value)} className="text-sm font-bold text-eco-700">{advanced ? 'Скрыть расширенный режим' : 'Расширенный режим'}</button>
            {advanced && <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">CAS, формулы, методики и нормативные документы сохранены в строках и будут доступны в редакторе и расчёте.</div>}
          </div>}
        </section>}

        {error && <div className="mt-5 whitespace-pre-wrap rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div>}
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="secondary" onClick={step === 1 ? onClose : () => setStep((current) => current - 1)} disabled={loading}>{step === 1 ? 'Отмена' : <><ChevronLeft className="h-4 w-4" /> Назад</>}</Button>
          {step < 4 ? <Button type="button" onClick={next} disabled={loading}>Далее <ChevronRight className="h-4 w-4" /></Button>
            : <Button type="button" onClick={submit} disabled={loading}>{loading ? 'Расчёт…' : 'Рассчитать и создать протокол'}</Button>}
        </div>
      </Modal>

      <Modal open={weatherEditOpen} onClose={() => setWeatherEditOpen(false)} title="Изменить условия вручную" size="md">
        <div className="grid gap-4 sm:grid-cols-2">
          {[['temperature', 'Температура, °C'], ['humidity', 'Влажность, %'], ['pressureKpa', 'Давление, кПа'], ['windSpeed', 'Скорость ветра, м/с']].map(([key, label]) => <label key={key} className="space-y-1.5 text-sm font-bold text-slate-700">{label}<input type="number" step="any" value={String(weatherEdit[key as keyof ProtocolEnvironmentalConditions] || '')} onChange={(event) => setWeatherEdit({ ...weatherEdit, [key]: event.target.value })} className={inputClass} /></label>)}
          <label className="space-y-1.5 text-sm font-bold text-slate-700 sm:col-span-2">Причина изменения *<textarea rows={3} value={weatherReason} onChange={(event) => setWeatherReason(event.target.value)} className={inputClass} />{fieldErrors.weatherReason && <span className="block text-rose-700">{fieldErrors.weatherReason}</span>}</label>
        </div>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setWeatherEditOpen(false)}>Отмена</Button><Button type="button" onClick={saveManualWeather}>Сохранить значения</Button></div>
      </Modal>
    </>
  );
};

export default CreateProtocolModal;
