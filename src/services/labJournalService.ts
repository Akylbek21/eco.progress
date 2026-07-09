import api, { type ApiResponse } from './api';
import { extractItem, extractList, getApiStatus, getContentDispositionFileName } from './apiHelpers';
import {
  JOURNAL_TYPES,
  JournalType,
  type ExportLabJournalParams,
  type JournalColumn,
  type JournalTypeDefinition,
  type LabJournalEntry,
  type LabJournalEntryData,
  type LabJournalPage,
  type LabJournalQuery,
  type SaveLabJournalEntryPayload,
} from '../types/labJournal';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const STORAGE_KEY = 'eco-progress-lab-journals-v1';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value);
const numberOrUndefined = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const unwrapPayload = (input: unknown): unknown => {
  const response = asRecord(input);
  const data = response.data;
  const nested = asRecord(data);
  if ('content' in nested || 'data' in nested) return nested.data && !Array.isArray(nested.data) ? nested.data : data;
  return data ?? input;
};

const normalizeColumn = (raw: unknown): JournalColumn => {
  const source = asRecord(raw);
  const type = text(source.type);
  return {
    key: text(source.key),
    title: text(source.title || source.label || source.name),
    type: type === 'number' || type === 'date' ? type : 'text',
  };
};

const normalizeType = (raw: unknown): JournalTypeDefinition | null => {
  const source = asRecord(raw);
  const code = text(source.code || source.journalType || source.type) as JournalType;
  if (!Object.values(JournalType).includes(code)) return null;
  const fallback = JOURNAL_TYPES.find((item) => item.code === code);
  const columns = extractList(source, ['columns']).map(normalizeColumn).filter((column) => column.key && column.title);
  return {
    code,
    title: text(source.title || source.name) || fallback?.title || code,
    columns: columns.length ? columns : fallback?.columns || [],
  };
};

const parseData = (value: unknown): LabJournalEntryData => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return asRecord(parsed) as LabJournalEntryData;
    } catch {
      return {};
    }
  }
  return asRecord(value) as LabJournalEntryData;
};

const normalizeEntry = (raw: unknown): LabJournalEntry => {
  const source = asRecord(raw);
  const data = parseData(source.data);
  const rowNumber = numberOrUndefined(source.rowNumber ?? source.row_number ?? data.rowNumber);
  if (rowNumber !== undefined) data.rowNumber = rowNumber;
  return {
    id: text(source.id),
    journalType: text(source.journalType || source.journal_type) as JournalType,
    rowNumber,
    entryDate: text(source.entryDate || source.entry_date),
    data,
    laboratoryId: source.laboratoryId as string | number | null | undefined,
    createdAt: text(source.createdAt || source.created_at),
    updatedAt: text(source.updatedAt || source.updated_at),
  };
};

const normalizePage = (raw: unknown, fallbackPage: number, fallbackSize: number): LabJournalPage => {
  const payload = asRecord(unwrapPayload(raw));
  const content = extractList(payload, ['content', 'entries', 'items']).map(normalizeEntry);
  const totalElements = numberOrUndefined(payload.totalElements) ?? content.length;
  const totalPages = numberOrUndefined(payload.totalPages) ?? Math.max(1, Math.ceil(totalElements / fallbackSize));
  return {
    content,
    totalElements,
    totalPages,
    number: numberOrUndefined(payload.number) ?? fallbackPage,
    size: numberOrUndefined(payload.size) ?? fallbackSize,
  };
};

const readMocks = (): LabJournalEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LabJournalEntry[];
  } catch {
    // Broken demo data is replaced with an empty journal.
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  return [];
};

