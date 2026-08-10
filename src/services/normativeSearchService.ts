import axios from 'axios';
import api from './api';
import type { NormativeSearchItem, NormativeSearchResponse } from '../types/normativeSearch';
import type { NormativeComparisonType, NormativeRecord, ProtocolTemplateId } from '../types/protocols';
import { canSearchNormative } from '../utils/normativeSearchRules';

export { canSearchNormative } from '../utils/normativeSearchRules';

type UnknownRecord = Record<string, unknown>;

export interface NormativeSearchRequest {
  query?: string;
  pollutantCode?: string;
  code?: string;
  templateId?: string;
  sourceDocumentCode?: string;
  environmentType?: string;
  categoryCode?: string;
  factorType?: string;
  factorCode?: string;
  waterType?: string;
  waterUseCategory?: string;
  lightingType?: string;
  noiseType?: string;
  roomType?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  normLevel?: string;
  visualWorkCategory?: string;
  unit?: string;
  page?: number;
  size?: number;
  status?: 'ACTIVE' | 'REVIEW' | 'ALL' | string;
}

const CACHE_TTL_MS = 45_000;
export const NORMATIVE_SEARCH_DEBOUNCE_MS = 400;
export const isNumericPollutantCode = (value: string): boolean => /^\d{1,7}$/.test(value.trim());
const cache = new Map<string, { expiresAt: number; value: NormativeSearchResponse['data'] }>();
export const clearNormativeSearchCache = (): void => cache.clear();

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

const normalizeItem = (value: unknown): NormativeSearchItem | null => {
  const record = asRecord(value);
  if (!record) return null;
  const pollutant = asRecord(record.pollutant || record.substance || record.indicatorReference) || {};
  const indicatorName = optionalString(firstValue(record, [
    'indicatorName', 'indicatorNameRu', 'indicatorNameKz', 'indicator',
    'pollutantName', 'substanceName', 'name', 'nameRu', 'nameKz', 'title', 'shortName',
  ])) || optionalString(firstValue(pollutant, ['indicatorName', 'indicator', 'pollutantName', 'name', 'nameRu']));
  if (!indicatorName) return null;
  const id = firstValue(record, ['id', '_id', 'normativeId', 'recordId', 'referenceId']);
  if ((typeof id !== 'number' && typeof id !== 'string') || String(id).trim() === '') return null;
  const code = firstValue(record, ['code', 'factorCode', 'pollutantCode', 'substanceCode', 'indicatorCode', 'referenceCode'])
    ?? firstValue(pollutant, ['code', 'pollutantCode']);

  return {
    id,
    code: optionalString(code),
    pollutantCode: optionalString(firstValue(record, ['pollutantCode', 'substanceCode', 'code']) ?? code),
    indicatorName,
    shortName: optionalString(record.shortName),
    casNumber: optionalString(firstValue(record, ['casNumber', 'cas']) ?? firstValue(pollutant, ['casNumber', 'cas'])),
    formula: optionalString(firstValue(record, ['formula', 'chemicalFormula']) ?? firstValue(pollutant, ['formula', 'chemicalFormula'])),
    alternativeName: optionalString(firstValue(record, ['alternativeName', 'alternativeNameRu', 'synonyms', 'alias'])),
    testingMethodNd: optionalString(firstValue(record, ['testingMethodNd', 'testingMethod', 'testingMethodDocument', 'methodDocument'])),
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
    matchQuality: optionalString(firstValue(record, ['matchQuality', 'matchType', 'quality'])) || undefined,
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

const unwrapSearchResponse = (response: unknown): unknown => {
  const outer = asRecord(response);
  const responseData = outer?.data;
  const dataRecord = asRecord(responseData);
  return dataRecord?.data ?? responseData ?? response;
};

export const extractNormativeItems = (response: unknown): unknown[] =>
  findItemsContainer(unwrapSearchResponse(response))?.items ?? [];

const normalizeResponse = (
  response: unknown,
  requestedPage: number,
  requestedSize: number,
): NormativeSearchResponse['data'] => {
  const payload = unwrapSearchResponse(response);
  const root = asRecord(payload);
  if (root?.success === false) {
    const errors = Array.isArray(root.errors) ? root.errors.filter((item): item is string => typeof item === 'string') : [];
    throw new Error(optionalString(root.message) || errors.join(', ') || 'Не удалось загрузить нормативы');
  }
  const found = findItemsContainer(payload);
  const container = found?.container || {};
  const rawItems = extractNormativeItems(response);
  const normalizedItems = rawItems.map(normalizeItem).filter((item): item is NormativeSearchItem => item !== null);
  const items = Array.from(
    new Map(normalizedItems.map((item) => [String(item.id), item])).values(),
  );
  const page = optionalNumber(firstValue(container, ['page', 'number'])) ?? requestedPage;
  const size = optionalNumber(container.size) ?? requestedSize;
  const totalElements = optionalNumber(firstValue(container, ['totalElements', 'total', 'count'])) ?? items.length;
  const totalPages = optionalNumber(container.totalPages) ?? Math.ceil(totalElements / Math.max(size, 1));
  return { items, page, size, totalElements, totalPages };
};

export const cleanNormativeSearchParams = (
  params: NormativeSearchRequest,
): NormativeSearchRequest => Object.fromEntries(
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => [
      key,
      Array.isArray(value)
        ? [...value].sort((left, right) => String(left).localeCompare(String(right)))
        : value,
    ]),
) as NormativeSearchRequest;

export const normalizeNormativeSearchRequest = (
  params: NormativeSearchRequest,
): NormativeSearchRequest => cleanNormativeSearchParams(params);

export const normativeSearchQueryKey = (params: NormativeSearchRequest) => [
  'protocol-normative-search-v3',
  normalizeNormativeSearchRequest(params),
] as const;

const cacheKey = (params: NormativeSearchRequest): string => JSON.stringify(
  Object.entries(params).sort(([left], [right]) => left.localeCompare(right)),
);

export const isNormativeSearchCanceled = (error: unknown): boolean =>
  axios.isCancel(error) || (axios.isAxiosError(error) && error.code === 'ERR_CANCELED') || (error instanceof DOMException && error.name === 'AbortError');

export const searchNormatives = async (
  params: NormativeSearchRequest,
  signal?: AbortSignal,
  options: { bypassCache?: boolean } = {},
): Promise<NormativeSearchResponse['data']> => {
  const query = typeof params.query === 'string' ? params.query.trim() : '';
  const requestedPage = params.page ?? 0;
  const requestedSize = params.size ?? 30;
  const hasExactFilter = Boolean(
    params.pollutantCode ||
      params.code ||
      params.factorCode,
  );
  if ((!query || !canSearchNormative(query)) && !hasExactFilter) {
    return { items: [], page: requestedPage, size: requestedSize, totalElements: 0, totalPages: 0 };
  }
  const cleaned = cleanNormativeSearchParams({
    ...params,
    query: query || undefined,
    page: requestedPage,
    size: requestedSize,
    status: params.status || 'ACTIVE',
  });
  const key = cacheKey(cleaned);
  const cached = cache.get(key);
  if (!options.bypassCache && cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) cache.delete(key);

  const response = await api.get<unknown>('/normatives/search', { params: cleaned, signal });
  const result = normalizeResponse(response.data, requestedPage, requestedSize);
  const normalized: NormativeSearchResponse['data'] = {
    ...result,
    relaxed: false,
    fallbackStage: cleaned.status === 'ALL' ? 'STRICT_ALL' : 'STRICT_ACTIVE',
  };
  if (normalized.items.length) cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value: normalized });
  return normalized;
};

