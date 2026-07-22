import { LAB_JOURNAL_TYPES, type JournalTypeDefinition, type LabJournalType } from '../types/labJournal';
import { LOCAL_JOURNAL_SCHEMAS, JournalSchemaError, validateJournalForm, validateJournalSchema } from '../features/lab-journals/schemas/journalSchemas';

export { LOCAL_JOURNAL_SCHEMAS, JournalSchemaError, validateJournalForm, validateJournalSchema };
export { mapJournalEntryToForm, mapJournalFormToCreateRequest, mapJournalFormToUpdateRequest } from '../features/lab-journals/api/labJournalMappers';

export const normalizeJournalSchema = (raw: unknown): JournalTypeDefinition => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const code = String(source.code || '') as LabJournalType;
  if (!(code in LAB_JOURNAL_TYPES)) throw new JournalSchemaError();
  return {
    code,
    name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : LAB_JOURNAL_TYPES[code].label,
    description: typeof source.description === 'string' ? source.description : LAB_JOURNAL_TYPES[code].description,
    columns: source.columns === undefined ? LOCAL_JOURNAL_SCHEMAS[code] : validateJournalSchema(source.columns),
    schemaSource: source.columns === undefined ? 'local' : 'backend',
  };
};
