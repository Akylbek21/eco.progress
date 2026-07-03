import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Archive, Copy, Edit3, FileSpreadsheet, RefreshCw, Search } from 'lucide-react';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { templateName } from '../data/protocolTemplates';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { archiveNormative, getNormatives, importDsm32FromResources, importNormativesExcel, importPhysicalFactorsFromResources, updateNormative, type NormativeImportPreview } from '../services/normativeService';
import { getApiStatus } from '../services/apiHelpers';
import type { NormativeRecord } from '../types/protocols';

const inputClass = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-eco-500 focus:ring-4 focus:ring-eco-100';
type NormativeDocumentCode = 'DSM_70' | 'DSM_15' | 'DSM_32';
type NormativeCategoryCode =
  | 'ambient_air'
  | 'workplace_air'
  | 'summation_groups'
  | 'rocket_fuel'
  | 'microclimate'
  | 'noise'
  | 'lighting'
  | 'infrasound'
  | 'ultrasound'
  | 'uv'
  | 'aeroions'
  | 'emf'
  | 'laser'
  | 'soil_pdk'
  | 'soil_sanitary_chemical'
  | 'soil_microbiology'
  | 'soil_degradation';

type NormativeCategory = {
  code: NormativeCategoryCode;
  label: string;
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
};

const environmentOptions = [
  'Атмосферный воздух',
  'Воздух рабочей зоны',
  'Вода',
  'Почва',
  'Физические факторы',
  'Специальные УДМГ',
];

const typeOptions = ['ПДК', 'Оценочная матрица', 'ОБУВ', 'ПДУ', 'ADI', 'Exposure limit'];
const soilFormOptions = ['подвижная форма', 'водорастворимая форма'];
const subtypeOptions = ['Максимальная разовая', 'Среднесуточная', 'Среднесменная', 'Разовая', 'Суточная'];
const factorTypeOptions = ['MICROCLIMATE', 'LIGHTING', 'NOISE', 'VIBRATION', 'NOISE_VIBRATION', 'INFRASOUND', 'ULTRASOUND', 'UV', 'AEROIONS', 'ELECTROMAGNETIC_FIELD', 'LASER'];

const NORMATIVE_DOCUMENTS: Array<{ code: NormativeDocumentCode; label: string }> = [
  { code: 'DSM_70', label: 'ДСМ-70 Атмосферный воздух' },
  { code: 'DSM_15', label: 'ДСМ-15 Физические факторы' },
  { code: 'DSM_32', label: 'ДСМ-32 Безопасность среды' },
];

const DSM15_CATEGORIES: NormativeCategory[] = [
  { code: 'microclimate', label: 'Микроклимат' },
  { code: 'noise', label: 'Шум' },
  { code: 'lighting', label: 'Освещенность' },
  { code: 'infrasound', label: 'Инфразвук' },
  { code: 'ultrasound', label: 'Ультразвук' },
  { code: 'uv', label: 'Ультрафиолет' },
  { code: 'aeroions', label: 'Аэроионы' },
  { code: 'emf', label: 'Электрические и магнитные поля' },
  { code: 'laser', label: 'Лазерное излучение' },
];

const DSM70_CATEGORIES: NormativeCategory[] = [
  { code: 'ambient_air', label: 'Атмосферный воздух' },
  { code: 'workplace_air', label: 'Воздух рабочей зоны' },
  { code: 'summation_groups', label: 'Группы суммации' },
  { code: 'rocket_fuel', label: 'Ракетное топливо' },
];

const DSM32_CATEGORIES: NormativeCategory[] = [
  { code: 'soil_pdk', label: 'ПДК химических веществ в почве' },
  { code: 'soil_sanitary_chemical', label: 'Санитарно-химическая оценка' },
  { code: 'soil_microbiology', label: 'Микробиология и паразитология' },
  { code: 'soil_degradation', label: 'Критерии деградации' },
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
  EXPOSURE_LIMIT: 'Exposure limit',
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
};

const normalizeSearch = (value: unknown) => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
const normalizeKey = (value: unknown) => textValue(value).toUpperCase().replace(/[\s-]+/g, '_');

const textValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = value === undefined || value === null ? '' : String(value).trim();
    if (text) return text;
  }
  return '';
};

