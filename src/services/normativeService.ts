import api, { ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import type { DirectoryQuery, NormativeRecord } from '../types/protocols';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));
type UnknownRecord = Record<string, unknown>;
const stringValue = (value: unknown) => value === undefined || value === null ? '' : String(value);
const normalizeNormative = (raw: unknown): NormativeRecord => {
  const source = (raw && typeof raw === 'object' ? raw : {}) as UnknownRecord;
  return {
    id: stringValue(source.id || source._id),
    templateId: stringValue(source.templateId || source.templateCode).toLowerCase() as NormativeRecord['templateId'],
    code: stringValue(source.code),
    pollutantCode: stringValue(source.pollutantCode || source.substanceCode),
    researchObject: stringValue(source.researchObject || source.environment),
    environment: stringValue(source.environment || source.researchObject),
    indicator: stringValue(source.indicator || source.name),
    unit: stringValue(source.unit),
    normativeType: stringValue(source.normativeType || source.type),
    value: stringValue(source.value),
    min: stringValue(source.min ?? source.minValue),
    max: stringValue(source.max ?? source.maxValue),
    comparisonType: stringValue(source.comparisonType || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'],
    normativeDocument: stringValue(source.normativeDocument || source.document),
    testingMethod: stringValue(source.testingMethod),
    samplingMethod: stringValue(source.samplingMethod),
    validFrom: stringValue(source.validFrom),
    validUntil: stringValue(source.validUntil),
    version: stringValue(source.version),
    status: stringValue(source.status || (source.active === false ? 'INACTIVE' : 'ACTIVE')) as NormativeRecord['status'],
    active: source.active !== false,
    archived: source.archived === true || source.status === 'ARCHIVED',
  };
};

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  if (useMocks) {
    await mockDelay();
    const { mockNormatives } = await import('../mocks/mockNormatives');
    const query = String(params?.search || '').toLowerCase();
    return mockNormatives.filter((item) => (!params?.templateId || item.templateId === params.templateId) && (!query || `${item.indicator} ${item.normativeDocument}`.toLowerCase().includes(query)));
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/normatives/records', { params });
  return extractList(response, ['records', 'content', 'items', 'normatives']).map(normalizeNormative);
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
  errors: Array<{ row?: number; message: string }>;
};

export async function importNormativesExcel(file: File, preview = true): Promise<NormativeImportPreview> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('preview', String(preview));
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives/import-excel', formData);
  const item = extractItem(response, ['preview', 'result']) as unknown as UnknownRecord;
  const items = extractList(response, ['normatives', 'items']).map(normalizeNormative);
  const errors = Array.isArray(item.errors) ? item.errors.map((error) => {
    const value = error as UnknownRecord;
    return { row: Number(value.row) || undefined, message: stringValue(value.message || value.error) };
  }) : [];
  return {
    items,
    total: Number(item.total ?? items.length),
    valid: Number(item.valid ?? items.length),
    invalid: Number(item.invalid ?? errors.length),
    errors,
  };
}
