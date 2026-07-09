import api, { type ApiResponse } from './api';
import { extractItem, extractList, getContentDispositionFileName } from './apiHelpers';
import {
  JOURNAL_TYPES,
  JournalType,
  type ExportLabJournalParams,
  type JournalColumn,
  type JournalKind,
  type JournalTypeDefinition,
  type LabJournalEntry,
  type LabJournalEntryData,
  type LabJournalPage,
  type LabJournalQuery,
  type SaveLabJournalEntryPayload,
} from '../types/labJournal';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const STORAGE_KEY = 'eco-progress-lab-journals-v2';

type UnknownRecord = Record<string, unknown>;
type DownloadResult = { blob: Blob; fileName: string };

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};

const text = (value: unknown) => value === undefined || value === null ? '' : String(value);

const numberOrUndefined = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const normalizeText = (value: unknown) => text(value).trim().toLowerCase();

const inferKind = (code: unknown, title: unknown): JournalKind => {
  const value = `${normalizeText(code)} ${normalizeText(title)}`;
  if (/solution|preparation|reagent_preparation|приготов/.test(value)) return 'solution';
  if (/chemical|reagent|reactive|веществ|реактив|хим/.test(value)) return 'chemical';
  if (/environment|condition|humidity|temperature|услов|сред|температур|влаж/.test(value)) return 'environment';
  if (/sample|sampling|проб/.test(value)) return 'sample';
  if (/result|test|protocol|испыт|результ|протокол/.test(value)) return 'results';
  return 'custom';
};

const fallbackFor = (code: unknown, title: unknown) => {
  const kind = inferKind(code, title);
  return JOURNAL_TYPES.find((item) => item.kind === kind) || JOURNAL_TYPES.find((item) => item.code === text(code));
};

const normalizeColumn = (raw: unknown): JournalColumn => {
  const source = asRecord(raw);
  const type = text(source.type || source.fieldType);
  return {
    key: text(source.key || source.field || source.name),
    title: text(source.title || source.label || source.displayName || source.name),
    type: type === 'number' || type === 'date' || type === 'time' || type === 'textarea' ? type : 'text',
    required: source.required === true,
    readOnly: source.readOnly === true || source.readonly === true,
  };
};

const normalizeType = (raw: unknown): JournalTypeDefinition | null => {
  if (typeof raw === 'string') {
    const fallback = fallbackFor(raw, raw);
    return {
      code: raw,
      title: fallback?.title || raw,
      displayName: fallback?.title || raw,
      kind: fallback?.kind || inferKind(raw, raw),
      columns: fallback?.columns || [],
    };
  }

  const source = asRecord(raw);
  const code = text(source.code || source.value || source.journalType || source.type || source.name).trim();
  const title = text(source.displayName || source.title || source.label || source.name).trim();
  if (!code && !title) return null;

  const fallback = fallbackFor(code, title);
  const columns = extractList(source, ['columns', 'fields'])
    .map(normalizeColumn)
    .filter((column) => column.key && column.title);

  return {
    code: code || fallback?.code || title,
    title: title || fallback?.title || code,
    displayName: title || fallback?.displayName || fallback?.title || code,
    kind: fallback?.kind || inferKind(code, title),
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
  const laboratory = asRecord(source.laboratory);
  const createdBy = asRecord(source.createdBy || source.createdByUser || source.creator || source.user);
  const data = parseData(source.fields ?? source.data);
  const rowNumber = numberOrUndefined(source.rowNumber ?? source.row_number ?? data.rowNumber);
  if (rowNumber !== undefined) data.rowNumber = rowNumber;

  return {
    id: text(source.id),
    journalType: text(source.journalType || source.journal_type || source.type),
    rowNumber,
    entryDate: text(source.entryDate || source.entry_date || source.preparationDate || source.preparation_date || source.date || data.date || data.preparationDate || data.preparedDate || data.samplingDate),
    data,
    laboratoryId: source.laboratoryId as string | number | null | undefined ?? laboratory.id as string | number | null | undefined,
    laboratoryName: text(source.laboratoryName || laboratory.name || laboratory.laboratoryName),
    createdBy: source.createdById as string | number | null | undefined ?? createdBy.id as string | number | null | undefined,
    createdByName: text(source.createdByName || source.creatorName || createdBy.name || createdBy.fullName || source.createdBy),
    createdAt: text(source.createdAt || source.created_at),
    updatedAt: text(source.updatedAt || source.updated_at),
  };
};

const unwrapPayload = (input: unknown): unknown => {
  const response = asRecord(input);
  const data = response.data;
  const nested = asRecord(data);
  if ('content' in nested || 'items' in nested || 'entries' in nested) return data;
  if ('data' in nested) return nested.data;
  return data ?? input;
};

const normalizePage = (raw: unknown, fallbackPage: number, fallbackSize: number): LabJournalPage => {
  const payload = asRecord(unwrapPayload(raw));
  const content = extractList(payload, ['content', 'entries', 'items']).map(normalizeEntry);
  const totalElements = numberOrUndefined(payload.totalElements ?? payload.total ?? payload.totalCount) ?? content.length;
  const totalPages = numberOrUndefined(payload.totalPages) ?? Math.max(1, Math.ceil(totalElements / fallbackSize));

  return {
    content,
    totalElements,
    totalPages,
    number: numberOrUndefined(payload.number ?? payload.page) ?? fallbackPage,
    size: numberOrUndefined(payload.size) ?? fallbackSize,
  };
};

const readMocks = (): LabJournalEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LabJournalEntry[];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  return [];
};

