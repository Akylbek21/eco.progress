import axios from 'axios';
import api, { type ApiResponse } from '../../../services/api';
import { getContentDispositionFileName } from '../../../services/apiHelpers';
import { LAB_JOURNAL_TYPES, JournalType, type ExportJournalParams, type JournalEntriesQuery, type JournalTypeDefinition, type JournalTypesResult, type LabJournalEntry, type LabJournalType, type PageResponse, type CreateLabJournalEntryRequest, type UpdateLabJournalEntryRequest } from '../../../types/labJournal';
import { LOCAL_JOURNAL_SCHEMAS, JournalSchemaError, validateJournalSchema } from '../schemas/journalSchemas';
import { mapJournalEntriesResponse, mapJournalEntryDtoToModel } from './labJournalMappers';

export type DownloadResult = { blob: Blob; fileName: string };

export function compactQueryParams<T extends object>(params: T): Partial<T> {
  return Object.fromEntries(Object.entries(params as Record<string, unknown>).filter(([, value]) => value !== undefined && value !== null && value !== '')) as Partial<T>;
}

const localDefinitions = (): JournalTypeDefinition[] => Object.values(JournalType).map((code) => ({
  code,
  name: LAB_JOURNAL_TYPES[code].label,
  description: LAB_JOURNAL_TYPES[code].description,
  columns: LOCAL_JOURNAL_SCHEMAS[code],
  schemaSource: 'local',
}));

const extractArray = (response: unknown): unknown[] => {
  const candidates = [response, (response as { data?: unknown })?.data, ((response as { data?: { data?: unknown } })?.data)?.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      const source = candidate as Record<string, unknown>;
      for (const key of ['types', 'items', 'content']) if (Array.isArray(source[key])) return source[key] as unknown[];
    }
  }
  return [];
};

const mapBackendTypes = (response: unknown): JournalTypesResult => {
  const rows = extractArray(response);
  if (!rows.length) throw new JournalSchemaError();
  const codes = new Set(Object.values(JournalType));
  const sources = rows.map((row) => row && typeof row === 'object' ? row as Record<string, unknown> : {});
  const hasColumns = sources.map((source) => Array.isArray(source.columns));
  if (hasColumns.some(Boolean) && !hasColumns.every(Boolean)) throw new JournalSchemaError();
  const definitions = sources.map((source): JournalTypeDefinition => {
    const code = String(source.code || '') as LabJournalType;
    if (!codes.has(code)) throw new JournalSchemaError();
    const fallback = LAB_JOURNAL_TYPES[code];
    return {
      code,
      name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : fallback.label,
      description: typeof source.description === 'string' ? source.description : fallback.description,
      columns: hasColumns.every(Boolean) ? validateJournalSchema(source.columns) : LOCAL_JOURNAL_SCHEMAS[code],
      schemaSource: hasColumns.every(Boolean) ? 'backend' : 'local',
    };
  });
  const schemaSource = hasColumns.every(Boolean) ? 'backend' : 'local';
  if (schemaSource === 'local' && import.meta.env.DEV) console.warn('[lab-journals] Backend returned journal types without columns; using declared local schemas.');
  return { content: definitions, schemaSource };
};

export async function getJournalTypesResult(signal?: AbortSignal): Promise<JournalTypesResult> {
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/types', { signal });
    return mapBackendTypes(response);
  } catch (error) {
    if (!axios.isAxiosError(error) || error.response?.status !== 404) {
      if (error instanceof JournalSchemaError && import.meta.env.DEV) console.error('[lab-journals] Incompatible backend journal schema.', error);
      throw error;
    }
    if (import.meta.env.DEV) console.warn('[lab-journals] GET /lab-journals/types returned 404; using declared local schemas.');
    return { content: localDefinitions(), schemaSource: 'local' };
  }
}

export async function getEntries(query: JournalEntriesQuery, signal?: AbortSignal): Promise<PageResponse<LabJournalEntry>> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/entries', { params: compactQueryParams(query), signal });
  return mapJournalEntriesResponse(response);
}

export async function createEntry(payload: CreateLabJournalEntryRequest): Promise<LabJournalEntry> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/lab-journals/entries', payload);
  return mapJournalEntryDtoToModel(response);
}

export async function updateEntry(id: number, payload: UpdateLabJournalEntryRequest): Promise<LabJournalEntry> {
  const response = await api.put<ApiResponse<unknown> | unknown>(`/lab-journals/entries/${id}`, payload);
  return mapJournalEntryDtoToModel(response);
}

export async function deleteJournalEntry(id: number): Promise<void> {
  await api.delete(`/lab-journals/entries/${id}`);
}

const parseErrorBlob = async (blob: Blob): Promise<string | undefined> => {
  if (!/json|text|html/i.test(blob.type)) return undefined;
  const body = await blob.text();
  try {
    const value = JSON.parse(body) as { message?: string; errors?: string[] };
    return value.message || value.errors?.join(', ') || 'Backend вернул ошибку вместо Excel-файла';
  } catch {
    return body.trim().slice(0, 500) || 'Backend вернул некорректный файл';
  }
};

const validateSpreadsheet = async (blob: Blob) => {
  const error = await parseErrorBlob(blob);
  if (error) throw new Error(error);
  if (blob.size === 0) throw new Error('Backend вернул пустой Excel-файл');
  if (blob.type && !/spreadsheet|excel|csv|octet-stream/i.test(blob.type)) throw new Error('Backend вернул файл неподдерживаемого формата');
};

const blobRequest = async (url: string, params: Record<string, unknown>, fallbackName: string): Promise<DownloadResult> => {
  try {
    const response = await api.get<Blob>(url, { params: compactQueryParams(params), responseType: 'blob' });
    await validateSpreadsheet(response.data);
    return { blob: response.data, fileName: getContentDispositionFileName(response.headers['content-disposition']) || fallbackName };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
      const message = await parseErrorBlob(error.response.data);
      if (message) throw new Error(message);
    }
    throw error;
  }
};

export const exportJournal = (params: ExportJournalParams) => blobRequest('/lab-journals/entries/export', params, 'lab-journal.xlsx');
export const downloadTemplate = (journalType: LabJournalType) => blobRequest('/lab-journals/entries/export-template', { journalType }, `${journalType.toLowerCase()}-template.xlsx`);

export function downloadBlobResponse({ blob, fileName }: DownloadResult): void {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const labJournalService = { getTypes: getJournalTypesResult, getEntries, createEntry, updateEntry, deleteEntry: deleteJournalEntry, exportJournal, downloadTemplate };
