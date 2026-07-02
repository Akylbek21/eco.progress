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
    tableNo: firstString(source.tableNo, source.tableNumber, source.table),
    matrixType: firstString(source.matrixType, source.matrix_type),
    assessmentCategory: firstString(source.assessmentCategory, source.assessment_category),
    pollutionDegree: firstString(source.pollutionDegree, source.pollution_degree),
    formType: firstString(source.formType, source.form_type, source.form, source.normativeSubType, source.normativeSubtype),
    factorType: firstString(source.factorType, source.factor_type, source.subtype, source.physicalFactorType),
    factorCode: firstString(source.factorCode, source.factor_code, source.indicatorCode, source.code),
    roomType: firstString(source.roomType, source.room_type),
    season: firstString(source.season, source.period, source.yearPeriod),
    workCategory: firstString(source.workCategory, source.work_category, source.categoryOfWork),
    workplaceType: firstString(source.workplaceType, source.workplace_type, source.workPlaceType),
    normLevel: firstString(source.normLevel, source.norm_level, source.level, source.normativeLevel),
    conditionJson: firstString(source.conditionJson, source.condition_json, source.conditionsJson, source.conditions),
    code,
    pollutantCode: firstString(source.pollutantCode, source.substanceCode, code),
    indicatorName: firstString(source.indicatorName, source.indicatorNameRu, source.name, source.nameRu, indicator),
    pollutantName: firstString(source.pollutantName, source.substanceName, indicator),
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
    maxOneTimeValue,
    dailyAverageValue,
    singleValue,
    obuvValue,
    min: stringValue(source.min ?? source.minValue ?? source.normativeMin),
    max: stringValue(source.max ?? source.maxValue ?? source.normativeMax),
    comparisonType: stringValue(source.comparisonType || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'],
    normativeDocument: firstString(source.normativeDocument, source.document, source.documentName, source.standard),
    hazardClass: firstString(source.hazardClass, source.dangerClass, source.hazard, source.hazardClassName),
    limitingIndicator: firstString(source.limitingIndicator, source.limitingSign, source.lpv, source.limitingFactor),
    aggregateState: firstString(source.aggregateState, source.aggregationState, source.physicalState, source.state),
    actionFeatures: firstString(source.actionFeatures, source.featuresOfAction, source.actionSpecifics, source.specialAction, source.effectFeatures),
    source: firstString(source.source, source.sourceName, source.dataSource, source.normativeDocument, source.document, source.documentName),
    sourceFile: firstString(source.sourceFile, source.sourceFileName, source.fileName, source.importFileName, source.excelFileName, source.workbookName),
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

const extractNormativeRecords = extractNormatives;

const directoryParams = (params?: DirectoryQuery) => {
  const search = firstString(params?.search, params?.query, params?.q);
  return {
    ...params,
    status: params?.status || 'ACTIVE',
    search: search || undefined,
    query: search || undefined,
    q: search || undefined,
  };
};

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  if (useMocks) {
    await mockDelay();
    return [];
  }
  const requestParams = directoryParams(params);
  const response = await api.get<ApiResponse<unknown> | unknown>('/normatives/records', { params: requestParams });
  const records = extractNormativeRecords(response);
  return records.filter((item) => item.active !== false && !item.archived && item.status !== 'ARCHIVED');
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

export async function importNormativesExcel(file: File, preview = true, importId?: string): Promise<NormativeImportPreview> {
  const response = await postNormativeImport(file, preview, importId);
  const item = unwrapImportData(response);
  const items = extractNormativeRecords(response);
  const errors = Array.isArray(item.errors) ? item.errors.map((error) => {
    const value = error as UnknownRecord;
    return { row: Number(value.row) || undefined, message: stringValue(value.message || value.error) };
  }) : [];
  return {
    items,
    total: Number(item.totalRows ?? item.total ?? item.rowsTotal ?? item.totalCount ?? items.length),
    valid: Number(item.validRows ?? item.valid ?? item.validCount ?? items.length),
    invalid: Number(item.errorRows ?? item.invalid ?? item.invalidRows ?? item.errorsCount ?? errors.length),
    created: Number(item.newNormatives ?? item.created ?? item.new ?? item.newRows ?? item.toCreate ?? 0),
    updated: Number(item.updatedNormatives ?? item.updated ?? item.update ?? item.updatedRows ?? item.toUpdate ?? 0),
    errors,
    importId: stringValue(item.importId || item.previewId || item.batchId) || undefined,
    fileName: stringValue(item.fileName || item.sourceFile || file.name) || undefined,
  };
}
