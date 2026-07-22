import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { getJournalTypesResult } from '../api/labJournalService';
import { labJournalQueryKeys } from './queryKeys';

const retryOnceForServerError = (failureCount: number, error: unknown) => axios.isAxiosError(error) && Number(error.response?.status) >= 500 && failureCount < 1;

export const useJournalTypes = () => useQuery({
  queryKey: labJournalQueryKeys.types(),
  queryFn: ({ signal }) => getJournalTypesResult(signal),
  staleTime: 30 * 60_000,
  retry: retryOnceForServerError,
});