const writeMocks = (items: LabJournalEntry[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
const delay = () => new Promise((resolve) => window.setTimeout(resolve, 250));

const toQueryParams = (params: LabJournalQuery | ExportLabJournalParams) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );

const firstDateFromData = (data: LabJournalEntryData) =>
  text(data.date || data.preparationDate || data.preparedDate || data.samplingDate || data.entryDate || data.registrationDate);

const inferEntryDate = (payload: SaveLabJournalEntryPayload) =>
  payload.preparationDate || payload.entryDate || firstDateFromData(payload.data) || new Date().toISOString().slice(0, 10);

const isReagentPreparationJournal = (journalType: JournalType) =>
  text(journalType).trim().toUpperCase() === 'REAGENT_PREPARATION';

const toApiSavePayload = (payload: SaveLabJournalEntryPayload) => {
  const entryDate = inferEntryDate(payload);
  const data = { ...payload.data };
  const base = {
    journalType: payload.journalType,
    data,
    laboratoryId: payload.laboratoryId || undefined,
  };

  if (isReagentPreparationJournal(payload.journalType)) {
    return {
      ...base,
      fields: data,
      preparationDate: payload.preparationDate || entryDate,
    };
  }

  return {
    ...base,
    entryDate,
  };
};

const nextRowNumber = (journalType: JournalType, items: LabJournalEntry[]) =>
  items.filter((item) => item.journalType === journalType).reduce((max, item) => Math.max(max, item.rowNumber || 0), 0) + 1;

const filterMockEntries = (query: LabJournalQuery) => {
  const search = text(query.search).toLowerCase().trim();
  return readMocks()
    .filter((item) => !query.journalType || item.journalType === query.journalType)
    .filter((item) => !query.laboratoryId || text(item.laboratoryId) === text(query.laboratoryId))
    .filter((item) => !query.dateFrom || text(item.entryDate) >= query.dateFrom!)
    .filter((item) => !query.dateTo || text(item.entryDate) <= query.dateTo!)
    .filter((item) => !search || JSON.stringify(item.data).toLowerCase().includes(search));
};

const tableToExcelBlob = (definition: JournalTypeDefinition, rows: LabJournalEntry[], title: string) => {
  const escape = (value: unknown) => text(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const columns = definition.columns.length ? definition.columns : JOURNAL_TYPES[0].columns;
  const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body><table border="1"><tr><th colspan="${columns.length}">${escape(title)}</th></tr><tr>${columns.map((column) => `<th>${escape(column.title)}</th>`).join('')}</tr>${rows.map((row) => `<tr>${columns.map((column) => `<td>${escape(row.data[column.key] ?? '')}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  return new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
};

export async function getJournalTypes(signal?: AbortSignal): Promise<JournalTypeDefinition[]> {
  if (useMocks) return JOURNAL_TYPES;
  const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/types', { signal });
  const items = extractList(response, ['types', 'journals', 'journalTypes']).map(normalizeType).filter(Boolean) as JournalTypeDefinition[];
  return items.length ? items : JOURNAL_TYPES;
}

export async function getEntries(params: LabJournalQuery): Promise<LabJournalPage> {
  const page = params.page ?? 0;
  const size = params.size ?? 50;

  if (useMocks) {
    await delay();
    const filtered = filterMockEntries(params);
    const start = page * size;
    return {
      content: filtered.slice(start, start + size),
      totalElements: filtered.length,
      totalPages: Math.max(1, Math.ceil(filtered.length / size)),
      number: page,
      size,
    };
  }

  const response = await api.get<ApiResponse<unknown> | unknown>('/lab-journals/entries', {
    params: toQueryParams({ ...params, page, size }),
  });
  return normalizePage(response, page, size);
}

export async function createEntry(payload: SaveLabJournalEntryPayload): Promise<LabJournalEntry> {
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
      createdByName: 'Лаборатория',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    writeMocks([entry, ...items]);
    return entry;
  }

  const response = await api.post<ApiResponse<unknown> | unknown>('/lab-journals/entries', toApiSavePayload(payload));
  return normalizeEntry(extractItem(response, ['entry', 'item']));
}

export async function updateEntry(id: string | number, payload: SaveLabJournalEntryPayload): Promise<LabJournalEntry> {
  if (useMocks) {
    await delay();
    const items = readMocks();
    const index = items.findIndex((item) => text(item.id) === text(id));
    if (index < 0) throw new Error('Запись журнала не найдена.');
    const rowNumber = items[index].rowNumber;
    const entry: LabJournalEntry = {
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

  const response = await api.put<ApiResponse<unknown> | unknown>(`/lab-journals/entries/${id}`, toApiSavePayload(payload));
  return normalizeEntry(extractItem(response, ['entry', 'item']));
}

export async function deleteEntry(id: string | number): Promise<void> {
  if (useMocks) {
    await delay();
    writeMocks(readMocks().filter((item) => text(item.id) !== text(id)));
    return;
  }
  await api.delete(`/lab-journals/entries/${id}`);
}

export async function downloadExcel(params: ExportLabJournalParams): Promise<DownloadResult> {
  if (useMocks) {
    await delay();
    const definition = JOURNAL_TYPES.find((item) => item.code === params.journalType) || JOURNAL_TYPES[0];
    const rows = filterMockEntries({ ...params, page: 0, size: 100000 });
    return {
      blob: tableToExcelBlob(definition, rows, definition.title),
      fileName: `lab-journal-${text(params.journalType || 'entries').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xls`,
    };
  }

  const response = await api.get('/lab-journals/entries/export', {
    params: toQueryParams(params),
    responseType: 'blob',
  });
  return {
    blob: response.data as Blob,
    fileName: getContentDispositionFileName(response.headers['content-disposition']) || 'lab-journal.xlsx',
  };
}

export async function downloadTemplate(params: ExportLabJournalParams): Promise<DownloadResult> {
  if (useMocks) {
    await delay();
    const definition = JOURNAL_TYPES.find((item) => item.code === params.journalType) || JOURNAL_TYPES[0];
    return {
      blob: tableToExcelBlob(definition, [], `${definition.title}. Шаблон`),
      fileName: `lab-journal-${text(params.journalType || 'template').toLowerCase()}-template.xls`,
    };
  }

  const response = await api.get('/lab-journals/entries/export-template', {
    params: toQueryParams(params),
    responseType: 'blob',
  });
  return {
    blob: response.data as Blob,
    fileName: getContentDispositionFileName(response.headers['content-disposition']) || 'lab-journal-template.xlsx',
  };
}

export const getLabJournalTypes = getJournalTypes;
export const getLabJournalEntries = getEntries;
export const createLabJournalEntry = createEntry;
export const updateLabJournalEntry = updateEntry;
export const deleteLabJournalEntry = deleteEntry;

export async function exportLabJournalExcel(params: ExportLabJournalParams & { template?: boolean }): Promise<DownloadResult> {
  const { template: _template, ...query } = params;
  return params.template ? downloadTemplate(query) : downloadExcel(query);
}
