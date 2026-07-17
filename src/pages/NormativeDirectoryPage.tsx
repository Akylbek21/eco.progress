import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Copy, Edit3, FileSpreadsheet, Plus, RefreshCw, RotateCcw, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { templateName } from '../data/protocolTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { archiveNormative, confirmDsm138Import, createNormative, getNormativeRecords, importDsm32FromResources, importNormativesExcel, importPhysicalFactorsFromResources, previewDsm138Import, rollbackDsm138Import, updateNormative, type NormativeImportPreview, type NormativeRecordsParams } from '../services/normativeService';
import { getApiStatus } from '../services/apiHelpers';
import type { NormativeRecord } from '../types/protocols';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
type NormativeDocumentCode = 'DSM_70' | 'DSM_15' | 'DSM_32' | 'DSM_138';
type NormativeCategoryCode =
  | 'ambient_air'
  | 'workplace_air'
  | 'summation_groups'
  | 'rocket_fuel'
  | 'water'
  | 'soil'
  | 'food'
  | 'surface'
  | 'sanitary'
  | 'food_products'
  | 'surfaces'
  | 'microclimate'
  | 'noise'
  | 'vibration'
  | 'lighting'
  | 'infrasound'
  | 'infra_sound'
  | 'ultrasound'
  | 'uv'
  | 'aeroions'
  | 'emf'
  | 'laser'
  | 'soil_pdk'
  | 'soil_sanitary_chemical'
  | 'soil_microbiology'
  | 'soil_degradation'
  | 'DRINKING_WATER_GENERAL_CHEMICAL'
  | 'WATER_TREATMENT_REAGENTS'
  | 'ORGANOLEPTIC'
  | 'RADIATION_SAFETY'
  | 'MICROBIOLOGY_PARASITOLOGY'
  | 'DRINKING_WATER_CHEMICALS'
  | 'SURFACE_WATER_SAFETY'
  | 'SURFACE_WATER_PDK'
  | 'drinking_water_safety'
  | 'water_treatment_reagents'
  | 'chemical_substances'
  | 'surface_water_safety'
  | 'surface_water_chemicals';

type NormativeCategory = {
  code: NormativeCategoryCode;
  label: string;
};

type SelectOption = {
  label: string;
  value: string;
};

type NormativeColumn = {
  key: string;
  label: string;
  className?: string;
  render: (row: NormativeTableRow, index: number) => string;
};

const emptyImportPreview: NormativeImportPreview = {
  items: [],
  total: 0,
  valid: 0,
  invalid: 0,
  created: 0,
  updated: 0,
  errors: [],
  warnings: [],
  files: [],
  totalFiles: 0,
};

const environmentOptions = [
  'Атмосферный воздух',
  'Воздух рабочей зоны',
  'Вода',
  'Почва',
  'Физические факторы',
  'Специальные УДМГ',
];

const normativeTypeOptions: SelectOption[] = [
  { label: 'ПДК', value: 'PDK' },
  { label: 'ОБУВ', value: 'OBUV' },
  { label: 'ПДУ', value: 'PDU' },
  { label: 'Оценочная матрица', value: 'ASSESSMENT' },
  { label: 'Предельно допустимый уровень', value: 'EXPOSURE_LIMIT' },
  { label: 'Допустимое суточное поступление', value: 'ADI' },
];
const soilFormOptions = ['подвижная форма', 'водорастворимая форма'];
const normativeSubTypeOptions: SelectOption[] = [
  { label: 'Максимально разовая', value: 'MAX_ONE_TIME' },
  { label: 'Среднесуточная', value: 'DAILY_AVERAGE' },
  { label: 'Разовая', value: 'SINGLE' },
  { label: 'Среднесменная', value: 'SHIFT_AVERAGE' },
  { label: 'Диапазон', value: 'RANGE' },
  { label: 'Отсутствие', value: 'ABSENT' },
  { label: 'Ориентировочный безопасный уровень', value: 'SAFE_APPROXIMATE_LEVEL' },
  { label: 'Экспозиция', value: 'EXPOSURE' },
];
const comparisonTypeOptions: SelectOption[] = [
  { label: '≤', value: 'LESS_OR_EQUAL' },
  { label: '≥', value: 'GREATER_OR_EQUAL' },
  { label: 'Диапазон', value: 'RANGE' },
  { label: '=', value: 'EQUAL' },
  { label: 'Отсутствие', value: 'ABSENT' },
  { label: 'Информация', value: 'INFO' },
];
const factorTypeOptions = ['MICROCLIMATE', 'LIGHTING', 'NOISE', 'VIBRATION', 'NOISE_VIBRATION', 'INFRASOUND', 'ULTRASOUND', 'UV', 'AEROIONS', 'ELECTROMAGNETIC_FIELD', 'LASER'];
const MIN_SEARCH_LENGTH = 3;
const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

const NORMATIVE_DOCUMENTS: Array<{ code: NormativeDocumentCode; title: string; description: string }> = [
  {
    code: 'DSM_70',
    title: 'ДСМ-70',
    description: 'Гигиенические нормативы к атмосферному воздуху, рабочей зоне и компонентам ракетного топлива',
  },
  {
    code: 'DSM_15',
    title: 'ДСМ-15',
    description: 'Гигиенические нормативы к физическим факторам',
  },
  {
    code: 'DSM_32',
    title: 'ДСМ-32',
    description: 'Гигиенические нормативы к безопасности среды обитания',
  },
  {
    code: 'DSM_138',
    title: 'ДСМ-138',
    description: 'Гигиенические нормативы воды питьевого и культурно-бытового водопользования',
  },
];

const DSM15_CATEGORIES: NormativeCategory[] = [
  { code: 'microclimate', label: 'Микроклимат' },
  { code: 'lighting', label: 'Освещенность' },
  { code: 'noise', label: 'Шум' },
  { code: 'vibration', label: 'Вибрация' },
  { code: 'infra_sound', label: 'Инфразвук' },
  { code: 'ultrasound', label: 'Ультразвук' },
  { code: 'uv', label: 'Ультрафиолет' },
  { code: 'aeroions', label: 'Аэроионы' },
  { code: 'emf', label: 'ЭМП' },
  { code: 'laser', label: 'Лазерное излучение' },
];

const DSM70_CATEGORIES: NormativeCategory[] = [
  { code: 'ambient_air', label: 'Атмосферный воздух' },
  { code: 'workplace_air', label: 'Воздух рабочей зоны' },
  { code: 'soil', label: 'Почва' },
  { code: 'water', label: 'Вода' },
  { code: 'food_products', label: 'Продукты питания' },
  { code: 'surfaces', label: 'Поверхности' },
  { code: 'rocket_fuel', label: 'Компоненты ракетного топлива' },
  { code: 'summation_groups', label: 'Группы суммации' },
];

const DSM32_CATEGORIES: NormativeCategory[] = [
  { code: 'soil', label: 'Почва' },
  { code: 'food', label: 'Пищевые продукты' },
  { code: 'surface', label: 'Поверхности' },
  { code: 'sanitary', label: 'Санитарно-показательные нормативы' },
];

const DSM138_CATEGORIES: NormativeCategory[] = [
  { code: 'drinking_water_safety', label: 'Прил. 1. Показатели безопасности питьевой воды' },
  { code: 'water_treatment_reagents', label: 'Прил. 1. Средства обработки воды' },
  { code: 'chemical_substances', label: 'Прил. 2. Вредные вещества в питьевой воде' },
  { code: 'surface_water_safety', label: 'Прил. 3. Показатели безопасности воды водных объектов' },
  { code: 'surface_water_chemicals', label: 'Прил. 4. Вредные вещества в воде водных объектов' },
];

const waterTypeOptions = [
  { value: 'DRINKING_WATER', label: 'Питьевая вода' },
  { value: 'SURFACE_WATER', label: 'Вода водного объекта' },
];

const templateEnvironment: Record<string, string> = {
  ambient_air: 'Атмосферный воздух',
  atmospheric_air: 'Атмосферный воздух',
  workplace_air: 'Воздух рабочей зоны',
  water_wastewater: 'Вода',
  soil: 'Почва',
  physical_factors: 'Физические факторы',
  industrial_emissions: 'Атмосферный воздух',
};

const typeLabels: Record<string, string> = {
  PDK: 'ПДК',
  MPC: 'ПДК',
  OBUV: 'ОБУВ',
  PDU: 'ПДУ',
  ADI: 'ADI',
  EXPOSURE_LIMIT: 'Предельно допустимый уровень',
  ASSESSMENT: 'Оценочная матрица',
  ASSESSMENT_MATRIX: 'Оценочная матрица',
  MATRIX: 'Оценочная матрица',
};

