export * from '../features/lab-journals/api/labJournalService';
export { mapJournalEntryDtoToModel, mapJournalEntriesResponse } from '../features/lab-journals/api/labJournalMappers';

export { getJournalTypesResult as getLabJournalTypes } from '../features/lab-journals/api/labJournalService';
export { getEntries as getLabJournalEntries } from '../features/lab-journals/api/labJournalService';
export { createEntry as createLabJournalEntry } from '../features/lab-journals/api/labJournalService';
export { updateEntry as updateLabJournalEntry } from '../features/lab-journals/api/labJournalService';
export { deleteJournalEntry as deleteEntry } from '../features/lab-journals/api/labJournalService';
export { exportJournal as downloadExcel, exportJournal as exportLabJournalExcel } from '../features/lab-journals/api/labJournalService';
