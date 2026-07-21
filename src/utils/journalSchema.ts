import { JOURNAL_SCHEMA_VERSION, JOURNAL_TYPES, type JournalColumn, type JournalColumnType, type JournalEntryPayload, type JournalTypeDefinition, type JournalValues, type LabJournalType } from '../types/labJournal';

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const supportedTypes = new Set<JournalColumnType>(['text', 'textarea', 'number', 'date', 'time', 'datetime', 'select', 'boolean', 'employee', 'laboratory', 'measurement_device', 'company', 'company_object', 'protocol', 'calculated']);
const journalCodes = new Set(JOURNAL_TYPES.map((item) => item.code));

export class JournalSchemaError extends Error { constructor() { super('Схема журнала настроена некорректно'); this.name = 'JournalSchemaError'; } }

export const normalizeJournalSchema = (raw: unknown): JournalTypeDefinition => {
  const source = record(raw);
  const code = String(source.code || '').trim() as LabJournalType;
  const title = String(source.title || source.displayName || '').trim();
  const schemaVersion = source.schemaVersion === undefined ? undefined : Number(source.schemaVersion);
  if (!journalCodes.has(code) || !title || !Array.isArray(source.columns) || (schemaVersion !== undefined && schemaVersion !== JOURNAL_SCHEMA_VERSION)) throw new JournalSchemaError();
  const keys = new Set<string>();
  const columns = source.columns.map((item): JournalColumn => {
    const columnSource = record(item);
    const key = String(columnSource.key || '').trim();
    const columnTitle = String(columnSource.title || '').trim();
    const type = String(columnSource.type || '') as JournalColumnType;
    if (!key || !columnTitle || !supportedTypes.has(type) || !Object.prototype.hasOwnProperty.call(columnSource, 'required') || typeof columnSource.required !== 'boolean' || keys.has(key)) throw new JournalSchemaError();
    keys.add(key);
    return { key, title: columnTitle, type, required: columnSource.required, readOnly: columnSource.readOnly === true, searchable: columnSource.searchable === true, sortable: columnSource.sortable === true, width: typeof columnSource.width === 'number' ? columnSource.width : undefined, options: Array.isArray(columnSource.options) ? columnSource.options.map((option) => ({ value: String(record(option).value ?? ''), label: String(record(option).label ?? '') })).filter((option) => option.value && option.label) : undefined, validation: record(columnSource.validation) as JournalColumn['validation'] };
  });
  return { code, title, description: typeof source.description === 'string' ? source.description : undefined, schemaVersion, columns };
};

const convert = (column: JournalColumn, value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (column.type === 'number') { const numeric = Number(String(value).replace(',', '.')); return Number.isFinite(numeric) ? numeric : value; }
  if (column.type === 'boolean') return value === true || value === 'true';
  if (column.type === 'datetime') { const date = new Date(String(value)); return Number.isNaN(date.getTime()) ? value : date.toISOString(); }
  if (typeof value === 'string') return value.trim();
  return value;
};

export const buildJournalEntryPayload = (definition: JournalTypeDefinition, laboratoryId: number, values: JournalValues, version?: number): JournalEntryPayload => {
  const allowed = definition.columns.reduce<JournalValues>((payload, column) => {
    if (column.readOnly || column.type === 'calculated') return payload;
    const value = convert(column, values[column.key]);
    if (value !== undefined) payload[column.key] = value;
    return payload;
  }, {});
  return { journalType: definition.code, laboratoryId, values: allowed, ...(version === undefined ? {} : { version }) };
};

