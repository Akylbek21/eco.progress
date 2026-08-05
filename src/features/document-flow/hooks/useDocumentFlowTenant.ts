import { useAuth } from '../../../contexts/AuthContext';
import { backendResolvedTenantScope } from '../api/documentFlowKeys';

/**
 * The current backend resolves the only membership when organizationId is omitted.
 * Its access DTO exposes no organization id/list, so this is an explicit per-user cache
 * scope, not a fabricated organization identifier.
 */
export const useDocumentFlowTenant = () => {
  const { user } = useAuth();
  return {
    organizationId: undefined,
    tenantScope: user ? backendResolvedTenantScope(user.id) : null,
    organizationResolved: Boolean(user),
  } as const;
};
