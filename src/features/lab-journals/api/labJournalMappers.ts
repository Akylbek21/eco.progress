import {
  JournalType,
  type CreateLabJournalEntryRequest,
  type LabJournalEntry,
  type LabJournalFormValues,
  type LabJournalType,
  type PageResponse,
  type UpdateLabJournalEntryRequest,
} from '../../../types/labJournal';

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const record = (value: unknown): UnknownRecord => isRecord(value) ? value : {};
const numeric = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const text = (value: unknown) => value === undefined || value === null ? '' : String(value);
const nullableText = (value: unknown): string | null => text(value).trim() || null;

const unwrapData = (value: unknown): unknown => {
  let current = value;
  for (let index = 0; index < 3; index += 1) {
    const source = record(current);
    if ('id' in source || 'journalType' in source || 'content' in source || 'items' in source || 'records' in source) break;
    if (!('data' in source)) break;
    current = source.data;
  }
  return current;
};

const normalizeDynamicFields = (source: UnknownRecord) => {
  const data = record(source.data);
  const fields = record(source.fields);
  const legacy = record(source.values);
  return { data: Object.keys(data).length ? data : Object.keys(fields).length ? fields : legacy, fields: Object.keys(fields).length ? fields : Object.keys(data).length ? data : legacy };
};

export function mapJournalEntryDtoToModel(dto: unknown): LabJournalEntry {
  const source = record(unwrapData(dto));
  const laboratory = record(source.laboratory);
  const creator = record(source.createdBy);
  const updater = record(source.updatedBy);
  const dynamic = normalizeDynamicFields(source);
  return {
    id: numeric(source.id),
    version: source.version === undefined || source.version === null ? undefined : numeric(source.version),
    journalType: text(source.journalType || source.type) as LabJournalType,
    laboratoryId: numeric(source.laboratoryId ?? laboratory.id),
    laboratoryName: text(source.laboratoryName ?? laboratory.name).trim() || undefined,
    entryDate: text(source.entryDate ?? source.registrationDate ?? source.preparationDate).slice(0, 10),
    registrationDate: nullableText(source.registrationDate),
    preparationDate: nullableText(source.preparationDate),
    executorName: nullableText(source.executorName ?? source.executor),
    note: nullableText(source.note ?? source.notes),
    data: dynamic.data,
    fields: dynamic.fields,
    createdAt: text(source.createdAt).trim() || undefined,
    updatedAt: text(source.updatedAt).trim() || undefined,
    createdBy: text(source.createdByName ?? creator.fullName ?? creator.name ?? source.createdBy).trim() || undefined,
    updatedBy: text(source.updatedByName ?? updater.fullName ?? updater.name ?? source.updatedBy).trim() || undefined,
  };
}

export function mapJournalEntryToForm(entry: LabJournalEntry): LabJournalFormValues {
  return {
    id: entry.id,
    version: entry.version,
    journalType: entry.journalType,
    laboratoryId: entry.laboratoryId,
    entryDate: entry.entryDate.slice(0, 10),
    registrationDate: entry.registrationDate?.slice(0, 10) || '',
    preparationDate: entry.preparationDate?.slice(0, 10) || '',
    executorName: entry.executorName || '',
    note: entry.note || '',
    dynamicFields: { ...entry.data, ...entry.fields },
  };
}

const convertDynamicValues = (values: Record<string, unknown>) => Object.fromEntries(
  Object.entries(values).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === '') return [];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? [[key, trimmed]] : [];
    }
    return [[key, value]];
  }),
);

export function mapJournalFormToCreateRequest(values: LabJournalFormValues): CreateLabJournalEntryRequest {
  if (!values.journalType || !values.laboratoryId || !values.entryDate) throw new Error('Не заполнены обязательные поля записи журнала');
  const dynamicFields = convertDynamicValues(values.dynamicFields);
  return {
    journalType: values.journalType,
    laboratoryId: values.laboratoryId,
    entryDate: values.entryDate,
    registrationDate: values.registrationDate || null,
    preparationDate: values.preparationDate || null,
    executorName: values.executorName.trim() || null,
    note: values.note.trim() || null,
    data: { ...dynamicFields },
    fields: { ...dynamicFields },
  };
}

export function mapJournalFormToUpdateRequest(values: LabJournalFormValues): UpdateLabJournalEntryRequest {
  return { ...mapJournalFormToCreateRequest(values), ...(values.version === undefined ? {} : { version: values.version }) };
}

const findContainer = (response: unknown): { container: UnknownRecord; rows: unknown[]; directArray: boolean } => {
  const direct = unwrapData(response);
  if (Array.isArray(direct)) return { container: {}, rows: direct, directArray: true };
  const candidates = [response, record(response).data, record(record(response).data).data, direct];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return { container: {}, rows: candidate, directArray: true };
    const source = record(candidate);
    for (const key of ['content', 'items', 'records', 'data']) {
      if (Array.isArray(source[key])) return { container: source, rows: source[key] as unknown[], directArray: false };
    }
  }
  return { container: record(direct), rows: [], directArray: false };
};

export function mapJournalEntriesResponse(response: unknown): PageResponse<LabJournalEntry> {
  const { container, rows, directArray } = findContainer(response);
  const content = rows.map(mapJournalEntryDtoToModel);
  if (directArray) return { content, page: 0, size: content.length, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 };
  const page = numeric(container.page ?? container.number, 0);
  const size = numeric(container.size, content.length);
  const totalElements = container.totalElements === undefined ? content.length : numeric(container.totalElements);
  const totalPages = container.totalPages === undefined ? (size > 0 ? Math.ceil(totalElements / size) : 0) : numeric(container.totalPages);
  return { content, page, size, totalElements, totalPages };
}

export function formatJournalKeyInfo(entry: LabJournalEntry): string {
  const values = { ...entry.data, ...entry.fields };
  const get = (key: string) => text(values[key]).trim();
  const join = (...items: string[]) => items.filter(Boolean).join(' · ') || '—';
  switch (entry.journalType) {
    case JournalType.SAMPLE_REGISTRATION: return join(get('sampleNumber'), get('sampleName'));
    case JournalType.SOLUTION_PREPARATION: return join(get('solutionName'), get('concentration'));
    case JournalType.CHEMICAL_REAGENT_USAGE: return join(get('reagentName'), get('usedQuantity'));
    case JournalType.ENVIRONMENT_CONDITIONS: return join(get('roomName'), get('temperature') && `${get('temperature')} °C`, get('humidity') && `${get('humidity')} %`);
    case JournalType.TEST_RESULTS_REGISTRATION: return join(get('indicatorName'), get('resultValue'));
    default: return '—';
  }
}