const subtypeLabels: Record<string, string> = {
  MAX_ONE_TIME: 'Максимальная разовая',
  MAX_SINGLE: 'Максимальная разовая',
  AVERAGE_DAILY: 'Среднесуточная',
  DAILY_AVERAGE: 'Среднесуточная',
  SHIFT_AVERAGE: 'Среднесменная',
  SINGLE: 'Разовая',
  DAILY: 'Суточная',
  RANGE: 'Диапазон',
  ABSENT: 'Отсутствие',
  SAFE_APPROXIMATE_LEVEL: 'Ориентировочный безопасный уровень',
  EXPOSURE: 'Экспозиция',
};

const normalizeSearch = (value: unknown) => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
const normalizeKey = (value: unknown) => textValue(value).toUpperCase().replace(/[\s-]+/g, '_');
const safeJsonParse = (value: string) => {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const conditionData = (record: NormativeRecord) => {
  const value = record.conditionJson as unknown;
  if (!value) return {};
  if (typeof value === 'string') return safeJsonParse(value);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const textValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
};

const conditionValue = (record: NormativeRecord, ...keys: string[]) => {
  const condition = conditionData(record);
  return textValue(...keys.map((key) => condition[key]));
};

const getRecordCode = (record: NormativeRecord) =>
  displayCell(record.pollutantCode, record.code, record.factorCode, conditionValue(record, 'indicatorCode', 'code'));

const getRecordName = (record: NormativeRecord) =>
  displayCell(record.indicatorName, record.indicator, record.pollutantName, record.name, conditionValue(record, 'factorName', 'indicatorName', 'name'));

const getRecordCas = (record: NormativeRecord) =>
  displayCell(record.casNumber, record.cas, conditionValue(record, 'casNumber', 'cas'));

const getRecordFormula = (record: NormativeRecord) =>
  displayCell(record.chemicalFormula, record.formula, conditionValue(record, 'chemicalFormula', 'formula'));

const getRecordUnit = (record: NormativeRecord) =>
  displayCell(record.unit, conditionValue(record, 'unit', 'measurementUnit'));

const getRecordValue = (record: NormativeRecord) =>
  displayCell(record.normativeValue, record.value, record.maxValue, conditionValue(record, 'normativeValue', 'value', 'maxValue'));

const extractNumericValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[≤≥=]/g, '').trim();
};

const normalizeNumericInput = (value: FormDataEntryValue | null): string | null => {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return '';
  return /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized) ? normalized : null;
};

const getCategories = (documentCode: NormativeDocumentCode) => {
  if (documentCode === 'DSM_15') return DSM15_CATEGORIES;
  if (documentCode === 'DSM_32') return DSM32_CATEGORIES;
  if (documentCode === 'DSM_138') return DSM138_CATEGORIES;
  return DSM70_CATEGORIES;
};

const isGarbageNormativeRow = (item: NormativeRecord) => {
  const usefulData = textValue(
    item.indicatorName,
    item.pollutantName,
    item.indicator,
    item.name,
    item.assessmentCategory,
    item.hazardLevel,
    item.categoryName,
    item.tableTitle,
    item.pollutantCode,
    item.code,
    item.factorCode,
    item.normativeValue,
    item.value,
    item.pdk,
    item.obuv,
    item.limitValue,
    item.minValue,
    item.maxValue,
    item.min,
    item.max,
    item.unit,
    item.cas,
    item.casNumber,
    item.formula,
    item.chemicalFormula,
    item.conditionJson,
    item.formType,
    item.factorType,
    item.waterType,
    item.matrixType,
    item.radioactiveIndicator,
    item.coliTiter,
    item.anaerobeTiter,
    item.helminth,
    item.flyLarvae,
    item.sanitaryNumber,
    item.ecologicalDisaster,
    item.emergencySituation,
    item.satisfactorySituation,
    item.hazardClass,
    item.limitingIndicator,
    item.limitingHazardIndicator,
    item.roomType,
    item.season,
    item.workCategory,
    item.workplaceType,
    item.normLevel,
    item.lightingType,
    item.noiseType,
    item.visualWorkCategory,
  );
  return !usefulData;
};

type NormativeTableRow = {
  key: string;
  records: NormativeRecord[];
  primary: NormativeRecord;
  maxOneTimeValue: string;
  dailyAverageValue: string;
  generalValue: string;
  unit: string;
};

const displayEnvironment = (item: NormativeRecord) =>
  textValue(item.environment, item.researchObject, templateEnvironment[item.templateId], templateName(item.templateId));

