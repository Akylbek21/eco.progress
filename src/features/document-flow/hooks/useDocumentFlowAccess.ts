import { useQuery } from '@tanstack/react-query';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowTenant } from './useDocumentFlowTenant';

export const useDocumentFlowAccess = () => {
  const tenant = useDocumentFlowTenant();
  return useQuery({
    queryKey: tenant.tenantScope ? documentFlowKeys.access(tenant.tenantScope) : ['document-flow', 'tenant-unresolved'],
    queryFn: ({ signal }) => documentFlowApi.access(tenant.organizationId!, signal),
    enabled: tenant.organizationResolved,
    staleTime: 30_000,
    gcTime: 15 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
};
