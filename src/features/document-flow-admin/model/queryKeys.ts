import type { AccessGrantFilters } from './types';

const stable = (value: object) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== '').sort(([a], [b]) => a.localeCompare(b)),
);

export const documentFlowAdminKeys = {
  all: ['admin', 'document-flow-access'] as const,
  list: (filters: AccessGrantFilters) => [...documentFlowAdminKeys.all, 'list', stable(filters)] as const,
  plans: () => [...documentFlowAdminKeys.all, 'plans'] as const,
  organizations: (filters: object) => [...documentFlowAdminKeys.all, 'organizations', stable(filters)] as const,
  organization: (organizationId: number | string) => [...documentFlowAdminKeys.all, 'organization', organizationId] as const,
  access: (organizationId: number | string) => [...documentFlowAdminKeys.all, 'access', organizationId] as const,
  history: (organizationId: number | string, page: number) => [...documentFlowAdminKeys.all, 'history', organizationId, page] as const,
};