const displayType = (item: NormativeRecord) => {
  if (item.comparisonType === 'INFO' || item.matrixType || item.assessmentCategory || ['2', '3', '4'].includes(textValue(item.tableNo))) return 'Оценочная матрица';
  const raw = textValue(item.normativeType);
  return typeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const displaySubtype = (item: NormativeRecord) => {
  const raw = textValue(item.normativeSubType, item.subtype);
  return subtypeLabels[raw.toUpperCase().replace(/[\s-]+/g, '_')] || raw;
};

const getNormativeDisplay = (item: NormativeRecord) => {
  const value = textValue(item.normativeValue, item.value, item.pdk, item.obuv, item.limitValue);
  const min = textValue(item.minValue, item.min);
  const max = textValue(item.maxValue, item.max);
  const unit = textValue(item.unit);
  const alternative = textValue(item.alternativeNormativeValue);
  const comparisonType = normalizeKey(item.comparisonType);
  let result = '';
  if (comparisonType === 'RANGE' && min && max) result = `${displayNormativeCell(min)}-${displayNormativeCell(max)}${unit ? ` ${unit}` : ''}`;
  else if (comparisonType === 'LESS_OR_EQUAL' && (max || value)) result = `≤ ${displayNormativeCell(max || value)}${unit ? ` ${unit}` : ''}`;
  else if (comparisonType === 'GREATER_OR_EQUAL' && (min || value)) result = `≥ ${displayNormativeCell(min || value)}${unit ? ` ${unit}` : ''}`;
  else if (comparisonType === 'EQUAL' && value) result = `= ${displayNormativeCell(value)}${unit ? ` ${unit}` : ''}`;
  else if (comparisonType === 'ABSENT') result = 'не допускается';
  else if (value) result = `${displayNormativeCell(value)}${unit && /^[<>≤≥=]?\s*[\d.,-]+$/.test(value) ? ` ${unit}` : ''}`;
  else if (min && max) result = `${displayNormativeCell(min)}-${displayNormativeCell(max)}${unit ? ` ${unit}` : ''}`;
  else result = textValue(max, min);
  return alternative ? `${result} (${alternative})` : result;
};

const displayNormative = getNormativeDisplay;

const normalizedTypeKey = (value: unknown) => textValue(value).toUpperCase().replace(/[\s-]+/g, '_');
const normalizedItemType = (item: NormativeRecord) => normalizedTypeKey(item.normativeType);
const normalizedItemSubtype = (item: NormativeRecord) => normalizedTypeKey(textValue(item.normativeSubType, item.subtype));
const displayCell = (...values: unknown[]) => textValue(...values) || '—';
const formatNormativeNumber = (value: unknown) => {
  const text = textValue(value);
  if (!text || text === '-') return text || '-';
  const normalized = text.replace(/\s+/g, '').replace(',', '.');
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) return text;
  const [integer, fraction = ''] = normalized.split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${integer},${trimmedFraction}` : integer;
};
const displayNormativeCell = (...values: unknown[]) => formatNormativeNumber(textValue(...values));
const displayComparisonType = (item: NormativeRecord) => {
  const labels: Record<string, string> = {
    LESS_OR_EQUAL: '≤',
    GREATER_OR_EQUAL: '≥',
    RANGE: 'Диапазон',
    EQUAL: '=',
    INFO: 'Инфо',
  };
  return labels[item.comparisonType] || item.comparisonType || '—';
};

const formatMetadata = (value: unknown) => {
  const raw = textValue(value);
  if (!raw) return '';
  const parsedValue = typeof value === 'string' ? safeJsonParse(value) : value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  if (!Object.keys(parsedValue).length) return raw === '[object Object]' ? '' : raw;
  try {
    const labels: Record<string, string> = {
      appendix: 'Приложение',
      appendixNo: 'Приложение',
      appNo: 'Приложение',
      table: 'таблица',
      tableNo: 'таблица',
      tableNumber: 'таблица',
      hazardClass: 'класс опасности',
      limitingIndicator: 'лимитирующий показатель',
      limitingHazardIndicator: 'лимитирующий показатель',
      roomType: 'помещение',
      workCategory: 'категория работ',
      season: 'период года',
      notes: 'примечание',
      sectionName: 'раздел',
    };
    return Object.entries(parsedValue)
      .filter(([, item]) => item !== undefined && item !== null && textValue(item))
      .map(([key, item]) => `${labels[key] || key} ${textValue(item)}`)
      .join(', ');
  } catch {
    return raw;
  }
};

const displayConditions = (item: NormativeRecord) => [
  item.season,
  item.workCategory,
  item.workplaceType,
  item.roomType,
  item.normLevel,
  item.lightingType,
  item.noiseType,
  item.visualWorkCategory,
  item.factorCode,
  formatMetadata(item.conditionJson),
].filter(Boolean).join(', ') || '—';

const displayTableLabel = (item: NormativeRecord) => {
  const appendix = textValue(item.appNo, item.appendixNo, item.appendix);
  const tableNo = textValue(item.tableNo, item.tableNumber);
  const tableTitle = textValue(item.tableTitle, item.sourceFileName, item.sourceFile, item.categoryName, item.category);
  const parts = [
    appendix ? `Прил. ${appendix}` : '',
    tableNo ? `Таблица ${tableNo}` : '',
    tableTitle,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
};

const displayDocument = (item: NormativeRecord) =>
  displayCell(item.sourceDocumentName, item.sourceDocumentCode, item.normativeDocument);

const displayPollutantName = (row: NormativeTableRow) =>
  displayCell(firstGroupValue(row, (record) => record.indicator || record.indicatorName || record.pollutantName || record.name));

const displayGeneralNormative = (row: NormativeTableRow) => {
  if (row.generalValue) return displayNormativeCell(row.generalValue);
  if (row.maxOneTimeValue || row.dailyAverageValue) return '—';
  return displayNormativeCell(displayNormative(row.primary));
};

const displaySubstances = (row: NormativeTableRow) =>
  displayCell(Array.from(new Set(row.records.map((record) => textValue(record.pollutantName, record.indicatorName, record.indicator, record.name)).filter(Boolean))).join(', '));

const displayCodes = (row: NormativeTableRow) =>
  displayCell(Array.from(new Set(row.records.map((record) => textValue(record.pollutantCode, record.code, record.factorCode)).filter(Boolean))).join(', '));

const groupTitleForRow = (row: NormativeTableRow) => displayTableLabel(row.primary);

const singleRecordRow = (item: NormativeRecord, index: number): NormativeTableRow => {
  const row: NormativeTableRow = {
    key: item.id || `record:${index}`,
    records: [item],
    primary: item,
    maxOneTimeValue: '',
    dailyAverageValue: '',
    generalValue: '',
    unit: '',
  };
  addNormativeToRow(row, item);
  return row;
};

const normativeGroupKey = (
  item: NormativeRecord,
  documentCode: NormativeDocumentCode,
  categoryCode: NormativeCategoryCode,
) => {
  if (categoryCode === 'summation_groups') {
    return `summation:${normalizeSearch(textValue(item.summationGroup, item.categoryName, item.code, item.category))}`;
  }
  if (documentCode === 'DSM_70' && ['ambient_air', 'workplace_air'].includes(categoryCode)) {
    const identity = normalizeSearch(textValue(
      item.pollutantCode,
      item.code,
      item.casNumber,
      item.cas,
      item.pollutantName,
      item.indicatorName,
      item.indicator,
      item.name,
    ));
    if (!identity) return `record:${item.id}`;
    return [
      'air',
      normalizeSearch(textValue(item.pollutantCode, item.code)),
      normalizeSearch(textValue(item.casNumber, item.cas)),
      normalizeSearch(textValue(item.pollutantName, item.indicatorName, item.indicator, item.name)),
      normalizedItemType(item),
      normalizeSearch(textValue(item.unit)),
    ].join(':');
  }
  return `record:${item.id}`;
};

const groupNormativeRows = (
  items: NormativeRecord[],
  documentCode: NormativeDocumentCode,
  categoryCode: NormativeCategoryCode,
) => {
  const rows = new Map<string, NormativeTableRow>();
  items.forEach((item, index) => {
    const key = normativeGroupKey(item, documentCode, categoryCode);
    const existing = rows.get(key);
    if (existing) {
      existing.records.push(item);
      addNormativeToRow(existing, item);
      return;
    }
    rows.set(key, { ...singleRecordRow(item, index), key });
  });
  return Array.from(rows.values());
};

const getVisibleColumns = (documentCode: NormativeDocumentCode, categoryCode: NormativeCategoryCode): NormativeColumn[] => {
  if (documentCode === 'DSM_138') {
    return [
      { key: 'code', label: 'Код', render: (row) => getRecordCode(row.primary) },
      { key: 'indicator', label: 'Показатель', render: (row) => getRecordName(row.primary) },
      { key: 'table', label: 'Приложение / таблица', render: (row) => displayTableLabel(row.primary) },
      { key: 'water', label: 'Категория воды', render: (row) => displayCell(row.primary.waterType, row.primary.waterUseCategory, conditionValue(row.primary, 'waterUseCategory', 'waterType')) },
      { key: 'normative', label: 'Норматив', render: (row) => displayNormative(row.primary) || getRecordValue(row.primary) },
      { key: 'unit', label: 'Ед. изм.', render: (row) => getRecordUnit(row.primary) },
      { key: 'hazard', label: 'Класс опасности', render: (row) => displayCell(row.primary.hazardClass, conditionValue(row.primary, 'hazardClass')) },
      { key: 'limiting', label: 'Показатель вредности', render: (row) => displayCell(row.primary.limitingHazardIndicator, row.primary.limitingIndicator, conditionValue(row.primary, 'limitingIndicator', 'limitingHazardIndicator')) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(conditionValue(row.primary, 'notes', 'organolepticSign', 'sectionName'), formatMetadata(row.primary.conditionJson)) },
    ];
  }

  if (documentCode === 'DSM_15') {
    return [
      { key: 'code', label: 'Код', render: (row) => getRecordCode(row.primary) },
      { key: 'factor', label: 'Фактор', render: (row) => getRecordName(row.primary) },
      { key: 'factorType', label: 'Категория фактора', render: (row) => displayCell(row.primary.factorType, row.primary.subtype, conditionValue(row.primary, 'factorType')) },
      { key: 'conditions', label: 'Условия', render: (row) => displayConditions(row.primary) },
      { key: 'normative', label: 'Норма', render: (row) => displayNormative(row.primary) || getRecordValue(row.primary) },
      { key: 'unit', label: 'Ед. изм.', render: (row) => getRecordUnit(row.primary) },
      { key: 'document', label: 'Документ', render: (row) => displayDocument(row.primary) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(conditionValue(row.primary, 'notes'), formatMetadata(row.primary.conditionJson)) },
    ];
  }

  if (documentCode === 'DSM_32') {
    return [
      { key: 'code', label: 'Код', render: (row) => getRecordCode(row.primary) },
      { key: 'indicator', label: 'Показатель', render: (row) => getRecordName(row.primary) },
      { key: 'environment', label: 'Объект среды', render: (row) => displayCell(row.primary.researchObject, row.primary.environment, row.primary.environmentType, conditionValue(row.primary, 'environment', 'researchObject')) },
      { key: 'normative', label: 'Норматив', render: (row) => displayNormative(row.primary) || getRecordValue(row.primary) },
      { key: 'unit', label: 'Ед. изм.', render: (row) => getRecordUnit(row.primary) },
      { key: 'sanitary', label: 'Санитарный показатель', render: (row) => displayCell(row.primary.sanitaryNumber, row.primary.coliTiter, row.primary.anaerobeTiter, row.primary.helminth, row.primary.flyLarvae, conditionValue(row.primary, 'sanitaryNumber', 'coliTiter', 'anaerobeTiter', 'helminth', 'flyLarvae')) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(conditionValue(row.primary, 'notes', 'sectionName'), formatMetadata(row.primary.conditionJson)) },
    ];
  }

  if (categoryCode === 'summation_groups') {
    return [
      { key: 'group', label: 'Группа', render: (row) => displayCell(row.primary.summationGroup, row.primary.code, row.primary.categoryName) },
      { key: 'substances', label: 'Вещества', render: (row) => displaySubstances(row) },
      { key: 'codes', label: 'Коды веществ', render: (row) => displayCodes(row) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(formatMetadata(row.primary.conditionJson), row.primary.normativeDocument) },
    ];
  }

  if (documentCode === 'DSM_70' && ['ambient_air', 'workplace_air'].includes(categoryCode)) {
    return [
      { key: 'code', label: 'Код', render: (row) => getRecordCode(row.primary) },
      { key: 'name', label: 'Наименование', render: (row) => displayPollutantName(row) },
      { key: 'cas', label: 'CAS', render: (row) => getRecordCas(row.primary) },
      { key: 'formula', label: 'Формула', render: (row) => getRecordFormula(row.primary) },
      { key: 'type', label: 'Тип норматива', render: (row) => displayCell(displayType(row.primary)) },
      { key: 'maxOneTime', label: 'Макс. разовая', render: (row) => displayNormativeCell(row.maxOneTimeValue) || '—' },
      { key: 'dailyAverage', label: 'Среднесуточная', render: (row) => displayNormativeCell(row.dailyAverageValue) || '—' },
      { key: 'value', label: 'Прочее значение', render: (row) => displayGeneralNormative(row) || '—' },
      { key: 'unit', label: 'Ед. изм.', render: (row) => displayCell(row.unit) },
      { key: 'hazard', label: 'Класс опасности', render: (row) => displayCell(row.primary.hazardClass, conditionValue(row.primary, 'hazardClass')) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(conditionValue(row.primary, 'notes'), formatMetadata(row.primary.conditionJson)) },
    ];
  }

  return [
    { key: 'code', label: 'Код', render: (row) => getRecordCode(row.primary) },
    { key: 'name', label: 'Наименование', render: (row) => getRecordName(row.primary) },
    { key: 'cas', label: 'CAS', render: (row) => getRecordCas(row.primary) },
    { key: 'formula', label: 'Формула', render: (row) => getRecordFormula(row.primary) },
    { key: 'type', label: 'Тип норматива', render: (row) => displayCell(displayType(row.primary)) },
    { key: 'subtype', label: 'Подтип', render: (row) => displayCell(displaySubtype(row.primary)) },
    { key: 'value', label: 'Значение', render: (row) => displayNormative(row.primary) || getRecordValue(row.primary) },
    { key: 'unit', label: 'Ед. изм.', render: (row) => getRecordUnit(row.primary) },
    { key: 'hazard', label: 'Класс опасности', render: (row) => displayCell(row.primary.hazardClass, conditionValue(row.primary, 'hazardClass')) },
    { key: 'note', label: 'Примечание', render: (row) => displayCell(conditionValue(row.primary, 'notes'), formatMetadata(row.primary.conditionJson)) },
  ];
};

const itemEnvironmentText = (item: NormativeRecord) => normalizeSearch([
  item.templateId,
  item.sourceDocumentCode,
  item.sourceDocumentName,
  item.normativeDocument,
  item.environmentType,
  item.environment,
  item.researchObject,
  displayEnvironment(item),
].filter(Boolean).join(' '));

const itemDocumentText = (item: NormativeRecord) => normalizeSearch([
  item.sourceDocumentCode,
  item.sourceDocumentName,
  item.normativeDocument,
  item.source,
].filter(Boolean).join(' ')).replace(/-/g, '_');

const hasDocumentCode = (item: NormativeRecord, code: string) =>
  itemDocumentText(item).includes(code.toLowerCase().replace(/-/g, '_'));

const normalizedDocumentCode = (item: NormativeRecord) =>
  textValue(item.sourceDocumentCode).toUpperCase().replace(/-/g, '_');

const isAtmosphericAir = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  const isDsm70 = hasDocumentCode(item, 'DSM_70') || hasDocumentCode(item, 'ДСМ_70');
  return text.includes('ambient_air')
    || text.includes('atmospheric_air')
    || text.includes('atmospheric')
    || text.includes('atmosphere')
    || text.includes('industrial_emissions')
    || text.includes('атмосфер')
    || (isDsm70 && item.templateId !== 'workplace_air' && !isWorkZoneAir(item));
};

const isWorkZoneAir = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  return text.includes('workplace_air')
    || text.includes('work_zone_air')
    || text.includes('workplace')
    || text.includes('work_zone')
    || text.includes('working_zone')
    || text.includes('рабочей зоны')
    || text.includes('рабочая зона');
};

const isPhysicalNormative = (item: NormativeRecord) => {
  const text = itemEnvironmentText(item);
  return hasDocumentCode(item, 'DSM_15')
    || hasDocumentCode(item, 'ДСМ_15')
    || ['physical_factors', 'microclimate', 'lighting', 'noise_vibration'].includes(item.templateId)
    || Boolean(item.factorType || item.factorCode)
    || text.includes('физичес');
};

const fallbackUnitForItem = (item: NormativeRecord) => {
  if (item.unit) return item.unit;
  const text = itemEnvironmentText(item);
  if (isAtmosphericAir(item) || isWorkZoneAir(item)) return 'мг/м³';
  if (text.includes('water') || text.includes('вод')) return 'мг/дм³';
  if (text.includes('soil') || text.includes('почв')) return 'мг/кг';
  if (text.includes('surface') || text.includes('поверх')) return 'мг/см²';
  if (text.includes('food') || text.includes('пищ')) return 'мг/кг';
  return '';
};

const firstGroupValue = (row: NormativeTableRow, getter: (item: NormativeRecord) => unknown) =>
  textValue(...row.records.map(getter));

const putGroupedValue = (current: string, next: string) => current || next;

const addNormativeToRow = (row: NormativeTableRow, item: NormativeRecord) => {
  const type = normalizedItemType(item);
  const subtype = normalizedItemSubtype(item);
  const value = textValue(displayNormative(item));

  if (subtype === 'MAX_ONE_TIME' || subtype === 'MAX_SINGLE') {
    row.maxOneTimeValue = putGroupedValue(row.maxOneTimeValue, textValue(item.maxOneTimeValue, value));
  } else if (subtype === 'DAILY_AVERAGE' || subtype === 'AVERAGE_DAILY' || subtype === 'DAILY') {
    row.dailyAverageValue = putGroupedValue(row.dailyAverageValue, textValue(item.dailyAverageValue, value));
  } else if (subtype === 'SINGLE_VALUE' || subtype === 'SINGLE' || subtype === 'SHIFT_AVERAGE') {
    row.generalValue = putGroupedValue(row.generalValue, textValue(item.singleValue, value));
  }

  if (type === 'OBUV' || type === 'ОБУВ') {
    row.generalValue = putGroupedValue(row.generalValue, textValue(item.obuvValue, value));
  }

  row.maxOneTimeValue = putGroupedValue(row.maxOneTimeValue, item.maxOneTimeValue || '');
  row.dailyAverageValue = putGroupedValue(row.dailyAverageValue, item.dailyAverageValue || '');
  row.generalValue = putGroupedValue(row.generalValue, textValue(item.obuvValue, item.singleValue));
  row.unit = putGroupedValue(row.unit, fallbackUnitForItem(item));
};

const normalizeSearchInput = (value: string) => value.trim();
const canSubmitSearch = (value: string) => {
  const text = normalizeSearchInput(value);
  return text.length === 0 || text.length >= MIN_SEARCH_LENGTH;
};

const factorTypeForCategory: Partial<Record<NormativeCategoryCode, string>> = {
  microclimate: 'MICROCLIMATE',
  noise: 'NOISE',
  vibration: 'VIBRATION',
  lighting: 'LIGHTING',
  infra_sound: 'INFRASOUND',
  infrasound: 'INFRASOUND',
  ultrasound: 'ULTRASOUND',
  uv: 'UV',
  aeroions: 'AEROIONS',
  emf: 'ELECTROMAGNETIC_FIELD',
  laser: 'LASER',
};

const tableNoForCategory: Partial<Record<NormativeCategoryCode, string>> = {
  soil_pdk: '1',
  soil_sanitary_chemical: '2',
  soil_microbiology: '3',
  soil_degradation: '4',
};

const DSM_138_CATEGORY_API_MAP: Partial<Record<NormativeCategoryCode, Partial<NormativeRecordsParams>>> = {
  DRINKING_WATER_GENERAL_CHEMICAL: {
    categoryCode: 'DRINKING_WATER_SAFETY',
    appendixNo: '1',
    tableNo: '1',
  },
  WATER_TREATMENT_REAGENTS: {
    categoryCode: 'DRINKING_WATER_SAFETY',
    appendixNo: '1',
    tableNo: '2',
  },
  ORGANOLEPTIC: {
    categoryCode: 'DRINKING_WATER_SAFETY',
    appendixNo: '1',
    tableNo: '3',
  },
  RADIATION_SAFETY: {
    categoryCode: 'DRINKING_WATER_SAFETY',
    appendixNo: '1',
    tableNo: '4',
  },
  MICROBIOLOGY_PARASITOLOGY: {
    categoryCode: 'DRINKING_WATER_SAFETY',
    appendixNo: '1',
    tableNo: '5',
  },
  DRINKING_WATER_CHEMICALS: {
    categoryCode: 'DRINKING_WATER_CHEMICALS',
    appendixNo: '2',
  },
  SURFACE_WATER_PDK: {
    categoryCode: 'SURFACE_WATER_PDK',
    appendixNo: '4',
  },
  SURFACE_WATER_SAFETY: {
    categoryCode: 'SURFACE_WATER_SAFETY',
    appendixNo: '3',
  },
};

const categoryRequestParams = (documentCode: NormativeDocumentCode, categoryCode: NormativeCategoryCode): Partial<NormativeRecordsParams> => {
  if (documentCode === 'DSM_70') {
    if (categoryCode === 'ambient_air') return { templateId: 'ambient_air' };
    if (categoryCode === 'workplace_air') return { templateId: 'workplace_air' };
    if (categoryCode === 'soil') return { templateId: 'soil' };
    if (categoryCode === 'water') return { templateId: 'water' };
    if (categoryCode === 'food_products') return { templateId: 'food_products' };
    if (categoryCode === 'surfaces') return { templateId: 'surfaces' };
    if (categoryCode === 'rocket_fuel') return { templateId: 'udmh_special' };
    if (categoryCode === 'summation_groups') return { category: 'SUMMATION_GROUP' };
    return {};
  }
  if (documentCode === 'DSM_15') {
    if (categoryCode === 'microclimate') return { templateId: 'microclimate' };
    if (categoryCode === 'lighting') return { templateId: 'lighting' };
    if (categoryCode === 'noise') return { templateId: 'noise_vibration', factorType: 'NOISE' };
    if (categoryCode === 'vibration') return { templateId: 'noise_vibration', factorType: 'VIBRATION' };
    return { factorType: factorTypeForCategory[categoryCode] };
  }
  if (documentCode === 'DSM_32') {
    if (categoryCode === 'soil') return { templateId: 'soil' };
    if (categoryCode === 'food') return { templateId: 'food_products' };
    if (categoryCode === 'surface') return { templateId: 'surfaces' };
    if (categoryCode === 'sanitary') return { category: 'SANITARY_INDICATORS' };
    return { templateId: 'soil', tableNo: tableNoForCategory[categoryCode] };
  }
  if (documentCode === 'DSM_138') {
    const categoryAliases: Partial<Record<NormativeCategoryCode, Partial<NormativeRecordsParams>>> = {
      drinking_water_safety: { templateId: 'water', category: 'DRINKING_WATER_SAFETY', categoryCode: 'DRINKING_WATER_SAFETY', appendixNo: '1' },
      water_treatment_reagents: { templateId: 'water', category: 'WATER_TREATMENT_REAGENTS', categoryCode: 'DRINKING_WATER_SAFETY', appendixNo: '1', tableNo: '2' },
      chemical_substances: { templateId: 'water', category: 'CHEMICAL_SUBSTANCES', categoryCode: 'DRINKING_WATER_CHEMICALS', appendixNo: '2' },
      surface_water_safety: { templateId: 'water', category: 'SURFACE_WATER_SAFETY', categoryCode: 'SURFACE_WATER_SAFETY', appendixNo: '3' },
      surface_water_chemicals: { templateId: 'water', category: 'SURFACE_WATER_CHEMICALS', categoryCode: 'SURFACE_WATER_PDK', appendixNo: '4' },
    };
    return categoryAliases[categoryCode] || { templateId: 'water', ...DSM_138_CATEGORY_API_MAP[categoryCode] };
  }
  return {};
};

const NormativeDirectoryPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = ['ADMIN', 'DIRECTOR', 'HEAD'].includes(user?.role || '');
  const canImportResources = user?.role === 'ADMIN';
  const [activeDocument, setActiveDocument] = useState<NormativeDocumentCode>('DSM_70');
  const [activeCategory, setActiveCategory] = useState<NormativeCategoryCode>('ambient_air');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [templateFilter, setTemplateFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [factorTypeFilter, setFactorTypeFilter] = useState('');
  const [appendixFilter, setAppendixFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [waterTypeFilter, setWaterTypeFilter] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('');
  const [editing, setEditing] = useState<NormativeRecord | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [importPreview, setImportPreview] = useState<NormativeImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importingResources, setImportingResources] = useState(false);

  const visibleCategories = useMemo(() => getCategories(activeDocument), [activeDocument]);
  const normalizedQuery = normalizeSearchInput(query);
  const normalizedDebouncedQuery = normalizeSearchInput(debouncedQuery);
  const searchAllowed = canSubmitSearch(normalizedQuery);
  const searchPending = searchAllowed && normalizedQuery !== normalizedDebouncedQuery;
  const debouncedSearchReady = Boolean(activeDocument) && searchAllowed && normalizedQuery === normalizedDebouncedQuery;
  const searchHintVisible = normalizedQuery.length > 0 && !searchAllowed;
  const categoryParams = useMemo(() => categoryRequestParams(activeDocument, activeCategory), [activeDocument, activeCategory]);
  const requestParams = useMemo<NormativeRecordsParams>(() => ({
    page,
    size,
    search: debouncedSearchReady && normalizedDebouncedQuery ? normalizedDebouncedQuery : undefined,
    query: debouncedSearchReady && normalizedDebouncedQuery ? normalizedDebouncedQuery : undefined,
    sourceDocumentCode: activeDocument,
    status: 'ACTIVE',
    templateId: templateFilter || categoryParams.templateId,
    environmentType: environmentFilter || undefined,
    factorType: factorTypeFilter || categoryParams.factorType,
    appendixNo: appendixFilter || categoryParams.appendixNo,
    tableNo: tableFilter || categoryParams.tableNo,
    categoryCode: categoryParams.categoryCode,
    category: categoryParams.category,
    waterType: activeDocument === 'DSM_138' ? waterTypeFilter || undefined : undefined,
    formType: formTypeFilter || undefined,
    normativeType: typeFilter || categoryParams.normativeType,
    normativeSubType: subtypeFilter || undefined,
  }), [page, size, debouncedSearchReady, normalizedDebouncedQuery, activeDocument, templateFilter, categoryParams, environmentFilter, factorTypeFilter, appendixFilter, tableFilter, waterTypeFilter, formTypeFilter, typeFilter, subtypeFilter]);
  const normativeQueryKey = useMemo(() => [
    'normatives',
    activeDocument,
    activeCategory,
    debouncedSearchReady ? normalizedDebouncedQuery : '',
    templateFilter,
    environmentFilter,
    factorTypeFilter,
    appendixFilter,
    tableFilter,
    waterTypeFilter,
    typeFilter,
    subtypeFilter,
    formTypeFilter,
    page,
    size,
  ], [activeDocument, activeCategory, debouncedSearchReady, normalizedDebouncedQuery, templateFilter, environmentFilter, factorTypeFilter, appendixFilter, tableFilter, waterTypeFilter, typeFilter, subtypeFilter, formTypeFilter, page, size]);
  const {
    data: recordsPage,
    error: loadError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: normativeQueryKey,
    queryFn: ({ signal }) => getNormativeRecords(requestParams, signal),
    enabled: debouncedSearchReady,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const items = debouncedSearchReady ? recordsPage?.items || [] : [];
  const loading = searchPending || (debouncedSearchReady && isLoading);
  const error = loadError ? (getApiStatus(loadError) === 401 || getApiStatus(loadError) === 403
    ? 'Нет доступа к нормативам'
    : loadError instanceof Error ? loadError.message : 'Не удалось загрузить нормативы') : '';
  const load = useCallback(async () => {
    if (!debouncedSearchReady) return;
    await refetch();
  }, [refetch, debouncedSearchReady]);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(normalizeSearchInput(query)), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(0);
    setActiveCategory(getCategories(activeDocument)[0]?.code ?? 'ambient_air');
    setTemplateFilter('');
    setEnvironmentFilter('');
    setFactorTypeFilter('');
    setAppendixFilter('');
    setTableFilter('');
    setFormTypeFilter('');
    setTypeFilter('');
    setSubtypeFilter('');
    setWaterTypeFilter('');
    setQuery('');
    setDebouncedQuery('');
  }, [activeDocument]);

  useEffect(() => {
    setPage(0);
  }, [query, activeDocument, activeCategory, templateFilter, environmentFilter, factorTypeFilter, appendixFilter, tableFilter, waterTypeFilter, formTypeFilter, typeFilter, subtypeFilter, size]);

  useEffect(() => {
    if (!editorDirty) return undefined;
    const warnAboutUnsavedChanges = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnAboutUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnAboutUnsavedChanges);
  }, [editorDirty]);

  const visibleItems = useMemo(() => items.filter((item) => !isGarbageNormativeRow(item)), [items]);

  const groupedRows = useMemo(() => {
    return groupNormativeRows(visibleItems, activeDocument, activeCategory);
  }, [visibleItems, activeDocument, activeCategory]);

  const baseColumns = useMemo(() => getVisibleColumns(activeDocument, activeCategory), [activeDocument, activeCategory]);
  const visibleColumns = baseColumns;
  const tableGroups = useMemo(() => {
    const map = new Map<string, NormativeTableRow[]>();
    groupedRows.forEach((row) => {
      const key = groupTitleForRow(row);
      map.set(key, [...(map.get(key) || []), row]);
    });
    return Array.from(map.entries()).map(([title, rows]) => ({ title, rows }));
  }, [groupedRows]);

  const closeEditor = () => {
    if (saving) return;
    if (editorDirty && !window.confirm('Закрыть форму без сохранения изменений?')) return;
    setEditing(null);
    setEditorDirty(false);
  };

  const openCreateEditor = () => {
    const categoryLabel = visibleCategories.find((category) => category.code === activeCategory)?.label || '';
    setEditing({
      id: '',
      templateId: (templateFilter || categoryParams.templateId || 'ambient_air') as NormativeRecord['templateId'],
      sourceDocumentCode: activeDocument,
      category: String(categoryParams.category || categoryLabel),
      categoryCode: String(categoryParams.categoryCode || activeCategory),
      factorType: String(categoryParams.factorType || ''),
      appendixNo: String(categoryParams.appendixNo || ''),
      tableNo: String(categoryParams.tableNo || ''),
      waterType: waterTypeFilter || undefined,
      researchObject: categoryLabel,
      indicator: '',
      indicatorName: '',
      unit: '',
      normativeType: 'PDK',
      value: '',
      comparisonType: 'LESS_OR_EQUAL',
      normativeDocument: activeDocument,
      testingMethod: '',
      samplingMethod: '',
      validFrom: new Date().toISOString().slice(0, 10),
      active: true,
      status: 'ACTIVE',
    });
    setEditorDirty(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !canManage || saving) return;
    const form = new FormData(event.currentTarget);
    const value = normalizeNumericInput(form.get('value'));
    const minValue = normalizeNumericInput(form.get('minValue'));
    const maxValue = normalizeNumericInput(form.get('maxValue'));
    if ([value, minValue, maxValue].some((item) => item === null)) {
      toast.warning('Проверьте числовые поля', 'Допустимы число, знак минус и один десятичный разделитель.');
      return;
    }
    const indicatorName = String(form.get('indicatorName') || '').trim();
    const sourceDocumentCode = String(form.get('sourceDocumentCode') || '').trim();
    const templateId = String(form.get('templateId') || '').trim() as NormativeRecord['templateId'];
    const comparisonType = String(form.get('comparisonType') || editing.comparisonType || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'];
    if (!indicatorName || !sourceDocumentCode || !templateId) {
      toast.warning('Заполните обязательные поля', 'Наименование, документ-код и templateId обязательны.');
      return;
    }
    if (comparisonType === 'RANGE') {
      if (!minValue || !maxValue) {
        toast.warning('Для диапазона укажите минимум и максимум');
        return;
      }
      if (Number(minValue) > Number(maxValue)) {
        toast.warning('Минимум не может быть больше максимума');
        return;
      }
    } else if (!['ABSENT', 'INFO'].includes(comparisonType) && !value && !minValue && !maxValue) {
      toast.warning('Укажите значение норматива');
      return;
    }
    const payload: Partial<NormativeRecord> & { notes?: string } = {
      indicatorName,
      indicator: indicatorName,
      pollutantCode: String(form.get('pollutantCode') || '').trim(),
      casNumber: String(form.get('casNumber') || '').trim(),
      chemicalFormula: String(form.get('chemicalFormula') || '').trim(),
      unit: String(form.get('unit') || '').trim(),
      value: value || '',
      minValue: minValue || '',
      maxValue: maxValue || '',
      comparisonType,
      normativeType: String(form.get('normativeType') || '').trim(),
      normativeSubType: String(form.get('normativeSubType') || '').trim(),
      sourceDocumentCode,
      normativeDocument: sourceDocumentCode,
      templateId,
      category: String(form.get('category') || '').trim(),
      categoryCode: String(form.get('categoryCode') || '').trim(),
      hazardClass: String(form.get('hazardClass') || '').trim(),
      limitingIndicator: String(form.get('limitingIndicator') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
    };
    if (!payload.category) delete payload.category;
    if (!payload.categoryCode) delete payload.categoryCode;

    setSaving(true);
    try {
      if (editing.id) {
        await updateNormative(editing.id, payload);
      } else {
        const { id: _editingId, ...editingDefaults } = editing;
        void _editingId;
        await createNormative({
          ...editingDefaults,
          ...payload,
          researchObject: editing.researchObject || payload.category || indicatorName,
          testingMethod: editing.testingMethod || '',
          samplingMethod: editing.samplingMethod || '',
          validFrom: editing.validFrom || new Date().toISOString().slice(0, 10),
          active: true,
        } as Omit<NormativeRecord, 'id'>);
      }
      await queryClient.invalidateQueries({ queryKey: ['normatives'] });
      setEditing(null);
      setEditorDirty(false);
      toast.success(editing.id ? 'Норматив обновлен' : 'Норматив создан');
    } catch (submitError) {
      toast.error('Не удалось сохранить норматив', submitError instanceof Error ? submitError.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const archiveGroup = async (row: NormativeTableRow) => {
    const name = firstGroupValue(row, (item) => item.indicator || item.indicatorName || item.pollutantName);
    if (!canManage || !window.confirm(`Архивировать нормативы "${name}"?`)) return;
    try {
      await Promise.all(row.records.map((record) => archiveNormative(record.id)));
      if (currentPage > 0 && row.records.length >= visibleItems.length) setPage(currentPage - 1);
      await queryClient.invalidateQueries({ queryKey: ['normatives'] });
      toast.success(row.records.length > 1 ? 'Нормативы архивированы' : 'Норматив архивирован');
    } catch (archiveError) {
      toast.error('Не удалось архивировать норматив', archiveError instanceof Error ? archiveError.message : undefined);
    }
  };

  const copyNormative = async (row: NormativeTableRow) => {
    const text = visibleColumns
      .map((column) => `${column.label}: ${column.render(row, 0)}`)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toast.success('Норматив скопирован');
    } catch (copyError) {
      toast.error('Не удалось скопировать норматив', copyError instanceof Error ? copyError.message : undefined);
    }
  };

  const resetImportState = () => {
    setImportFiles([]);
    setImportPreview(null);
    setImportError('');
    setImporting(false);
  };

  const openImport = () => {
    resetImportState();
    setImportOpen(true);
  };

  const importDsm15Resources = async () => {
    if (!canImportResources || !window.confirm('Импортировать ДСМ-15 из backend resources? Существующие записи могут быть обновлены.')) return;
    setImportingResources(true);
    try {
      const result = await importPhysicalFactorsFromResources();
      toast.success(`Импорт завершен: создано ${result.created}, обновлено ${result.updated}, предупреждений ${result.warnings}`);
      await load();
    } catch (error) {
      toast.error('Не удалось импортировать ДСМ-15 из resources', error instanceof Error ? error.message : undefined);
    } finally {
      setImportingResources(false);
    }
  };

  const importDsm32Resources = async () => {
    if (!canImportResources || !window.confirm('Импортировать ДСМ-32 из backend resources? Существующие записи могут быть обновлены.')) return;
    setImportingResources(true);
    try {
      const result = await importDsm32FromResources();
      toast.success(`ДСМ-32 импортирован: создано ${result.created}, обновлено ${result.updated}`);
      await load();
    } catch (error) {
      toast.error('Не удалось импортировать ДСМ-32', error instanceof Error ? error.message : undefined);
    } finally {
      setImportingResources(false);
    }
  };

  const closeImport = (force = false) => {
    if (importing && !force) return;
    if (!force && importFiles.length && !window.confirm('Закрыть импорт? Выбранные файлы и результат проверки будут сброшены.')) return;
    setImportOpen(false);
    resetImportState();
  };

  const previewImport = async (fileList?: FileList | null) => {
    const selectedFiles = Array.from(fileList || []);
    if (!selectedFiles.length) {
      setImportError('Выберите файл для импорта');
      toast.warning('Выберите файл для импорта');
      return;
    }
    setImportFiles(selectedFiles);
    setImportPreview(null);
    setImportError('');
    setImporting(true);
    try {
      const preview = activeDocument === 'DSM_138'
        ? await previewDsm138Import(selectedFiles)
        : await importNormativesExcel(selectedFiles[0], true);
      setImportPreview(preview);
      if (!preview.total || !preview.valid) {
        setImportError('Файл прочитан, но валидные строки нормативов не найдены. Проверьте формат таблицы.');
      }
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Не удалось проверить файл';
      setImportError(message);
      toast.error('Не удалось проверить файл', message);
    } finally {
      setImporting(false);
    }
  };

  const commitImport = async () => {
    const stats = importPreview || emptyImportPreview;
    if (!importFiles.length || !canManage) {
      setImportError('Выберите файл для импорта');
      toast.warning('Выберите файл для импорта');
      return;
    }
    if ((!stats.valid && activeDocument !== 'DSM_138') || importError) return;
    setImporting(true);
    try {
      if (activeDocument === 'DSM_138') {
        await confirmDsm138Import(stats.importBatchId || stats.importId, importFiles);
      } else {
        const importBatchId = stats.importBatchId || stats.importId;
        if (!importBatchId) return;
        await importNormativesExcel(importFiles[0], false, importBatchId);
      }
      toast.success('Нормативы импортированы');
      closeImport(true);
      await load();
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Импорт не выполнен';
      setImportError(message);
      toast.error('Импорт не выполнен', message);
    } finally {
      setImporting(false);
    }
  };

  const importStats = importPreview || emptyImportPreview;
  const confirmImportDisabled = !importFiles.length
    || !importStats.valid
    || importing
    || Boolean(importError)
    || (activeDocument !== 'DSM_138' && !(importStats.importBatchId || importStats.importId));
  const activeCategoryLabel = visibleCategories.find((category) => category.code === activeCategory)?.label || 'выбранной категории';
  const emptyMessage = searchHintVisible
    ? 'Введите минимум 3 символа для поиска'
    : activeDocument === 'DSM_138' && (activeCategory === 'surface_water_safety' || activeCategory === 'SURFACE_WATER_SAFETY')
    ? 'Данные по приложению 3 не загружены'
    : normalizedQuery.length > 0 && searchAllowed
      ? 'Нормативы не найдены'
      : `По выбранной категории данные пока не загружены: ${activeCategoryLabel}`;
  const rollbackImport = async () => {
    const importBatchId = importStats.importBatchId || importStats.importId;
    if (!importBatchId || activeDocument !== 'DSM_138' || !window.confirm('Откатить импорт DSM_138? Все изменения этой партии будут отменены.')) return;
    setImporting(true);
    setImportError('');
    try {
      await rollbackDsm138Import(importBatchId);
      toast.success('Импорт DSM_138 откачен');
      closeImport(true);
      await load();
    } catch (rollbackError) {
      const message = rollbackError instanceof Error ? rollbackError.message : 'Не удалось откатить импорт DSM_138';
      setImportError(message);
      toast.error('Не удалось откатить импорт DSM_138', message);
    } finally {
      setImporting(false);
    }
  };
  const displayedCount = visibleItems.length;
  const totalElements = recordsPage?.totalElements ?? 0;
  const totalPages = Math.max(1, recordsPage?.totalPages ?? 1);
  const currentPage = Math.min(recordsPage?.page ?? page, totalPages - 1);
  const canGoBack = currentPage > 0 && !isFetching;
  const canGoForward = currentPage + 1 < totalPages && !isFetching;
  const handleQueryChange = useCallback((event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value), []);
  const handlePageSizeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSize(Number(event.target.value));
    setPage(0);
  }, []);
  const goToPreviousPage = useCallback(() => setPage(Math.max(0, currentPage - 1)), [currentPage]);
  const goToNextPage = useCallback(() => setPage(Math.min(totalPages - 1, currentPage + 1)), [currentPage, totalPages]);
  const hasActiveFilters = Boolean(query || templateFilter || environmentFilter || factorTypeFilter || appendixFilter || tableFilter || waterTypeFilter || formTypeFilter || typeFilter || subtypeFilter);
  const resetFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setTemplateFilter('');
    setEnvironmentFilter('');
    setFactorTypeFilter('');
    setAppendixFilter('');
    setTableFilter('');
    setWaterTypeFilter('');
    setFormTypeFilter('');
    setTypeFilter('');
    setSubtypeFilter('');
    setPage(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Нормативы</h1>
          <p className="mt-1 text-sm text-slate-500">Справочник ПДК, ОБУВ, ПДУ и других нормативов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button type="button" onClick={openCreateEditor}>
              <Plus className="h-4 w-4" /> Добавить норматив
            </Button>
          )}
          {canImportResources && (
            <Button type="button" variant="secondary" onClick={openImport}>
              <FileSpreadsheet className="h-4 w-4" /> Импорт Excel
            </Button>
          )}
          {activeDocument === 'DSM_15' && canImportResources && (
            <Button type="button" variant="secondary" disabled={importingResources} onClick={importDsm15Resources}>
              <FileSpreadsheet className="h-4 w-4" /> Импортировать ДСМ-15 из backend resources
            </Button>
          )}
          {activeDocument === 'DSM_32' && canImportResources && (
            <Button type="button" variant="secondary" disabled={importingResources} onClick={importDsm32Resources}>
              <FileSpreadsheet className="h-4 w-4" /> Импортировать ДСМ-32
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Обновить
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {NORMATIVE_DOCUMENTS.map((tab) => (
          <button
            key={tab.code}
            type="button"
            onClick={() => setActiveDocument(tab.code)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${activeDocument === tab.code ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {tab.title}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {visibleCategories.map((category) => (
          <button
            key={category.code}
            type="button"
            onClick={() => setActiveCategory(category.code)}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${activeCategory === category.code ? 'bg-eco-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {category.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={handleQueryChange}
            placeholder="Название, код, CAS, формула"
            className={`${inputClass} pl-10`}
          />
        </label>
        <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className={inputClass}>
          <option value="">templateId: все</option>
          <option value="ambient_air">ambient_air</option>
          <option value="workplace_air">workplace_air</option>
          <option value="industrial_emissions">industrial_emissions</option>
          <option value="water">water</option>
          <option value="water_wastewater">water_wastewater</option>
          <option value="soil">soil</option>
          <option value="physical_factors">physical_factors</option>
          <option value="microclimate">microclimate</option>
          <option value="lighting">lighting</option>
          <option value="noise_vibration">noise_vibration</option>
        </select>
        <select value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)} className={inputClass}>
          <option value="">Тип среды: все</option>
          {environmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={factorTypeFilter} onChange={(event) => setFactorTypeFilter(event.target.value)} className={inputClass}>
          <option value="">factorType: все</option>
          {factorTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        {activeDocument === 'DSM_32' && (
          <select value={formTypeFilter} onChange={(event) => setFormTypeFilter(event.target.value)} className={inputClass}>
            <option value="">Форма: все</option>
            {soilFormOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        )}
        {activeDocument === 'DSM_138' && (
          <select value={waterTypeFilter} onChange={(event) => setWaterTypeFilter(event.target.value)} className={inputClass}>
            <option value="">Тип воды: все</option>
            {waterTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        )}
        {(activeDocument === 'DSM_15' || activeDocument === 'DSM_32' || activeDocument === 'DSM_138') && (
          <>
            {(activeDocument === 'DSM_15' || activeDocument === 'DSM_138') && (
              <input
                value={appendixFilter}
                onChange={(event) => setAppendixFilter(event.target.value)}
                placeholder="Приложение"
                className={inputClass}
              />
            )}
            <input
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              placeholder="Таблица"
              className={inputClass}
            />
          </>
        )}
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}>
          <option value="">Тип норматива: все</option>
          {normativeTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <select value={subtypeFilter} onChange={(event) => setSubtypeFilter(event.target.value)} className={inputClass}>
          <option value="">Подтип: все</option>
          {normativeSubTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <Button type="button" variant="secondary" disabled={!hasActiveFilters} onClick={resetFilters}>
          <RotateCcw className="h-4 w-4" /> Сбросить фильтры
        </Button>
        {isFetching && !loading && (
          <p className="text-xs font-semibold text-slate-500 md:col-span-2 xl:col-span-4">Обновляем нормативы...</p>
        )}
        {searchHintVisible && (
          <p className="text-xs font-semibold text-amber-700 md:col-span-2 xl:col-span-4">Введите минимум 3 символа для поиска</p>
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={load}>Повторить</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="overflow-x-auto">
              <div className="px-4 py-3 text-sm font-semibold text-slate-500">Загрузка нормативов...</div>
              <table className="min-w-[1180px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {visibleColumns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
                    <th className="px-3 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from({ length: 5 }).map((_, rowIndex) => (
                    <tr key={rowIndex} className="animate-pulse">
                      {Array.from({ length: visibleColumns.length + 1 }).map((__, cell) => (
                        <td key={cell} className="px-4 py-4"><div className="h-4 rounded bg-slate-100" /></td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tableGroups.map((group) => (
            <div key={group.title}>
              <div className="bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">{group.title}</div>
              <div className="overflow-x-auto">
                <table className="min-w-[1180px] w-full text-left text-sm">
                  <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {visibleColumns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
                      <th className="px-3 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.rows.map((row, index) => (
                      <tr key={row.key} className="hover:bg-slate-50">
                        {visibleColumns.map((column) => (
                          <td key={column.key} className={`px-3 py-3 ${column.className || ''}`}>
                            <div className="max-w-[320px] whitespace-normal break-words" title={column.render(row, index)}>{column.render(row, index)}</div>
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" className="px-3" title="Скопировать норматив" onClick={() => copyNormative(row)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            {canManage ? (
                              <>
                              <Button type="button" variant="secondary" className="px-3" title="Изменить" onClick={() => { setEditing(row.primary); setEditorDirty(false); }}>
                                <Edit3 className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="secondary" className="px-3" title="Архивировать" onClick={() => archiveGroup(row)}>
                                <Archive className="h-4 w-4" />
                              </Button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        {!loading && !error && displayedCount === 0 && (
          <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">{emptyMessage}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          Страница {currentPage + 1} из {totalPages} · всего {totalElements}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span>Строк</span>
            <select value={size} onChange={handlePageSizeChange} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-eco-500 focus:ring-4 focus:ring-eco-100">
              {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <Button type="button" variant="secondary" disabled={!canGoBack} onClick={goToPreviousPage}>Назад</Button>
          <Button type="button" variant="secondary" disabled={!canGoForward} onClick={goToNextPage}>Вперёд</Button>
        </div>
      </div>

      <Modal open={Boolean(editing)} onClose={closeEditor} title={editing?.id ? 'Изменить норматив' : 'Добавить норматив'} size="lg" loading={saving}>
        {editing && (
          <form onSubmit={submit} onChange={() => setEditorDirty(true)} className="grid gap-4 sm:grid-cols-2">
            {[
              ['indicatorName', 'Наименование', getRecordName(editing)],
              ['pollutantCode', 'Код', getRecordCode(editing)],
              ['casNumber', 'CAS', getRecordCas(editing)],
              ['chemicalFormula', 'Формула', getRecordFormula(editing)],
              ['value', 'Значение', extractNumericValue(textValue(editing.value, editing.normativeValue, editing.maxValue))],
              ['minValue', 'Минимум', extractNumericValue(textValue(editing.minValue, editing.min))],
              ['maxValue', 'Максимум', extractNumericValue(textValue(editing.maxValue, editing.max))],
              ['unit', 'Ед. изм.', editing.unit],
              ['sourceDocumentCode', 'Документ-код', editing.sourceDocumentCode],
              ['templateId', 'templateId', editing.templateId],
              ['category', 'Категория', editing.category],
              ['categoryCode', 'categoryCode', editing.categoryCode],
              ['hazardClass', 'Класс опасности', editing.hazardClass],
              ['limitingIndicator', 'Лимитирующий показатель', editing.limitingIndicator],
              ['notes', 'Примечание', conditionValue(editing, 'notes')],
            ].map(([name, label, value]) => (
              <label key={name} className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <input
                  name={name}
                  defaultValue={String(value || '')}
                  required={['indicatorName', 'sourceDocumentCode', 'templateId'].includes(String(name))}
                  inputMode={['value', 'minValue', 'maxValue'].includes(String(name)) ? 'decimal' : undefined}
                  className={inputClass}
                />
              </label>
            ))}
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Тип сравнения</span>
              <select name="comparisonType" defaultValue={editing.comparisonType || 'LESS_OR_EQUAL'} className={inputClass}>
                {comparisonTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Тип норматива</span>
              <select name="normativeType" defaultValue={editing.normativeType || ''} className={inputClass}>
                <option value="">Не указан</option>
                {normativeTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="space-y-1.5 text-sm font-semibold text-slate-700">
              <span>Подтип</span>
              <select name="normativeSubType" defaultValue={editing.normativeSubType || editing.subtype || ''} className={inputClass}>
                <option value="">Не указан</option>
                {normativeSubTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
              <Button type="button" variant="secondary" disabled={saving} onClick={closeEditor}>Отмена</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Сохраняем...' : 'Сохранить'}</Button>
            </div>
          </form>
        )}
      </Modal>

      {canManage && (
        <Modal open={importOpen} onClose={() => closeImport()} title="Импорт нормативов из Excel" description="Сначала файл проверяется, затем импорт подтверждается." size="lg" loading={importing}>
          <div className="space-y-4">
            <input
              type="file"
              multiple={activeDocument === 'DSM_138'}
              accept={activeDocument === 'DSM_138' ? '.xls,.xlsx,.zip' : '.xls,.xlsx,.csv'}
              onChange={(event) => previewImport(event.target.files)}
              className={inputClass}
            />
            <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {importFiles.length ? (
                <span>Файлы: <span className="font-black text-slate-950">{importFiles.map((file) => file.name).join(', ')}</span></span>
              ) : 'Выберите файл Excel для проверки'}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Всего</p><p className="text-xl font-black">{importStats.total}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">Валидных</p><p className="text-xl font-black text-emerald-800">{importStats.valid}</p></div>
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">Ошибок</p><p className="text-xl font-black text-rose-800">{importStats.invalid}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-bold text-sky-700">Новых</p><p className="text-xl font-black text-sky-800">{importStats.created ?? 0}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">Обновляемых</p><p className="text-xl font-black text-amber-800">{importStats.updated ?? 0}</p></div>
            </div>
            {activeDocument === 'DSM_138' && (importStats.totalFiles || importStats.files?.length || importStats.warnings?.length) ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <p>Файлов: <span className="font-black text-slate-950">{importStats.totalFiles ?? importStats.files?.length ?? importFiles.length}</span></p>
                {importStats.files?.length ? (
                  <p className="mt-1">Таблицы/приложения: {importStats.files.map((file, index) => textValue(file.fileName, file.name, file.appendixNo, file.tableNo, `файл ${index + 1}`)).join(', ')}</p>
                ) : null}
              </div>
            ) : null}
            {importing && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">Проверяем файл...</div>}
            {importError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{importError}</div>}
            {importStats.items.length > 0 && <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Код</th><th className="p-3">Показатель</th><th className="p-3">Норматив</th></tr></thead>
                <tbody>{importStats.items.slice(0, 50).map((item, index) => <tr key={`${item.id}-${index}`} className="border-t border-slate-100"><td className="p-3">{getRecordCode(item)}</td><td className="p-3">{getRecordName(item)}</td><td className="p-3">{displayNormative(item) || getRecordValue(item)}</td></tr>)}</tbody>
              </table>
            </div>}
            {importStats.errors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{importStats.errors.slice(0, 10).map((item, index) => <p key={index}>Строка {item.row || '-'}: {item.message}</p>)}</div>}
            {importStats.warnings && importStats.warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{importStats.warnings.slice(0, 10).map((item, index) => <p key={index}>Предупреждение {item.row || '-'}: {item.message}</p>)}</div>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => closeImport()}>Отмена</Button>
              {activeDocument === 'DSM_138' && (importStats.importBatchId || importStats.importId) && (
                <Button type="button" variant="secondary" disabled={importing} onClick={rollbackImport}>Откатить импорт</Button>
              )}
              <Button type="button" disabled={confirmImportDisabled} onClick={commitImport}>Подтвердить импорт</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NormativeDirectoryPage;
