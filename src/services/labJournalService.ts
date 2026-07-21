import axios from 'axios';
import api, { type ApiResponse } from './api';
import { extractItem, extractList, getContentDispositionFileName } from './apiHelpers';
import { JOURNAL_TYPES, type ExportJournalParams, type JournalEntriesParams, type JournalEntry, type JournalEntryPayload, type JournalValues, type PageResponse, type JournalTypeDefinition, type LabJournalType } from '../types/labJournal';
import { JournalSchemaError, normalizeJournalSchema } from '../utils/journalSchema';

type UnknownRecord = Record<string, unknown>;
export type DownloadResult = { blob: Blob; fileName: string };
export type JournalTypesResult = { items: JournalTypeDefinition[]; fallback: boolean };
const record = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const number = (value: unknown, fallback = 0) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; };
const unwrap = (raw: unknown) => { const outer = record(raw); const data = outer.data; const nested = record(data); return 'data' in nested && !('items' in nested) && !('content' in nested) ? nested.data : data ?? raw; };

export const normalizeJournalEntryResponse = (raw: unknown): JournalEntry => {
  const source = record(unwrap(raw));
  const creator = record(source.createdBy || source.creator);
  const values = record(source.values ?? source.data ?? source.fields) as JournalValues;
  return {
    id: number(source.id), journalType: String(source.journalType || source.type) as LabJournalType,
    laboratoryId: number(source.laboratoryId ?? record(source.laboratory).id), values,
    version: number(source.version), archived: source.archived === true || source.active === false,
    automatic: source.automatic === true || source.autoCreated === true || source.source === 'PROTOCOL',
    protocolId: source.protocolId === undefined ? number(values.protocolId, 0) || undefined : number(source.protocolId),
    createdByName: String(source.createdByName || creator.fullName || creator.name || ''),
    createdAt: String(source.createdAt || ''), updatedAt: String(source.updatedAt || source.createdAt || ''),
  };
};

const normalizePage = (raw: unknown, requestedPage: number, requestedSize: number): PageResponse<JournalEntry> => {
  const payload = record(unwrap(raw));
  const items = extractList(payload, ['items', 'content']).map(normalizeJournalEntryResponse);
  return {
    items, page: number(payload.page ?? payload.number, requestedPage), size: number(payload.size, requestedSize),
    totalElements: number(payload.totalElements), totalPages: number(payload.totalPages),
    first: payload.first === true, last: payload.last !== false,
    hasNext: payload.hasNext === true, hasPrevious: payload.hasPrevious === true,
  };
};

const queryParams = (params: JournalEntriesParams | ExportJournalParams) => {
  const { filters, ...base } = params;
  return Object.fromEntries(Object.entries({ ...base, ...(filters || {}) }).filter(([, value]) => value !== undefined && value !== null && value !== ''));
};

const endpointUnavailable = (error: unknown) => axios.isAxiosError(error) && !axios.isCancel(error) && (!error.response || error.response.status === 404 || error.response.status === 503);

export async function getJournalTypesResult(signal?: AbortSignal): Promise<JournalTypesResult> {
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/types', { signal });
    const rawItems = extractList(response, ['items', 'types']);
    if (!rawItems.length) throw new JournalSchemaError();
    return { items: rawItems.map(normalizeJournalSchema), fallback: false };
  } catch (error) {
    if (endpointUnavailable(error)) return { items: JOURNAL_TYPES, fallback: true };
    throw error;
  }
}

export const getJournalTypes = async (signal?: AbortSignal) => (await getJournalTypesResult(signal)).items;

export async function getEntries(params: JournalEntriesParams, signal?: AbortSignal): Promise<PageResponse<JournalEntry>> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/entries', { params: queryParams(params), signal });
  return normalizePage(response, params.page, params.size);
}

export async function getEntry(id: number, signal?: AbortSignal): Promise<JournalEntry> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/lab-journals/entries/${id}`, { signal });
  return normalizeJournalEntryResponse(extractItem(response, ['entry', 'item']));
}

export async function createEntry(payload: JournalEntryPayload): Promise<JournalEntry> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/lab-journals/entries', payload);
  return normalizeJournalEntryResponse(extractItem(response, ['entry', 'item']));
}

export async function updateEntry(id: number, payload: JournalEntryPayload): Promise<JournalEntry> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/lab-journals/entries/${id}`, payload);
  return normalizeJournalEntryResponse(extractItem(response, ['entry', 'item']));
}

export const archiveEntry = async (id: number) => { await api.post(`/lab-journals/entries/${id}/archive`); };
export const restoreEntry = async (id: number) => { await api.post(`/lab-journals/entries/${id}/restore`); };

const ensureSpreadsheet = async (blob: Blob) => {
  const contentType = blob.type.toLowerCase();
  if (contentType.includes('json') || contentType.includes('text/plain') || contentType.includes('text/html')) {
    const body = await blob.text();
    try { const parsed = JSON.parse(body) as { message?: string }; throw new Error(parsed.message || 'Не удалось сформировать Excel'); }
    catch (error) { if (error instanceof SyntaxError) throw new Error('Backend вернул некорректный файл'); throw error; }
  }
  if (contentType && !/spreadsheet|excel|csv|octet-stream/.test(contentType)) throw new Error('Backend вернул файл неподдерживаемого формата');
};

const rethrowBlobError = async (error: unknown): Promise<never> => {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    const body = await error.response.data.text();
    try { const parsed = JSON.parse(body) as { message?: string }; throw new Error(parsed.message || 'Не удалось сформировать Excel'); }
    catch (parseError) { if (!(parseError instanceof SyntaxError)) throw parseError; }
  }
  throw error;
};

export async function exportJournal(params: ExportJournalParams): Promise<DownloadResult> {
  const { archived, ...filters } = params;
  try {
    const response = await api.get<Blob>('/lab-journals/entries/export', { params: queryParams({ ...filters, includeArchived: archived } as ExportJournalParams), responseType: 'blob' });
    await ensureSpreadsheet(response.data);
    return { blob: response.data, fileName: getContentDispositionFileName(response.headers['content-disposition']) || 'lab-journal.xlsx' };
  } catch (error) { return rethrowBlobError(error); }
}

export async function downloadTemplate(journalType: LabJournalType): Promise<DownloadResult> {
  try {
    const response = await api.get<Blob>(`/lab-journals/templates/${journalType}`, { responseType: 'blob' });
    await ensureSpreadsheet(response.data);
    return { blob: response.data, fileName: getContentDispositionFileName(response.headers['content-disposition']) || `${journalType.toLowerCase()}-template.xlsx` };
  } catch (error) { return rethrowBlobError(error); }
}

export const labJournalService = { getTypes: getJournalTypesResult, getEntries, getEntry, createEntry, updateEntry, archiveEntry, restoreEntry, exportJournal, downloadTemplate };

/** Transitional names retained for callers while the old service surface is removed. */
export const getLabJournalTypes = getJournalTypes;
export const getLabJournalEntries = getEntries;
export const createLabJournalEntry = createEntry;
export const updateLabJournalEntry = updateEntry;
export const deleteEntry = archiveEntry;
export const deleteLabJournalEntry = archiveEntry;
export const downloadExcel = exportJournal;
export const exportLabJournalExcel = exportJournal;
