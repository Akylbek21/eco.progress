import type { DocumentFilters } from '../types';

const normalize = (filters: DocumentFilters) =>
  Object.fromEntries(Object.entries(filters).sort(([left], [right]) => left.localeCompare(right)));

export const documentKeys = {
  all: (organizationId?: string) => ['organization', organizationId, 'documents'] as const,
  dashboard: (organizationId?: string) => ['organization', organizationId, 'documents', 'dashboard'] as const,
  types: (organizationId?: string) => ['organization', organizationId, 'documents', 'types'] as const,
  list: (organizationId: string | undefined, filters: DocumentFilters) =>
    ['organization', organizationId, 'documents', 'list', normalize(filters)] as const,
  details: (organizationId: string | undefined, id: string) =>
    ['organization', organizationId, 'documents', 'details', id] as const,
};
