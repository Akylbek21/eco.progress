import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import type { JournalEntriesQuery } from '../../../types/labJournal';
import { getEntries } from '../api/labJournalService';
import { labJournalQueryKeys } from './queryKeys';

const retryOnceForServerError = (failureCount: number, error: unknown) => axios.isAxiosError(error) && Number(error.response?.status) >= 500 && failureCount < 1;

export const useJournalEntries = (filters: JournalEntriesQuery, enabled: boolean) => useQuery({
  queryKey: labJournalQueryKeys.entries(filters),
  queryFn: ({ signal }) => getEntries(filters, signal),
  enabled,
  placeholderData: keepPreviousData,
  retry: retryOnceForServerError,
});
