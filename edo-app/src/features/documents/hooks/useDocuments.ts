import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { documentKeys } from '../api/documentKeys';
import { documentsApi } from '../api/documentsApi';
import type { DocumentFilters } from '../types';

export const useDashboard = () => useQuery({
  queryKey: documentKeys.dashboard,
  queryFn: ({ signal }) => documentsApi.dashboard(signal),
});

export const useDocumentTypes = () => useQuery({
  queryKey: documentKeys.types,
  queryFn: ({ signal }) => documentsApi.types(signal),
  staleTime: 5 * 60_000,
});

export const useDocuments = (filters: DocumentFilters) => useQuery({
  queryKey: documentKeys.list(filters),
  queryFn: ({ signal }) => documentsApi.list(filters, signal),
  placeholderData: keepPreviousData,
});

export const useDocument = (id: string) => useQuery({
  queryKey: documentKeys.details(id),
  queryFn: ({ signal }) => documentsApi.details(id, signal),
  enabled: Boolean(id),
});
