import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateLabJournalEntryRequest, UpdateLabJournalEntryRequest } from '../../../types/labJournal';
import { createEntry, deleteJournalEntry, updateEntry } from '../api/labJournalService';
import { labJournalQueryKeys } from './queryKeys';

export const useJournalEntryMutations = () => {
  const queryClient = useQueryClient();
  const refreshEntries = () => queryClient.invalidateQueries({ queryKey: [...labJournalQueryKeys.all, 'entries'] });
  const createMutation = useMutation({ mutationFn: (payload: CreateLabJournalEntryRequest) => createEntry(payload), onSuccess: refreshEntries });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateLabJournalEntryRequest }) => updateEntry(id, payload),
    onSuccess: (entry) => { queryClient.setQueryData(labJournalQueryKeys.entry(entry.id), entry); void refreshEntries(); },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: (_, id) => { queryClient.removeQueries({ queryKey: labJournalQueryKeys.entry(id) }); void refreshEntries(); },
  });
  return { createMutation, updateMutation, deleteMutation };
};
