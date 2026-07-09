import api, { ApiResponse } from './api';
import { extractItem, extractList, getApiStatus } from './apiHelpers';
import type { DirectoryQuery, NormativeRecord } from '../types/protocols';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));
type UnknownRecord = Record<string, unknown>;
const stringValue = (value: unknown) => value === undefined || value === null ? '' : String(value);
const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const text = stringValue(value).trim();
    if (text) return text;
  }
  return '';
};
const normalizeText = (value: unknown) => stringValue(value).trim().toLowerCase().replace(/ё/g, 'е');
const normalizeKey = (value: unknown) => normalizeText(value).replace(/[\s-]+/g, '_').toUpperCase();
const normalizeNormative = (raw: unknown): NormativeRecord => {
  const source = asRecord(raw);
  const pollutant = asRecord(source.pollutant || source.substance || source.indicatorReference);
  const code = firstString(source.code, source.pollutantCode, source.substanceCode, source.indicatorCode, source.referenceCode, pollutant.code, pollutant.pollutantCode);
  const normativeType = firstString(source.normativeType, source.type, source.limitType, source.category);
  const normativeSubType = firstString(source.normativeSubType, source.normativeSubtype, source.subType, source.subtype);
  const value = stringValue(source.value ?? source.normative ?? source.normativeValue);
  const maxOneTimeValue = stringValue(source.maxOneTimeValue ?? source.max_one_time_value ?? source.maximumOneTimeValue ?? source.oneTimeValue ?? source.pdkMaxOneTime);
  const dailyAverageValue = stringValue(source.dailyAverageValue ?? source.daily_average_value ?? source.averageDailyValue ?? source.pdkDailyAverage);
  const singleValue = stringValue(source.singleValue ?? source.single_value ?? source.pdkValue);
  const obuvValue = stringValue(source.obuvValue ?? source.obuv_value ?? source.obuv ?? (normativeType === 'OBUV' ? source.value ?? source.normative ?? source.normativeValue : undefined));
  const indicator = firstString(
    source.indicator,
    source.indicatorName,
    source.indicatorNameRu,
    source.indicatorNameKz,
    source.name,
    source.nameRu,
    source.nameKz,
    source.title,
    source.pollutantName,
    source.substanceName,
    pollutant.name,
    pollutant.nameRu,
    pollutant.indicator,
  );
  return {
    id: firstString(source.id, source._id, source.referenceId, `${code}-${indicator}-${source.normativeDocument || source.document}`),
    templateId: firstString(source.templateId, source.templateCode, source.protocolTemplateCode).toLowerCase() as NormativeRecord['templateId'],
    sourceDocumentCode: firstString(source.sourceDocumentCode, source.source_document_code, source.documentCode, source.dsmCode),
    sourceDocumentName: firstString(source.sourceDocumentName, source.source_document_name, source.documentName, source.document),
    documentNumber: firstString(source.documentNumber, source.document_number, source.orderNumber, source.orderNo),
    documentDate: firstString(source.documentDate, source.document_date, source.orderDate),
    appendixNo: firstString(source.appendixNo, source.appendixNumber, source.appendix, source.attachmentNo),
    appendix: firstString(source.appendix, source.appendixNo, source.appendixNumber, source.attachmentNo),
    appNo: firstString(source.appNo, source.applicationNo, source.applicationNumber, source.appendixNo, source.appendixNumber, source.appendix, source.attachmentNo),
    tableNo: firstString(source.tableNo, source.tableNumber, source.table),
    tableNumber: firstString(source.tableNumber, source.tableNo, source.table),
    tableTitle: firstString(source.tableTitle, source.tableName, source.title),
    categoryCode: firstString(source.categoryCode, source.category_code, source.category),
    category: firstString(source.category, source.categoryCode, source.group),
    categoryName: firstString(source.categoryName, source.categoryTitle, source.sectionName),
    waterType: firstString(source.waterType, source.water_type),
    waterUseCategory: firstString(source.waterUseCategory, source.water_use_category),
    matrixType: firstString(source.matrixType, source.matrix_type),
    assessmentCategory: firstString(source.assessmentCategory, source.assessment_category),
    pollutionDegree: firstString(source.pollutionDegree, source.pollution_degree),
    hazardLevel: firstString(source.hazardLevel, source.hazard_level, source.dangerLevel, source.assessmentCategory),
    pollutionLevel: firstString(source.pollutionLevel, source.pollution_level, source.pollutionDegree),
    radioactiveIndicator: firstString(source.radioactiveIndicator, source.radioactive_indicator, source.radiologicalIndicator),
    coliTiter: firstString(source.coliTiter, source.coli_titer),
    anaerobeTiter: firstString(source.anaerobeTiter, source.anaerobe_titer, source.anaerobicTiter),
    helminth: firstString(source.helminth, source.helminthEggs, source.helminth_eggs),
    flyLarvae: firstString(source.flyLarvae, source.fly_larvae, source.flyPupae, source.fly_larvae_pupae),
    sanitaryNumber: firstString(source.sanitaryNumber, source.sanitary_number),
    ecologicalDisaster: firstString(source.ecologicalDisaster, source.ecological_disaster),
    emergencySituation: firstString(source.emergencySituation, source.emergency_situation),
    satisfactorySituation: firstString(source.satisfactorySituation, source.satisfactory_situation),
    formType: firstString(source.formType, source.form_type, source.form, source.normativeSubType, source.normativeSubtype),
    factorType: firstString(source.factorType, source.factor_type, source.subtype, source.physicalFactorType),
    factorCode: firstString(source.factorCode, source.factor_code, source.indicatorCode, source.code),
    roomType: firstString(source.roomType, source.room_type),
    season: firstString(source.season, source.period, source.yearPeriod),
    workCategory: firstString(source.workCategory, source.work_category, source.categoryOfWork),
    workplaceType: firstString(source.workplaceType, source.workplace_type, source.workPlaceType),
    normLevel: firstString(source.normLevel, source.norm_level, source.level, source.normativeLevel),
    lightingType: firstString(source.lightingType, source.lighting_type),
    noiseType: firstString(source.noiseType, source.noise_type),
    visualWorkCategory: firstString(source.visualWorkCategory, source.visual_work_category),
    conditionJson: firstString(source.conditionJson, source.condition_json, source.conditionsJson, source.conditions),
    summationGroup: firstString(source.summationGroup, source.summation_group, source.groupNo, source.groupNumber),
    name: firstString(source.name, source.nameRu, indicator),
    code,
    pollutantCode: firstString(source.pollutantCode, source.substanceCode, code),
    indicatorName: firstString(source.indicatorName, source.indicatorNameRu, source.name, source.nameRu, indicator),
    pollutantName: firstString(source.pollutantName, source.substanceName, indicator),
    synonyms: firstString(source.synonyms, source.synonym, source.aliases, asRecord(source.primary).synonyms, pollutant.synonyms, pollutant.aliases),
    researchObject: firstString(source.researchObject, source.object, source.objectName, source.environmentType, source.environment, source.medium, source.sampleType),
    environmentType: firstString(source.environmentType, source.environment_type, source.mediumType, source.environmentCode),
    environment: firstString(source.environment, source.environmentType, source.environment_type, source.researchObject, source.medium, source.sampleType),
    indicator,
    cas: firstString(source.cas, source.casNumber, pollutant.cas, pollutant.casNumber),
    casNumber: firstString(source.casNumber, source.cas, pollutant.casNumber, pollutant.cas),
    formula: firstString(source.formula, source.chemicalFormula, pollutant.formula, pollutant.chemicalFormula),
    chemicalFormula: firstString(source.chemicalFormula, source.formula, pollutant.chemicalFormula, pollutant.formula),
    unit: firstString(source.unit, source.measurementUnit, source.resultUnit),
    normativeType,
    normativeSubType,
    subtype: firstString(source.subtype, source.subType, source.normativeSubType, source.normativeSubtype),
    value,
    normativeValue: firstString(source.normativeValue, source.normative, source.value, source.pdk, source.obuv, source.limitValue),
    pdk: firstString(source.pdk, source.pdkValue, normativeType === 'PDK' ? source.value ?? source.normative ?? source.normativeValue : undefined),
    limitValue: firstString(source.limitValue, source.limit, source.value, source.normativeValue),
    maxOneTimeValue,
    dailyAverageValue,
    singleValue,
    obuvValue,
    obuv: firstString(source.obuv, source.obuvValue, source.obuv_value, normativeType === 'OBUV' ? source.value ?? source.normative ?? source.normativeValue : undefined),
    min: stringValue(source.min ?? source.minValue ?? source.normativeMin),
    max: stringValue(source.max ?? source.maxValue ?? source.normativeMax),
    minValue: firstString(source.minValue, source.min, source.normativeMin),
    maxValue: firstString(source.maxValue, source.max, source.normativeMax),
    alternativeNormativeValue: firstString(source.alternativeNormativeValue, source.alternative_normative_value, source.altValue),
    comparisonType: stringValue(source.comparisonType || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'],
    normativeDocument: firstString(source.normativeDocument, source.document, source.documentName, source.standard),
    hazardClass: firstString(source.hazardClass, source.dangerClass, source.hazard, source.hazardClassName),
    limitingIndicator: firstString(source.limitingIndicator, source.limitingSign, source.lpv, source.limitingFactor),
    limitingHazardIndicator: firstString(source.limitingHazardIndicator, source.limitingIndicator, source.limitingSign, source.lpv, source.limitingFactor),
    aggregateState: firstString(source.aggregateState, source.aggregationState, source.physicalState, source.state),
    actionFeatures: firstString(source.actionFeatures, source.featuresOfAction, source.actionSpecifics, source.specialAction, source.effectFeatures),
    source: firstString(source.source, source.sourceName, source.dataSource, source.normativeDocument, source.document, source.documentName),
    sourceFile: firstString(source.sourceFile, source.sourceFileName, source.fileName, source.importFileName, source.excelFileName, source.workbookName),
    sourceFileName: firstString(source.sourceFileName, source.sourceFile, source.fileName, source.importFileName, source.excelFileName, source.workbookName),
    importFileName: firstString(source.importFileName, source.fileName, source.sourceFile, source.excelFileName, source.workbookName),
    testingMethod: firstString(source.testingMethod, source.method, source.methodName, source.measurementMethod),
    samplingMethod: firstString(source.samplingMethod, source.sampleMethod, source.samplingMethodName),
    validFrom: stringValue(source.validFrom),
    validUntil: stringValue(source.validUntil),
    version: stringValue(source.version),
    status: stringValue(source.status || (source.active === false ? 'INACTIVE' : 'ACTIVE')) as NormativeRecord['status'],
    active: source.active !== false,
    archived: source.archived === true || source.status === 'ARCHIVED',
  };
};

export const extractNormatives = (response: unknown): NormativeRecord[] => {
  const lists = [
    extractList(response, ['records']),
    extractList(response, ['normatives']),
    extractList(response, ['items']),
    extractList(response, ['content']),
  ];
  const single = extractItem(response, ['normative', 'record', 'item']);
  const singleRecord = asRecord(single);
  if (singleRecord.id || singleRecord.code || singleRecord.pollutantCode || singleRecord.indicator || singleRecord.indicatorName || singleRecord.name) lists.push([single]);
  const map = new Map<string, NormativeRecord>();
  lists.flat().map(normalizeNormative).forEach((item, index) => {
    const key = item.id || `${item.pollutantCode || item.code}-${item.indicator}-${item.normativeDocument}-${index}`;
    map.set(key, item);
  });
  return Array.from(map.values());
};

export const extractNormativeItems = extractNormatives;

const extractNormativeRecords = extractNormatives;

export interface NormativeRecordsParams {
  page?: number;
  size?: number;
  search?: string;
  query?: string;
  sourceDocumentCode?: string;
  templateId?: string;
  category?: string;
  environmentType?: string;
  factorType?: string;
  appendixNo?: string | number;
  tableNo?: string | number;
  categoryCode?: string;
  waterType?: string;
  normativeType?: string;
  status?: string;
  formType?: string;
  subtype?: string;
}

export type NormativePageState = {
  items: NormativeRecord[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
};

export type NormativeRecordsPage = NormativePageState;

const DEFAULT_PAGE = 0;
const DEFAULT_SIZE = 50;

const unwrapCandidates = (input: unknown): unknown[] => {
  const candidates: unknown[] = [];
  const seen = new Set<unknown>();
  const pushCandidate = (value: unknown) => {
    const record = asRecord(value);
    if (!Object.keys(record).length || seen.has(value)) return;
    candidates.push(value);
    seen.add(value);
  };

  pushCandidate(input);
  let current = input;
  for (let depth = 0; depth < 4; depth += 1) {
    const record = asRecord(current);
    if (!record || !('data' in record)) break;
    current = record.data;
    pushCandidate(current);
  }

  for (let index = 0; index < candidates.length; index += 1) {
    const record = asRecord(candidates[index]);
    ['pagination', 'page', 'pageable', 'pageInfo', 'paging', 'meta', 'metadata', 'headers'].forEach((key) => pushCandidate(record[key]));
  }

  return candidates;
};

const firstNumber = (candidates: unknown[], keys: string[]) => {
  for (const candidate of candidates) {
    const record = asRecord(candidate);
    for (const key of keys) {
      const value = record[key]
        ?? record[key.toLowerCase()]
        ?? record[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
      if (value !== undefined && value !== null && value !== '') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) return numeric;
      }
    }
  }
  return undefined;
};

const compactParams = (params: NormativeRecordsParams) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));