const getCategories = (documentCode: NormativeDocumentCode) => {
  if (documentCode === 'DSM_15') return DSM15_CATEGORIES;
  if (documentCode === 'DSM_32') return DSM32_CATEGORIES;
  return DSM70_CATEGORIES;
};

const documentCodeForItem = (item: NormativeRecord): NormativeDocumentCode | '' => {
  const sourceCode = normalizeKey(item.sourceDocumentCode);
  if (sourceCode.includes('DSM_70')) return 'DSM_70';
  if (sourceCode.includes('DSM_15')) return 'DSM_15';
  if (sourceCode.includes('DSM_32')) return 'DSM_32';

  const templateId = normalizeSearch(item.templateId);
  if (['ambient_air', 'workplace_air', 'industrial_emissions'].includes(templateId)) return 'DSM_70';
  if (['physical_factors', 'microclimate', 'lighting', 'noise_vibration'].includes(templateId)) return 'DSM_15';
  if (templateId === 'soil') return 'DSM_32';
  return '';
};

const containsAny = (value: string, needles: string[]) => needles.some((needle) => value.includes(normalizeSearch(needle)));

const combinedText = (item: NormativeRecord) => normalizeSearch([
  item.factorType,
  item.templateId,
  item.indicatorName,
  item.indicator,
  item.pollutantName,
  item.tableTitle,
  item.sourceDocumentName,
  item.sourceFileName,
  item.sourceFile,
  item.name,
  item.category,
  item.categoryName,
].filter(Boolean).join(' '));

const dsm15CategoryForItem = (item: NormativeRecord): NormativeCategoryCode => {
  const factorType = normalizeKey(item.factorType || item.templateId || item.category);
  const text = combinedText(item);
  if (factorType.includes('MICROCLIMATE') || containsAny(text, ['микроклимат'])) return 'microclimate';
  if (factorType.includes('NOISE') || factorType.includes('VIBRATION') || containsAny(text, ['шум', 'вибрац'])) return 'noise';
  if (factorType.includes('LIGHTING') || containsAny(text, ['освещ', 'свет'])) return 'lighting';
  if (factorType.includes('INFRASOUND') || containsAny(text, ['инфразвук'])) return 'infrasound';
  if (factorType.includes('ULTRASOUND') || containsAny(text, ['ультразвук'])) return 'ultrasound';
  if (factorType === 'UV' || factorType.includes('ULTRAVIOLET') || containsAny(text, ['ультрафиолет', 'уф'])) return 'uv';
  if (factorType.includes('AEROION') || containsAny(text, ['аэроион'])) return 'aeroions';
  if (factorType.includes('EMF') || factorType.includes('ELECTROMAGNETIC') || containsAny(text, ['электрическ', 'магнитн', 'электромагнит'])) return 'emf';
  if (factorType.includes('LASER') || containsAny(text, ['лазер'])) return 'laser';
  return 'microclimate';
};

const dsm70CategoryForItem = (item: NormativeRecord): NormativeCategoryCode => {
  const text = combinedText(item);
  const normativeType = normalizeKey(item.normativeType);
  if (normativeType === 'SUMMATION_GROUP' || item.summationGroup) return 'summation_groups';
  if (containsAny(text, ['ракет', 'ндмг', 'udmh', 'диметилгидразин'])) return 'rocket_fuel';
  if (item.templateId === 'workplace_air' || containsAny(text, ['рабочей зоны', 'workplace', 'work zone'])) return 'workplace_air';
  return 'ambient_air';
};

const dsm32CategoryForItem = (item: NormativeRecord): NormativeCategoryCode => {
  const tableNo = textValue(item.tableNo).replace(/\D/g, '');
  const normativeType = normalizeKey(item.normativeType);
  if (tableNo === '2' || item.hazardLevel || item.pollutionLevel || item.radioactiveIndicator) return 'soil_sanitary_chemical';
  if (tableNo === '3' || item.coliTiter || item.helminth || item.flyLarvae) return 'soil_microbiology';
  if (tableNo === '4' || item.ecologicalDisaster || item.emergencySituation || item.satisfactorySituation) return 'soil_degradation';
  if (tableNo === '1' || (item.templateId === 'soil' && (normativeType === 'PDK' || normativeType === 'MPC'))) return 'soil_pdk';
  return 'soil_pdk';
};

