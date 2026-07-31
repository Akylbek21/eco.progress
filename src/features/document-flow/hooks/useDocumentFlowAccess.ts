import { useQuery } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';

export const useDocumentFlowAccess = () => useQuery({
  queryKey: documentFlowKeys.access(),
  queryFn: ({ signal }) => documentFlowApi.access(signal),
  staleTime: 30_000,
  gcTime: 15 * 60_000,
  refetchOnWindowFocus: false,
  retry: false,
});