export const searchNormativesActiveThenAll = async (
  params: NormativeSearchRequest,
  signal?: AbortSignal,
): Promise<NormativeSearchResponse['data']> => {
  const active = await searchNormatives({ ...params, status: 'ACTIVE' }, signal);
  if (active.items.length) return active;
  return searchNormatives({ ...params, status: 'ALL' }, signal);
};

export const buildNormativeSearchSequence = (params: NormativeSearchRequest) => {
  const strict = cleanNormativeSearchParams({ ...params, page: params.page ?? 0, size: params.size ?? 50 });
  const {
    waterType: _waterType,
    waterUseCategory: _waterUseCategory,
    lightingType: _lightingType,
    noiseType: _noiseType,
    roomType: _roomType,
    season: _season,
    workCategory: _workCategory,
    workplaceType: _workplaceType,
    normLevel: _normLevel,
    visualWorkCategory: _visualWorkCategory,
    status: _status,
    ...relaxedFields
  } = strict;
  const relaxed = cleanNormativeSearchParams(relaxedFields);
  return [
    { stage: 'STRICT_ACTIVE' as const, params: { ...strict, status: 'ACTIVE' } },
    { stage: 'STRICT_ALL' as const, params: { ...strict, status: 'ALL' } },
    { stage: 'RELAXED_ACTIVE' as const, params: { ...relaxed, status: 'ACTIVE' } },
    { stage: 'RELAXED_ALL' as const, params: { ...relaxed, status: 'ALL' } },
  ];
};

export const searchNormativesStaged = async (
  params: NormativeSearchRequest,
  signal?: AbortSignal,
): Promise<NormativeSearchResponse['data']> => {
  const seen = new Set<string>();
  let lastResult: NormativeSearchResponse['data'] = {
    items: [], page: params.page ?? 0, size: params.size ?? 50, totalElements: 0, totalPages: 0,
    relaxed: false, fallbackStage: 'STRICT_ACTIVE',
  };

  for (const step of buildNormativeSearchSequence(params)) {
    const cleaned = cleanNormativeSearchParams(step.params);
    const key = cacheKey(cleaned);
    if (seen.has(key)) continue;
    seen.add(key);
    const result = await searchNormatives(cleaned, signal);
    const relaxed = step.stage === 'RELAXED_ACTIVE' || step.stage === 'RELAXED_ALL';
    lastResult = {
      ...result,
      relaxed,
      fallbackStage: step.stage,
      items: relaxed
        ? result.items.map((item) => ({ ...item, matchQuality: item.matchQuality || 'CONTEXT_GENERAL' }))
        : result.items,
    };
    if (lastResult.items.length) return lastResult;
  }

  return lastResult;
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
  testingMethod: item.testingMethodNd || '',
  samplingMethod: '',
  validFrom: '',
  status: item.status === 'ACTIVE' || item.status === 'REVIEW' || item.status === 'INACTIVE'
    ? item.status
    : undefined,
  matchQuality: item.matchQuality,
  active: item.status !== 'INACTIVE',
});