const categoryForItem = (documentCode: NormativeDocumentCode, item: NormativeRecord): NormativeCategoryCode => {
  if (documentCode === 'DSM_15') return dsm15CategoryForItem(item);
  if (documentCode === 'DSM_32') return dsm32CategoryForItem(item);
  return dsm70CategoryForItem(item);
};

const isGarbageNormativeRow = (item: NormativeRecord) => {
  const name = textValue(item.indicatorName, item.pollutantName, item.indicator, item.name, item.assessmentCategory, item.hazardLevel, item.categoryName, item.tableTitle);
  if (!name) return true;

  const normalizedName = normalizeSearch(name);
  const compactName = normalizedName.replace(/[№#.,;:\-\s]/g, '');
  if (normalizedName === 'скачать') return true;
  if (normalizedName.startsWith('таблица') || normalizedName.startsWith('приложение')) return true;
  if (normalizedName === '№' || /^[1-5]$/.test(normalizedName)) return true;
  if (/^[\d\s№#.,;:-]+$/.test(normalizedName)) return true;
  if (/^(12345|1234|2345)$/.test(compactName)) return true;

  const headerHits = ['код', 'наименование', 'вещество', 'показатель', 'пдк', 'обув', 'cas', 'формула', 'ед', 'документ']
    .filter((token) => normalizedName.includes(token)).length;
  return headerHits >= 3;
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

const displayNormative = (item: NormativeRecord) => {
  const value = textValue(item.value);
  const min = textValue(item.min);
  const max = textValue(item.max);
  if (value) return value;
  if (min && max) return `${displayNormativeCell(min)}-${displayNormativeCell(max)}`;
  return textValue(max, min);
};

const normalizedTypeKey = (value: unknown) => textValue(value).toUpperCase().replace(/[\s-]+/g, '_');
const normalizedItemType = (item: NormativeRecord) => normalizedTypeKey(item.normativeType);
const normalizedItemSubtype = (item: NormativeRecord) => normalizedTypeKey(textValue(item.normativeSubType, item.subtype));
const displayCell = (...values: unknown[]) => textValue(...values) || '-';
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
    LESS_OR_EQUAL: '<=',
    GREATER_OR_EQUAL: '>=',
    RANGE: 'Диапазон',
    EQUAL: '=',
    INFO: 'Инфо',
  };
  return labels[item.comparisonType] || item.comparisonType || '-';
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
].filter(Boolean).join(', ') || '-';

const displayTableLabel = (item: NormativeRecord) => {
  const appendix = textValue(item.appNo, item.appendixNo);
  const tableNo = textValue(item.tableNo);
  const tableTitle = textValue(item.tableTitle, item.sourceFileName, item.sourceFile, item.categoryName, item.category);
  const parts = [
    appendix ? `Прил. ${appendix}` : '',
    tableNo ? `Таблица ${tableNo}` : '',
    tableTitle,
  ].filter(Boolean);
  return parts.join(' · ') || '-';
};

const displayDocument = (item: NormativeRecord) =>
  displayCell(item.sourceDocumentName, item.sourceDocumentCode, item.normativeDocument);

const displayPollutantName = (row: NormativeTableRow) =>
  displayCell(firstGroupValue(row, (record) => record.indicator || record.indicatorName || record.pollutantName || record.name));

const displayGeneralNormative = (row: NormativeTableRow) =>
  displayNormativeCell(row.generalValue, displayNormative(row.primary));

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

const groupSummationRows = (records: NormativeRecord[]) => {
  const rows = new Map<string, NormativeTableRow>();
  records.forEach((item, index) => {
    const key = textValue(item.summationGroup, item.categoryName, item.category, item.tableTitle, item.code, `record:${index}`);
    const existing = rows.get(key);
    if (existing) {
      existing.records.push(item);
      addNormativeToRow(existing, item);
      return;
    }
    const row = singleRecordRow(item, index);
    row.key = `summation:${key}`;
    rows.set(key, row);
  });
  return Array.from(rows.values());
};

const getVisibleColumns = (documentCode: NormativeDocumentCode, categoryCode: NormativeCategoryCode): NormativeColumn[] => {
  if (documentCode === 'DSM_15') {
    return [
      { key: 'table', label: 'Таблица', render: (row) => displayTableLabel(row.primary) },
      { key: 'indicator', label: 'Показатель', render: (row) => displayCell(row.primary.indicator, row.primary.indicatorName, row.primary.pollutantName) },
      { key: 'conditions', label: 'Условия', render: (row) => displayConditions(row.primary) },
      { key: 'normative', label: 'Норматив', render: (row) => displayGeneralNormative(row) },
      { key: 'unit', label: 'Единица', render: (row) => displayCell(row.unit, row.primary.unit) },
      { key: 'comparison', label: 'Тип сравнения', render: (row) => displayComparisonType(row.primary) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(row.primary.conditionJson, row.primary.normativeDocument) },
    ];
  }

  if (documentCode === 'DSM_32' && categoryCode === 'soil_sanitary_chemical') {
    return [
      { key: 'hazard', label: 'Степень опасности', render: (row) => displayCell(row.primary.hazardLevel, row.primary.assessmentCategory) },
      { key: 'pollution', label: 'Степень загрязнения', render: (row) => displayCell(row.primary.pollutionLevel, row.primary.pollutionDegree) },
      { key: 'excess', label: 'Кратность превышения ПДК', render: (row) => displayCell(row.primary.value, row.primary.conditionJson) },
      { key: 'radio', label: 'Радиологический показатель', render: (row) => displayCell(row.primary.radioactiveIndicator) },
    ];
  }

  if (documentCode === 'DSM_32' && categoryCode === 'soil_microbiology') {
    return [
      { key: 'hazard', label: 'Степень опасности', render: (row) => displayCell(row.primary.hazardLevel, row.primary.assessmentCategory) },
      { key: 'pollution', label: 'Степень загрязнения', render: (row) => displayCell(row.primary.pollutionLevel, row.primary.pollutionDegree) },
      { key: 'coli', label: 'Коли-титр', render: (row) => displayCell(row.primary.coliTiter) },
      { key: 'anaerobe', label: 'Титр анаэробов', render: (row) => displayCell(row.primary.anaerobeTiter) },
      { key: 'helminth', label: 'Яйца гельминтов', render: (row) => displayCell(row.primary.helminth) },
      { key: 'fly', label: 'Личинки/куколки мух', render: (row) => displayCell(row.primary.flyLarvae) },
      { key: 'sanitary', label: 'Санитарное число', render: (row) => displayCell(row.primary.sanitaryNumber) },
    ];
  }

  if (documentCode === 'DSM_32' && categoryCode === 'soil_degradation') {
    return [
      { key: 'group', label: 'Группа', render: (row) => displayCell(row.primary.categoryName, row.primary.category, row.primary.tableTitle) },
      { key: 'indicator', label: 'Показатель', render: (row) => displayCell(row.primary.indicator, row.primary.indicatorName, row.primary.pollutantName) },
      { key: 'disaster', label: 'Экологическое бедствие', render: (row) => displayCell(row.primary.ecologicalDisaster) },
      { key: 'emergency', label: 'Чрезвычайная ситуация', render: (row) => displayCell(row.primary.emergencySituation) },
      { key: 'satisfactory', label: 'Относительно удовлетворительная ситуация', render: (row) => displayCell(row.primary.satisfactorySituation) },
      { key: 'unit', label: 'Единица', render: (row) => displayCell(row.primary.unit) },
    ];
  }

  if (documentCode === 'DSM_32') {
    return [
      { key: 'section', label: 'Раздел', render: (row) => displayCell(row.primary.formType, row.primary.categoryName, row.primary.category, row.primary.tableTitle) },
      { key: 'substance', label: 'Вещество', render: (row) => displayPollutantName(row) },
      { key: 'pdk', label: 'ПДК', render: (row) => displayGeneralNormative(row) },
      { key: 'unit', label: 'Ед. изм.', render: (row) => displayCell(row.unit, row.primary.unit) },
      { key: 'limiting', label: 'Лимитирующий показатель', render: (row) => displayCell(row.primary.limitingIndicator) },
      { key: 'document', label: 'Документ', render: (row) => displayDocument(row.primary) },
    ];
  }

  if (categoryCode === 'summation_groups') {
    return [
      { key: 'group', label: 'Группа', render: (row) => displayCell(row.primary.summationGroup, row.primary.code, row.primary.categoryName) },
      { key: 'substances', label: 'Вещества', render: (row) => displaySubstances(row) },
      { key: 'codes', label: 'Коды веществ', render: (row) => displayCodes(row) },
      { key: 'note', label: 'Примечание', render: (row) => displayCell(row.primary.conditionJson, row.primary.normativeDocument) },
    ];
  }

  return [
    { key: 'code', label: 'Код', render: (row) => displayCodes(row) },
    { key: 'name', label: 'Наименование вещества', render: (row) => displayPollutantName(row) },
    { key: 'cas', label: 'CAS', render: (row) => displayCell(firstGroupValue(row, (record) => record.casNumber || record.cas)) },
    { key: 'formula', label: 'Формула', render: (row) => displayCell(firstGroupValue(row, (record) => record.formula || record.chemicalFormula)) },
    { key: 'pdk', label: 'ПДК / ОБУВ', render: (row) => displayGeneralNormative(row) },
    { key: 'max', label: 'Максимальная разовая', render: (row) => displayNormativeCell(row.maxOneTimeValue) },
    { key: 'daily', label: 'Среднесуточная', render: (row) => displayNormativeCell(row.dailyAverageValue) },
    { key: 'hazard', label: 'Класс опасности', render: (row) => displayCell(firstGroupValue(row, (record) => record.hazardClass)) },
    { key: 'limiting', label: 'Лимитирующий показатель', render: (row) => displayCell(firstGroupValue(row, (record) => record.limitingIndicator)) },
    { key: 'document', label: 'Документ', render: (row) => displayDocument(row.primary) },
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

const isDsm32SoilRecord = (item: NormativeRecord) =>
  item.templateId === 'soil'
  && normalizedDocumentCode(item) === 'DSM_32'
  && item.active !== false
  && !item.archived;

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

const isSoilNormative = (item: NormativeRecord) => {
  return isDsm32SoilRecord(item);
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

const groupKey = (item: NormativeRecord, index: number) => {
  const codeKey = textValue(item.code, item.pollutantCode);
  if (codeKey) return `code:${codeKey}`;
  const casKey = textValue(item.casNumber, item.cas);
  if (casKey) return `cas:${casKey}`;
  const nameFormulaKey = [textValue(item.indicatorName, item.indicator, item.pollutantName), textValue(item.formula, item.chemicalFormula)].filter(Boolean).join('|');
  return nameFormulaKey ? `name:${normalizeSearch(nameFormulaKey)}` : `record:${item.id || index}`;
};

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

const groupNormatives = (records: NormativeRecord[]) => {
  const rows = new Map<string, NormativeTableRow>();
  records.forEach((item, index) => {
    const key = groupKey(item, index);
    const existing = rows.get(key);
    if (existing) {
      existing.records.push(item);
      addNormativeToRow(existing, item);
      return;
    }
    const row: NormativeTableRow = {
      key,
      records: [item],
      primary: item,
      maxOneTimeValue: '',
      dailyAverageValue: '',
      generalValue: '',
      unit: '',
    };
    addNormativeToRow(row, item);
    rows.set(key, row);
  });
  return Array.from(rows.values());
};

const recordSearchText = (item: NormativeRecord) => normalizeSearch([
  item.code,
  item.pollutantCode,
  item.indicator,
  item.indicatorName,
  item.pollutantName,
  item.name,
  item.cas,
  item.casNumber,
  item.formula,
  item.chemicalFormula,
  item.factorCode,
  item.hazardClass,
  item.limitingIndicator,
  item.tableTitle,
  item.categoryName,
  item.category,
  item.formType,
  item.matrixType,
  item.assessmentCategory,
  item.pollutionDegree,
  item.hazardLevel,
  item.pollutionLevel,
  item.tableNo,
  item.conditionJson,
  item.maxOneTimeValue,
  item.dailyAverageValue,
  item.singleValue,
  item.obuvValue,
  item.aggregateState,
  item.actionFeatures,
  displayEnvironment(item),
  displayType(item),
  displaySubtype(item),
  item.unit,
  item.normativeDocument,
  item.source,
  item.sourceFile,
  item.importFileName,
].filter(Boolean).join(' '));

const matchesOption = (value: string, option: string) => {
  if (!option) return true;
  const left = normalizeSearch(value);
  const right = normalizeSearch(option);
  return left === right || left.includes(right) || right.includes(left);
};

const isSearchReady = (value: string) => {
  const text = value.trim();
  return text.length >= 3 || /\d{3}/.test(text);
};

const NormativeDirectoryPage = () => {
  const toast = useToast();
  const { user } = useAuth();
  const canManage = ['ADMIN', 'DIRECTOR', 'HEAD'].includes(user?.role || '');
  const canImportResources = user?.role === 'ADMIN';
  const [items, setItems] = useState<NormativeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDocument, setActiveDocument] = useState<NormativeDocumentCode>('DSM_70');
  const [activeCategory, setActiveCategory] = useState<NormativeCategoryCode>('ambient_air');
  const [query, setQuery] = useState('');
  const [templateFilter, setTemplateFilter] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [subtypeFilter, setSubtypeFilter] = useState('');
  const [factorTypeFilter, setFactorTypeFilter] = useState('');
  const [appendixFilter, setAppendixFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [formTypeFilter, setFormTypeFilter] = useState('');
  const [editing, setEditing] = useState<NormativeRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<NormativeImportPreview | null>(null);
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importingResources, setImportingResources] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setItems(await getNormatives({
        search: isSearchReady(query) ? query.trim() : undefined,
        status: 'ACTIVE',
        templateId: templateFilter || undefined,
        environmentType: environmentFilter || undefined,
        factorType: factorTypeFilter || undefined,
        appendixNo: appendixFilter || undefined,
        tableNo: tableFilter || undefined,
        formType: formTypeFilter || undefined,
        normativeType: typeFilter || undefined,
        subtype: subtypeFilter || undefined,
      }));
    } catch (loadError) {
      const status = getApiStatus(loadError);
      setError(status === 401 || status === 403
        ? 'Нет доступа к нормативам'
        : loadError instanceof Error ? loadError.message : 'Не удалось загрузить нормативы');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(load, isSearchReady(query) ? 300 : 0);
    return () => window.clearTimeout(timer);
  }, [query, templateFilter, environmentFilter, factorTypeFilter, appendixFilter, tableFilter, formTypeFilter, typeFilter, subtypeFilter]);

  useEffect(() => {
    setActiveCategory(getCategories(activeDocument)[0].code);
  }, [activeDocument]);

  const visibleCategories = useMemo(() => getCategories(activeDocument), [activeDocument]);
  const searchActive = isSearchReady(query);

  const filtered = useMemo(() => items.filter((item) => {
    if (isGarbageNormativeRow(item)) return false;
    const terms = searchActive ? normalizeSearch(query).split(/\s+/).filter(Boolean) : [];
    const matchesQuery = !terms.length || terms.every((term) => recordSearchText(item).includes(term));
    const matchesDocument = documentCodeForItem(item) === activeDocument;
    const matchesCategory = categoryForItem(activeDocument, item) === activeCategory;
    const matchesTemplate = matchesOption(item.templateId || '', templateFilter);
    const matchesFactorType = matchesOption(item.factorType || '', factorTypeFilter);
    const matchesAppendix = matchesOption(item.appendixNo || '', appendixFilter);
    const matchesTable = matchesOption(item.tableNo || '', tableFilter);
    const matchesForm = matchesOption(item.formType || item.normativeSubType || item.subtype || '', formTypeFilter);
    const matchesEnvironment = matchesOption(displayEnvironment(item), environmentFilter);
    const matchesType = matchesOption(displayType(item), typeFilter);
    const matchesSubtype = matchesOption(displaySubtype(item), subtypeFilter);
    return matchesDocument && matchesCategory && matchesQuery && matchesTemplate && matchesFactorType && matchesAppendix && matchesTable && matchesForm && matchesEnvironment && matchesType && matchesSubtype && !item.archived;
  }), [items, query, searchActive, activeDocument, activeCategory, templateFilter, factorTypeFilter, appendixFilter, tableFilter, formTypeFilter, environmentFilter, typeFilter, subtypeFilter]);

  const groupedRows = useMemo(() => {
    if (activeDocument === 'DSM_70' && activeCategory !== 'summation_groups') return groupNormatives(filtered);
    if (activeDocument === 'DSM_70' && activeCategory === 'summation_groups') return groupSummationRows(filtered);
    return filtered.map(singleRecordRow);
  }, [filtered, activeDocument, activeCategory]);

  const visibleColumns = useMemo(() => getVisibleColumns(activeDocument, activeCategory), [activeDocument, activeCategory]);
  const tableGroups = useMemo(() => {
    const map = new Map<string, NormativeTableRow[]>();
    groupedRows.forEach((row) => {
      const key = groupTitleForRow(row);
      map.set(key, [...(map.get(key) || []), row]);
    });
    return Array.from(map.entries()).map(([title, rows]) => ({ title, rows }));
  }, [groupedRows]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing || !canManage) return;
    const form = new FormData(event.currentTarget);
    const payload: Partial<NormativeRecord> = {
      indicator: String(form.get('indicator') || ''),
      indicatorName: String(form.get('indicator') || ''),
      cas: String(form.get('cas') || ''),
      casNumber: String(form.get('cas') || ''),
      formula: String(form.get('formula') || ''),
      value: String(form.get('value') || ''),
      unit: String(form.get('unit') || ''),
      normativeSubType: String(form.get('normativeSubType') || ''),
      subtype: String(form.get('normativeSubType') || ''),
      hazardClass: String(form.get('hazardClass') || ''),
      limitingIndicator: String(form.get('limitingIndicator') || ''),
      normativeDocument: String(form.get('normativeDocument') || ''),
      active: form.get('active') === 'on',
      status: form.get('active') === 'on' ? 'ACTIVE' : 'INACTIVE',
    };

    try {
      const saved = await updateNormative(editing.id, payload);
      setItems((current) => current.map((item) => item.id === editing.id ? { ...item, ...saved } : item));
      setEditing(null);
      toast.success('Норматив обновлен');
    } catch (submitError) {
      toast.error('Не удалось сохранить норматив', submitError instanceof Error ? submitError.message : undefined);
    }
  };

  const archiveGroup = async (row: NormativeTableRow) => {
    const name = firstGroupValue(row, (item) => item.indicator || item.indicatorName || item.pollutantName);
    if (!canManage || !window.confirm(`Архивировать нормативы "${name}"?`)) return;
    try {
      await Promise.all(row.records.map((record) => archiveNormative(record.id)));
      const archivedIds = new Set(row.records.map((record) => record.id));
      setItems((current) => current.filter((record) => !archivedIds.has(record.id)));
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
    setImportFile(null);
    setImportPreview(null);
    setImportError('');
    setImporting(false);
  };

  const openImport = () => {
    resetImportState();
    setImportOpen(true);
  };

  const importDsm15Resources = async () => {
    if (!canImportResources) return;
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
    if (!canImportResources) return;
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

  const closeImport = () => {
    setImportOpen(false);
    resetImportState();
  };

  const previewImport = async (file?: File) => {
    if (!file) {
      setImportError('Выберите файл Excel');
      toast.warning('Выберите файл Excel');
      return;
    }
    setImportFile(file);
    setImportPreview(null);
    setImportError('');
    setImporting(true);
    try {
      const preview = await importNormativesExcel(file, true);
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
    if (!importFile || !canManage) {
      setImportError('Выберите файл Excel');
      toast.warning('Выберите файл Excel');
      return;
    }
    if (!stats.importId || !stats.valid || importError) return;
    setImporting(true);
    try {
      await importNormativesExcel(importFile, false, stats.importId);
      toast.success('Нормативы импортированы');
      closeImport();
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
  const confirmImportDisabled = !importFile || !importStats.importId || !importStats.valid || importing || Boolean(importError);
  const displayedCount = groupedRows.length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-white pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950 sm:text-3xl">Нормативы</h1>
          <p className="mt-1 text-sm text-slate-500">Справочник ПДК, ОБУВ, ПДУ и других нормативов.</p>
        </div>
        <div className="flex flex-wrap gap-2">
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
            {tab.label}
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Название, код, CAS, формула"
            className={`${inputClass} pl-10`}
          />
        </label>
        <select value={templateFilter} onChange={(event) => setTemplateFilter(event.target.value)} className={inputClass}>
          <option value="">templateId: все</option>
          <option value="ambient_air">ambient_air</option>
          <option value="workplace_air">workplace_air</option>
          <option value="industrial_emissions">industrial_emissions</option>
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
        {(activeDocument === 'DSM_15' || activeDocument === 'DSM_32') && (
          <>
            {activeDocument === 'DSM_15' && (
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
          {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select value={subtypeFilter} onChange={(event) => setSubtypeFilter(event.target.value)} className={inputClass}>
          <option value="">Подтип: все</option>
          {subtypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <p className="text-xs font-semibold text-slate-500 md:col-span-2 xl:col-span-4">
          Загружено: {items.length}. Показано: {displayedCount}.
        </p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="overflow-x-auto">
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
                            <div className="max-w-[320px] truncate" title={column.render(row, index)}>{column.render(row, index)}</div>
                          </td>
                        ))}
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" className="px-3" title="Скопировать норматив" onClick={() => copyNormative(row)}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            {canManage ? (
                              <>
                              <Button type="button" variant="secondary" className="px-3" title="Изменить" onClick={() => setEditing(row.primary)}>
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
          <p className="px-6 py-10 text-center text-sm font-semibold text-slate-500">Нет данных по этой таблице. Проверьте импорт нормативов.</p>
        )}
      </div>

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title="Изменить норматив" size="lg">
        {editing && (
          <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
            {[
              ['indicator', 'Наименование', editing.indicator || editing.indicatorName],
              ['cas', 'CAS', editing.cas || editing.casNumber],
              ['formula', 'Формула', editing.formula || editing.chemicalFormula],
              ['value', 'Норматив', displayNormative(editing)],
              ['unit', 'Ед. изм.', editing.unit],
              ['normativeSubType', 'Подтип', displaySubtype(editing)],
              ['hazardClass', 'Класс опасности', editing.hazardClass],
              ['limitingIndicator', 'Лимитирующий показатель', editing.limitingIndicator],
              ['normativeDocument', 'Нормативный документ', editing.normativeDocument],
            ].map(([name, label, value]) => (
              <label key={name} className="space-y-1.5 text-sm font-semibold text-slate-700">
                <span>{label}</span>
                <input name={name} defaultValue={String(value || '')} className={inputClass} />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input name="active" type="checkbox" defaultChecked={editing.active !== false} className="h-4 w-4 rounded border-slate-300 text-eco-700" /> Активен
            </label>
            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Отмена</Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        )}
      </Modal>

      {canManage && (
        <Modal open={importOpen} onClose={closeImport} title="Импорт нормативов из Excel" description="Сначала файл проверяется, затем импорт подтверждается." size="lg" loading={importing}>
          <div className="space-y-4">
            <input
              type="file"
              accept=".xls,.xlsx,.xls.xls"
              onChange={(event) => previewImport(event.target.files?.[0])}
              className={inputClass}
            />
            <div className="rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-700">
              {importFile ? (
                <span>Файл: <span className="font-black text-slate-950">{importFile.name}</span></span>
              ) : 'Выберите файл Excel для проверки'}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-400">Всего</p><p className="text-xl font-black">{importStats.total}</p></div>
              <div className="rounded-xl bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-700">Валидных</p><p className="text-xl font-black text-emerald-800">{importStats.valid}</p></div>
              <div className="rounded-xl bg-rose-50 p-3"><p className="text-xs font-bold text-rose-700">Ошибок</p><p className="text-xl font-black text-rose-800">{importStats.invalid}</p></div>
              <div className="rounded-xl bg-sky-50 p-3"><p className="text-xs font-bold text-sky-700">Новых</p><p className="text-xl font-black text-sky-800">{importStats.created ?? 0}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-700">Обновляемых</p><p className="text-xl font-black text-amber-800">{importStats.updated ?? 0}</p></div>
            </div>
            {importing && <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-800">Проверяем файл...</div>}
            {importError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{importError}</div>}
            {importStats.items.length > 0 && <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50"><tr><th className="p-3">Код</th><th className="p-3">Показатель</th><th className="p-3">Норматив</th></tr></thead>
                <tbody>{importStats.items.slice(0, 50).map((item, index) => <tr key={`${item.id}-${index}`} className="border-t border-slate-100"><td className="p-3">{item.pollutantCode || item.code || '-'}</td><td className="p-3">{item.indicator}</td><td className="p-3">{displayNormative(item)}</td></tr>)}</tbody>
              </table>
            </div>}
            {importStats.errors.length > 0 && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{importStats.errors.slice(0, 10).map((item, index) => <p key={index}>Строка {item.row || '-'}: {item.message}</p>)}</div>}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closeImport}>Отмена</Button>
              <Button type="button" disabled={confirmImportDisabled} onClick={commitImport}>Подтвердить импорт</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default NormativeDirectoryPage;