const extractPageRecordItems = (response: unknown): NormativeRecord[] => {
  const candidates = unwrapCandidates(response);
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate.map(normalizeNormative);
    const record = asRecord(candidate);
    for (const key of ['records', 'items', 'normatives', 'content']) {
      if (Array.isArray(record[key])) return (record[key] as unknown[]).map(normalizeNormative);
    }
  }
  return extractNormativeRecords(response);
};

export function normalizeNormativePageResponse(response: unknown, page = DEFAULT_PAGE, size = DEFAULT_SIZE): NormativePageState {
  const safePage = Number.isFinite(Number(page)) ? Number(page) : DEFAULT_PAGE;
  const safeSize = Number.isFinite(Number(size)) && Number(size) > 0 ? Number(size) : DEFAULT_SIZE;
  const candidates = unwrapCandidates(response);
  const items = extractPageRecordItems(response);
  const explicitTotal = firstNumber(candidates, [
    'totalElements',
    'totalRecords',
    'recordsTotal',
    'totalItems',
    'total',
    'count',
    'totalCount',
    'total_records',
    'total_items',
    'x-total-count',
    'x-total-elements',
    'x-total-records',
  ]);
  const responseTotalPages = firstNumber(candidates, ['totalPages', 'pages', 'pageCount', 'total_pages', 'x-total-pages']);
  const totalElements = explicitTotal ?? items.length;
  const totalPages = responseTotalPages ?? Math.max(1, Math.ceil(totalElements / safeSize));
  return {
    items,
    totalElements,
    totalPages,
    page: firstNumber(candidates, ['number', 'page', 'currentPage', 'pageNumber', 'pageIndex']) ?? safePage,
    size: firstNumber(candidates, ['size', 'pageSize', 'limit', 'perPage']) ?? safeSize,
  };
}

