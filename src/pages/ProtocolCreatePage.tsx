import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, CloudSun, Save, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import {
  PROTOCOL_TYPE_CONFIG,
  PROTOCOL_TYPE_OPTIONS,
  ProtocolTypeKey,
  isChemicalProtocolType,
  isPhysicalProtocolType,
  protocolFactorType,
  resolveProtocolUnit,
} from '../data/protocolTypeConfig';
import { getCompanies, getCompanyObjects } from '../services/companyService';
import { getDefaultLaboratory, getLaboratories, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import { getAllNormativeRecords, type NormativeRecordsParams } from '../services/normativeService';
import protocolService from '../services/protocolService';
import { getApiErrorMessage } from '../services/apiHelpers';
import { useToast } from '../hooks/useToast';
import type { Company, CompanyObject } from '../types/companies';
import type { LaboratoryEmployee, LaboratorySummary, NormativeRecord, Pollutant, ProtocolResultValue, ProtocolSubtype, QuickProtocolCreatePayload } from '../types/protocols';
import {
  canSearchProtocolNormative as canSearch,
  filterAndRankProtocolNormatives,
  isProtocolScopeQuery,
  protocolNormativeConditionLabel,
  protocolNormativeDisplayValue as normativeDisplayValue,
  protocolNormativeIdentity,
  type ProtocolNormativeSearchContext,
} from '../utils/protocolNormativeSearch';

type SelectedExecutor = {
  laboratoryEmployeeId: string;
  userId?: string;
  fullName: string;
  position?: string;
};

type QuickForm = {
  templateKey: ProtocolTypeKey;
  companyId: string;
  objectId: string;
  protocolDate: string;
  measurementDate: string;
  measurementTime: string;
  measurementPlace: string;
  sampleNumber: string;
  samplingDepth: string;
  laboratoryId: string;
  executorId: string;
  season: string;
  workCategory: string;
  workplaceType: string;
  normLevel: string;
  roomType: string;
  visualWorkCategory: string;
  lightingType: string;
  noiseType: string;
  temperature: string;
  humidity: string;
  pressureKpa: string;
  windSpeed: string;
  waterType: string;
  waterUseCategory: string;
};

type SelectedIndicator = Pollutant & {
  key: string;
  factorCode?: string;
  factorType?: string;
  indicatorName?: string;
  measurementUnit?: string;
  units?: string;
  normative?: NormativeRecord;
  manual?: boolean;
  result: string;
};

const SEARCH_DEBOUNCE_MS = 450;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const today = () => new Date().toISOString().slice(0, 10);
const emptyToUndefined = <T,>(value: T): T | undefined => typeof value === 'string' && value.trim() === '' ? undefined : value;
const compactValues = (values: Record<string, ProtocolResultValue>) => Object.fromEntries(
  Object.entries(values).filter(([, value]) => emptyToUndefined(value) !== undefined),
) as Record<string, ProtocolResultValue>;

const seasonOptions = [{ value: 'COLD', label: 'Холодный период' }, { value: 'WARM', label: 'Теплый период' }];
const workCategoryOptions = ['IA', 'IB', 'IIA', 'IIB', 'III'];
const workplaceTypeOptions = [{ value: 'PERMANENT', label: 'Постоянное место' }, { value: 'TEMPORARY', label: 'Временное место' }];
const normLevelOptions = [{ value: 'OPTIMAL', label: 'Оптимальный' }, { value: 'ALLOWABLE', label: 'Допустимый' }];
const roomTypeOptions = [
  { value: 'PRODUCTION_ROOM', label: 'Производственное помещение' },
  { value: 'PUBLIC_ROOM', label: 'Общественное помещение' },
  { value: 'RESIDENTIAL_ROOM', label: 'Жилое помещение' },
];
const lightingTypeOptions = [{ value: 'GENERAL', label: 'Общее' }, { value: 'COMBINED', label: 'Комбинированное' }, { value: 'NATURAL', label: 'Естественное' }];
const noiseTypeOptions = [{ value: 'CONSTANT', label: 'Постоянный' }, { value: 'VARIABLE', label: 'Непостоянный' }, { value: 'IMPULSE', label: 'Импульсный' }];
const waterTypeOptions = [
  { value: 'DRINKING_WATER', label: 'Питьевая вода' },
  { value: 'SURFACE_WATER', label: 'Вода водного объекта' },
];
const waterUseCategoryOptions = [
  { value: 'I', label: 'I категория' },
  { value: 'II', label: 'II категория' },
];
const normalizeNormativeIndicator = (item: NormativeRecord): SelectedIndicator => ({
  key: protocolNormativeIdentity(item),
  id: item.id,
  code: item.factorCode || item.pollutantCode || item.code || '',
  factorCode: item.factorCode,
  factorType: item.factorType,
  indicatorName: item.indicator || item.indicatorName || item.pollutantName || '',
  name: item.indicator || item.indicatorName || item.pollutantName || '',
  cas: item.cas || item.casNumber,
  formula: item.formula || item.chemicalFormula,
  unit: item.unit,
  testingMethod: item.testingMethod,
  samplingMethod: item.samplingMethod,
  normative: item,
  result: '',
});

const ProtocolCreatePage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const searchRequestRef = useRef(0);
  const searchAbortRef = useRef<AbortController | null>(null);
  const weatherRequestRef = useRef(0);
  const weatherAbortRef = useRef<AbortController | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [booting, setBooting] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [templateError, setTemplateError] = useState('');
  const [backendTemplateIds, setBackendTemplateIds] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [objectWarning, setObjectWarning] = useState('');
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [employees, setEmployees] = useState<LaboratoryEmployee[]>([]);
  const [selectedExecutor, setSelectedExecutor] = useState<SelectedExecutor | null>(null);
  const [warning, setWarning] = useState('');
  const [employeeWarning, setEmployeeWarning] = useState('');
  const [chemicalQuery, setChemicalQuery] = useState('');
  const [chemicalSuggestions, setChemicalSuggestions] = useState<SelectedIndicator[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchRetry, setSearchRetry] = useState(0);
  const [manualDraft, setManualDraft] = useState<{ code: string; name: string; unit: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherMessage, setWeatherMessage] = useState('');
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([]);
  const [form, setForm] = useState<QuickForm>({
    templateKey: 'ambient_air',
    companyId: '',
    objectId: '',
    protocolDate: today(),
    measurementDate: today(),
    measurementTime: '12:00',
    measurementPlace: '',
    sampleNumber: '',
    samplingDepth: '',
    laboratoryId: '',
    executorId: '',
    season: 'COLD',
    workCategory: 'IA',
    workplaceType: 'PERMANENT',
    normLevel: 'OPTIMAL',
    roomType: 'PRODUCTION_ROOM',
    visualWorkCategory: '',
    lightingType: 'GENERAL',
    noiseType: 'CONSTANT',
    temperature: '',
    humidity: '',
    pressureKpa: '',
    windSpeed: '',
    waterType: 'DRINKING_WATER',
    waterUseCategory: 'I',
  });

  const selectedChoice = useMemo(
    () => PROTOCOL_TYPE_CONFIG[form.templateKey] || PROTOCOL_TYPE_CONFIG.ambient_air,
    [form.templateKey],
  );
  const selectedSubtype = protocolFactorType[form.templateKey];
  const isPhysical = isPhysicalProtocolType(selectedChoice);
  const isChemical = isChemicalProtocolType(selectedChoice);
  const isSoil = selectedChoice.templateId === 'soil';
  const isWater = selectedChoice.templateId === 'water';
  const sourceDocumentCode = selectedChoice.sourceDocumentCode;
  const selectedCompany = companies.find((item) => item.id === form.companyId);
  const selectedObject = objects.find((item) => String(item.id) === String(form.objectId));
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies.slice(0, 8);
    return companies.filter((item) => `${item.name} ${item.bin || ''}`.toLowerCase().includes(query)).slice(0, 12);
  }, [companies, companySearch]);
  const availableTypeOptions = useMemo(
    () => PROTOCOL_TYPE_OPTIONS.filter((option) => backendTemplateIds.has(PROTOCOL_TYPE_CONFIG[option.key].templateId)),
    [backendTemplateIds],
  );

  const setField = <K extends keyof QuickForm>(key: K, value: QuickForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  const loadTemplates = async () => {
    setIsLoadingTemplates(true);
    setTemplateError('');
    try {
      const templates = await protocolService.getProtocolTemplates();
      const ids = new Set(templates.map((template) => String(template.id).trim().toLowerCase()));
      setBackendTemplateIds(ids);
      const firstAvailable = PROTOCOL_TYPE_OPTIONS.find((option) => ids.has(PROTOCOL_TYPE_CONFIG[option.key].templateId));
      if (firstAvailable) {
        setForm((current) => ids.has(PROTOCOL_TYPE_CONFIG[current.templateKey].templateId)
          ? current
          : { ...current, templateKey: firstAvailable.key });
      }
    } catch (error) {
      setBackendTemplateIds(new Set());
      setTemplateError(getApiErrorMessage(error, 'Не удалось загрузить доступные типы протоколов'));
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setBooting(true);
      setWarning('');
      try {
        const [companyItems, defaultLaboratory] = await Promise.all([
          getCompanies({ status: 'ACTIVE' }).catch((error) => {
            toast.error('Не удалось загрузить компании', error instanceof Error ? error.message : undefined);
            return [];
          }),
          getDefaultLaboratory(),
        ]);
        if (!mounted) return;
        setCompanies(companyItems);
        const laboratoryItems = defaultLaboratory?.active ? [defaultLaboratory] : await getLaboratories();
        if (!mounted) return;
        const activeLaboratories = laboratoryItems.filter((item) => item.active);
        setLaboratories(activeLaboratories);
        if (defaultLaboratory?.active) setForm((current) => ({ ...current, laboratoryId: defaultLaboratory.id }));
        if (!companyItems.length) setWarning('Компании не найдены. Добавьте компанию перед созданием протокола.');
        if (!activeLaboratories.length) setWarning((current) => current || 'Перед созданием протокола необходимо заполнить настройки лаборатории');
      } catch (error) {
        if (mounted) {
          const message = getApiErrorMessage(error, 'Не удалось загрузить лабораторию');
          setWarning(message);
          toast.error('Не удалось загрузить лабораторию', message);
        }
      } finally {
        if (mounted) setBooting(false);
      }
    };
    void Promise.all([boot(), loadTemplates()]);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setSelectedIndicators([]);
    setChemicalQuery('');
    setChemicalSuggestions([]);
    setSearchDone(false);
    setSearchError('');
    setManualDraft(null);
    setForm((current) => ({
      ...current,
      sampleNumber: '',
      samplingDepth: '',
      waterType: form.templateKey === 'water' ? 'DRINKING_WATER' : '',
      waterUseCategory: form.templateKey === 'water' ? 'I' : '',
      season: form.templateKey === 'microclimate' ? 'COLD' : '',
      workCategory: form.templateKey === 'microclimate' ? 'IA' : '',
      workplaceType: ['microclimate', 'lighting', 'noise_vibration'].includes(form.templateKey) ? 'PERMANENT' : '',
      normLevel: form.templateKey === 'microclimate' ? 'OPTIMAL' : '',
      roomType: ['microclimate', 'lighting', 'noise_vibration'].includes(form.templateKey) ? 'PRODUCTION_ROOM' : '',
      visualWorkCategory: '',
      lightingType: form.templateKey === 'lighting' ? 'GENERAL' : '',
      noiseType: form.templateKey === 'noise_vibration' ? 'CONSTANT' : '',
    }));
  }, [form.templateKey]);

  useEffect(() => {
    if (!form.companyId) {
      setObjects([]);
      setObjectWarning('');
      setForm((current) => ({ ...current, objectId: '' }));
      return;
    }
    setObjectWarning('');
    getCompanyObjects(form.companyId)
      .then((items) => {
        const active = items.filter((item) => item.status === 'ACTIVE' || item.virtual === true);
        setObjects(active);
        if (!active.length) setObjectWarning('У компании не заполнен объект. Заполните объект в карточке компании.');
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
      setSelectedExecutor(null);
      return;
    }
    setEmployees([]);
    setEmployeeWarning('');
    getLaboratoryEmployees(form.laboratoryId)
      .then((items) => {
        const active = items.filter((item) => item.active && item.id && String(item.laboratoryId || form.laboratoryId) === String(form.laboratoryId));
        setEmployees(active);
        if (!active.length) setEmployeeWarning('Сотрудники лаборатории не найдены');
        setForm((current) => ({ ...current, executorId: active.some((item) => item.id === current.executorId) ? current.executorId : '' }));
        setSelectedExecutor(null);
      })
      .catch((error) => {
        setEmployees([]);
        setEmployeeWarning('Сотрудники лаборатории не найдены');
        toast.error('Не удалось загрузить исполнителей лаборатории', error instanceof Error ? error.message : undefined);
      });
  }, [form.laboratoryId]);

  useEffect(() => {
    if (!form.objectId || !form.measurementDate || !form.measurementTime) return;
    const requestId = ++weatherRequestRef.current;
    const timer = window.setTimeout(async () => {
      weatherAbortRef.current?.abort();
      const controller = new AbortController();
      weatherAbortRef.current = controller;
      setWeatherLoading(true);
      setWeatherMessage('');
      try {
        const weather = await protocolService.getWeatherConditions({
          objectId: form.objectId,
          coordinates: selectedObject?.coordinates,
          date: form.measurementDate,
          time: form.measurementTime,
          signal: controller.signal,
        });
        if (requestId !== weatherRequestRef.current) return;
        setForm((current) => ({
          ...current,
          temperature: weather.temperature || current.temperature,
          humidity: weather.humidity || current.humidity,
          pressureKpa: weather.pressureKpa || weather.pressure || current.pressureKpa,
          windSpeed: weather.windSpeed || current.windSpeed,
        }));
        if (weather.warning) setWeatherMessage(weather.warning);
      } catch {
        if (!controller.signal.aborted && requestId === weatherRequestRef.current) setWeatherMessage('Погоду не удалось подтянуть. Заполните условия вручную.');
      } finally {
        if (requestId === weatherRequestRef.current) setWeatherLoading(false);
      }
    }, 650);
    return () => {
      window.clearTimeout(timer);
      weatherAbortRef.current?.abort();
    };
  }, [form.objectId, form.measurementDate, form.measurementTime, selectedObject?.coordinates]);

  useEffect(() => {
    const value = chemicalQuery.trim();
    const requestId = ++searchRequestRef.current;
    searchAbortRef.current?.abort();
    setSearchDone(false);
    setSearchError('');
    if (!value || !canSearch(value)) {
      setChemicalSuggestions([]);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setSearching(true);
      try {
        const context: ProtocolNormativeSearchContext = {
          templateId: selectedChoice.normativeTemplateId,
          sourceDocumentCode,
          environmentType: selectedChoice.environmentType,
          factorType: isPhysical ? selectedSubtype : undefined,
          waterType: isWater ? form.waterType : undefined,
          waterUseCategory: isWater && form.waterType === 'SURFACE_WATER' ? form.waterUseCategory : undefined,
          season: selectedSubtype === 'MICROCLIMATE' ? form.season : undefined,
          workCategory: selectedSubtype === 'MICROCLIMATE' ? form.workCategory : undefined,
          workplaceType: isPhysical ? form.workplaceType : undefined,
          normLevel: selectedSubtype === 'MICROCLIMATE' ? form.normLevel : undefined,
          roomType: isPhysical ? form.roomType : undefined,
          visualWorkCategory: selectedSubtype === 'LIGHTING' ? form.visualWorkCategory : undefined,
          lightingType: selectedSubtype === 'LIGHTING' ? form.lightingType : undefined,
          noiseType: selectedSubtype === 'NOISE' || selectedSubtype === 'NOISE_VIBRATION' ? form.noiseType : undefined,
        };
        const indicatorQuery = isProtocolScopeQuery(value, context.templateId) ? undefined : value;
        const basicParams: NormativeRecordsParams = {
          size: 100,
          status: 'ACTIVE',
          templateId: selectedChoice.normativeTemplateId,
          query: indicatorQuery,
          search: indicatorQuery,
          sourceDocumentCode: sourceDocumentCode || undefined,
          environmentType: selectedChoice.environmentType || undefined,
          waterType: isWater ? form.waterType || undefined : undefined,
          normativeType: isSoil ? 'PDK' : undefined,
        };
        const detailedParams: NormativeRecordsParams = {
          ...basicParams,
          factorType: isPhysical ? selectedSubtype : undefined,
          waterUseCategory: context.waterUseCategory,
          season: context.season,
          workCategory: context.workCategory,
          workplaceType: context.workplaceType,
          normLevel: context.normLevel,
          roomType: context.roomType,
          visualWorkCategory: context.visualWorkCategory,
          lightingType: context.lightingType,
          noiseType: context.noiseType,
        };
        let records = await getAllNormativeRecords(detailedParams, controller.signal);
        let normatives = filterAndRankProtocolNormatives(records, value, context);
        if (!normatives.length && JSON.stringify(detailedParams) !== JSON.stringify(basicParams)) {
          records = await getAllNormativeRecords(basicParams, controller.signal);
          normatives = filterAndRankProtocolNormatives(records, value, context);
        }
        if (!normatives.length && indicatorQuery) {
          records = await getAllNormativeRecords({ ...basicParams, query: undefined, search: undefined }, controller.signal);
          normatives = filterAndRankProtocolNormatives(records, value, context);
        }
        if (requestId !== searchRequestRef.current) return;
        if (normatives.length) {
          setChemicalSuggestions(normatives.map(normalizeNormativeIndicator));
          setSearchDone(true);
          return;
        }
        setChemicalSuggestions([]);
        setSearchDone(true);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestId !== searchRequestRef.current) return;
        setChemicalSuggestions([]);
        setSearchDone(false);
        const message = getApiErrorMessage(error, 'Не удалось выполнить поиск норматива');
        setSearchError(message);
        toast.error('Не удалось выполнить поиск норматива', message);
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      searchAbortRef.current?.abort();
    };
  }, [
    chemicalQuery,
    selectedChoice,
    sourceDocumentCode,
    isPhysical,
    isSoil,
    isWater,
    selectedSubtype,
    form.waterType,
    form.season,
    form.workCategory,
    form.workplaceType,
    form.normLevel,
    form.roomType,
    form.visualWorkCategory,
    form.lightingType,
    form.noiseType,
    form.waterUseCategory,
    searchRetry,
  ]);

  const selectCompany = (company: Company) => {
    setField('companyId', company.id);
    setCompanySearch(company.name);
  };

  const addChemicalIndicator = (indicator: SelectedIndicator) => {
    setSelectedIndicators((current) => {
      if (current.some((item) => item.key === indicator.key || (item.code === indicator.code && item.normative?.id === indicator.normative?.id))) return current;
      return [...current, indicator];
    });
    setChemicalQuery('');
    setChemicalSuggestions([]);
    setSearchDone(false);
  };

  const openManualIndicator = () => {
    const value = chemicalQuery.trim();
    setManualDraft({
      code: '',
      name: value,
      unit: selectedChoice.defaultUnit || '',
    });
  };

  const addManualIndicator = () => {
    if (!manualDraft) return;
    const code = manualDraft.code.trim();
    const name = manualDraft.name.trim();
    const unit = manualDraft.unit.trim();
    if (!code || !name || !unit) {
      toast.warning('Для ручного показателя заполните код, название и единицу измерения');
      return;
    }
    addChemicalIndicator({
      key: `manual-${form.templateKey}-${selectedSubtype || selectedChoice.resultMode}-${code}`,
      id: undefined,
      code,
      name,
      unit,
      manual: true,
      result: '',
    });
    setManualDraft(null);
  };

  const setIndicatorResult = (key: string, result: string) => {
    setSelectedIndicators((current) => current.map((item) => item.key === key ? { ...item, result } : item));
  };

  const physicalConditionValues = () => {
    if (!isPhysical) return {};
    const base = {
      sourceDocumentCode: sourceDocumentCode || '',
      subtype: selectedSubtype || '',
      factorType: selectedSubtype || '',
    };
    if (selectedSubtype === 'MICROCLIMATE') {
      return { ...base, season: form.season, workCategory: form.workCategory, workplaceType: form.workplaceType, roomType: form.roomType, normLevel: form.normLevel };
    }
    if (selectedSubtype === 'NOISE' || selectedSubtype === 'NOISE_VIBRATION') {
      return { ...base, roomType: form.roomType, workplaceType: form.workplaceType, noiseType: form.noiseType };
    }
    if (selectedSubtype === 'LIGHTING') {
      return { ...base, roomType: form.roomType, workplaceType: form.workplaceType, visualWorkCategory: form.visualWorkCategory, lightingType: form.lightingType };
    }
    return base;
  };

  const weatherConditionValues = () => ({
    temperature: form.temperature,
    humidity: form.humidity,
    pressure: form.pressureKpa,
    pressureKpa: form.pressureKpa,
    windSpeed: form.windSpeed,
  });

  const baseConditionValues = () => ({
    ...(isPhysical ? physicalConditionValues() : {}),
    ...(isSoil ? {
      sampleNumber: form.sampleNumber,
      samplingDepth: form.samplingDepth,
      samplingPlace: form.measurementPlace,
    } : {}),
    ...(isWater ? {
      waterType: form.waterType,
      waterUseCategory: form.waterType === 'SURFACE_WATER' ? form.waterUseCategory : '',
      sampleNumber: form.sampleNumber,
      samplingPlace: form.measurementPlace,
      environmentType: selectedChoice.environmentType || 'WATER',
      defaultUnit: selectedChoice.defaultUnit || 'мг/л',
      productNormativeDocument: 'Приказ Министра здравоохранения Республики Казахстан от 24 ноября 2022 года № ҚР ДСМ-138',
    } : {}),
    ...weatherConditionValues(),
    sourceDocumentCode,
    docxTemplateCode: selectedChoice.docxTemplateCode,
    normativeTemplateId: selectedChoice.normativeTemplateId,
    resultMode: selectedChoice.resultMode,
  });

  const normativeValues = (normative?: NormativeRecord) => {
    if (!normative) return {};
    const value = normativeDisplayValue(normative);
    return {
      normativeId: normative.id,
      sourceDocumentCode: normative.sourceDocumentCode || sourceDocumentCode,
      sourceDocumentName: normative.sourceDocumentName || normative.normativeDocument || '',
      documentNumber: normative.documentNumber || '',
      documentDate: normative.documentDate || '',
      appendixNo: normative.appendixNo || '',
      tableNo: normative.tableNo || '',
      categoryCode: normative.categoryCode || normative.category || '',
      waterType: normative.waterType || (isWater ? form.waterType : ''),
      matrixType: normative.matrixType || '',
      assessmentCategory: normative.assessmentCategory || '',
      pollutionDegree: normative.pollutionDegree || '',
      formType: normative.formType || '',
      factorType: normative.factorType || (isPhysical ? selectedSubtype || '' : ''),
      factorCode: normative.factorCode || '',
      normativeType: normative.normativeType || '',
      normativeSubType: normative.normativeSubType || normative.subtype || '',
      normativeValue: value,
      normative: value,
      normativeMin: normative.min || '',
      normativeMax: normative.max || normative.value || normative.maxOneTimeValue || normative.dailyAverageValue || normative.obuvValue || '',
      alternativeNormativeValue: normative.alternativeNormativeValue || '',
      minValue: normative.min || '',
      maxValue: normative.max || normative.value || normative.maxOneTimeValue || normative.dailyAverageValue || normative.obuvValue || '',
      comparisonType: normative.comparisonType || 'LESS_OR_EQUAL',
      normativeDocument: normative.normativeDocument || normative.sourceDocumentName || '',
      limitingIndicator: normative.limitingIndicator || '',
      testingMethod: normative.testingMethod || '',
    };
  };

  const unitForIndicator = (item: SelectedIndicator) => {
    const factorCode = item.factorCode || item.code;
    return String(resolveProtocolUnit(form.templateKey, {
      ...item,
      factorCode,
      unit: item.normative?.unit || item.unit,
    })).trim();
  };

  const selectExecutor = (employeeId: string) => {
    const employee = employees.find((item) => item.id === employeeId && item.active);
    setField('executorId', employee?.id || '');
    setSelectedExecutor(employee ? {
      laboratoryEmployeeId: employee.id,
      userId: employee.userId,
      fullName: employee.fullName,
      position: employee.position,
    } : null);
  };

  const validate = () => {
    if (!selectedChoice.templateId) return 'Выберите тип протокола';
    if (!form.companyId) return 'Выберите компанию';
    if (!form.objectId) return 'Выберите объект';
    if (!form.protocolDate) return 'Укажите дату протокола';
    if (!form.measurementDate) return 'Укажите дату измерения';
    if (!form.measurementTime) return 'Укажите время измерения';
    if (!form.measurementPlace.trim()) return 'Укажите место измерения';
    if (!form.laboratoryId) return 'Выберите лабораторию';
    if (!form.executorId) return 'Выберите исполнителя';
    if (!selectedIndicators.length) return 'Выберите показатели';
    if (selectedIndicators.some((item) => !item.result.trim())) return 'Введите фактические значения по всем выбранным показателям';
    return '';
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isCreating) return;
    const message = validate();
    if (message) {
      toast.warning(message);
      return;
    }
    if (!selectedCompany?.id) {
      toast.warning('Выберите компанию');
      return;
    }
    if (!selectedObject?.id) {
      toast.warning('Выберите объект');
      return;
    }
    const executor = employees.find((item) => item.id === form.executorId);
    if (!executor || !executor.active || !executor.id || String(executor.laboratoryId || form.laboratoryId) !== String(form.laboratoryId)) {
      toast.warning('Выберите активного сотрудника выбранной лаборатории');
      return;
    }
    if (!selectedExecutor || selectedExecutor.laboratoryEmployeeId !== executor.id) {
      toast.warning('Повторно выберите исполнителя лаборатории');
      return;
    }
    const companyId = Number(selectedCompany.id);
    const objectId = Number(selectedObject.id);
    const laboratoryId = Number(form.laboratoryId);
    const executorId = Number(executor.id);
    if (![companyId, objectId, laboratoryId, executorId].every(Number.isFinite)) {
      toast.error('Не удалось создать протокол', 'Backend требует числовые ID компании, объекта, лаборатории и сотрудника');
      return;
    }
    if (!selectedChoice.templateId || !sourceDocumentCode || !selectedChoice.docxTemplateCode || !selectedChoice.normativeTemplateId || !selectedChoice.resultMode
      || selectedChoice.templateId !== form.templateKey || selectedChoice.normativeTemplateId !== form.templateKey
      || !availableTypeOptions.some((option) => option.key === form.templateKey)) {
      toast.error('Конфигурация типа протокола некорректна', 'Проверьте templateId, sourceDocumentCode, docxTemplateCode, normativeTemplateId и resultMode');
      return;
    }

    const measurements: QuickProtocolCreatePayload['measurements'] = selectedIndicators.map((item) => {
      const factorCode = isPhysical ? item.factorCode || item.normative?.factorCode || item.code : item.normative?.factorCode || item.factorCode || '';
      const factorType = isPhysical ? item.factorType || item.normative?.factorType || selectedSubtype || '' : item.normative?.factorType || item.factorType || '';
      const pollutantCode = isPhysical
        ? factorCode
        : item.normative?.pollutantCode || item.normative?.code || item.code || item.factorCode || '';
      const indicatorName = item.indicatorName || item.name || item.normative?.indicator || item.normative?.indicatorName || item.normative?.pollutantName || '';
      const unit = unitForIndicator(item);
      const normativeValue = normativeDisplayValue(item.normative);
      const testingMethodNd = item.normative?.testingMethod || item.testingMethod || '';
      const samplingMethodNd = item.normative?.samplingMethod || item.samplingMethod || '';
      const normativeId = item.normative?.id || '';
      const normativeDocument = item.normative?.normativeDocument || item.normative?.sourceDocumentName || '';
      const normativeMin = item.normative?.min || '';
      const normativeMax = item.normative?.max || item.normative?.value || item.normative?.maxOneTimeValue || item.normative?.dailyAverageValue || item.normative?.obuvValue || '';
      const conditionJson = isPhysical ? JSON.stringify(physicalConditionValues()) : item.normative?.conditionJson || '';

      return {
        ...(factorType ? { factorType } : {}),
        ...(factorCode ? { factorCode } : {}),
        pollutantCode,
        indicatorName,
        value: item.result,
        unit,
        normativeId: normativeId || undefined,
        normativeValue: normativeValue || undefined,
        normativeMin: normativeMin || undefined,
        normativeMax: normativeMax || undefined,
        comparisonType: item.normative?.comparisonType || undefined,
        normativeDocument: normativeDocument || undefined,
        sourceDocumentCode: item.normative?.sourceDocumentCode || sourceDocumentCode,
        testingMethodNd: testingMethodNd || undefined,
        samplingMethodNd: samplingMethodNd || undefined,
        values: compactValues({
          ...baseConditionValues(),
          ...normativeValues(item.normative),
          code: item.code,
          sourceDocumentCode: item.normative?.sourceDocumentCode || sourceDocumentCode || '',
          normativeDocument,
          normativeId,
          normativeValue,
          comparisonType: item.normative?.comparisonType || '',
          normativeMin,
          normativeMax,
          minValue: normativeMin,
          maxValue: normativeMax,
          pollutantCode,
          factorCode,
          factorType,
          indicator: indicatorName,
          indicatorName,
          unit,
          docxTemplateCode: selectedChoice.docxTemplateCode,
          normativeTemplateId: selectedChoice.normativeTemplateId,
          resultMode: selectedChoice.resultMode,
          testingMethodNd,
          samplingMethodNd,
          formType: item.normative?.formType || '',
          limitingIndicator: item.normative?.limitingIndicator || '',
          sampleNumber: isSoil ? form.sampleNumber : '',
          samplingDepth: isSoil ? form.samplingDepth : '',
          samplingPlace: form.measurementPlace,
          measurementPlace: form.measurementPlace,
          cas: item.cas || item.normative?.cas || item.normative?.casNumber || '',
          formula: item.formula || item.normative?.formula || item.normative?.chemicalFormula || '',
          conditionJson,
        }),
      };
    });
    const invalidPollutant = measurements.find((item) => !item.pollutantCode || !String(item.pollutantCode).trim());
    if (invalidPollutant) {
      toast.warning(`Укажите код загрязняющего вещества для: ${invalidPollutant.indicatorName}`);
      return;
    }
    const invalidPhysical = isPhysical
      ? measurements.find((item) => !item.factorType || !item.factorCode)
      : undefined;
    if (invalidPhysical) {
      toast.warning(`Укажите тип и код физического фактора для: ${invalidPhysical.indicatorName}`);
      return;
    }
    const invalidName = measurements.find((item) => !item.indicatorName || !String(item.indicatorName).trim());
    if (invalidName) {
      toast.warning('Укажите наименование показателя');
      return;
    }
    const invalid = measurements.find((item) => !item.unit || !String(item.unit).trim());
    if (invalid) {
      toast.warning(`Укажите единицу измерения для: ${invalid.indicatorName}`);
      return;
    }

    const quickPayload: QuickProtocolCreatePayload = {
      companyId,
      objectId,
      templateId: selectedChoice.templateId,
      subtype: selectedSubtype,
      protocolDate: form.protocolDate,
      measurementDate: form.measurementDate,
      measurementTime: form.measurementTime,
      measurementPlace: form.measurementPlace,
      laboratoryId,
      executorId,
      sourceDocumentCode,
      docxTemplateCode: selectedChoice.docxTemplateCode,
      normativeTemplateId: selectedChoice.normativeTemplateId,
      environmentType: selectedChoice.environmentType,
      defaultUnit: selectedChoice.defaultUnit || undefined,
      waterType: isWater ? form.waterType : undefined,
      waterUseCategory: isWater && form.waterType === 'SURFACE_WATER' ? form.waterUseCategory : undefined,
      resultMode: selectedChoice.resultMode,
      conditions: compactValues(baseConditionValues()),
      measurements,
    };
    setIsCreating(true);
    try {
      const created = await protocolService.quickCreateProtocol(quickPayload);
      const protocol = await protocolService.getProtocol(created.id);
      if (!protocol.id) throw new Error('Backend не вернул id протокола');
      if (protocol.results.length !== measurements.length) {
        toast.warning(`Backend сохранил ${protocol.results.length} из ${measurements.length} строк. Откройте протокол и проверьте результаты.`);
      }
      toast.success('Протокол создан, нормативы проверены');
      navigate(`/staff/protocols/${protocol.id}`, { replace: true });
    } catch (error) {
      toast.error('Не удалось создать протокол', getApiErrorMessage(error, 'Не удалось создать протокол'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <button type="button" onClick={() => navigate('/staff/protocols')} className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-eco-700">
            <ArrowLeft className="h-4 w-4" /> Назад к протоколам
          </button>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Быстрое создание протокола</h1>
          <p className="mt-1 text-sm text-slate-500">Выберите тип, объект, показатели и внесите фактические значения. Нормативы подтянутся автоматически.</p>
        </div>
        <Button type="submit" disabled={isCreating || booting || isLoadingTemplates || Boolean(templateError)}>
          <Save className="h-4 w-4" /> {isCreating ? 'Создание...' : 'Создать протокол'}
        </Button>
      </header>

      {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{warning}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">1. Тип протокола</h2>
        {templateError && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            <p>{templateError}</p>
            <Button type="button" variant="secondary" className="mt-3" onClick={() => void loadTemplates()} disabled={isLoadingTemplates}>Повторить</Button>
          </div>
        )}
        {isLoadingTemplates && <p className="mt-4 text-sm font-semibold text-slate-500">Загрузка доступных типов протоколов...</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {availableTypeOptions.map((choice) => {
            const active = form.templateKey === choice.key;
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => setField('templateKey', choice.key)}
                className={`flex min-h-20 items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-black transition ${active ? 'border-eco-600 bg-eco-50 text-eco-900 ring-4 ring-eco-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {choice.title}
                {active && <CheckCircle2 className="h-5 w-5 text-eco-700" />}
              </button>
            );
          })}
        </div>
      </section>

      {isWater && (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2">
          <h2 className="text-lg font-black text-slate-900 md:col-span-2">Параметры воды</h2>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">
            <span>Тип воды</span>
            <select value={form.waterType} onChange={(event) => setField('waterType', event.target.value)} className={inputClass}>
              {waterTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          {form.waterType === 'SURFACE_WATER' && (
            <label className="space-y-1.5 text-sm font-bold text-slate-700">
              <span>Категория водопользования</span>
              <select value={form.waterUseCategory} onChange={(event) => setField('waterUseCategory', event.target.value)} className={inputClass}>
                {waterUseCategoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          )}
          <p className="text-sm font-semibold text-slate-500 md:col-span-2">
            Нормативный документ: Приказ Министра здравоохранения Республики Казахстан от 24 ноября 2022 года № ҚР ДСМ-138.
          </p>
        </section>
      )}

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <h2 className="text-lg font-black text-slate-900 lg:col-span-2">2. Компания и объект</h2>
        <div className="space-y-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={companySearch} onChange={(event) => setCompanySearch(event.target.value)} placeholder="Поиск компании по названию или БИН" className={`${inputClass} pl-10`} disabled={booting} />
          </label>
          <div className="max-h-56 overflow-auto rounded-xl border border-slate-200">
            {filteredCompanies.map((company) => (
              <button key={company.id} type="button" onClick={() => selectCompany(company)} className={`flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50 ${form.companyId === company.id ? 'bg-eco-50' : ''}`}>
                <span><span className="block font-bold text-slate-900">{company.name}</span><span className="text-xs font-semibold text-slate-500">{company.bin || 'БИН не указан'}</span></span>
                {form.companyId === company.id && <CheckCircle2 className="h-5 w-5 text-eco-700" />}
              </button>
            ))}
            {!filteredCompanies.length && <p className="p-4 text-sm font-semibold text-slate-500">Компания не найдена</p>}
          </div>
        </div>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Объект</span>
          <select value={form.objectId} onChange={(event) => setField('objectId', event.target.value)} className={inputClass} disabled={!form.companyId || !objects.length}>
            <option value="">Выберите объект</option>
            {objects.map((item) => <option key={item.id} value={item.id}>{item.name} {item.address ? `· ${item.address}` : ''}</option>)}
          </select>
          {selectedCompany && <p className="text-xs font-semibold text-slate-500">Данные компании будут сохранены в snapshot протокола.</p>}
          {objectWarning && <p className="text-sm font-semibold text-amber-700">{objectWarning}</p>}
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">3. Дата и место</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Дата протокола</span><input type="date" value={form.protocolDate} onChange={(event) => setField('protocolDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>{isSoil ? 'Дата отбора' : 'Дата измерения'}</span><input type="date" value={form.measurementDate} onChange={(event) => setField('measurementDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Время</span><input type="time" value={form.measurementTime} onChange={(event) => setField('measurementTime', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>{isSoil ? 'Место отбора' : 'Место измерения'}</span><input value={form.measurementPlace} onChange={(event) => setField('measurementPlace', event.target.value)} placeholder={isSoil ? 'Например: участок 1, точка 3' : 'Например: рабочее место оператора'} className={inputClass} /></label>
        {(isSoil || isWater) && (
          <>
            <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Номер пробы</span><input value={form.sampleNumber} onChange={(event) => setField('sampleNumber', event.target.value)} placeholder="Например: 1/24" className={inputClass} /></label>
            {isSoil && <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Глубина отбора</span><input value={form.samplingDepth} onChange={(event) => setField('samplingDepth', event.target.value)} placeholder="Например: 0-20 см" className={inputClass} /></label>}
          </>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">
          <CloudSun className="h-5 w-5 text-eco-700" /> Погодные условия
        </h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Температура, °C</span><input type="number" step="any" value={form.temperature} onChange={(event) => setField('temperature', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Влажность, %</span><input type="number" step="any" value={form.humidity} onChange={(event) => setField('humidity', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Давление, кПа</span><input type="number" step="any" value={form.pressureKpa} onChange={(event) => setField('pressureKpa', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Скорость ветра, м/с</span><input type="number" step="any" value={form.windSpeed} onChange={(event) => setField('windSpeed', event.target.value)} className={inputClass} /></label>
        {(weatherLoading || weatherMessage) && <p className="text-sm font-semibold text-slate-500 md:col-span-2 xl:col-span-4">{weatherLoading ? 'Пробуем подтянуть погоду...' : weatherMessage}</p>}
      </section>

      {isPhysical && ['MICROCLIMATE', 'NOISE', 'NOISE_VIBRATION', 'LIGHTING'].includes(String(selectedSubtype)) && (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">4. Условия</h2>
          {selectedSubtype === 'MICROCLIMATE' && (
            <>
              <select value={form.season} onChange={(event) => setField('season', event.target.value)} className={inputClass}>{seasonOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.workCategory} onChange={(event) => setField('workCategory', event.target.value)} className={inputClass}>{workCategoryOptions.map((item) => <option key={item} value={item}>Категория работ {item}</option>)}</select>
              <select value={form.workplaceType} onChange={(event) => setField('workplaceType', event.target.value)} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.roomType} onChange={(event) => setField('roomType', event.target.value)} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.normLevel} onChange={(event) => setField('normLevel', event.target.value)} className={inputClass}>{normLevelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </>
          )}
          {(selectedSubtype === 'NOISE' || selectedSubtype === 'NOISE_VIBRATION') && (
            <>
              <select value={form.roomType} onChange={(event) => setField('roomType', event.target.value)} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.workplaceType} onChange={(event) => setField('workplaceType', event.target.value)} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.noiseType} onChange={(event) => setField('noiseType', event.target.value)} className={inputClass}>{noiseTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </>
          )}
          {selectedSubtype === 'LIGHTING' && (
            <>
              <select value={form.roomType} onChange={(event) => setField('roomType', event.target.value)} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.workplaceType} onChange={(event) => setField('workplaceType', event.target.value)} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <input value={form.visualWorkCategory} onChange={(event) => setField('visualWorkCategory', event.target.value)} placeholder="Разряд зрительной работы" className={inputClass} />
              <select value={form.lightingType} onChange={(event) => setField('lightingType', event.target.value)} className={inputClass}>{lightingTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">5. Показатели</h2>
        <div className="mt-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input value={chemicalQuery} onChange={(event) => setChemicalQuery(event.target.value)} placeholder={isPhysical ? 'Введите минимум 2 символа: код или название показателя' : 'Введите минимум 2 символа: код, вещество, CAS'} className={`${inputClass} pl-10`} />
          </label>
          {chemicalQuery.trim() && !canSearch(chemicalQuery) && <p className="mt-2 text-sm font-semibold text-slate-500">Введите минимум 2 символа для поиска</p>}
          {searching && <p className="mt-2 text-sm font-semibold text-eco-700">Поиск...</p>}
          {searchError && !searching && (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">
              <p>{searchError}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => setSearchRetry((value) => value + 1)}>Повторить поиск</Button>
                <Button type="button" variant="secondary" onClick={openManualIndicator}>Добавить вручную</Button>
              </div>
            </div>
          )}
          {chemicalSuggestions.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                Найдено: {chemicalSuggestions.length}. Сначала показаны наиболее подходящие условия.
              </p>
              <div className="max-h-[32rem] overflow-y-auto">
              {chemicalSuggestions.map((item) => (
                <button key={item.key} type="button" onClick={() => addChemicalIndicator(item)} className="grid w-full gap-1 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50 md:grid-cols-[160px_1fr_180px] md:items-start md:gap-3">
                  <span className="font-black text-eco-800">{item.code}</span>
                  <span>
                    <span className="block font-bold text-slate-900">{item.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {item.normative ? protocolNormativeConditionLabel(item.normative) : ''}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-700">
                    {item.unit || item.normative?.unit || ''}
                    {item.normative ? ` · норматив ${normativeDisplayValue(item.normative)} ${item.normative.unit}` : ''}
                  </span>
                </button>
              ))}
              </div>
            </div>
          )}
          {searchDone && !searchError && chemicalQuery.trim() && canSearch(chemicalQuery) && !chemicalSuggestions.length && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <p>Норматив не найден. Можно выбрать вручную или добавить в справочник.</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={openManualIndicator}>Создать без норматива / вручную</Button>
            </div>
          )}
          {manualDraft && (
            <div className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 md:grid-cols-3">
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Код показателя *</span>
                <input value={manualDraft.code} onChange={(event) => setManualDraft({ ...manualDraft, code: event.target.value })} className={inputClass} placeholder="Например, TEMP_AIR" />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Название *</span>
                <input value={manualDraft.name} onChange={(event) => setManualDraft({ ...manualDraft, name: event.target.value })} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm font-bold text-slate-700">
                <span>Единица измерения *</span>
                <input value={manualDraft.unit} onChange={(event) => setManualDraft({ ...manualDraft, unit: event.target.value })} className={inputClass} placeholder="мг/л, °C, дБА" />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-3">
                <Button type="button" onClick={addManualIndicator}>Добавить показатель</Button>
                <Button type="button" variant="secondary" onClick={() => setManualDraft(null)}>Отмена</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">6. Замеры</h2>
        {selectedIndicators.length ? (
          <div className="mt-4 grid gap-3">
            {selectedIndicators.map((item) => (
              <div key={item.key} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_220px_180px_auto] md:items-center">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.code}{unitForIndicator(item) ? ` · ${unitForIndicator(item)}` : ''}</p>
                </div>
                <div className="rounded-xl border border-eco-200 bg-eco-50 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-eco-700">Норматив</p>
                  <p className="mt-0.5 font-black text-eco-900">
                    {normativeDisplayValue(item.normative)
                      ? `${normativeDisplayValue(item.normative)}${unitForIndicator(item) ? ` ${unitForIndicator(item)}` : ''}`
                      : 'Не найден'}
                  </p>
                </div>
                <input value={item.result} onChange={(event) => setIndicatorResult(item.key, event.target.value)} placeholder="Факт" className={inputClass} />
                <Button type="button" variant="secondary" className="text-rose-700 hover:bg-rose-50" onClick={() => setSelectedIndicators((current) => current.filter((selected) => selected.key !== item.key))}>Убрать</Button>
              </div>
            ))}
          </div>
        ) : <p className="mt-3 rounded-xl border border-dashed border-slate-300 py-8 text-center text-sm font-semibold text-slate-500">Выберите показатели, и здесь появятся поля для фактических значений.</p>}
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-2">
        <h2 className="text-lg font-black text-slate-900 lg:col-span-2">Лаборатория</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Лаборатория</span>
          <select value={form.laboratoryId} onChange={(event) => setField('laboratoryId', event.target.value)} className={inputClass} disabled={!laboratories.length}>
            <option value="">Выберите лабораторию</option>
            {laboratories.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isDefault ? ' · по умолчанию' : ''}</option>)}
          </select>
        </label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700">
          <span>Исполнитель</span>
          <select value={form.executorId} onChange={(event) => selectExecutor(event.target.value)} className={inputClass} disabled={!employees.length}>
            <option value="">Выберите исполнителя</option>
            {employees.map((item) => <option key={item.id} value={item.id}>{item.fullName} {item.position ? `· ${item.position}` : ''}</option>)}
          </select>
          {employeeWarning && <p className="text-sm font-semibold text-amber-700">{employeeWarning}</p>}
        </label>
      </section>
      {!laboratories.length && !booting && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <p>Перед созданием протокола необходимо заполнить настройки лаборатории</p>
          <Button type="button" variant="secondary" className="mt-3" onClick={() => navigate('/staff/settings/laboratory')}>Перейти в настройки лаборатории</Button>
        </div>
      )}

      <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <Button type="submit" disabled={isCreating || booting || isLoadingTemplates || Boolean(templateError)}>
          <Save className="h-4 w-4" /> {isCreating ? 'Создание...' : 'Создать протокол'}
        </Button>
      </div>
    </form>
  );
};

export default ProtocolCreatePage;
