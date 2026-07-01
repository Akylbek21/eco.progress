import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Copy, FileSpreadsheet, History, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge from './NormativeStatusBadge';
import RawMeasurementsModal from './RawMeasurementsModal';
import protocolService from '../../services/protocolService';
import { getApiStatus } from '../../services/apiHelpers';
import { getMeasurementDevices } from '../../services/measurementDeviceService';
import { filterPhysicalFactorIndicators, getPhysicalFactorIndicators } from '../../data/physicalFactors';
import { subtypeName } from '../../data/protocolTemplates';
import { useAuth } from '../../contexts/AuthContext';
import type {
  CalculationDetails,
  CalculationResultResponse,
  NormativeRecord,
  MeasurementDevice,
  Pollutant,
  ProtocolCalculationSummaryResponse,
  ProtocolMeasurementDevice,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolSubtype,
  ProtocolTemplateId,
} from '../../types/protocols';

type Props = {
  protocolId: string;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  rows: ProtocolResultRow[];
  devices?: ProtocolMeasurementDevice[];
  readOnly: boolean;
  busy?: boolean;
  testingDate?: string;
  objectId?: string | number;
  measurementPlace?: string;
  allowManualIndicator?: boolean;
  onChange: (rows: ProtocolResultRow[]) => void;
  onCheckNormatives: () => void | Promise<void>;
  onImported: () => void | Promise<void>;
  onNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onGoToInstruments?: () => void;
};

type NormativeSuggestion = Pollutant & {
  selectedNormative?: NormativeRecord;
};

type SearchState = 'idle' | 'minLength' | 'searching' | 'empty' | 'ready' | 'error';

const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 700;
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const automaticClass = 'rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700';
const physicalFactorTemplateIds: ProtocolTemplateId[] = ['physical_factors', 'microclimate', 'lighting', 'noise_vibration'];
const chemicalTemplateIds: ProtocolTemplateId[] = ['industrial_emissions', 'ambient_air', 'workplace_air', 'water_wastewater', 'soil'];
const searchUnavailableMessage = 'Поиск временно недоступен. Добавьте показатель вручную.';
const normativeNotFoundMessage = 'Норматив не найден. Можно выбрать вручную или добавить в справочник.';
const notFoundSearchMessage = 'Норматив или показатель не найден. Проверьте код или добавьте норматив в справочник.';
const physicalNormativeNotFoundMessage = 'Норматив не найден. Проверьте условия или добавьте норматив в справочник.';
const canSearch = (value: string) => value.trim().length >= MIN_SEARCH_LENGTH;
const defaultPhysicalConditions = {
  season: 'COLD',
  workCategory: 'IA',
  workplaceType: 'PERMANENT',
  normLevel: 'OPTIMAL',
  roomType: 'PRODUCTION_ROOM',
  visualWorkCategory: '',
  lightingType: '',
  noiseType: '',
};
const physicalSubtypeForTemplate = (templateId: ProtocolTemplateId, subtype?: ProtocolSubtype) =>
  subtype || ({ microclimate: 'MICROCLIMATE', lighting: 'LIGHTING', noise_vibration: 'NOISE_VIBRATION' } as Partial<Record<ProtocolTemplateId, ProtocolSubtype>>)[templateId] || 'MICROCLIMATE';
const sourceDocumentCodeForTemplate = (templateId: ProtocolTemplateId, isPhysicalFactors: boolean) => {
  if (isPhysicalFactors) return 'DSM_15';
  if (templateId === 'soil') return 'DSM_32';
  if (['ambient_air', 'workplace_air', 'industrial_emissions'].includes(templateId)) return 'DSM_70';
  return '';
};
const seasonOptions = [{ value: 'COLD', label: 'холодный' }, { value: 'WARM', label: 'тёплый' }];
const workCategoryOptions = ['IA', 'IB', 'IIA', 'IIB', 'III'].map((value) => ({ value, label: value }));
const workplaceTypeOptions = [{ value: 'PERMANENT', label: 'постоянное' }, { value: 'TEMPORARY', label: 'временное' }];
const normLevelOptions = [{ value: 'OPTIMAL', label: 'оптимальный' }, { value: 'ALLOWABLE', label: 'допустимый' }];
const roomTypeOptions = [
  { value: 'PRODUCTION_ROOM', label: 'производственное' },
  { value: 'PUBLIC_ROOM', label: 'общественное' },
  { value: 'RESIDENTIAL_ROOM', label: 'жилое' },
];
const lightingTypeOptions = [{ value: 'GENERAL', label: 'общее' }, { value: 'COMBINED', label: 'комбинированное' }, { value: 'NATURAL', label: 'естественное' }];
const noiseTypeOptions = [{ value: 'CONSTANT', label: 'постоянный' }, { value: 'VARIABLE', label: 'непостоянный' }, { value: 'IMPULSE', label: 'импульсный' }];
const optionLabel = (options: Array<{ value: string; label: string }>, value?: string) =>
  options.find((item) => item.value === value)?.label || value || '';
const valueOf = (row: ProtocolResultRow, keys: string[]) => {
  for (const key of keys) {
    const value = row.values[key];
    if (value !== undefined && value !== null && String(value) !== '') return String(value);
  }
  return '';
};
const officialResult = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  if (row.result) return row.result;
  if (templateId === 'industrial_emissions') return valueOf(row, ['resultMg', 'calculatedConcentration', 'resultValue']);
  return valueOf(row, ['result', 'resultValue', 'calculatedResult']);
};
const normativeValue = (row: ProtocolResultRow) =>
  row.normativeReference?.value || row.normative || row.normativeValue || row.pdk || valueOf(row, ['normative', 'normativeValue', 'pdk', 'normativeMax', 'maxValue', 'normativeMin', 'minValue']) || row.normativeMax || row.normativeMin || '';
const pollutantCode = (row: ProtocolResultRow) => row.pollutant?.code || row.code || valueOf(row, ['pollutantCode', 'code']);
const indicator = (row: ProtocolResultRow) => row.pollutant?.name || row.indicatorName || row.indicator || valueOf(row, ['indicator', 'substanceName']);
const unit = (row: ProtocolResultRow) => row.unit || valueOf(row, ['unit']);
const normativeDisplayValue = (normative?: NormativeRecord) => {
  if (!normative) return '';
  if (normative.value) return normative.value;
  if (normative.min && normative.max) return `${normative.min}-${normative.max}`;
  return normative.max || normative.min || normative.maxOneTimeValue || normative.dailyAverageValue || normative.singleValue || normative.obuvValue || '';
};
const normativeSubtype = (normative?: NormativeRecord) => normative?.normativeSubType || normative?.subtype || '';
const normativeDocumentLabel = (row: ProtocolResultRow) =>
  [
    valueOf(row, ['sourceDocumentName', 'sourceDocumentCode']) || row.normativeDocument || valueOf(row, ['normativeDocument']),
    valueOf(row, ['appendixNo']) ? `приложение ${valueOf(row, ['appendixNo'])}` : '',
    valueOf(row, ['tableNo']) ? `таблица ${valueOf(row, ['tableNo'])}` : '',
  ].filter(Boolean).join(', ');