const normalizeNormativeRecordsPage = (response: unknown, params: NormativeRecordsParams): NormativeRecordsPage => {
  const page = Number(params.page ?? DEFAULT_PAGE);
  const size = Number(params.size ?? DEFAULT_SIZE);
  return normalizeNormativePageResponse(response, page, size);
};

const directoryParams = (params?: NormativeRecordsParams) => {
  const page = Number(params?.page ?? DEFAULT_PAGE);
  const size = Number(params?.size ?? DEFAULT_SIZE);
  const search = firstString(params?.search, params?.query);
  return compactParams({
    ...params,
    page,
    size,
    status: params?.status || 'ACTIVE',
    search: search || undefined,
    query: search || undefined,
  });
};

export async function getNormativeRecords(params: NormativeRecordsParams = {}, signal?: AbortSignal): Promise<NormativeRecordsPage> {
  if (useMocks) {
    await mockDelay();
    return {
      items: [],
      totalElements: 0,
      totalPages: 1,
      page: Number(params.page ?? DEFAULT_PAGE),
      size: Number(params.size ?? DEFAULT_SIZE),
    };
  }
  const requestParams = directoryParams(params);
  const response = await api.get<ApiResponse<unknown> | unknown>('/normatives/records', { params: requestParams, signal });
  return normalizeNormativeRecordsPage(response, params);
}

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  const recordsPage = await getNormativeRecords(params);
  return recordsPage.items;
}