const writeMocks = (items: LabJournalEntry[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
const delay = () => new Promise((resolve) => window.setTimeout(resolve, 250));

const inferEntryDate = (payload: SaveLabJournalEntryPayload) => {
  const definition = JOURNAL_TYPES.find((item) => item.code === payload.journalType);
  const dateColumn = definition?.columns.find((column) => column.type === 'date' && column.key !== 'rowNumber');
  return payload.entryDate || text(dateColumn ? payload.data[dateColumn.key] : '') || new Date().toISOString().slice(0, 10);
};

const nextRowNumber = (journalType: JournalType, items: LabJournalEntry[]) =>
  items.filter((item) => item.journalType === journalType).reduce((max, item) => Math.max(max, item.rowNumber || 0), 0) + 1;

const filterMockEntries = (query: LabJournalQuery) => {
  const search = text(query.search).toLowerCase().trim();
  return readMocks()
    .filter((item) => item.journalType === query.journalType)
    .filter((item) => !query.laboratoryId || text(item.laboratoryId) === text(query.laboratoryId))
    .filter((item) => !query.dateFrom || text(item.entryDate) >= query.dateFrom!)
    .filter((item) => !query.dateTo || text(item.entryDate) <= query.dateTo!)
    .filter((item) => !search || JSON.stringify(item.data).toLowerCase().includes(search));
};

const tableToExcelBlob = (definition: JournalTypeDefinition, rows: LabJournalEntry[], title: string) => {
  const escape = (value: unknown) => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><tr><th colspan="${definition.columns.length}">${escape(title)}</th></tr><tr>${definition.columns.map((column) => `<th>${escape(column.title)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${definition.columns.map((column) => `<td>${escape(row.data[column.key] ?? '')}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  return new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
};

export async function getLabJournalTypes(): Promise<JournalTypeDefinition[]> {
  if (useMocks) return JOURNAL_TYPES;
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/types');
    const items = extractList(response, ['types', 'journals']).map(normalizeType).filter(Boolean) as JournalTypeDefinition[];
    return items.length ? items : JOURNAL_TYPES;
  } catch (error) {
    if (getApiStatus(error) === 404) return JOURNAL_TYPES;
    throw error;
  }
}

export async function getLabJournalEntries(query: LabJournalQuery): Promise<LabJournalPage> {
  const page = query.page ?? 0;
  const size = query.size ?? 50;
  if (useMocks) {
    await delay();
    const filtered = filterMockEntries(query);
    const start = page * size;
    return {
      content: filtered.slice(start, start + size),
      totalElements: filtered.length,
      totalPages: Math.ceil(filtered.length / size),
      number: page,
      size,
    };
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/entries', { params: { ...query, page, size } });
  return normalizePage(response, page, size);
}

export async function createLabJournalEntry(payload: SaveLabJournalEntryPayload): Promise<LabJournalEntry> {
  if (useMocks) {
    await delay();
    const items = readMocks();
    const rowNumber = nextRowNumber(payload.journalType, items);
    const entry: LabJournalEntry = {
      id: `lab-journal-${Date.now()}`,
      journalType: payload.journalType,
      rowNumber,
      entryDate: inferEntryDate(payload),
      data: { ...payload.data, rowNumber },
      laboratoryId: payload.laboratoryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeMocks([entry, ...items]);
    return entry;
  }
  const response = await api.post<ApiResponse<unknown> | unknown>('/lab-journals/entries', payload);
  return normalizeEntry(extractItem(response, ['entry', 'item']));
}

export async function updateLabJournalEntry(id: string, payload: SaveLabJournalEntryPayload): Promise<LabJournalEntry> {
  if (useMocks) {
    await delay();
    const items = readMocks();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Запись журнала не найдена.');
    const rowNumber = items[index].rowNumber;
    const entry = {
      ...items[index],
      ...payload,
      rowNumber,
      entryDate: inferEntryDate(payload),
      data: { ...payload.data, rowNumber: rowNumber ?? payload.data.rowNumber },
      updatedAt: new Date().toISOString(),
    };
    items[index] = entry;
    writeMocks(items);
    return entry;
  }
  const response = await api.put<ApiResponse<unknown> | unknown>(`/lab-journals/entries/${id}`, payload);
  return normalizeEntry(extractItem(response, ['entry', 'item']));
}

export async function deleteLabJournalEntry(id: string): Promise<void> {
  if (useMocks) {
    await delay();
    writeMocks(readMocks().filter((item) => item.id !== id));
    return;
  }
  await api.delete(`/lab-journals/entries/${id}`);
}

export async function exportLabJournalExcel(params: ExportLabJournalParams): Promise<{ blob: Blob; fileName?: string }> {
  if (useMocks) {
    await delay();
    const definition = JOURNAL_TYPES.find((item) => item.code === params.journalType) || JOURNAL_TYPES[0];
    const rows = params.template ? [] : filterMockEntries({ ...params, page: 0, size: 100000 });
    return {
      blob: tableToExcelBlob(definition, rows, params.template ? `${definition.title}. Шаблон` : definition.title),
      fileName: params.template ? `journal_${params.journalType}_template.xls` : `journal_${params.journalType}_${new Date().toISOString().slice(0, 10)}.xls`,
    };
  }
  const endpoint = params.template ? '/lab-journals/entries/export/template' : '/lab-journals/entries/export';
  try {
    const response = await api.get(endpoint, { params, responseType: 'blob' });
    return {
      blob: response.data as Blob,
      fileName: getContentDispositionFileName(response.headers['content-disposition']),
    };
  } catch (error) {
    if (!params.template || getApiStatus(error) !== 404) throw error;
    const response = await api.get('/lab-journals/entries/export', { params: { ...params, template: true }, responseType: 'blob' });
    return {
      blob: response.data as Blob,
      fileName: getContentDispositionFileName(response.headers['content-disposition']),
    };
  }
}
