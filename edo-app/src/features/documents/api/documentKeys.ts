import type { DocumentFilters } from '../types';

const normalize = (filters: DocumentFilters) =>
  Object.fromEntries(Object.entries(filters).sort(([left], [right]) => left.localeCompare(right)));

export const documentKeys = {
  all: ['documents'] as const,
  dashboard: ['documents', 'dashboard'] as const,
  types: ['documents', 'types'] as const,
  list: (filters: DocumentFilters) => ['documents', 'list', normalize(filters)] as const,
  details: (id: string) => ['documents', 'details', id] as const,
};