export async function createNormative(payload: Omit<NormativeRecord, 'id'>): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives', payload);
  return normalizeNormative(extractItem(response, ['normative']));
}

export async function updateNormative(id: string, payload: Partial<NormativeRecord>): Promise<NormativeRecord> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/normatives/${id}`, payload);
  return normalizeNormative(extractItem(response, ['normative']));
}

export async function archiveNormative(id: string): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/normatives/${id}/archive`);
  return normalizeNormative(extractItem(response, ['normative']));
}

export type NormativeImportPreview = {
  items: NormativeRecord[];
  total: number;
  valid: number;
  invalid: number;
  created?: number;
  updated?: number;
  errors: Array<{ row?: number; message: string }>;
  importId?: string;
  importBatchId?: string;
  fileName?: string;
};

export type NormativeResourceImportResult = {
  created: number;
  updated: number;
  warnings: number;
  items?: NormativeRecord[];
};

export async function importPhysicalFactorsFromResources(): Promise<NormativeResourceImportResult> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/physical-factors/import-resources');
  const item = unwrapImportData(response);
  return {
    created: Number(item.created ?? item.createdCount ?? item.newNormatives ?? 0),
    updated: Number(item.updated ?? item.updatedCount ?? item.updatedNormatives ?? 0),
    warnings: Number(item.warnings ?? item.warningCount ?? item.warningsCount ?? 0),
    items: extractNormativeRecords(response),
  };
}

