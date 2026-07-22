import type { JournalEntriesQuery } from '../../../types/labJournal';

export const labJournalQueryKeys = {
  all: ['lab-journals'] as const,
  types: () => [...labJournalQueryKeys.all, 'types'] as const,
  entries: (filters: JournalEntriesQuery) => [...labJournalQueryKeys.all, 'entries', filters] as const,
  entry: (id: number) => [...labJournalQueryKeys.all, 'entry', id] as const,
};
