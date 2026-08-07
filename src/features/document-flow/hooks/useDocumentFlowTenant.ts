import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../contexts/AuthContext';
import { documentFlowApi } from '../api/documentFlowApi';
import { documentFlowKeys } from '../api/documentFlowKeys';
import { useDocumentFlowOrganizationSelection } from '../model/organizationSelection';

export const useDocumentFlowTenant = () => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const storedUserId = useDocumentFlowOrganizationSelection((state) => state.userId);
  const organizationId = useDocumentFlowOrganizationSelection((state) => state.organizationId);
  const initialize = useDocumentFlowOrganizationSelection((state) => state.initialize);
  const select = useDocumentFlowOrganizationSelection((state) => state.select);
  const userId = user ? String(user.id) : null;
  const organizationsQuery = useQuery({
    queryKey: documentFlowKeys.organizations(userId ?? undefined),
    queryFn: ({ signal }) => documentFlowApi.organizations(signal),
    enabled: isAuthenticated && Boolean(user),
    staleTime: 30_000,
    retry: false,
  });

  useEffect(() => {
    if (userId) initialize(userId);
  }, [initialize, userId]);

  useEffect(() => {
    if (!userId || storedUserId !== userId || !organizationsQuery.data) return;
    const organizations = organizationsQuery.data;
    const valid = organizationId !== null && organizations.some((item) => item.id === organizationId);
    if (valid) return;
    select(userId, organizations.length === 1 ? organizations[0].id : null);
  }, [organizationId, organizationsQuery.data, select, storedUserId, userId]);

  const selectOrganization = useCallback((nextOrganizationId: number) => {
    if (!userId || !organizationsQuery.data?.some((item) => item.id === nextOrganizationId)) return;
    const previousOrganizationId = useDocumentFlowOrganizationSelection.getState().organizationId;
    if (previousOrganizationId !== null && previousOrganizationId !== nextOrganizationId) {
      queryClient.removeQueries({ queryKey: [...documentFlowKeys.all, { userId, organizationId: previousOrganizationId }] });
    }
    select(userId, nextOrganizationId);
  }, [organizationsQuery.data, queryClient, select, userId]);

  const organizations = organizationsQuery.data ?? [];
  return {
    organizationId,
    tenantScope: userId && organizationId ? { userId, organizationId } as const : null,
    organizationResolved: Boolean(user && organizationId),
    selectionRequired: organizations.length > 1 && organizationId === null,
    organization: organizations.find((item) => item.id === organizationId) ?? null,
    organizations,
    organizationsQuery,
    selectOrganization,
  };
};
