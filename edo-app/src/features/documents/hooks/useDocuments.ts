import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { documentKeys } from '../api/documentKeys';
import { documentsApi } from '../api/documentsApi';
import type { DocumentFilters } from '../types';
import { useAuthStore } from '../../../shared/auth/authStore';

export const useDashboard = () => {
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  return useQuery({
    queryKey: documentKeys.dashboard(organizationId),
    queryFn: ({ signal }) => documentsApi.dashboard(signal),
    enabled: Boolean(organizationId),
  });
};

export const useDocumentTypes = () => {
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  return useQuery({
    queryKey: documentKeys.types(organizationId),
    queryFn: ({ signal }) => documentsApi.types(signal),
    enabled: Boolean(organizationId),
    staleTime: 5 * 60_000,
  });
};

export const useDocuments = (filters: DocumentFilters) => {
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  return useQuery({
    queryKey: documentKeys.list(organizationId, filters),
    queryFn: ({ signal }) => documentsApi.list(filters, signal),
    enabled: Boolean(organizationId),
    placeholderData: keepPreviousData,
  });
};

export const useDocument = (id: string) => {
  const organizationId = useAuthStore((state) => state.activeOrganizationId);
  return useQuery({
    queryKey: documentKeys.details(organizationId, id),
    queryFn: ({ signal }) => documentsApi.details(id, signal),
    enabled: Boolean(organizationId && id),
  });
};
