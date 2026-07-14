import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Copy, FileSpreadsheet, History, MoreHorizontal, Plus, Search, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import NormativeStatusBadge, { normativeStatusLabels } from './NormativeStatusBadge';
import RawMeasurementsModal from './RawMeasurementsModal';
import protocolService from '../../services/protocolService';
import { getApiStatus } from '../../services/apiHelpers';
import { getMeasurementDevices } from '../../services/measurementDeviceService';
import { getPhysicalFactorIndicators } from '../../data/physicalFactors';
import { subtypeName } from '../../data/protocolTemplates';
import { resolveNormativeSearchContext } from '../../data/protocolTypeConfig';
import {
  canSearchNormative,
  isNormativeSearchCanceled,
  normativeSearchItemToRecord,
  searchNormatives,
} from '../../services/normativeSearchService';
import { useAuth } from '../../contexts/AuthContext';
import { resolveMeasurementDeviceId } from '../../utils/protocolResultAliases';
import type { NormativeSearchParams } from '../../types/normativeSearch';
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
  waterType?: string;
  waterUseCategory?: string;
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

const SEARCH_DEBOUNCE_MS = 500;
const inputClass = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100 disabled:bg-slate-100 disabled:text-slate-500';
const automaticClass = 'rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700';
const physicalFactorTemplateIds: ProtocolTemplateId[] = ['physical_factors', 'microclimate', 'lighting', 'noise_vibration', 'uv_emf_laser'];
const chemicalTemplateIds: ProtocolTemplateId[] = ['industrial_emissions', 'ambient_air', 'workplace_air', 'water', 'water_wastewater', 'soil', 'food_products', 'surfaces', 'udmh_special'];
const searchUnavailableMessage = 'Поиск временно недоступен. Добавьте показатель вручную.';
const normativeNotFoundMessage = 'Норматив не найден. Можно выбрать вручную или добавить в справочник.';
const notFoundSearchMessage = 'Норматив или показатель не найден. Проверьте код или добавьте норматив в справочник.';
const physicalNormativeNotFoundMessage = 'Норматив не найден. Проверьте условия или добавьте норматив в справочник.';
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
const normalizeProtocolTemplate = (value: string) => {
  const key = value.toLowerCase();
  if (['ambient_air', 'atmospheric_air', 'industrial_emissions'].includes(key)) return 'ambient_air';
  if (['workplace_air', 'work_zone_air'].includes(key)) return 'workplace_air';
  if (['soil'].includes(key)) return 'soil';
  if (['food_products', 'food'].includes(key)) return 'food_products';
  if (['surfaces', 'surface'].includes(key)) return 'surfaces';
  if (['udmh_special', 'rocket_fuel'].includes(key)) return 'udmh_special';
  if (['water', 'water_wastewater'].includes(key)) return 'water';
  if ([
    'physical_factors',
    'microclimate',
    'lighting',
    'noise_vibration',
    'uv_emf_laser',
    'uv',
    'emf',
    'laser',
  ].includes(key)) return 'physical_factors';
  return key;
};
const sourceDocumentCodeForTemplate = (templateId: string, isPhysicalFactors: boolean) => {
  const normalized = normalizeProtocolTemplate(templateId);
  if (isPhysicalFactors || normalized === 'physical_factors') return 'DSM_15';
  if (normalized === 'soil') return 'DSM_32';
  if (normalized === 'water') return 'DSM_138';
  if (['ambient_air', 'workplace_air', 'food_products', 'surfaces', 'udmh_special'].includes(normalized)) return 'DSM_70';
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
const resultKeyOf = (row: ProtocolResultRow) => {
  if (row.id && !String(row.id).startsWith('tmp_')) return `id:${row.id}`;
  return [
    pollutantCode(row),
    indicator(row),
    valueOf(row, ['samplingPlace', 'measurementPlace']),
  ].join('|').toLowerCase();
};
const mergeProtocolResults = (currentRows: ProtocolResultRow[], importedRows: ProtocolResultRow[]) => {
  const map = new Map<string, ProtocolResultRow>();
  currentRows.forEach((row) => map.set(resultKeyOf(row), row));
  importedRows.forEach((row) => {
    const key = resultKeyOf(row);
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...row, values: { ...existing.values, ...row.values } } : row);
  });
  return Array.from(map.values());
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
    documentNumber: normative.documentNumber || '',
    documentDate: normative.documentDate || '',
    appendixNo: normative.appendixNo || '',
    tableNo: normative.tableNo || '',
    categoryCode: normative.categoryCode || normative.category || '',
    waterType: normative.waterType || '',
    waterUseCategory: '',
    matrixType: normative.matrixType || '',
    assessmentCategory: normative.assessmentCategory || '',
    pollutionDegree: normative.pollutionDegree || '',
    formType: normative.formType || '',
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
    alternativeNormativeValue: normative.alternativeNormativeValue || '',
    minValue: normative.min || '',
    maxValue: normative.max || normative.value || normative.maxOneTimeValue || normative.dailyAverageValue || normative.obuvValue || '',
    unit,
    comparisonType: normative.comparisonType || 'LESS_OR_EQUAL',
    normativeDocument: normative.normativeDocument || normative.sourceDocumentName || normative.sourceDocumentCode || '',
    limitingIndicator: normative.limitingIndicator || '',
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
const testingMethod = (row: ProtocolResultRow) => row.testingMethodNd || row.testingMethodDocument || row.testingMethod || valueOf(row, ['testingMethodNd', 'testingMethodDocument', 'testingMethod']);
const needsNormativeSelection = (row: ProtocolResultRow) => valueOf(row, ['normativeSelectionRequired']) === 'true';
const statusOf = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  void templateId;
  return String(row.internalStatus || row.checkStatus || '').trim().toUpperCase();
};
const statusLabel = (status?: string) =>
  normativeStatusLabels[status as keyof typeof normativeStatusLabels] || status || '—';
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
  const resolvedId = resolveMeasurementDeviceId(row);
  const ids = resolvedId ? [resolvedId] : [];
  const device = devices.find((item) => ids.includes(String(item.deviceId)) || ids.includes(String(item.id)));
  const name = device?.deviceSnapshot.name
    || row.measurementDevice?.name
    || row.device?.name
    || row.deviceName
    || valueOf(row, ['deviceName']);
  return name && name !== '—' ? name : '';
};

