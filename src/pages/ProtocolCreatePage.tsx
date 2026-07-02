import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Save, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { PHYSICAL_FACTOR_UNITS } from '../data/physicalFactors';
import { getCompanies, getCompanyObjects } from '../services/companyService';
import { getLaboratories, getLaboratoryEmployees } from '../services/laboratorySettingsService';
import protocolService from '../services/protocolService';
import { useToast } from '../hooks/useToast';
import type { Company, CompanyObject } from '../types/companies';
import type { LaboratoryEmployee, LaboratorySummary, NormativeRecord, Pollutant, ProtocolSubtype, ProtocolTemplateId, QuickProtocolCreatePayload } from '../types/protocols';

type QuickProtocolChoice = {
  key: string;
  label: string;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  group?: 'chemical' | 'physical' | 'radiation';
};

type QuickForm = {
  templateKey: string;
  radiationSubtype: ProtocolSubtype;
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

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 700;
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const today = () => new Date().toISOString().slice(0, 10);

const protocolChoices: QuickProtocolChoice[] = [
  { key: 'ambient_air', label: 'Атмосферный воздух', templateId: 'ambient_air', group: 'chemical' },
  { key: 'workplace_air', label: 'Воздух рабочей зоны', templateId: 'workplace_air', group: 'chemical' },
  { key: 'soil', label: 'Почва', templateId: 'soil', group: 'chemical' },
  { key: 'microclimate', label: 'Микроклимат', templateId: 'physical_factors', subtype: 'MICROCLIMATE', group: 'physical' },
  { key: 'noise', label: 'Шум', templateId: 'physical_factors', subtype: 'NOISE', group: 'physical' },
  { key: 'lighting', label: 'Освещенность', templateId: 'physical_factors', subtype: 'LIGHTING', group: 'physical' },
  { key: 'vibration', label: 'Вибрация', templateId: 'physical_factors', subtype: 'VIBRATION', group: 'physical' },
  { key: 'radiation', label: 'УФ / ЭМП / Лазер', templateId: 'physical_factors', subtype: 'UV', group: 'radiation' },
];

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
const radiationSubtypeOptions: Array<{ value: ProtocolSubtype; label: string }> = [
  { value: 'UV', label: 'УФ' },
  { value: 'ELECTROMAGNETIC_FIELD', label: 'ЭМП' },
  { value: 'LASER', label: 'Лазер' },
];

const canSearch = (value: string) => value.trim().length >= MIN_SEARCH_LENGTH;
const sourceDocumentCodeFor = (templateId: ProtocolTemplateId, physical: boolean) => {
  if (physical) return 'DSM_15';
  if (templateId === 'soil') return 'DSM_32';
  return 'DSM_70';
};

const resolveUnitByTemplate = (
  templateId: ProtocolTemplateId,
  sourceDocumentCode = '',
  physical = false,
  factorCode = '',
) => {
  if (physical) return PHYSICAL_FACTOR_UNITS[factorCode] || '';
  if (templateId === 'ambient_air') return 'мг/м³';
  if (templateId === 'workplace_air') return 'мг/м³';
  if (templateId === 'soil') return 'мг/кг';
  if (sourceDocumentCode === 'DSM_70') return 'мг/м³';
  if (sourceDocumentCode === 'DSM_32') return 'мг/кг';
  return '';
};

const normativeDisplayValue = (normative?: NormativeRecord) => {
  if (!normative) return '';
  if (normative.value) return normative.value;
  if (normative.min && normative.max) return `${normative.min}-${normative.max}`;
  return normative.max || normative.min || normative.maxOneTimeValue || normative.dailyAverageValue || normative.singleValue || normative.obuvValue || '';
};

const normalizeNormativeIndicator = (item: NormativeRecord): SelectedIndicator => ({
  key: item.id || `${item.factorCode || item.pollutantCode || item.code}-${item.indicator}`,
  id: item.id,
  code: item.factorCode || item.pollutantCode || item.code || '',
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
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [objects, setObjects] = useState<CompanyObject[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratorySummary[]>([]);
  const [employees, setEmployees] = useState<LaboratoryEmployee[]>([]);
  const [warning, setWarning] = useState('');
  const [employeeWarning, setEmployeeWarning] = useState('');
  const [chemicalQuery, setChemicalQuery] = useState('');
  const [chemicalSuggestions, setChemicalSuggestions] = useState<SelectedIndicator[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<SelectedIndicator[]>([]);
  const [form, setForm] = useState<QuickForm>({
    templateKey: 'ambient_air',
    radiationSubtype: 'UV',
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
  });

  const selectedChoice = useMemo(
    () => protocolChoices.find((item) => item.key === form.templateKey) || protocolChoices[0],
    [form.templateKey],
  );
  const selectedSubtype = selectedChoice.key === 'radiation' ? form.radiationSubtype : selectedChoice.subtype;
  const isPhysical = selectedChoice.group === 'physical' || selectedChoice.group === 'radiation';
  const isSoil = selectedChoice.templateId === 'soil';
  const sourceDocumentCode = sourceDocumentCodeFor(selectedChoice.templateId, isPhysical);
  const selectedCompany = companies.find((item) => item.id === form.companyId);
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies.slice(0, 8);
    return companies.filter((item) => `${item.name} ${item.bin || ''}`.toLowerCase().includes(query)).slice(0, 12);
  }, [companies, companySearch]);

  const setField = <K extends keyof QuickForm>(key: K, value: QuickForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      setBooting(true);
      setWarning('');
      try {
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
        const activeLaboratories = laboratoryItems.filter((item) => item.active);
        setLaboratories(activeLaboratories);
        const defaultLab = activeLaboratories.find((item) => item.isDefault) || (activeLaboratories.length === 1 ? activeLaboratories[0] : undefined);
        if (defaultLab) setForm((current) => ({ ...current, laboratoryId: defaultLab.id }));
        if (!companyItems.length) setWarning('Компании не найдены. Добавьте компанию перед созданием протокола.');
        if (!activeLaboratories.length) setWarning((current) => current || 'Лаборатория не настроена или не активна.');
      } finally {
        if (mounted) setBooting(false);
      }
    };
    boot();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    setSelectedIndicators([]);
    setChemicalQuery('');
    setChemicalSuggestions([]);
    setSearchDone(false);
  }, [form.templateKey, form.radiationSubtype]);

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
    getLaboratoryEmployees(form.laboratoryId)
      .then((items) => {
        setEmployees(items);
        if (!items.length) setEmployeeWarning('Сотрудники лаборатории не найдены');
        setForm((current) => ({ ...current, executorId: items.find((item) => (item.userId || item.id) === current.executorId)?.userId || items[0]?.userId || items[0]?.id || '' }));
      })
      .catch((error) => {
        setEmployees([]);
        setEmployeeWarning('Сотрудники лаборатории не найдены');
        toast.error('Не удалось загрузить исполнителей лаборатории', error instanceof Error ? error.message : undefined);
      });
  }, [form.laboratoryId]);

  useEffect(() => {
    const value = chemicalQuery.trim();
    const requestId = ++searchRequestRef.current;
    setSearchDone(false);
    if (!value || !canSearch(value)) {
      setChemicalSuggestions([]);
      setSearching(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const commonParams: Record<string, string> = {
          templateId: isPhysical ? 'physical_factors' : selectedChoice.templateId,
          sourceDocumentCode,
          query: value,
          q: value,
          search: value,
        };
        const physicalParams: Record<string, string> = isPhysical
          ? {
            factorType: selectedSubtype || '',
            factorCode: value,
            conditionJson: JSON.stringify(physicalConditionValues()),
            ...(selectedSubtype === 'MICROCLIMATE' ? {
              season: form.season,
              workCategory: form.workCategory,
              workplaceType: form.workplaceType,
              normLevel: form.normLevel,
            } : {}),
            ...(selectedSubtype === 'NOISE' ? {
              roomType: form.roomType,
              workplaceType: form.workplaceType,
              noiseType: form.noiseType,
            } : {}),
            ...(selectedSubtype === 'LIGHTING' ? {
              roomType: form.roomType,
              visualWorkCategory: form.visualWorkCategory,
              lightingType: form.lightingType,
            } : {}),
          }
          : {
            normativeType: isSoil ? 'PDK' : '',
            code: value,
            pollutantCode: value,
            indicator: value,
          };
        const params = { ...commonParams, ...physicalParams };
        const found = await protocolService.searchNormative(params);
        if (requestId !== searchRequestRef.current) return;
        const normatives = (found.normatives || found.items || (found.normative ? [found.normative] : []))
          .filter((item) => item.active !== false && !item.archived)
          .filter((item) => {
            if (isPhysical) {
              return item.templateId === 'physical_factors'
                && String(item.sourceDocumentCode || '').toUpperCase().replace(/-/g, '_') === 'DSM_15'
                && (!selectedSubtype || item.factorType === selectedSubtype);
            }
            if (isSoil) {
              return item.templateId === 'soil'
                && String(item.sourceDocumentCode || '').toUpperCase().replace(/-/g, '_') === 'DSM_32'
                && item.comparisonType !== 'INFO'
                && String(item.normativeType || '').toUpperCase() === 'PDK';
            }
            return item.templateId === selectedChoice.templateId && String(item.sourceDocumentCode || '').toUpperCase().replace(/-/g, '_') === sourceDocumentCode;
          });
        if (normatives.length) {
          setChemicalSuggestions(normatives.map(normalizeNormativeIndicator).slice(0, 20));
          setSearchDone(true);
          return;
        }
        if (isPhysical || isSoil) {
          setChemicalSuggestions([]);
          setSearchDone(true);
          return;
        }
        const pollutants = await protocolService.searchPollutants(value, params);
        if (requestId !== searchRequestRef.current) return;
        setChemicalSuggestions(pollutants.map((item) => ({ ...item, key: item.id || `${item.code}-${item.name}`, result: '' })).slice(0, 10));
        setSearchDone(true);
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        setChemicalSuggestions([]);
        setSearchDone(true);
        toast.error('Не удалось выполнить поиск норматива', error instanceof Error ? error.message : undefined);
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    chemicalQuery,
    selectedChoice.templateId,
    sourceDocumentCode,
    isPhysical,
    isSoil,
    selectedSubtype,
    form.season,
    form.workCategory,
    form.workplaceType,
    form.normLevel,
    form.roomType,
    form.visualWorkCategory,
    form.lightingType,
    form.noiseType,
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

  const addManualIndicator = () => {
    const value = chemicalQuery.trim();
    if (!value) return;
    const code = isPhysical ? value.toUpperCase().replace(/\s+/g, '_') : value;
    addChemicalIndicator({
      key: `manual-${selectedChoice.key}-${selectedSubtype || 'chemical'}-${code}`,
      id: undefined,
      code,
      name: value,
      unit: resolveUnitByTemplate(selectedChoice.templateId, sourceDocumentCode, isPhysical, code),
      manual: true,
      result: '',
    });
  };

  const setIndicatorResult = (key: string, result: string) => {
    setSelectedIndicators((current) => current.map((item) => item.key === key ? { ...item, result } : item));
  };

  const physicalConditionValues = () => {
    if (!isPhysical) return {};
    const base = {
      sourceDocumentCode: 'DSM_15',
      subtype: selectedSubtype || '',
      factorType: selectedSubtype || '',
    };
    if (selectedSubtype === 'MICROCLIMATE') {
      return { ...base, season: form.season, workCategory: form.workCategory, workplaceType: form.workplaceType, normLevel: form.normLevel };
    }
    if (selectedSubtype === 'NOISE') {
      return { ...base, roomType: form.roomType, workplaceType: form.workplaceType, noiseType: form.noiseType };
    }
    if (selectedSubtype === 'LIGHTING') {
      return { ...base, roomType: form.roomType, visualWorkCategory: form.visualWorkCategory, lightingType: form.lightingType };
    }
    return base;
  };

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
    return String(
      item.normative?.unit ||
      item.unit ||
      item.measurementUnit ||
      item.units ||
      PHYSICAL_FACTOR_UNITS[factorCode] ||
      resolveUnitByTemplate(selectedChoice.templateId, sourceDocumentCode, isPhysical, factorCode) ||
      '',
    ).trim();
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
    const message = validate();
    if (message) {
      toast.warning(message);
      return;
    }
    if (!selectedCompany?.id) {
      toast.warning('Выберите компанию');
      return;
    }
    const selectedObject = objects.find((item) => String(item.id) === String(form.objectId));
    if (!selectedObject?.id) {
      toast.warning('Выберите объект');
      return;
    }

    const measurements: QuickProtocolCreatePayload['measurements'] = selectedIndicators.map((item) => {
      const factorCode = isPhysical ? item.factorCode || item.code : item.normative?.factorCode || item.factorCode || '';
      const factorType = isPhysical ? item.factorType || selectedSubtype || '' : item.normative?.factorType || item.factorType || '';
      const pollutantCode = isPhysical ? '' : item.normative?.pollutantCode || item.normative?.code || item.code || item.factorCode || '';
      const indicatorName = item.indicatorName || item.name;
      const unit = unitForIndicator(item);

      return {
        factorType,
        factorCode,
        pollutantCode,
        indicatorName,
        value: item.result,
        unit,
        normativeId: item.normative?.id,
        values: {
          ...(isPhysical ? physicalConditionValues() : {}),
          ...normativeValues(item.normative),
          code: item.code,
          pollutantCode,
          factorCode,
          factorType,
          indicator: indicatorName,
          indicatorName,
          unit,
          formType: item.normative?.formType || '',
          limitingIndicator: item.normative?.limitingIndicator || '',
          sampleNumber: isSoil ? form.sampleNumber : '',
          samplingDepth: isSoil ? form.samplingDepth : '',
          cas: item.cas || '',
          formula: item.formula || '',
          conditionJson: isPhysical ? JSON.stringify(physicalConditionValues()) : '',
        },
      };
    });
    const invalidPollutant = !isPhysical
      ? measurements.find((item) => !item.pollutantCode || !String(item.pollutantCode).trim())
      : undefined;
    if (invalidPollutant) {
      toast.warning(`Укажите код загрязняющего вещества для: ${invalidPollutant.indicatorName}`);
      return;
    }
    const invalid = measurements.find((item) => !item.unit || !String(item.unit).trim());
    if (invalid) {
      toast.warning(`Укажите единицу измерения для: ${invalid.indicatorName}`);
      return;
    }

    const quickPayload: QuickProtocolCreatePayload = {
      companyId: selectedCompany.id,
      objectId: selectedObject.id,
      templateId: selectedChoice.templateId,
      subtype: selectedSubtype,
      protocolDate: form.protocolDate,
      measurementDate: form.measurementDate,
      measurementTime: form.measurementTime,
      measurementPlace: form.measurementPlace,
      laboratoryId: form.laboratoryId,
      executorId: form.executorId,
      sourceDocumentCode,
      conditions: isSoil
        ? {
          sourceDocumentCode: 'DSM_32',
          sampleNumber: form.sampleNumber,
          samplingDepth: form.samplingDepth,
          samplingPlace: form.measurementPlace,
        }
        : physicalConditionValues(),
      measurements,
    };
    console.log('quick-create payload', quickPayload);

    setLoading(true);
    try {
      const protocol = await protocolService.quickCreateProtocol(quickPayload);
      if (!protocol.id) throw new Error('Backend не вернул id протокола');
      toast.success('Протокол создан, нормативы проверены');
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
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Быстрое создание протокола</h1>
          <p className="mt-1 text-sm text-slate-500">Выберите тип, объект, показатели и внесите фактические значения. Нормативы подтянутся автоматически.</p>
        </div>
        <Button type="submit" disabled={loading || booting}>
          <Save className="h-4 w-4" /> Создать протокол
        </Button>
      </header>

      {warning && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{warning}</div>}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">1. Тип протокола</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {protocolChoices.map((choice) => {
            const active = form.templateKey === choice.key;
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => setField('templateKey', choice.key)}
                className={`flex min-h-20 items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-black transition ${active ? 'border-eco-600 bg-eco-50 text-eco-900 ring-4 ring-eco-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                {choice.label}
                {active && <CheckCircle2 className="h-5 w-5 text-eco-700" />}
              </button>
            );
          })}
        </div>
        {selectedChoice.key === 'radiation' && (
          <div className="mt-4 flex flex-wrap gap-2">
            {radiationSubtypeOptions.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setField('radiationSubtype', item.value)}
                className={`rounded-lg px-3 py-2 text-sm font-bold ${form.radiationSubtype === item.value ? 'bg-eco-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </section>

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
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">3. Дата и место</h2>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Дата протокола</span><input type="date" value={form.protocolDate} onChange={(event) => setField('protocolDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>{isSoil ? 'Дата отбора' : 'Дата измерения'}</span><input type="date" value={form.measurementDate} onChange={(event) => setField('measurementDate', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Время</span><input type="time" value={form.measurementTime} onChange={(event) => setField('measurementTime', event.target.value)} className={inputClass} /></label>
        <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>{isSoil ? 'Место отбора' : 'Место измерения'}</span><input value={form.measurementPlace} onChange={(event) => setField('measurementPlace', event.target.value)} placeholder={isSoil ? 'Например: участок 1, точка 3' : 'Например: рабочее место оператора'} className={inputClass} /></label>
        {isSoil && (
          <>
            <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Номер пробы</span><input value={form.sampleNumber} onChange={(event) => setField('sampleNumber', event.target.value)} placeholder="Например: 1/24" className={inputClass} /></label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700"><span>Глубина отбора</span><input value={form.samplingDepth} onChange={(event) => setField('samplingDepth', event.target.value)} placeholder="Например: 0-20 см" className={inputClass} /></label>
          </>
        )}
      </section>

      {isPhysical && ['MICROCLIMATE', 'NOISE', 'LIGHTING'].includes(String(selectedSubtype)) && (
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <h2 className="text-lg font-black text-slate-900 md:col-span-2 xl:col-span-4">4. Условия</h2>
          {selectedSubtype === 'MICROCLIMATE' && (
            <>
              <select value={form.season} onChange={(event) => setField('season', event.target.value)} className={inputClass}>{seasonOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.workCategory} onChange={(event) => setField('workCategory', event.target.value)} className={inputClass}>{workCategoryOptions.map((item) => <option key={item} value={item}>Категория работ {item}</option>)}</select>
              <select value={form.workplaceType} onChange={(event) => setField('workplaceType', event.target.value)} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.normLevel} onChange={(event) => setField('normLevel', event.target.value)} className={inputClass}>{normLevelOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </>
          )}
          {selectedSubtype === 'NOISE' && (
            <>
              <select value={form.roomType} onChange={(event) => setField('roomType', event.target.value)} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.workplaceType} onChange={(event) => setField('workplaceType', event.target.value)} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
              <select value={form.noiseType} onChange={(event) => setField('noiseType', event.target.value)} className={inputClass}>{noiseTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
            </>
          )}
          {selectedSubtype === 'LIGHTING' && (
            <>
              <select value={form.roomType} onChange={(event) => setField('roomType', event.target.value)} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
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
            <input value={chemicalQuery} onChange={(event) => setChemicalQuery(event.target.value)} placeholder={isPhysical ? 'Введите минимум 3 символа: код или название показателя' : 'Введите минимум 3 символа: код, вещество, CAS'} className={`${inputClass} pl-10`} />
          </label>
          {chemicalQuery.trim() && !canSearch(chemicalQuery) && <p className="mt-2 text-sm font-semibold text-slate-500">Введите минимум 3 символа для поиска</p>}
          {searching && <p className="mt-2 text-sm font-semibold text-eco-700">Поиск...</p>}
          {chemicalSuggestions.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200">
              {chemicalSuggestions.map((item) => (
                <button key={item.key} type="button" onClick={() => addChemicalIndicator(item)} className="grid w-full gap-1 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50 md:grid-cols-[160px_1fr_180px] md:items-start md:gap-3">
                  <span className="font-black text-eco-800">{item.code}</span>
                  <span>
                    <span className="block font-bold text-slate-900">{item.name}</span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {item.normative?.sourceDocumentCode || sourceDocumentCode}
                      {item.normative?.appendixNo ? ` · приложение ${item.normative.appendixNo}` : ''}
                      {item.normative?.tableNo ? ` · таблица ${item.normative.tableNo}` : ''}
                      {item.normative?.conditionJson ? ` · ${item.normative.conditionJson}` : ''}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-700">
                    {item.unit || item.normative?.unit || ''}
                    {item.normative ? ` · норматив ${normativeDisplayValue(item.normative)} ${item.normative.unit}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {searchDone && chemicalQuery.trim() && canSearch(chemicalQuery) && !chemicalSuggestions.length && (
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <p>Норматив не найден. Проверьте условия или импорт DSM_15/DSM_32/DSM_70 в справочник.</p>
              <Button type="button" variant="secondary" className="mt-3" onClick={addManualIndicator}>Создать без норматива / вручную</Button>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-900">6. Замеры</h2>
        {selectedIndicators.length ? (
          <div className="mt-4 grid gap-3">
            {selectedIndicators.map((item) => (
              <div key={item.key} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_180px_auto] md:items-center">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.code}{item.unit ? ` · ${item.unit}` : ''}{item.normative ? ` · норматив ${normativeDisplayValue(item.normative)} ${item.normative.unit}` : ''}</p>
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
          <select value={form.executorId} onChange={(event) => setField('executorId', event.target.value)} className={inputClass} disabled={!employees.length}>
            <option value="">Выберите исполнителя</option>
            {employees.map((item) => <option key={item.id} value={item.userId || item.id}>{item.fullName} {item.position ? `· ${item.position}` : ''}</option>)}
          </select>
          {employeeWarning && <p className="text-sm font-semibold text-amber-700">{employeeWarning}</p>}
        </label>
      </section>

      <div className="sticky bottom-0 flex justify-end border-t border-slate-200 bg-white/95 py-4 backdrop-blur">
        <Button type="submit" disabled={loading || booting}>
          <Save className="h-4 w-4" /> Создать протокол
        </Button>
      </div>
    </form>
  );
};

export default ProtocolCreatePage;
