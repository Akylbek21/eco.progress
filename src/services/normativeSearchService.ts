import axios from 'axios';
import api from './api';
import type { NormativeSearchItem, NormativeSearchParams, NormativeSearchResponse } from '../types/normativeSearch';
import type { NormativeComparisonType, NormativeRecord, ProtocolTemplateId } from '../types/protocols';
import { canSearchNormative } from '../utils/normativeSearchRules';

export { canSearchNormative } from '../utils/normativeSearchRules';

type UnknownRecord = Record<string, unknown>;

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, { expiresAt: number; value: NormativeSearchResponse['data'] }>();

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;

const firstValue = (record: UnknownRecord, keys: string[]): unknown => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return undefined;
};

const optionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const optionalNumber = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const conditionRecord = (value: unknown): Record<string, unknown> | null => {
  const record = asRecord(value);
  if (record) return record;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
};

const normalizeItem = (value: unknown, index: number): NormativeSearchItem | null => {
  const record = asRecord(value);
  if (!record) return null;
  const pollutant = asRecord(record.pollutant || record.substance || record.indicatorReference) || {};
  const indicatorName = optionalString(firstValue(record, [
    'indicatorName', 'indicatorNameRu', 'indicatorNameKz', 'indicator',
    'pollutantName', 'substanceName', 'name', 'nameRu', 'nameKz', 'title', 'shortName',
  ])) || optionalString(firstValue(pollutant, ['indicatorName', 'indicator', 'pollutantName', 'name', 'nameRu']));
  if (!indicatorName) return null;
  const id = firstValue(record, ['id', '_id', 'normativeId', 'recordId', 'referenceId']);
  const code = firstValue(record, ['code', 'factorCode', 'pollutantCode', 'substanceCode', 'indicatorCode', 'referenceCode'])
    ?? firstValue(pollutant, ['code', 'pollutantCode']);

  return {
    id: typeof id === 'number' || typeof id === 'string' ? id : `search-${index}`,
    code: optionalString(code),
    pollutantCode: optionalString(firstValue(record, ['pollutantCode', 'substanceCode', 'code']) ?? code),
    indicatorName,
    shortName: optionalString(record.shortName),
    casNumber: optionalString(firstValue(record, ['casNumber', 'cas']) ?? firstValue(pollutant, ['casNumber', 'cas'])),
    formula: optionalString(firstValue(record, ['formula', 'chemicalFormula']) ?? firstValue(pollutant, ['formula', 'chemicalFormula'])),
    unit: optionalString(firstValue(record, ['unit', 'measurementUnit', 'resultUnit', 'units'])),
    limitValue: optionalNumber(firstValue(record, ['limitValue', 'normativeValue', 'normative', 'value', 'pdk', 'obuv', 'obuvValue'])),
    limitMin: optionalNumber(firstValue(record, ['limitMin', 'normativeMin', 'minValue', 'min'])),
    limitMax: optionalNumber(firstValue(record, ['limitMax', 'normativeMax', 'maxValue', 'max', 'maxOneTimeValue', 'dailyAverageValue'])),
    comparisonType: optionalString(record.comparisonType) || undefined,
    templateId: optionalString(firstValue(record, ['templateId', 'templateCode', 'protocolTemplateCode', 'normativeTemplateId'])),
    sourceDocumentCode: optionalString(firstValue(record, ['sourceDocumentCode', 'source_document_code', 'documentCode', 'dsmCode'])),
    sourceDocumentName: optionalString(firstValue(record, ['sourceDocumentName', 'source_document_name', 'normativeDocument', 'documentName', 'document'])),
    environmentType: optionalString(firstValue(record, ['environmentType', 'environment_type', 'mediumType', 'environmentCode'])),
    factorType: optionalString(firstValue(record, ['factorType', 'factor_type', 'physicalFactorType', 'subtype'])),
    factorCode: optionalString(firstValue(record, ['factorCode', 'factor_code', 'indicatorCode'])),
    waterType: optionalString(firstValue(record, ['waterType', 'water_type'])),
    waterUseCategory: optionalString(firstValue(record, ['waterUseCategory', 'water_use_category'])),
    categoryCode: optionalString(firstValue(record, ['categoryCode', 'category_code', 'category'])),
    roomType: optionalString(firstValue(record, ['roomType', 'room_type'])),
    season: optionalString(firstValue(record, ['season', 'period', 'yearPeriod'])),
    workCategory: optionalString(firstValue(record, ['workCategory', 'work_category', 'categoryOfWork'])),
    workplaceType: optionalString(firstValue(record, ['workplaceType', 'workplace_type', 'workPlaceType'])),
    normLevel: optionalString(firstValue(record, ['normLevel', 'norm_level', 'normativeLevel'])),
    visualWorkCategory: optionalString(firstValue(record, ['visualWorkCategory', 'visual_work_category'])),
    lightingType: optionalString(firstValue(record, ['lightingType', 'lighting_type'])),
    noiseType: optionalString(firstValue(record, ['noiseType', 'noise_type'])),
    conditionJson: conditionRecord(firstValue(record, ['conditionJson', 'condition_json', 'conditionsJson', 'conditions'])),
    status: optionalString(record.status) || undefined,
    relevanceScore: optionalNumber(record.relevanceScore) ?? undefined,
  };
};