const conditionSummary = (row: ProtocolResultRow) => [
  optionLabel(seasonOptions, valueOf(row, ['season'])),
  valueOf(row, ['workCategory']),
  optionLabel(workplaceTypeOptions, valueOf(row, ['workplaceType'])),
  optionLabel(roomTypeOptions, valueOf(row, ['roomType'])),
  optionLabel(normLevelOptions, valueOf(row, ['normLevel'])),
  valueOf(row, ['visualWorkCategory']),
  optionLabel(lightingTypeOptions, valueOf(row, ['lightingType'])),
  optionLabel(noiseTypeOptions, valueOf(row, ['noiseType'])),
].filter(Boolean).join(', ');
const normativeValuesFromRecord = (normative: NormativeRecord, templateId: ProtocolTemplateId, fallbackUnit = '') => {
  const value = normativeDisplayValue(normative);
  const unit = normative.unit || fallbackUnitForEnvironment(templateId, normative) || fallbackUnit;
  return {
    normativeId: normative.id,
    sourceDocumentCode: normative.sourceDocumentCode || sourceDocumentCodeForTemplate(templateId, physicalFactorTemplateIds.includes(templateId)),
    sourceDocumentName: normative.sourceDocumentName || normative.normativeDocument || '',
    appendixNo: normative.appendixNo || '',
    tableNo: normative.tableNo || '',
    factorType: normative.factorType || '',
    factorCode: normative.factorCode || normative.code || normative.pollutantCode || '',
    season: normative.season || '',
    workCategory: normative.workCategory || '',
    workplaceType: normative.workplaceType || '',
    roomType: normative.roomType || '',
    normLevel: normative.normLevel || '',
    normativeType: normative.normativeType || '',
    normativeSubType: normativeSubtype(normative),
    normativeValue: value,
    normative: value,
    normativeMin: normative.min || '',
    normativeMax: normative.max || normative.value || normative.maxOneTimeValue || normative.dailyAverageValue || normative.obuvValue || '',
    minValue: normative.min || '',
    maxValue: normative.max || normative.value || normative.maxOneTimeValue || normative.dailyAverageValue || normative.obuvValue || '',
    unit,
    comparisonType: normative.comparisonType || 'LESS_OR_EQUAL',
    normativeDocument: normative.normativeDocument || normative.sourceDocumentName || normative.sourceDocumentCode || '',
    testingMethod: normative.testingMethod || '',
  };
};
const normalizeText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
const fallbackUnitForEnvironment = (templateId: ProtocolTemplateId, normative?: NormativeRecord | null) => {
  const text = normalizeText([
    templateId,
    normative?.templateId,
    normative?.environment,
    normative?.researchObject,
    normative?.normativeType,
  ].filter(Boolean).join(' '));

  if (text.includes('surface') || text.includes('поверх')) return 'мг/см²';
  if (text.includes('food') || text.includes('пищ')) return 'мг/кг';
  if (text.includes('soil') || text.includes('почв')) return 'мг/кг';
  if (text.includes('water') || text.includes('вода') || text.includes('водн')) return 'мг/дм³';
  if (
    text.includes('atmospheric_air')
    || text.includes('ambient_air')
    || text.includes('work_zone_air')
    || text.includes('workplace_air')
    || text.includes('industrial_emissions')
    || text.includes('air')
    || text.includes('воздух')
    || text.includes('выброс')
  ) return 'мг/м³';

  return '';
};
const parseMeasurementNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const normativeToSuggestion = (normative: NormativeRecord): NormativeSuggestion => ({
  id: normative.id,
  code: normative.factorCode || normative.pollutantCode || normative.code || '',
  name: normative.indicator || normative.indicatorName || normative.pollutantName || '',
  cas: normative.cas || normative.casNumber || '',
  formula: normative.formula || normative.chemicalFormula || '',
  unit: normative.unit || fallbackUnitForEnvironment((normative.templateId || 'ambient_air') as ProtocolTemplateId, normative),
  testingMethod: normative.testingMethod || '',
  samplingMethod: normative.samplingMethod || '',
  selectedNormative: normative,
});
const primaryReading = (row: ProtocolResultRow) => valueOf(row, ['primaryReading', 'measurementReadings', 'readings', 'concentration']);
const rawDataLabel = (row: ProtocolResultRow) =>
  primaryReading(row)
  || ['reading1', 'reading2', 'sampleWeight', 'volume'].map((key) => valueOf(row, [`raw_${key}`, key])).filter(Boolean).join(', ');
const measurementPlace = (row: ProtocolResultRow) => row.measurementPlace || valueOf(row, ['measurementPlace', 'samplingPlace', 'object']);
const testingMethod = (row: ProtocolResultRow) => row.testingMethodDocument || row.testingMethod || valueOf(row, ['testingMethodDocument', 'testingMethod']);
const needsNormativeSelection = (row: ProtocolResultRow) => valueOf(row, ['normativeSelectionRequired']) === 'true';
const statusOf = (row: ProtocolResultRow) =>
  (row.internalStatus || row.checkStatus) === 'NORMATIVE_NOT_FOUND' && normativeValue(row)
    ? 'MANUAL_NORMATIVE'
    : row.internalStatus || row.checkStatus;

const calculationStatusLabel = (status?: string) => ({
  WAITING_INPUTS: 'Ожидает исходные данные',
  CALCULATED: 'Рассчитано',
  MANUAL: 'Ручной ввод',
  ERROR: 'Ошибка расчета',
  NEEDS_REPEAT: 'Требуется повторный анализ',
  NORMATIVE_NOT_FOUND: 'Норматив не найден',
}[String(status || '')] || '');

const uncertaintyValue = (row: ProtocolResultRow) => row.uncertaintyValue || valueOf(row, ['uncertaintyValue', 'uncertainty']);

const resolveDeviceName = (row: ProtocolResultRow, devices: ProtocolMeasurementDevice[]) => {
  const ids = [
    row.deviceId,
    row.measurementDeviceId,
    valueOf(row, ['device', 'deviceId', 'measurementDeviceId']),
  ].filter(Boolean).map(String);
  const device = devices.find((item) => ids.includes(String(item.deviceId)) || ids.includes(String(item.id)));
  const name = device?.deviceSnapshot.name || row.deviceName || valueOf(row, ['deviceName']);
  return name && name !== '—' ? name : '';
};

const exceededText = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  if (statusOf(row) !== 'EXCEEDED') return '';
  const actual = Number(officialResult(row, templateId).replace(',', '.'));
  const limit = Number(normativeValue(row).replace(',', '.'));
  if (!Number.isFinite(actual) || !Number.isFinite(limit) || !limit) return '';
  return `Факт: ${officialResult(row, templateId)} ${unit(row)} · Норматив: ${normativeValue(row)} ${unit(row)} · Превышение: ${Math.max(0, ((actual - limit) / limit) * 100).toFixed(0)}%`;
};

