import { useQuery } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';

export const useDocumentFlowAccess = (organizationId?: number) => useQuery({
  queryKey: documentFlowKeys.access(organizationId),
  queryFn: ({ signal }) => documentFlowApi.access(organizationId, signal),
  staleTime: 30_000,
  gcTime: 15 * 60_000,
  refetchOnWindowFocus: false,
  retry: false,
});
