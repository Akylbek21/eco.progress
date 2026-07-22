export type {
  CreateLabJournalEntryRequest,
  ExportJournalParams,
  JournalColumnDefinition,
  JournalEntriesQuery,
  JournalTypesResult,
  LabJournalEntry,
  LabJournalFormValues,
  LabJournalType,
  LabJournalTypeDto,
  PageResponse,
  UpdateLabJournalEntryRequest,
} from '../../../types/labJournal';

export const journalCapabilities = {
  getById: false,
  archive: false,
  restore: false,
  delete: true,
  exportTemplate: true,
} as const;