const exceededText = (row: ProtocolResultRow, templateId: ProtocolTemplateId) => {
  if (statusOf(row, templateId) !== 'EXCEEDED') return '';
  const actual = Number(officialResult(row, templateId).replace(',', '.'));
  const limit = Number(normativeValue(row).replace(',', '.'));
  if (!Number.isFinite(actual) || !Number.isFinite(limit) || !limit) return '';
  return `Факт: ${officialResult(row, templateId)} ${unit(row)} · Норматив: ${normativeValue(row)} ${unit(row)} · Превышение: ${Math.max(0, ((actual - limit) / limit) * 100).toFixed(0)}%`;
};

const ProtocolResultsTable = ({
  protocolId, templateId, subtype, rows, devices = [], readOnly, busy = false, testingDate = '', objectId, measurementPlace: defaultMeasurementPlace = '', waterType = '', waterUseCategory = '',
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
  const searchAbortRef = useRef<AbortController | null>(null);
  const canUseAdvanced = user?.role === 'ADMIN' || user?.role === 'HEAD' || user?.role === 'DIRECTOR';
  const searchContext = resolveNormativeSearchContext({ templateId, subtype });
  const contextTemplateId = (searchContext.templateId || searchContext.normativeTemplateId || normalizeProtocolTemplate(templateId)) as ProtocolTemplateId;
  const isPhysicalFactors = searchContext.sourceDocumentCode === 'DSM_15' || physicalFactorTemplateIds.includes(templateId);
  const isSoilProtocol = templateId === 'soil';
  const isChemicalProtocol = chemicalTemplateIds.includes(templateId);
  const physicalSubtype = physicalSubtypeForTemplate(templateId, subtype);
  const normalizedTemplateId = contextTemplateId;
  const sourceDocumentCode = searchContext.sourceDocumentCode || sourceDocumentCodeForTemplate(templateId, isPhysicalFactors);
  const isWaterProtocol = normalizedTemplateId === 'water';
  const effectiveWaterType = waterType || valueOf(rows[0] || ({ values: {} } as ProtocolResultRow), ['waterType']) || 'DRINKING_WATER';

  const buildNormativeSearchParams = (value: string): NormativeSearchParams => ({
      query: value.trim(),
      status: 'ACTIVE',
      templateId: normalizedTemplateId,
      sourceDocumentCode,
      categoryCode: searchContext.category || undefined,
      factorType: searchContext.factorType || (isPhysicalFactors ? physicalSubtype : undefined),
      environmentType: isWaterProtocol ? 'WATER' : undefined,
      waterType: isWaterProtocol ? effectiveWaterType : undefined,
      waterUseCategory: isWaterProtocol && effectiveWaterType === 'SURFACE_WATER'
        ? waterUseCategory || undefined
        : undefined,
      season: isPhysicalFactors ? physicalConditions.season : undefined,
      workCategory: isPhysicalFactors ? physicalConditions.workCategory : undefined,
      workplaceType: isPhysicalFactors ? physicalConditions.workplaceType : undefined,
      roomType: isPhysicalFactors ? physicalConditions.roomType : undefined,
      normLevel: isPhysicalFactors ? physicalConditions.normLevel : undefined,
      visualWorkCategory: isPhysicalFactors ? physicalConditions.visualWorkCategory || undefined : undefined,
      lightingType: isPhysicalFactors ? physicalConditions.lightingType || undefined : undefined,
      noiseType: isPhysicalFactors ? physicalConditions.noiseType || undefined : undefined,
      page: 0,
      size: 30,
    });

  const searchNormativeCandidates = async (
    value: string,
    _pollutant?: Pollutant,
  ): Promise<NormativeRecord[]> => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    const result = await searchNormatives(buildNormativeSearchParams(value), controller.signal);
    return result.items.map(normativeSearchItemToRecord);
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
  const reviewRow = rows.find((row) => ['EXCEEDED', 'BELOW_REQUIRED', 'UNIT_MISMATCH', 'NEEDS_REVIEW', 'MANUAL_NORMATIVE'].includes(String(statusOf(row, templateId))));

  useEffect(() => {
    if (!addOpen) return;
    getMeasurementDevices({ status: 'VALID' })
      .then((items) => setAvailableDevices(items))
      .catch((loadError) => {
        setAvailableDevices([]);
        onNotify(loadError instanceof Error ? loadError.message : 'Не удалось загрузить доступные приборы', 'error');
      });
  }, [addOpen]);

  const openAddDialog = (initialQuery = '') => {
    setAddOpen(true);
    setNormativeQuery(initialQuery);
    setNormativeResults([]);
    setNormativeSearchDone(false);
    setSelectedNormative(null);
    setResultValue('');
    setResultDeviceId('');
  };

  const searchNormativesForDialog = async () => {
    const value = normativeQuery.trim();
    setSelectedNormative(null);
    if (!canSearchNormative(value)) {
      setNormativeResults([]);
      setNormativeSearchDone(false);
      onNotify('Введите минимум 3 символа для поиска', 'warning');
      return;
    }
    setNormativeLoading(true);
    setNormativeSearchDone(false);
    try {
      const candidates = await searchNormativeCandidates(value);
      setNormativeResults(candidates);
      setNormativeSearchDone(true);
      if (!candidates.length) onNotify('Норматив не найден. Проверьте код или добавьте норматив в справочник.', 'warning');
    } catch (error) {
      if (isNormativeSearchCanceled(error)) return;
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
    const isAbsentNormative = String(selectedNormative.comparisonType || '').toUpperCase() === 'ABSENT';
    const parsedResult = parseMeasurementNumber(resultValue);
    if (!isAbsentNormative && parsedResult === null) return onNotify('Результат измерения должен быть числом', 'warning');
    const savedResult = parsedResult ?? resultValue.trim();
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
          primaryReading: savedResult,
          measurementReadings: savedResult,
          result: savedResult,
          resultValue: savedResult,
          deviceId: resultDeviceId || null,
          measurementDeviceId: resultDeviceId || null,
          measurementPlace: defaultMeasurementPlace || '',
          samplingPlace: defaultMeasurementPlace || '',
          waterType: isWaterProtocol ? selectedNormative.waterType || effectiveWaterType : '',
          waterUseCategory: isWaterProtocol ? waterUseCategory : '',
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
    searchAbortRef.current?.abort();
    if (!value) {
      setSuggestions([]);
      setSearching(false);
      setSearchState('idle');
      return;
    }
    if (!canSearchNormative(value) || value.includes(',') || value.includes(';')) {
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
        if (requestId !== searchRequestRef.current) return;
        const candidates = await searchNormativeCandidates(value);
        if (requestId !== searchRequestRef.current) return;
        if (candidates.length) {
          setSuggestions(candidates.map(normativeToSuggestion).slice(0, 12));
          setSearchState('ready');
          return;
        }
        setSuggestions([]);
        setSearchState('empty');
      } catch (error) {
        if (requestId !== searchRequestRef.current) return;
        if (isNormativeSearchCanceled(error)) return;
        if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
        setSuggestions([]);
        setSearchState('error');
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, templateId, subtype, objectId, testingDate, isPhysicalFactors, isSoilProtocol, isWaterProtocol, sourceDocumentCode, effectiveWaterType, physicalSubtype, physicalConditions]);

  const search = (value: string) => {
    setQuery(value);
  };

  const searchNow = async (value: string) => {
    const candidates = await searchNormativeCandidates(value);
    return candidates.map(normativeToSuggestion).slice(0, 12);
  };

  const addPollutant = async (pollutant: Pollutant, _append = true): Promise<ProtocolResultRow | null> => {
    setSaving(true);
    try {
      const selectedNormative = (pollutant as NormativeSuggestion).selectedNormative;
      const candidates = selectedNormative
        ? [selectedNormative]
        : await searchNormativeCandidates(
          `${pollutant.code} ${pollutant.name}`.trim(),
          pollutant,
        ).catch((error) => {
          if (isNormativeSearchCanceled(error)) return [];
          if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
          return [];
        });
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

  const createResultRowFromNormative = async (normative: NormativeRecord): Promise<ProtocolResultRow> => {
    const resolvedUnit = normative.unit || fallbackUnitForEnvironment(templateId, normative);
    const code = normative.factorCode || normative.pollutantCode || normative.code || '';
    const name = normative.indicator || normative.indicatorName || normative.pollutantName || '';
    const normativeValues = normativeValuesFromRecord(normative, templateId, resolvedUnit);
    return protocolService.addProtocolResult(protocolId, {
      normativeId: normative.id,
      values: {
        ...normativeValues,
        ...physicalConditionValues(),
        code,
        pollutantCode: code,
        factorCode: isPhysicalFactors ? code : normativeValues.factorCode,
        indicator: name,
        indicatorName: name,
        cas: normative.cas || normative.casNumber || '',
        casNumber: normative.casNumber || normative.cas || '',
        formula: normative.formula || normative.chemicalFormula || '',
        chemicalFormula: normative.chemicalFormula || normative.formula || '',
        result: null,
        resultValue: null,
        primaryReading: null,
        measurementReadings: null,
        measurementPlace: defaultMeasurementPlace || '',
        samplingPlace: defaultMeasurementPlace || '',
        waterType: isWaterProtocol ? normative.waterType || effectiveWaterType : '',
        waterUseCategory: isWaterProtocol ? waterUseCategory : '',
        sourceDocumentCode: normative.sourceDocumentCode || sourceDocumentCode,
        templateId: normative.templateId || normalizedTemplateId,
        category: normative.category || normative.categoryCode || searchContext.category || '',
      },
    });
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
    if (tokens.some((token) => !canSearchNormative(token))) {
      onNotify('Введите минимум 3 символа для поиска', 'warning');
      return;
    }
    setSearching(true);
    setSaving(true);
    try {
      const created: ProtocolResultRow[] = [];
      for (const token of tokens) {
        const candidates = await searchNormativeCandidates(token, { code: token, name: token }).catch((error) => {
          if (isNormativeSearchCanceled(error)) return [];
          if (getApiStatus(error) === 500) onNotify(searchUnavailableMessage, 'error');
          return [];
        });
        const normalized = token.toLowerCase();
        const normative = candidates.find((item) => String(item.pollutantCode || item.code || item.factorCode || '').toLowerCase() === normalized)
          || (candidates.length === 1 ? candidates[0] : undefined);
        if (!normative) {
          onNotify(candidates.length > 1 ? 'Выберите конкретный норматив через поиск, найдено несколько совпадений' : (isPhysicalFactors ? physicalNormativeNotFoundMessage : notFoundSearchMessage), 'warning');
          continue;
        }
        const normativeCode = normative.pollutantCode || normative.code || normative.factorCode || token;
        const exists = [...rows, ...created].some((row) => pollutantCode(row).toLowerCase() === normativeCode.toLowerCase());
        if (!exists) {
          const saved = await createResultRowFromNormative(normative);
          created.push(saved);
        }
      }
      if (created.length) {
        onChange([...rows, ...created]);
        setQuery('');
        setSuggestions([]);
        onNotify(`Добавлено показателей: ${created.length}`, 'success');
      }
    } finally {
      setSearching(false);
      setSaving(false);
    }
  };

  const addManualIndicator = async () => {
    const value = query.trim();
    if (!canSearchNormative(value)) {
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
          environmentType: isWaterProtocol ? 'WATER' : '',
          waterType: isWaterProtocol ? effectiveWaterType : '',
          waterUseCategory: isWaterProtocol ? waterUseCategory : '',
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
      const resultValue = form.primaryReading.trim() || null;
      const saved = await protocolService.updateProtocolResult(protocolId, editing.id, {
        measurementDeviceId: form.measurementDeviceId || undefined,
        normativeId: valueOf(editing, ['normativeId']) || editing.normativeReference?.id,
        values: {
          ...editing.values,
          primaryReading: form.primaryReading,
          readings: form.readings,
          measurementReadings: form.readings || form.primaryReading,
          result: resultValue,
          resultValue,
          ...(templateId === 'industrial_emissions' ? { resultMg: resultValue } : {}),
          measurementDeviceId: form.measurementDeviceId,
          measurementPlace: form.measurementPlace,
          samplingPlace: form.measurementPlace,
          sourceNumber: form.sourceNumber,
          externalLaboratory: form.externalLaboratory,
          externalLaboratoryDocument: form.externalLaboratoryDocument,
        },
      });
      let latestRow = saved;
      let recalculated = true;
      try {
        const calculation = await protocolService.calculateResult(protocolId, editing.id);
        if (calculation.row) latestRow = calculation.row;
      } catch (calculationError) {
        recalculated = false;
        console.warn(`Result ${editing.id} was updated but could not be recalculated automatically.`, calculationError);
      }
      onChange(rows.map((row) => row.id === editing.id ? latestRow : row));
      await onImported();
      setEditing(null);
      onNotify(
        recalculated ? 'Результат замера изменён и пересчитан' : 'Результат замера изменён. Нажмите «Рассчитать», чтобы обновить статус.',
        recalculated ? 'success' : 'warning',
      );
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
          waterType: isWaterProtocol ? normative.waterType || effectiveWaterType : valueOf(row, ['waterType']),
          waterUseCategory: isWaterProtocol ? waterUseCategory : valueOf(row, ['waterUseCategory']),
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
      const candidates = await searchNormativeCandidates(
        `${pollutantCode(row)} ${indicator(row)}`.trim(),
        { code: pollutantCode(row), name: indicator(row), unit: unit(row) },
      );
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
    setSaving(true);
    try {
      await protocolService.deleteProtocolResult(protocolId, deleteRow.id);
      onChange(rows.filter((item) => item.id !== deleteRow.id));
      setDeleteRow(null);
      onNotify('Строка удалена', 'success');
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось удалить строку', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeSelected = async () => {
    if (!selectedRows.length) return onNotify('Выберите строки', 'warning');
    if (!window.confirm(`Удалить выбранные строки: ${selectedRows.length}?`)) return;
    setSaving(true);
    try {
      const settled = await Promise.allSettled(selectedRows.map((row) => protocolService.deleteProtocolResult(protocolId, row.id)));
      const deletedIds = new Set(selectedRows.filter((_, index) => settled[index].status === 'fulfilled').map((row) => row.id));
      const failed = settled.length - deletedIds.size;
      if (failed) {
        await onImported();
        onNotify(`Удалено ${deletedIds.size} из ${settled.length}. ${failed} строк не удалено; данные перезагружены.`, 'warning');
      } else {
        onChange(rows.filter((row) => !deletedIds.has(row.id)));
        onNotify('Выбранные строки удалены', 'success');
      }
      setSelected([]);
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
      const settled = await Promise.allSettled(selectedRows.map((row) => protocolService.updateProtocolResult(protocolId, row.id, {
        measurementDeviceId: patch.measurementDeviceId || row.measurementDeviceId,
        normativeId: row.normativeReference?.id || valueOf(row, ['normativeId']),
        values: { ...row.values, ...patch },
      })));
      const saved = settled.flatMap((item) => item.status === 'fulfilled' ? [item.value] : []);
      const failed = settled.length - saved.length;
      if (failed) {
        await onImported();
        onNotify(`Обновлено ${saved.length} из ${settled.length}. ${failed} строк не обновлено; данные перезагружены.`, 'warning');
        return;
      }
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
      const importedRows = imported.results || [];
      if (importedRows.length) {
        onChange(mergeProtocolResults(rows, importedRows));
      } else {
        await onImported();
      }
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
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={() => openAddDialog()}><Plus className="h-4 w-4" /> Добавить показатель</Button>
          <Button type="button" variant="secondary" disabled={readOnly || busy || saving} onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4" /> Импорт из Excel</Button>
          <Button type="button" disabled={readOnly || busy || saving || !rows.length} onClick={calculateAll}><Calculator className="h-4 w-4" /> Рассчитать результаты</Button>
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
                <Button type="button" variant="secondary" className="shrink-0" disabled={readOnly || saving} onClick={() => openAddDialog(query.trim())}>
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
                <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row, templateId)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}</div></td>
                <td className="px-3 py-3"><div className="max-w-56 text-xs font-semibold text-slate-700">{normativeDocumentLabel(row) || '—'}</div></td>
                <td className="px-3 py-3">{resolveDeviceName(row, devices) || '—'}</td>
                <td className="px-3 py-3"><div className="relative flex flex-wrap justify-end gap-1">
                  <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                  <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
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
        ) : isWaterProtocol ? (
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {!readOnly && <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>}
            <th className="px-3 py-3">№</th>
            <th className="px-3 py-3">Показатель / вещество</th>
            <th className="bg-slate-100 px-3 py-3">Фактическое значение</th>
            <th className="px-3 py-3">Единица измерения</th>
            <th className="bg-slate-100 px-3 py-3">Норматив</th>
            <th className="bg-slate-100 px-3 py-3">Результат</th>
            <th className="px-3 py-3">Документ</th>
            <th className="px-3 py-3">Приложение</th>
            <th className="px-3 py-3">Таблица</th>
            <th className="px-3 py-3 text-right">Действия</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row, index) => (
            <tr key={row.id} className="align-top hover:bg-slate-50">
              {!readOnly && <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>}
              <td className="px-3 py-3 font-bold text-slate-900">{index + 1}</td>
              <td className="px-3 py-3"><p className="font-bold text-slate-900">{indicator(row) || '—'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{pollutantCode(row) || valueOf(row, ['categoryCode']) || '—'}</p></td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{officialResult(row, templateId) || 'Ожидает ввода'}</div></td>
              <td className="px-3 py-3">{unit(row) || '—'}</td>
              <td className="bg-slate-50 px-3 py-3">{renderNormativeCell(row)}</td>
              <td className="bg-slate-50 px-3 py-3"><NormativeStatusBadge status={statusOf(row, templateId)} /></td>
              <td className="px-3 py-3"><div className="max-w-56 text-xs font-semibold text-slate-700">{valueOf(row, ['sourceDocumentCode']) || normativeDocumentLabel(row) || 'DSM_138'}</div></td>
              <td className="px-3 py-3">{valueOf(row, ['appendixNo']) || '—'}</td>
              <td className="px-3 py-3">{valueOf(row, ['tableNo']) || '—'}</td>
              <td className="px-3 py-3"><div className="flex flex-wrap justify-end gap-1">
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => openEdit(row)}>Изменить</Button>
                <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly || saving} onClick={() => setDeleteRow(row)}>Удалить</Button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
        ) : isSoilProtocol ? (
        <table className="min-w-[1180px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
            {!readOnly && <th className="px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length} onChange={(event) => setSelected(event.target.checked ? rows.map((row) => row.id) : [])} /></th>}
            <th className="px-3 py-3">Вещество</th>
            <th className="px-3 py-3">Форма</th>
            <th className="bg-slate-100 px-3 py-3">Факт</th>
            <th className="bg-slate-100 px-3 py-3">Норматив</th>
            <th className="px-3 py-3">Ед.</th>
            <th className="px-3 py-3">Лимитирующий показатель</th>
            <th className="bg-slate-100 px-3 py-3">Вывод</th>
            <th className="px-3 py-3">Документ</th>
            <th className="px-3 py-3 text-right">Действия</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((row) => {
            const calculationLabel = calculationStatusLabel(row.calculationStatus || valueOf(row, ['calculationStatus']));
            const documentLabel = [
              normativeDocumentLabel(row),
              valueOf(row, ['tableNo']) ? `табл. ${valueOf(row, ['tableNo'])}` : '',
            ].filter(Boolean).join(', ');
            return <tr key={row.id} className="align-top hover:bg-slate-50">
              {!readOnly && <td className="px-3 py-3"><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} /></td>}
              <td className="px-3 py-3"><p className="font-bold text-slate-900">{indicator(row) || '—'}</p><p className="mt-1 text-xs font-black text-eco-800">{pollutantCode(row) || '—'}</p>{measurementPlace(row) && <p className="mt-1 text-xs text-slate-500">{measurementPlace(row)}</p>}</td>
              <td className="px-3 py-3">{valueOf(row, ['formType', 'aggregateState', 'normativeSubType', 'subtype']) || '—'}</td>
              <td className="bg-slate-50 px-3 py-3"><div className={automaticClass}>{officialResult(row, templateId) || 'Ожидает ввод'} {officialResult(row, templateId) && unit(row)}</div></td>
              <td className="bg-slate-50 px-3 py-3">{renderNormativeCell(row)}</td>
              <td className="px-3 py-3">{unit(row) || '—'}</td>
              <td className="px-3 py-3">{valueOf(row, ['limitingIndicator']) || '—'}</td>
              <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row, templateId)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}</div></td>
              <td className="px-3 py-3"><div className="max-w-56 text-xs font-semibold text-slate-700">{documentLabel || '—'}</div></td>
              <td className="px-3 py-3"><div className="flex flex-wrap justify-end gap-1">
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => openEdit(row)}>Изменить</Button>
                <Button type="button" variant="secondary" className="px-3 text-rose-700 hover:bg-rose-50" disabled={readOnly || saving} onClick={() => setDeleteRow(row)}>Удалить</Button>
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
              <td className="bg-slate-50 px-3 py-3"><div className="space-y-2"><NormativeStatusBadge status={statusOf(row, templateId)} />{calculationLabel && <p className="text-xs font-semibold text-slate-600">{calculationLabel}</p>}{exceededText(row, templateId) && <p className="max-w-56 text-xs font-semibold text-rose-700">{exceededText(row, templateId)}</p>}</div></td>
              <td className="px-3 py-3"><div className="relative flex flex-wrap justify-end gap-1">
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => setRawRow(row)}>Ввести данные</Button>
                <Button type="button" variant="secondary" className="px-3" disabled={readOnly || saving} onClick={() => calculateRow(row)}>Рассчитать</Button>
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
                ) : normativeQuery.trim() && !canSearchNormative(normativeQuery) ? (
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
            <Button type="button" disabled={readOnly || saving || !selectedNormative || !resultValue.trim()} onClick={saveDialogResult}>Сохранить результат</Button>
          </div>
        </div>
      </Modal>

      <RawMeasurementsModal
        open={Boolean(rawRow)}
        protocolId={protocolId}
        row={rawRow}
        devices={devices}
        readOnly={readOnly}
        onClose={() => setRawRow(null)}
        onCalculated={applyCalculatedRow}
        onReload={onImported}
        onNotify={onNotify}
      />

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Изменить результат замера" description="Исправьте значение. После сохранения строка будет повторно рассчитана и загружена с backend." size="lg" loading={saving}>
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
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button><Button type="button" onClick={save} disabled={saving}>Сохранить и пересчитать</Button></div>
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
            ['Сравнение', calculation.details.comparisonResult || statusLabel(String(statusOf(calculation.row, templateId) || ''))],
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
                <div><dt className="text-xs font-bold uppercase text-slate-400">Статус</dt><dd className="font-semibold text-slate-800"><NormativeStatusBadge status={item.row ? statusOf(item.row, templateId) : item.internalStatus} /></dd></div>
              </dl>
              {item.calculationMessage && <p className="mt-2 text-sm text-slate-600">{item.calculationMessage}</p>}
            </div>
          )) : <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">История расчета пуста.</p>}
        </div>
      </Modal>

      <Modal open={Boolean(deleteRow)} onClose={() => setDeleteRow(null)} title="Удалить строку?" size="sm">
        <p className="text-sm text-slate-600">Будут удалены первичные показания и связанный расчёт. Это действие нельзя отменить.</p>
        <div className="mt-5 flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setDeleteRow(null)}>Отмена</Button><Button type="button" disabled={readOnly} onClick={remove}>Удалить</Button></div>
      </Modal>
    </section>
  );
};

export default ProtocolResultsTable;