const findItemsContainer = (payload: unknown, depth = 0): { container: UnknownRecord; items: unknown[] } | null => {
  if (depth > 5) return null;
  if (Array.isArray(payload)) return { container: {}, items: payload };
  const record = asRecord(payload);
  if (!record) return null;
  for (const key of ['items', 'content', 'normatives', 'records', 'results', 'rows']) {
    if (Array.isArray(record[key])) return { container: record, items: record[key] as unknown[] };
  }
  for (const key of ['data', 'result', 'page', 'payload']) {
    const nested = findItemsContainer(record[key], depth + 1);
    if (nested) return nested;
  }
  return null;
};

const normalizeResponse = (
  payload: unknown,
  requestedPage: number,
  requestedSize: number,
): NormativeSearchResponse['data'] => {
  const root = asRecord(payload);
  if (root?.success === false) {
    const errors = Array.isArray(root.errors) ? root.errors.filter((item): item is string => typeof item === 'string') : [];
    throw new Error(optionalString(root.message) || errors.join(', ') || 'Не удалось загрузить нормативы');
  }
  const found = findItemsContainer(payload);
  const container = found?.container || {};
  const rawItems = found?.items || [];
  const items = rawItems.map(normalizeItem).filter((item): item is NormativeSearchItem => item !== null);
  const page = optionalNumber(firstValue(container, ['page', 'number'])) ?? requestedPage;
  const size = optionalNumber(container.size) ?? requestedSize;
  const totalElements = optionalNumber(firstValue(container, ['totalElements', 'total', 'count'])) ?? items.length;
  const totalPages = optionalNumber(container.totalPages) ?? Math.ceil(totalElements / Math.max(size, 1));
  return { items, page, size, totalElements, totalPages };
};

export const cleanNormativeSearchParams = (
  params: Partial<NormativeSearchParams>,
): Partial<NormativeSearchParams> => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
) as Partial<NormativeSearchParams>;

const cacheKey = (params: Partial<NormativeSearchParams>): string => JSON.stringify(
  Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
);

export const isNormativeSearchCanceled = (error: unknown): boolean =>
  axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') || (error instanceof DOMException && error.name === 'AbortError');

export const searchNormatives = async (
  params: NormativeSearchParams,
  signal?: AbortSignal,
  options: { bypassCache?: boolean } = {},
): Promise<NormativeSearchResponse['data']> => {
  const query = typeof params.query === 'string' ? params.query.trim() : '';
  const requestedPage = params.page ?? 0;
  const requestedSize = params.size ?? 30;
  if (!canSearchNormative(query)) {
    return { items: [], page: requestedPage, size: requestedSize, totalElements: 0, totalPages: 0 };
  }
  const cleaned = cleanNormativeSearchParams({ ...params, query, page: requestedPage, size: requestedSize });
  const key = cacheKey(cleaned);
  const cached = cache.get(key);
  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);

  const response = await api.get<unknown>('/normatives/search', { params: cleaned, signal });
  const normalized = normalizeResponse(response.data, Number(cleaned.page ?? 0), Number(cleaned.size ?? 30));
  if (normalized.items.length) cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: normalized });
  return normalized;
};

const valueString = (value: number | null | undefined): string => value === null || value === undefined ? '' : String(value);

export const normativeSearchItemToRecord = (item: NormativeSearchItem): NormativeRecord => ({
  id: String(item.id),
  templateId: (item.templateId || 'ambient_air') as ProtocolTemplateId,
  sourceDocumentCode: item.sourceDocumentCode || undefined,
  sourceDocumentName: item.sourceDocumentName || undefined,
  categoryCode: item.categoryCode || undefined,
  waterType: item.waterType || undefined,
  waterUseCategory: item.waterUseCategory || undefined,
  factorType: item.factorType || undefined,
  factorCode: item.factorCode || undefined,
  roomType: item.roomType || undefined,
  season: item.season || undefined,
  workCategory: item.workCategory || undefined,
  workplaceType: item.workplaceType || undefined,
  normLevel: item.normLevel || undefined,
  lightingType: item.lightingType || undefined,
  noiseType: item.noiseType || undefined,
  visualWorkCategory: item.visualWorkCategory || undefined,
  conditionJson: item.conditionJson ? JSON.stringify(item.conditionJson) : undefined,
  code: item.code || undefined,
  pollutantCode: item.pollutantCode || undefined,
  indicatorName: item.indicatorName,
  pollutantName: item.indicatorName,
  researchObject: item.environmentType || '',
  indicator: item.indicatorName,
  environmentType: item.environmentType || undefined,
  cas: item.casNumber || undefined,
  casNumber: item.casNumber || undefined,
  formula: item.formula || undefined,
  unit: item.unit || '',
  normativeType: 'LIMIT',
  value: valueString(item.limitValue),
  normativeValue: item.limitValue ?? undefined,
  limitValue: item.limitValue ?? undefined,
  min: valueString(item.limitMin),
  max: valueString(item.limitMax),
  minValue: item.limitMin ?? undefined,
  maxValue: item.limitMax ?? undefined,
  comparisonType: (item.comparisonType || 'LESS_OR_EQUAL') as NormativeComparisonType,
  normativeDocument: item.sourceDocumentName || item.sourceDocumentCode || '',
  testingMethod: '',
  samplingMethod: '',
  validFrom: '',
  status: item.status === 'ACTIVE' ? 'ACTIVE' : undefined,
  active: item.status !== 'INACTIVE',
});