const ProtocolResultsTable = ({
  protocolId, templateId, subtype, rows, devices = [], readOnly, busy = false, testingDate = '', objectId, measurementPlace: defaultMeasurementPlace = '',
  onChange, onCheckNormatives, onImported, onNotify, onGoToInstruments,
}: Props) => {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<NormativeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeviceId, setBulkDeviceId] = useState('');
  const [bulkPlace, setBulkPlace] = useState('');
  const [editing, setEditing] = useState<ProtocolResultRow | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [calculation, setCalculation] = useState<{ row: ProtocolResultRow; details: CalculationDetails } | null>(null);
  const [calculationHistory, setCalculationHistory] = useState<CalculationResultResponse[] | null>(null);
  const [deleteRow, setDeleteRow] = useState<ProtocolResultRow | null>(null);
  const [rawRow, setRawRow] = useState<ProtocolResultRow | null>(null);
  const [calculationSummary, setCalculationSummary] = useState<ProtocolCalculationSummaryResponse | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [extraActionsOpen, setExtraActionsOpen] = useState(false);
  const [normativeChoices, setNormativeChoices] = useState<Record<string, NormativeRecord[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [normativeQuery, setNormativeQuery] = useState('');
  const [normativeLoading, setNormativeLoading] = useState(false);
  const [normativeSearchDone, setNormativeSearchDone] = useState(false);
  const [normativeResults, setNormativeResults] = useState<NormativeRecord[]>([]);
  const [selectedNormative, setSelectedNormative] = useState<NormativeRecord | null>(null);
  const [resultValue, setResultValue] = useState('');
  const [resultDeviceId, setResultDeviceId] = useState('');
  const [physicalConditions, setPhysicalConditions] = useState(defaultPhysicalConditions);
  const [availableDevices, setAvailableDevices] = useState<MeasurementDevice[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRequestRef = useRef(0);
  const canUseAdvanced = user?.role === 'ADMIN' || user?.role === 'HEAD' || user?.role === 'DIRECTOR';
  const isPhysicalFactors = physicalFactorTemplateIds.includes(templateId);
  const isChemicalProtocol = chemicalTemplateIds.includes(templateId);
  const physicalSubtype = physicalSubtypeForTemplate(templateId, subtype);
  const sourceDocumentCode = sourceDocumentCodeForTemplate(templateId, isPhysicalFactors);

  const buildNormativeSearchParams = (value: string, pollutant?: Pollutant): Record<string, string> => {
    const code = pollutant?.code || value;
    const params: Record<string, string> = {
      templateId,
      subtype: isPhysicalFactors ? physicalSubtype : subtype || '',
      query: value,
      q: value,
      search: value,
      code,
      pollutantCode: isPhysicalFactors ? '' : code,
      indicator: pollutant?.name || value,
      objectId: objectId ? String(objectId) : '',
      date: testingDate,
      sourceDocumentCode,
    };
    if (isPhysicalFactors) {
      params.factorType = physicalSubtype;
      params.factorCode = code;
      params.season = physicalConditions.season;
      params.workCategory = physicalConditions.workCategory;
      params.workplaceType = physicalConditions.workplaceType;
      params.roomType = physicalConditions.roomType;
      params.normLevel = physicalConditions.normLevel;
    }
    return params;
  };

  const physicalConditionValues = () => isPhysicalFactors ? {
    sourceDocumentCode: 'DSM_15',
    factorType: physicalSubtype,
    season: physicalConditions.season,
    workCategory: physicalConditions.workCategory,
    workplaceType: physicalConditions.workplaceType,
    roomType: physicalConditions.roomType,
    normLevel: physicalConditions.normLevel,
    visualWorkCategory: physicalConditions.visualWorkCategory,
    lightingType: physicalConditions.lightingType,
    noiseType: physicalConditions.noiseType,
    conditionJson: JSON.stringify(physicalConditions),
  } : {};

  const selectedRows = useMemo(() => rows.filter((row) => selected.includes(row.id)), [rows, selected]);
  const reviewRow = rows.find((row) => ['EXCEEDED', 'BELOW_REQUIRED', 'UNIT_MISMATCH', 'NEEDS_REVIEW', 'MANUAL_NORMATIVE'].includes(String(statusOf(row))));

  useEffect(() => {
    if (!addOpen) return;
    getMeasurementDevices({ status: 'VALID' })
      .then((items) => setAvailableDevices(items))
      .catch(() => setAvailableDevices([]));
  }, [addOpen]);

  const openAddDialog = () => {
    setAddOpen(true);
    setNormativeQuery('');
    setNormativeResults([]);
    setNormativeSearchDone(false);
    setSelectedNormative(null);
    setResultValue('');
    setResultDeviceId('');
  };

  const searchNormativesForDialog = async () => {
    const value = normativeQuery.trim();
    setSelectedNormative(null);
    if (!canSearch(value)) {
      setNormativeResults([]);
      setNormativeSearchDone(false);
      onNotify('Введите минимум 3 символа для поиска', 'warning');
      return;
    }
    setNormativeLoading(true);
    setNormativeSearchDone(false);
    try {
      const found = await protocolService.searchNormative(buildNormativeSearchParams(value));
      const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
      setNormativeResults(candidates);
      setNormativeSearchDone(true);
      if (!candidates.length) onNotify('Норматив не найден. Проверьте код или добавьте норматив в справочник.', 'warning');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось загрузить нормативы', 'error');
      setNormativeResults([]);
      setNormativeSearchDone(true);
    } finally {
      setNormativeLoading(false);
    }
  };

  const saveDialogResult = async () => {
    if (!selectedNormative) return onNotify('Выберите показатель', 'warning');
    if (!normativeDisplayValue(selectedNormative)) return onNotify('Выберите норматив', 'warning');
    if (!resultValue.trim()) return onNotify('Введите результат измерения', 'warning');
    const parsedResult = parseMeasurementNumber(resultValue);
    if (parsedResult === null) return onNotify('Результат измерения должен быть числом', 'warning');
    const selectedUnit = selectedNormative.unit || fallbackUnitForEnvironment(templateId, selectedNormative);
    if (!selectedUnit) return onNotify('У норматива не указана единица измерения', 'warning');

    setSaving(true);
    try {
      const code = selectedNormative.factorCode || selectedNormative.pollutantCode || selectedNormative.code || '';
      const name = selectedNormative.indicator || selectedNormative.indicatorName || selectedNormative.pollutantName || '';
      const normativeValues = normativeValuesFromRecord(selectedNormative, templateId, selectedUnit);
      const saved = await protocolService.addProtocolResult(protocolId, {
        normativeId: selectedNormative.id,
        measurementDeviceId: resultDeviceId || undefined,
        values: {
          ...normativeValues,
          ...physicalConditionValues(),
          code,
          pollutantCode: code,
          factorCode: isPhysicalFactors ? code : normativeValues.factorCode,
          indicator: name,
          indicatorName: name,
          cas: selectedNormative.cas || selectedNormative.casNumber || '',
          casNumber: selectedNormative.casNumber || selectedNormative.cas || '',
          formula: selectedNormative.formula || selectedNormative.chemicalFormula || '',
          primaryReading: parsedResult,
          measurementReadings: [parsedResult],
          result: parsedResult,
          resultValue: parsedResult,
          deviceId: resultDeviceId || null,
          measurementDeviceId: resultDeviceId || null,
          measurementPlace: defaultMeasurementPlace || '',
          samplingPlace: defaultMeasurementPlace || '',
        },
      });
      onChange([...rows, saved]);
      setAddOpen(false);
      onNotify('Результат сохранён', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Backend не вернул сохранённый результат с id', 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const value = query.trim();
    const requestId = ++searchRequestRef.current;
    if (!value) {
      setSuggestions([]);
      setSearching(false);
      setSearchState('idle');
      return;
    }
    if (!canSearch(value) || value.includes(',') || value.includes(';')) {
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
        const found = await protocolService.searchNormative(buildNormativeSearchParams(value));
        if (requestId !== searchRequestRef.current) return;
        const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
        if (candidates.length) {
          setSuggestions(candidates.map(normativeToSuggestion).slice(0, 12));
          setSearchState('ready');
          return;
        }
        const apiItems = isPhysicalFactors ? [] : (await protocolService.searchPollutants(value, {
          templateId,
          subtype: subtype || '',
          code: value,
          pollutantCode: value,
          objectId: objectId ? String(objectId) : '',
          sourceDocumentCode,
        })).slice(0, 8);
        if (requestId !== searchRequestRef.current) return;
        const localItems = isPhysicalFactors ? filterPhysicalFactorIndicators(value, subtype).slice(0, 8) : [];
        const items = apiItems.length ? apiItems : localItems;
        setSuggestions(items);
        setSearchState(items.length ? 'ready' : 'empty');
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
        setSuggestions([]);
        setSearchState('error');
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, templateId, subtype, objectId, testingDate, isPhysicalFactors, sourceDocumentCode, physicalSubtype, physicalConditions]);

  const search = (value: string) => {
    setQuery(value);
  };

  const searchNow = async (value: string) => {
    const found = await protocolService.searchNormative(buildNormativeSearchParams(value));
    const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
    if (candidates.length) return candidates.map(normativeToSuggestion).slice(0, 12);
    const apiItems = isPhysicalFactors ? [] : (await protocolService.searchPollutants(value, {
      templateId,
      subtype: subtype || '',
      code: value,
      pollutantCode: value,
      objectId: objectId ? String(objectId) : '',
      sourceDocumentCode,
    })).slice(0, 8);
    return apiItems.length || !isPhysicalFactors ? apiItems : filterPhysicalFactorIndicators(value, subtype).slice(0, 8);
  };

  const addPollutant = async (pollutant: Pollutant, _append = true): Promise<ProtocolResultRow | null> => {
    setSaving(true);
    try {
      const selectedNormative = (pollutant as NormativeSuggestion).selectedNormative;
      const found = selectedNormative ? { found: true, normatives: [selectedNormative], items: [], normative: selectedNormative } : await protocolService.searchNormative({
        ...buildNormativeSearchParams(`${pollutant.code} ${pollutant.name}`.trim(), pollutant),
        unit: pollutant.unit || '',
      }).catch((error) => {
        if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
        return { found: false, normatives: [], items: [], normative: undefined };
      });
      const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
      const normative = selectedNormative || (candidates.length === 1 ? candidates[0] : undefined);
      if (!normative) {
        onNotify(candidates.length > 1 ? 'Выберите конкретный норматив перед вводом результата' : (isPhysicalFactors ? physicalNormativeNotFoundMessage : normativeNotFoundMessage), 'warning');
        setNormativeResults(candidates);
        setAddOpen(true);
        return null;
      }
      const resolvedUnit = normative?.unit || pollutant.unit || fallbackUnitForEnvironment(templateId, normative);
      if (!resolvedUnit) {
        onNotify('У выбранного показателя не указана единица измерения', 'warning');
        return null;
      }
      setSelectedNormative({ ...normative, unit: resolvedUnit });
      setNormativeResults(candidates.length ? candidates : [normative]);
      setResultValue('');
      setResultDeviceId('');
      setAddOpen(true);
      setQuery('');
      setSuggestions([]);
      onNotify('Введите результат измерения перед сохранением показателя', 'info');
      return null;
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось добавить вещество', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const addBulk = async () => {
    const tokens = query.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
    if (!tokens.length) {
      if (isPhysicalFactors) {
        setSuggestions(getPhysicalFactorIndicators(subtype).slice(0, 8));
        return;
      }
      onNotify('Введите код или название показателя', 'warning');
      return;
    }
    if (tokens.some((token) => !canSearch(token))) {
      onNotify('Введите минимум 3 символа для поиска', 'warning');
      return;
    }
    setSearching(true);
    try {
      const created: ProtocolResultRow[] = [];
      for (const token of tokens) {
        const found = await searchNow(token).catch((error) => {
          if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
          return [];
        });
        const normalized = token.toLowerCase();
        const item = found.find((pollutant) => pollutant.code.toLowerCase() === normalized)
          || found.find((pollutant) => `${pollutant.code} ${pollutant.name}`.toLowerCase().includes(normalized));
        if (!item) {
          onNotify(isPhysicalFactors ? physicalNormativeNotFoundMessage : notFoundSearchMessage, 'warning');
          continue;
        }
        const exists = [...rows, ...created].some((row) => pollutantCode(row).toLowerCase() === item.code.toLowerCase());
        if (!exists) {
          const saved = await addPollutant(item, false);
          if (saved) created.push(saved);
        }
      }
      if (created.length) {
        onChange([...rows, ...created]);
        setQuery('');
        setSuggestions([]);
      }
    } finally {
      setSearching(false);
    }
  };

  const addManualIndicator = async () => {
    const value = query.trim();
    if (!canSearch(value)) {
      onNotify('Введите минимум 3 символа для поиска', 'warning');
      return;
    }
    setSaving(true);
    try {
      const saved = await protocolService.addProtocolResult(protocolId, {
        values: {
          code: value,
          pollutantCode: value,
          indicator: value,
          indicatorName: value,
          normativeSearchWarning: normativeNotFoundMessage,
          normativeSelectionRequired: 'true',
          sourceDocumentCode: sourceDocumentCode,
          ...physicalConditionValues(),
          result: null,
          resultValue: null,
          measurementPlace: defaultMeasurementPlace || '',
          samplingPlace: defaultMeasurementPlace || '',
          subtype: subtype || null,
          factorType: isPhysicalFactors ? physicalSubtype : null,
        },
      });
      onChange([...rows, saved]);
      setQuery('');
      setSuggestions([]);
      setSearchState('idle');
      onNotify('Показатель добавлен вручную без норматива. Выберите норматив позже или добавьте его в справочник.', 'warning');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось добавить показатель вручную', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ProtocolResultRow) => {
    setEditing(row);
    setForm({
      primaryReading: primaryReading(row),
      measurementDeviceId: row.measurementDeviceId || valueOf(row, ['measurementDeviceId']),
      measurementPlace: valueOf(row, ['measurementPlace', 'samplingPlace']),
      sourceNumber: valueOf(row, ['sourceNumber']),
      readings: valueOf(row, ['readings', 'measurementReadings']),
      externalLaboratory: valueOf(row, ['externalLaboratory']),
      externalLaboratoryDocument: valueOf(row, ['externalLaboratoryDocument']),
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!form.primaryReading.trim() && !form.readings.trim()) return onNotify('Введите первичные показания', 'warning');
    setSaving(true);
    try {
      const resultValue = form.primaryReading || form.readings;
      const saved = await protocolService.updateProtocolResult(protocolId, editing.id, {
        measurementDeviceId: form.measurementDeviceId || undefined,
        normativeId: valueOf(editing, ['normativeId']) || editing.normativeReference?.id,
        values: {
          ...editing.values,
          primaryReading: form.primaryReading,
          readings: form.readings,
          measurementReadings: form.readings || form.primaryReading,
          result: resultValue,
          ...(templateId === 'industrial_emissions' ? { resultMg: resultValue } : {}),
          measurementDeviceId: form.measurementDeviceId,
          measurementPlace: form.measurementPlace,
          samplingPlace: form.measurementPlace,
          sourceNumber: form.sourceNumber,
          externalLaboratory: form.externalLaboratory,
          externalLaboratoryDocument: form.externalLaboratoryDocument,
        },
      });
      onChange(rows.map((row) => row.id === editing.id ? saved : row));
      setEditing(null);
      onNotify('Первичные показания сохранены', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить показания', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectNormative = async (row: ProtocolResultRow, normativeId: string) => {
    const normative = normativeChoices[row.id]?.find((item) => item.id === normativeId);
    if (!normative) return;
    const resolvedUnit = normative.unit || fallbackUnitForEnvironment(templateId, normative) || unit(row);
    const normativeValues = normativeValuesFromRecord(normative, templateId, resolvedUnit);
    setSaving(true);
    try {
      const saved = await protocolService.updateProtocolResult(protocolId, row.id, {
        measurementDeviceId: row.measurementDeviceId || valueOf(row, ['measurementDeviceId']),
        normativeId: normative.id,
        values: {
          ...row.values,
          ...normativeValues,
          code: normative.pollutantCode || normative.code || pollutantCode(row),
          pollutantCode: normative.pollutantCode || normative.code || pollutantCode(row),
          factorCode: isPhysicalFactors ? normative.factorCode || normative.code || normative.pollutantCode || pollutantCode(row) : normativeValues.factorCode,
          indicatorName: normative.indicator || normative.indicatorName || indicator(row),
          cas: normative.cas || normative.casNumber || valueOf(row, ['cas']),
          casNumber: normative.casNumber || normative.cas || valueOf(row, ['casNumber', 'cas']),
          formula: normative.formula || normative.chemicalFormula || valueOf(row, ['formula']),
          testingMethod: normative.testingMethod || valueOf(row, ['testingMethod']),
          normativeSelectionRequired: '',
          normativeSearchWarning: '',
        },
      });
      setNormativeChoices((current) => {
        const next = { ...current };
        delete next[row.id];
        return next;
      });
      onChange(rows.map((item) => item.id === row.id ? saved : item));
      onNotify('Норматив выбран', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить норматив', 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadNormativeChoices = async (row: ProtocolResultRow) => {
    setSaving(true);
    try {
      const found = await protocolService.searchNormative({
        ...buildNormativeSearchParams(`${pollutantCode(row)} ${indicator(row)}`.trim(), { code: pollutantCode(row), name: indicator(row), unit: unit(row) }),
        unit: unit(row),
      });
      const candidates = found.normatives || found.items || (found.normative ? [found.normative] : []);
      if (!candidates.length) {
        onNotify(isPhysicalFactors ? physicalNormativeNotFoundMessage : normativeNotFoundMessage, 'warning');
        return;
      }
      setNormativeChoices((current) => ({ ...current, [row.id]: candidates }));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : normativeNotFoundMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderNormativeCell = (row: ProtocolResultRow) => {
    const choices = normativeChoices[row.id];
    if (choices?.length) {
      return (
        <select value="" onChange={(event) => selectNormative(row, event.target.value)} disabled={saving || readOnly} className={inputClass}>
          <option value="">Выберите норматив</option>
          {choices.map((item) => <option key={item.id} value={item.id}>{item.value || `${item.min || '—'}–${item.max || '—'}`} {item.unit} · {item.normativeDocument}</option>)}
        </select>
      );
    }
    const value = normativeValue(row);
    if (!value && needsNormativeSelection(row)) {
      return <Button type="button" variant="secondary" disabled={saving || readOnly} onClick={() => loadNormativeChoices(row)}>Выбрать норматив</Button>;
    }
    if (value) return <div className={automaticClass}>{value} {unit(row)}</div>;
    return <div className={automaticClass}>{valueOf(row, ['normativeSearchWarning']) || 'Норматив не найден'}</div>;
  };

  const duplicate = async (row: ProtocolResultRow) => {
    setSaving(true);
    try {
      const saved = await protocolService.addProtocolResult(protocolId, {
        measurementDeviceId: row.measurementDeviceId,
        normativeId: row.normativeReference?.id || valueOf(row, ['normativeId']),
        values: { ...row.values },
      });
      onChange([...rows, saved]);
      onNotify('Строка дублирована', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось дублировать строку', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteRow) return;
    try {
      await protocolService.deleteProtocolResult(protocolId, deleteRow.id);
      onChange(rows.filter((item) => item.id !== deleteRow.id));
      setDeleteRow(null);
      onNotify('Строка удалена', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить строку', 'error');
    }
  };

  const removeSelected = async () => {
    if (!selectedRows.length) return onNotify('Выберите строки', 'warning');
    if (!window.confirm(`Удалить выбранные строки: ${selectedRows.length}?`)) return;
    setSaving(true);
    try {
      await Promise.all(selectedRows.map((row) => protocolService.deleteProtocolResult(protocolId, row.id)));
      const selectedSet = new Set(selectedRows.map((row) => row.id));
      onChange(rows.filter((row) => !selectedSet.has(row.id)));
      setSelected([]);
      onNotify('Выбранные строки удалены', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить выбранные строки', 'error');
    } finally {
      setSaving(false);
    }
  };

  const applyToSelected = async (patch: Record<string, string>) => {
    if (!selectedRows.length) return onNotify('Выберите строки', 'warning');
    setSaving(true);
    try {
      const saved = await Promise.all(selectedRows.map((row) => protocolService.updateProtocolResult(protocolId, row.id, {
        measurementDeviceId: patch.measurementDeviceId || row.measurementDeviceId,
        normativeId: row.normativeReference?.id || valueOf(row, ['normativeId']),
        values: { ...row.values, ...patch },
      })));
      const map = new Map(saved.map((row) => [row.id, row]));
      onChange(rows.map((row) => map.get(row.id) || row));
      onNotify('Значение применено к выбранным строкам', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Массовое изменение не выполнено', 'error');
    } finally {
      setSaving(false);
    }
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    setSaving(true);
    try {
      const imported = await protocolService.importExcel(protocolId, file);
      onChange(imported.results || []);
      onNotify('Показания импортированы из Excel', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось импортировать Excel', 'error');
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const applyCalculatedRow = async (row?: ProtocolResultRow) => {
    if (row?.id) {
      onChange(rows.map((item) => item.id === row.id ? row : item));
    }
  };

  const calculateRow = async (row: ProtocolResultRow) => {
    setSaving(true);
    try {
      const calculated = await protocolService.calculateResult(protocolId, row.id);
      if (calculated.row?.id) onChange(rows.map((item) => item.id === calculated.row!.id ? calculated.row! : item));
      else await onImported();
      onNotify('Результат рассчитан', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось рассчитать строку', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openCalculationHistory = async (row: ProtocolResultRow) => {
    setSaving(true);
    setRowMenuId(null);
    try {
      const history = await protocolService.getCalculationHistory(protocolId, row.id);
      setCalculationHistory(history);
      if (!history.length) onNotify('История расчета пуста', 'info');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось загрузить историю расчета', 'error');
    } finally {
      setSaving(false);
    }
  };

  const calculateAll = async () => {
    setSaving(true);
    try {
      const summary = await protocolService.calculateProtocolSummary(protocolId);
      setCalculationSummary(summary);
      const rowMap = new Map(summary.rows.filter((item) => item.row?.id).map((item) => [item.row!.id, item.row!]));
      if (rowMap.size) onChange(rows.map((row) => rowMap.get(row.id) || row));
      else await onImported();
      onNotify('Результаты рассчитаны', summary.errors || summary.waitingInputs ? 'warning' : 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось рассчитать результаты', 'error');
      await onCheckNormatives();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Результаты испытаний</h2>
          <p className="mt-1 text-sm text-slate-500">Добавьте показатели, введите показания и запустите расчет результатов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => importFile(event.target.files?.[0])} />
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={openAddDialog}><Plus className="h-4 w-4" /> Добавить показатель</Button>
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> Импорт из Excel</Button>
          <Button type="button" disabled={busy || saving || !rows.length} onClick={calculateAll}><Calculator className="h-4 w-4" /> Рассчитать результаты</Button>
        </div>
      </div>

      {calculationSummary && <div className="mb-4 grid gap-2 rounded-xl border border-eco-100 bg-eco-50 p-3 text-sm sm:grid-cols-3 xl:grid-cols-6">
        <div><span className="text-slate-500">Всего</span><p className="font-black text-slate-900">{calculationSummary.total}</p></div>
        <div><span className="text-slate-500">Рассчитано</span><p className="font-black text-slate-900">{calculationSummary.calculated}</p></div>
        <div><span className="text-slate-500">Ручной ввод</span><p className="font-black text-slate-900">{calculationSummary.manual}</p></div>
        <div><span className="text-slate-500">Ошибки</span><p className="font-black text-slate-900">{calculationSummary.errors}</p></div>
        <div><span className="text-slate-500">Повторный анализ</span><p className="font-black text-slate-900">{calculationSummary.needsRepeat}</p></div>
        <div><span className="text-slate-500">Не соответствует</span><p className="font-black text-slate-900">{calculationSummary.exceeded}</p></div>
      </div>}

      {devices.length === 0 && <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
        <p>К протоколу не прикреплены средства измерений. Сначала добавьте прибор на шаге «Средства измерений».</p>
        {onGoToInstruments && (
          <Button type="button" variant="secondary" onClick={onGoToInstruments}>
            Перейти к средствам измерений
          </Button>
        )}
      </div>}

      {!readOnly && <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input value={query} onChange={(event) => search(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addBulk(); } }} placeholder={isPhysicalFactors ? 'Показатель: освещённость, шум, температура…' : 'Код или название вещества: 0301, азот…'} className={`${inputClass} pl-10`} />
          {isPhysicalFactors && (
            <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5">
              {physicalSubtype === 'MICROCLIMATE' && (
                <>
                  <select value={physicalConditions.season} onChange={(event) => setPhysicalConditions((current) => ({ ...current, season: event.target.value }))} className={inputClass}>{seasonOptions.map((item) => <option key={item.value} value={item.value}>Период: {item.label}</option>)}</select>
                  <select value={physicalConditions.workCategory} onChange={(event) => setPhysicalConditions((current) => ({ ...current, workCategory: event.target.value }))} className={inputClass}>{workCategoryOptions.map((item) => <option key={item.value} value={item.value}>Категория: {item.label}</option>)}</select>
                  <select value={physicalConditions.workplaceType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, workplaceType: event.target.value }))} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>Место: {item.label}</option>)}</select>
                  <select value={physicalConditions.normLevel} onChange={(event) => setPhysicalConditions((current) => ({ ...current, normLevel: event.target.value }))} className={inputClass}>{normLevelOptions.map((item) => <option key={item.value} value={item.value}>Норма: {item.label}</option>)}</select>
                  <select value={physicalConditions.roomType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, roomType: event.target.value }))} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>Помещение: {item.label}</option>)}</select>
                </>
              )}
              {physicalSubtype === 'LIGHTING' && (
                <>
                  <select value={physicalConditions.roomType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, roomType: event.target.value }))} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>Помещение: {item.label}</option>)}</select>
                  <input value={physicalConditions.visualWorkCategory} onChange={(event) => setPhysicalConditions((current) => ({ ...current, visualWorkCategory: event.target.value }))} placeholder="Разряд зрительной работы" className={inputClass} />
                  <select value={physicalConditions.lightingType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, lightingType: event.target.value }))} className={inputClass}><option value="">Тип освещения</option>{lightingTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                  <select value={physicalConditions.normLevel} onChange={(event) => setPhysicalConditions((current) => ({ ...current, normLevel: event.target.value }))} className={inputClass}>{normLevelOptions.map((item) => <option key={item.value} value={item.value}>Норма: {item.label}</option>)}</select>
                </>
              )}
              {['NOISE', 'NOISE_VIBRATION'].includes(physicalSubtype) && (
                <>
                  <select value={physicalConditions.roomType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, roomType: event.target.value }))} className={inputClass}>{roomTypeOptions.map((item) => <option key={item.value} value={item.value}>Помещение: {item.label}</option>)}</select>
                  <select value={physicalConditions.workplaceType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, workplaceType: event.target.value }))} className={inputClass}>{workplaceTypeOptions.map((item) => <option key={item.value} value={item.value}>Место: {item.label}</option>)}</select>
                  <select value={physicalConditions.noiseType} onChange={(event) => setPhysicalConditions((current) => ({ ...current, noiseType: event.target.value }))} className={inputClass}><option value="">Тип шума</option>{noiseTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
                </>
              )}
            </div>
          )}
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
          {suggestions.length > 0 && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {suggestions.map((item) => <button key={`${item.code}-${item.id || item.name}`} type="button" onClick={() => addPollutant(item)} className="flex w-full flex-wrap gap-x-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-eco-50">
              <span className="font-black text-eco-800">{item.code}</span>
              <span className="font-bold">{item.name}</span>
              <span className="text-slate-500">{item.formula}</span>
              <span className="text-slate-500">{item.cas}</span>
              <span className="text-slate-500">{item.unit}</span>
              {item.selectedNormative && <span className="font-semibold text-slate-700">{normativeSubtype(item.selectedNormative) || item.selectedNormative.normativeType || 'Норматив'}: {normativeDisplayValue(item.selectedNormative)} {item.selectedNormative.unit}</span>}
            </button>)}
          </div>}
          {!searching && searchState === 'empty' && (
            <div className="mt-2 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <span>{isPhysicalFactors ? physicalNormativeNotFoundMessage : notFoundSearchMessage}</span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="shrink-0" disabled={readOnly || saving} onClick={() => setAddOpen(true)}>
                  Выбрать вручную
                </Button>
                <a href="/staff/normatives" className="inline-flex items-center rounded-lg bg-white px-3 py-2 text-sm font-bold text-eco-700 ring-1 ring-slate-200 hover:bg-eco-50">
                  Добавить в справочник
                </a>
                <Button type="button" variant="secondary" className="shrink-0" disabled={readOnly || saving} onClick={addManualIndicator}>
                  Добавить без норматива
                </Button>
              </div>
            </div>
          )}
        </div>
        {selectedRows.length > 0 && <div className="grid gap-2 rounded-xl border border-eco-100 bg-white p-3 lg:grid-cols-[1fr_auto_1fr_auto_auto]">
          <select value={bulkDeviceId} onChange={(event) => setBulkDeviceId(event.target.value)} className={inputClass}><option value="">Прибор для выбранных строк</option>{devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.deviceSnapshot.name} · {item.deviceSnapshot.serialNumber}</option>)}</select>
          <Button type="button" variant="secondary" disabled={!bulkDeviceId || saving} onClick={() => applyToSelected({ measurementDeviceId: bulkDeviceId })}>Применить прибор</Button>
          <input value={bulkPlace} onChange={(event) => setBulkPlace(event.target.value)} placeholder="Одно место замера" className={inputClass} />
          <Button type="button" variant="secondary" disabled={!bulkPlace || saving} onClick={() => applyToSelected({ measurementPlace: bulkPlace, samplingPlace: bulkPlace })}>Применить место</Button>
          <Button type="button" variant="secondary" className="text-rose-700 hover:bg-rose-50" disabled={saving} onClick={removeSelected}>Удалить выбранные</Button>
        </div>}
      </div>}

      <div className="overflow-x-auto">
        {isPhysicalFactors ? (
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              {!readOnly && <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>}
              <th className="px-3 py-3">Показатель</th><th className="px-3 py-3">Условия</th><th className="bg-slate-100 px-3 py-3">Факт</th><th className="bg-slate-100 px-3 py-3">Норматив</th><th className="px-3 py-3">Ед.</th><th className="bg-slate-100 px-3 py-3">Вывод</th><th className="px-3 py-3">Документ</th><th className="px-3 py-3">Прибор</th><th className="px-3 py-3 text-right">Действия</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{rows.map((row) => {
              const calculationLabel = calculationStatusLabel(row.calculationStatus || valueOf(row, ['calculationStatus']));
              return <tr key={row.id} className="align-top hover:bg-slate-50">
                {!readOnly && <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>}
                <td className="px-3 py-3"><p className="font-bold text-slate-900">{indicator(row) || '—'}</p><p className="mt-1 text-xs font-black text-eco-800">{pollutantCode(row) || valueOf(row, ['factorCode']) || '—'}</p><p className="mt-1 text-xs text-slate-500">{subtypeName(valueOf(row, ['factorType', 'subtype']) || subtype)}</p></td>
                <td className="px-3 py-3"><p className="font-semibold text-slate-800">{conditionSummary(row) || '—'}</p>{measurementPlace(row) && <p className="mt-1 text-xs text-slate-500">{measurementPlace(row)}</p>}</td>
                <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{officialResult(row, templateId) || 'Ожидает ввода'} {officialResult(row, templateId) && unit(row)}</div></td>
                <td className="bg-slate-50 px-3 py-3">{renderNormativeCell(row)}</td>
                <td className="px-3 py-3">{unit(row) || '—'}</td>
                <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}</div></td>
                <td className="px-3 py-3"><div className="max-w-56 text-xs font-semibold text-slate-700">{normativeDocumentLabel(row) || '—'}</div></td>
                <td className="px-3 py-3">{resolveDeviceName(row, devices) || '—'}</td>
                <td className="px-3 py-3"><div className="relative flex flex-wrap justify-end gap-1">
                  <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                  <Button type="button" variant="secondary" className="px-3" disabled={saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
                  <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} title="Изменить" onClick={() => openEdit(row)}>Изменить</Button>
                  <Button type="button" variant="secondary" className="px-2.5" disabled={saving} title="Еще" onClick={() => setRowMenuId((current) => current === row.id ? null : row.id)}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {rowMenuId === row.id && (
                    <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); duplicate(row); }}>
                        <Copy className="h-4 w-4" /> Дублировать
                      </button>
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={saving} onClick={() => openCalculationHistory(row)}>
                        <History className="h-4 w-4" /> История расчета
                      </button>
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); setDeleteRow(row); }}>
                        <Trash2 className="h-4 w-4" /> Удалить
                      </button>
                    </div>
                  )}
                </div></td>
              </tr>;
            })}</tbody>
          </table>
        ) : (
        <table className="min-w-[1320px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {!readOnly && <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>}
            <th className="px-3 py-3">Код</th><th className="px-3 py-3">Показатель</th><th className="px-3 py-3">Методика</th><th className="px-3 py-3">Сырые данные</th><th className="px-3 py-3">Прибор</th><th className="bg-slate-100 px-3 py-3">Результат</th><th className="bg-slate-100 px-3 py-3">Погрешность</th><th className="bg-slate-100 px-3 py-3">Норматив</th><th className="bg-slate-100 px-3 py-3">Статус</th><th className="px-3 py-3 text-right">Действия</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => {
            const calculationLabel = calculationStatusLabel(row.calculationStatus || valueOf(row, ['calculationStatus']));
            return <tr key={row.id} className="align-top hover:bg-slate-50">
              {!readOnly && <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>}
              <td className="px-3 py-3 font-black text-eco-800">{pollutantCode(row) || '—'}</td>
              <td className="px-3 py-3"><p className="font-bold text-slate-900">{indicator(row) || '—'}</p>{advanced && <p className="mt-1 text-xs text-slate-500">{valueOf(row, ['formula'])} {valueOf(row, ['cas'])}</p>}</td>
              <td className="px-3 py-3"><div className="max-w-60"><p className="font-semibold text-slate-800">{testingMethod(row) || '—'}</p>{measurementPlace(row) && <p className="mt-1 text-xs text-slate-500">{measurementPlace(row)}</p>}{row.sampleName && <p className="mt-1 text-xs text-slate-500">{row.sampleName}</p>}</div></td>
              <td className="px-3 py-3"><button type="button" disabled={readOnly} onClick={() => setRawRow(row)} className="min-w-32 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-eco-800 disabled:cursor-default">{rawDataLabel(row) || 'Ввести данные'}</button></td>
              <td className="px-3 py-3">{resolveDeviceName(row, devices) || '—'}</td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{officialResult(row, templateId) || 'Ожидает расчёта'} {officialResult(row, templateId) && unit(row)}</div></td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{uncertaintyValue(row) || '—'}</div></td>
              <td className="bg-slate-50 px-3 py-3">{renderNormativeCell(row)}</td>
              <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}{exceededText(row, templateId) && <p className="max-w-56 text-xs font-semibold text-rose-700">{exceededText(row, templateId)}</p>}</div></td>
              <td className="px-3 py-3"><div className="relative flex flex-wrap justify-end gap-1">
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} title="Изменить" onClick={() => openEdit(row)}>Изменить</Button>
                <Button type="button" variant="secondary" className="px-2.5" disabled={saving} title="Еще" onClick={() => setRowMenuId((current) => current === row.id ? null : row.id)}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {rowMenuId === row.id && (
                  <div className="absolute right-0 top-10 z-20 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl">
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); duplicate(row); }}>
                      <Copy className="h-4 w-4" /> Дублировать
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" disabled={saving} onClick={() => openCalculationHistory(row)}>
                      <History className="h-4 w-4" /> История расчета
                    </button>
                    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-400" disabled={readOnly || saving} onClick={() => { setRowMenuId(null); setDeleteRow(row); }}>
                      <Trash2 className="h-4 w-4" /> Удалить
                    </button>
                  </div>
                )}
              </div></td>
            </tr>;
          })}</tbody>
        </table>
        )}
      </div>
      {!rows.length && <div className="border border-dashed border-slate-300 py-10 text-center text-sm text-slate-500">Показания ещё не добавлены.</div>}
      {reviewRow && <div className="mt-3 inline-block max-w-full rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <button type="button" onClick={() => setExtraActionsOpen((value) => !value)} className="text-sm font-bold text-amber-900">
          Дополнительные действия
        </button>
        {extraActionsOpen && <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setCalculation({ row: reviewRow, details: reviewRow.calculationDetails || {} })}>Проверить расчет</Button>
          <Button type="button" variant="secondary" disabled={readOnly} onClick={() => openEdit(reviewRow)}>Исправить исходные данные</Button>
          <Button type="button" variant="secondary" disabled={readOnly || saving} onClick={() => duplicate(reviewRow)}>Добавить повторный замер</Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={async () => {
            try {
              await protocolService.readyForApproval(protocolId);
              await onImported();
              onNotify('Протокол отправлен на проверку', 'success');
            } catch (error) {
              onNotify(error instanceof Error ? error.message : 'Не удалось отправить на проверку', 'error');
            }
          }}>Отправить на проверку</Button>
        </div>}
      </div>}
      {canUseAdvanced && <button type="button" onClick={() => setAdvanced((value) => !value)} className="mt-4 text-sm font-bold text-eco-700">{advanced ? 'Скрыть расширенные данные' : 'Расширенный режим'}</button>}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Добавить показатель" description="Выберите конкретный норматив, затем введите результат измерения." size="xl" loading={saving}>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
              <input
                value={normativeQuery}
                onChange={(event) => setNormativeQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); searchNormativesForDialog(); } }}
                placeholder="азот, 0301, NO2, 10102-44-0"
                className={`${inputClass} pl-10`}
              />
            </label>
            <Button type="button" variant="secondary" disabled={normativeLoading} onClick={searchNormativesForDialog}>Найти</Button>
          </div>

          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
            <table className="min-w-[900px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Код</th>
                  <th className="px-3 py-3">Наименование</th>
                  <th className="px-3 py-3">CAS</th>
                  <th className="px-3 py-3">Формула</th>
                  <th className="px-3 py-3">Норматив</th>
                  <th className="px-3 py-3">Подтип</th>
                  <th className="px-3 py-3">Ед. изм.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {normativeLoading ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">Загрузка нормативов...</td></tr>
                ) : normativeResults.length ? normativeResults.map((item) => {
                  const active = selectedNormative?.id === item.id;
                  return (
                    <tr key={item.id} onClick={() => setSelectedNormative(item)} className={`cursor-pointer ${active ? 'bg-eco-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-3 font-black text-eco-800">{item.pollutantCode || item.code || '-'}</td>
                      <td className="px-3 py-3 font-bold text-slate-900">{item.indicator || item.indicatorName || item.pollutantName || '-'}</td>
                      <td className="px-3 py-3">{item.cas || item.casNumber || '-'}</td>
                      <td className="px-3 py-3">{item.formula || item.chemicalFormula || '-'}</td>
                      <td className="px-3 py-3 font-semibold">{normativeDisplayValue(item) || '-'}</td>
                      <td className="px-3 py-3">{normativeSubtype(item) || item.normativeType || '-'}</td>
                      <td className="px-3 py-3">{item.unit || '-'}</td>
                    </tr>
                  );
                }) : normativeSearchDone ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm font-semibold text-amber-800">Норматив не найден. Проверьте код или добавьте норматив в справочник.</td></tr>
                ) : normativeQuery.trim() && !canSearch(normativeQuery) ? (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">Введите минимум 3 символа для поиска.</td></tr>
                ) : (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-sm font-semibold text-slate-500">Введите код, название, CAS или формулу и нажмите “Найти”.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedNormative && (
            <div className="grid gap-3 rounded-xl border border-eco-100 bg-eco-50 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-bold uppercase tracking-wide text-eco-700">Выбранный норматив</p>
                <p className="mt-1 font-black text-slate-900">
                  {selectedNormative.indicator || selectedNormative.indicatorName} / {selectedNormative.pollutantCode || selectedNormative.code} / {normativeSubtype(selectedNormative) || selectedNormative.normativeType || 'норматив'} / {normativeDisplayValue(selectedNormative)} {selectedNormative.unit}
                </p>
              </div>
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                <span>Результат измерения</span>
                <input value={resultValue} onChange={(event) => setResultValue(event.target.value)} placeholder="0.13" className={inputClass} />
              </label>
              <label className="space-y-1.5 text-sm font-bold text-slate-700">
                <span>Прибор</span>
                <select value={resultDeviceId} onChange={(event) => setResultDeviceId(event.target.value)} className={inputClass}>
                  <option value="">Не выбран</option>
                  {availableDevices.map((device) => (
                    <option key={device.id} value={device.id}>{device.name} {device.serialNumber ? `· ${device.serialNumber}` : ''}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button type="button" disabled={saving || !selectedNormative || !resultValue.trim()} onClick={saveDialogResult}>Сохранить результат</Button>
          </div>
        </div>
      </Modal>

      <RawMeasurementsModal
        open={Boolean(rawRow)}
        protocolId={protocolId}
        row={rawRow}
        devices={devices}
        onClose={() => setRawRow(null)}
        onCalculated={applyCalculatedRow}
        onReload={onImported}
        onNotify={onNotify}
      />

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Первичные показания" description="Официальный результат будет рассчитан backend после сохранения." size="lg" loading={saving}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Показание / концентрация<input autoFocus value={form.primaryReading || ''} onChange={(event) => setForm({ ...form, primaryReading: event.target.value })} className={inputClass} /></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Серия показаний<textarea rows={2} value={form.readings || ''} onChange={(event) => setForm({ ...form, readings: event.target.value })} placeholder="Через запятую: 418, 421, 416" className={inputClass} /></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Прибор<select value={form.measurementDeviceId || ''} onChange={(event) => setForm({ ...form, measurementDeviceId: event.target.value })} className={inputClass}><option value="">Не выбран</option>{devices.map((item) => <option key={item.deviceId} value={item.deviceId}>{item.deviceSnapshot.name} · {item.deviceSnapshot.serialNumber}</option>)}</select></label>
          <label className="space-y-1.5 text-sm font-bold text-slate-700">Место замера<input value={form.measurementPlace || ''} onChange={(event) => setForm({ ...form, measurementPlace: event.target.value })} className={inputClass} /></label>
          {templateId === 'industrial_emissions' && <label className="space-y-1.5 text-sm font-bold text-slate-700">Источник<input value={form.sourceNumber || ''} onChange={(event) => setForm({ ...form, sourceNumber: event.target.value })} className={inputClass} /></label>}
          {(templateId === 'water_wastewater' || templateId === 'soil') && <>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">Внешняя лаборатория<input value={form.externalLaboratory || ''} onChange={(event) => setForm({ ...form, externalLaboratory: event.target.value })} className={inputClass} /></label>
            <label className="space-y-1.5 text-sm font-bold text-slate-700">Документ внешней лаборатории<input value={form.externalLaboratoryDocument || ''} onChange={(event) => setForm({ ...form, externalLaboratoryDocument: event.target.value })} className={inputClass} /></label>
          </>}
        </div>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button><Button type="button" onClick={save} disabled={saving}>Сохранить показания</Button></div>
      </Modal>

      <Modal open={Boolean(calculation)} onClose={() => setCalculation(null)} title="Расчёт результата" size="lg">
        {calculation && <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ['Исходные показания', primaryReading(calculation.row) || '—'],
            ['Формула', calculation.details.formula || 'Backend не передал формулу'],
            ['Подставленные числа', calculation.details.substitutedValues || '—'],
            ['Округление', calculation.details.rounding || '—'],
            ['Итог', calculation.details.finalValue || officialResult(calculation.row, templateId) || '—'],
            ['Норматив', calculation.details.normativeValue || normativeValue(calculation.row) || 'Не найден'],
            ['Сравнение', calculation.details.comparisonResult || String(calculation.row.internalStatus || calculation.row.checkStatus || '—')],
            ['Версия методики', calculation.details.methodVersion || valueOf(calculation.row, ['methodVersion']) || '—'],
          ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><dt className="text-xs font-bold uppercase text-slate-400">{label}</dt><dd className="mt-1 whitespace-pre-wrap font-semibold text-slate-800">{value}</dd></div>)}
          {calculation.details.intermediateResults?.length ? <div className="rounded-xl bg-slate-50 p-3 sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-400">Промежуточные результаты</dt>{calculation.details.intermediateResults.map((item) => <dd key={item.label} className="mt-1 font-semibold">{item.label}: {item.value}</dd>)}</div> : null}
        </dl>}
      </Modal>

      <Modal open={calculationHistory !== null} onClose={() => setCalculationHistory(null)} title="История расчета" size="lg">
        <div className="space-y-3">
          {calculationHistory?.length ? calculationHistory.map((item, index) => (
            <div key={`${item.resultId}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-900">Расчет {index + 1}</p>
                <p className="text-xs font-semibold text-slate-500">{calculationStatusLabel(item.calculationStatus)}</p>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div><dt className="text-xs font-bold uppercase text-slate-400">Результат</dt><dd className="font-semibold text-slate-800">{item.result ?? '—'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Норматив</dt><dd className="font-semibold text-slate-800">{item.normativeValue ?? 'Норматив не найден'}</dd></div>
                <div><dt className="text-xs font-bold uppercase text-slate-400">Статус</dt><dd className="font-semibold text-slate-800"><NormativeStatusBadge status={item.internalStatus} /></dd></div>
              </dl>
              {item.calculationMessage && <p className="mt-2 text-sm text-slate-600">{item.calculationMessage}</p>}
            </div>
          )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">История расчета пуста.</p>}
        </div>
      </Modal>

      <Modal open={Boolean(deleteRow)} onClose={() => setDeleteRow(null)} title="Удалить строку?" size="sm">
        <p className="text-sm text-slate-600">Будут удалены первичные показания и связанный расчёт. Это действие нельзя отменить.</p>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setDeleteRow(null)}>Отмена</Button><Button type="button" onClick={remove}>Удалить</Button></div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