export async function importDsm32FromResources(): Promise<NormativeResourceImportResult> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/dsm32/import-resources');
  const item = unwrapImportData(response);
  return {
    created: Number(item.created ?? item.createdCount ?? item.newNormatives ?? 0),
    updated: Number(item.updated ?? item.updatedCount ?? item.updatedNormatives ?? 0),
    warnings: Number(item.warnings ?? item.warningCount ?? item.warningsCount ?? 0),
    items: extractNormativeRecords(response),
  };
}

const isImportFallbackStatus = (error: unknown) => [400, 404, 405].includes(getApiStatus(error) || 0);

const postLegacyNormativeImport = (file: File, preview: boolean) => {
  const legacyFormData = new FormData();
  legacyFormData.append('file', file);
  legacyFormData.append('preview', String(preview));
  return api.post<ApiResponse<unknown> | unknown>('/normatives/import-excel', legacyFormData);
};

const postNormativeImport = async (file: File, preview: boolean, importId?: string) => {
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = preview ? '/normatives/import/preview' : '/normatives/import/confirm';
  if (!preview && importId) formData.append('importId', String(importId));
  try {
    return await api.post<ApiResponse<unknown> | unknown>(endpoint, formData);
  } catch (error) {
    if (!isImportFallbackStatus(error)) throw error;
    return postLegacyNormativeImport(file, preview);
  }
};

const unwrapImportData = (response: unknown): UnknownRecord => {
  const axiosResponse = asRecord(response);
  const body = asRecord(axiosResponse.data);
  const nested = asRecord(body.data);
  if (Object.keys(nested).length) return nested;
  if (Object.keys(body).length) return body;
  return axiosResponse;
};

const normalizeImportErrors = (...values: unknown[]): Array<{ row?: number; message: string }> => {
  const source = values.find(Array.isArray);
  if (!Array.isArray(source)) return [];
  return source.map((item) => {
    if (typeof item === 'string') return { message: item };
    const value = asRecord(item);
    return {
      row: Number(value.row ?? value.rowNumber ?? value.line) || undefined,
      message: firstString(value.message, value.error, value.warning, item),
    };
  }).filter((item) => item.message);
};

export function normalizeImportPreviewResponse(response: unknown, fileName?: string): NormativeImportPreview {
  const item = unwrapImportData(response);
  const items = extractNormativeRecords(response);
  const errors = normalizeImportErrors(item.errors, item.warnings, item.validationErrors);
  const totalRecords = Number(item.totalRecords ?? item.recordsTotal ?? item.totalRows ?? item.total ?? item.rowsTotal ?? item.totalCount ?? items.length);
  const validRows = Number(item.validRows ?? item.valid ?? item.validCount ?? item.totalRecords ?? item.totalRows ?? items.length);
  const errorRows = Number(item.errorRows ?? item.invalid ?? item.invalidRows ?? item.errorsCount ?? errors.length);
  const importId = firstString(item.importId, item.importBatchId, item.id, item.previewId, item.batchId);

  return {
    items,
    total: Number.isFinite(totalRecords) ? totalRecords : 0,
    valid: Number.isFinite(validRows) ? validRows : 0,
    invalid: Number.isFinite(errorRows) ? errorRows : 0,
    created: Number(item.newNormatives ?? item.created ?? item.new ?? item.newRows ?? item.toCreate ?? item.totalRecords ?? 0),
    updated: Number(item.updatedNormatives ?? item.updated ?? item.update ?? item.updatedRows ?? item.toUpdate ?? 0),
    errors,
    importId: importId || undefined,
    importBatchId: firstString(item.importBatchId, item.batchId, importId) || undefined,
    fileName: firstString(item.fileName, item.sourceFile, fileName) || undefined,
  };
}

export async function importNormativesExcel(file: File, preview = true, importId?: string): Promise<NormativeImportPreview> {
  const response = await postNormativeImport(file, preview, importId);
  return normalizeImportPreviewResponse(response, file.name);
}

export async function previewDsm138Import(files: File | File[]): Promise<NormativeImportPreview> {
  const selectedFiles = Array.isArray(files) ? files : [files];
  const formData = new FormData();
  selectedFiles.forEach((file) => formData.append('files', file));
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/import/dsm-138/preview', formData);
  return normalizeImportPreviewResponse(response, selectedFiles.map((file) => file.name).join(', '));
}

export async function confirmDsm138Import(importBatchId?: string, files?: File[]): Promise<NormativeImportPreview> {
  if (importBatchId) {
    const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/import/dsm-138/confirm', { importBatchId });
    return normalizeImportPreviewResponse(response);
  }

  const formData = new FormData();
  (files || []).forEach((file) => formData.append('files', file));
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/import/dsm-138/confirm', formData);
  return normalizeImportPreviewResponse(response);
}

export async function rollbackDsm138Import(importBatchId: string): Promise<void> {
  await api.post(`/normatives/import/dsm-138/rollback/${encodeURIComponent(importBatchId)}`);
}
