import type { DocumentFilters } from '../model/types';

export type TenantScope = number;

const stable = (value: object) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== '').sort(([a], [b]) => a.localeCompare(b)),
);

export const documentFlowKeys = {
  all: ['document-flow'] as const,
  organizations: () => [...documentFlowKeys.all, 'organizations'] as const,
  access: (organizationId: TenantScope) => [...documentFlowKeys.all, organizationId, 'access'] as const,
  plans: () => [...documentFlowKeys.all, 'plans'] as const,
  dashboard: (tenantScope: TenantScope) => [...documentFlowKeys.all, tenantScope, 'dashboard'] as const,
  documentLists: (tenantScope: TenantScope) => [...documentFlowKeys.all, tenantScope, 'documents'] as const,
  documents: (tenantScope: TenantScope, filters: DocumentFilters) => [...documentFlowKeys.documentLists(tenantScope), stable(filters)] as const,
  document: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id] as const,
  documentTypes: () => [...documentFlowKeys.all, 'document-types'] as const,
  versions: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'versions'] as const,
  attachments: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'attachments'] as const,
  members: (tenantScope: TenantScope, filters?: object) => [...documentFlowKeys.all, tenantScope, 'members', stable(filters ?? {})] as const,
  memberLists: (tenantScope: TenantScope) => [...documentFlowKeys.all, tenantScope, 'members'] as const,
  counterparties: (tenantScope: TenantScope, filters?: object) => [...documentFlowKeys.all, tenantScope, 'counterparties', stable(filters ?? {})] as const,
  counterpartyLists: (tenantScope: TenantScope) => [...documentFlowKeys.all, tenantScope, 'counterparties'] as const,
  counterparty: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'counterparty', id] as const,
  representatives: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'counterparty', id, 'representatives'] as const,
  signingRoute: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'signing-route'] as const,
  signatures: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'signatures'] as const,
  assignment: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'my-assignment'] as const,
  audit: (tenantScope: TenantScope, id: number, page = 0) => [...documentFlowKeys.all, tenantScope, 'document', id, 'audit', page] as const,
  revocations: (tenantScope: TenantScope, id: number) => [...documentFlowKeys.all, tenantScope, 'document', id, 'revocations'] as const,
  publicSigning: (token: string) => [...documentFlowKeys.all, 'public-signing', token] as const,
  adminPlans: () => [...documentFlowKeys.all, 'admin', 'plans'] as const,
  adminSubscriptions: () => [...documentFlowKeys.all, 'admin', 'subscriptions'] as const,
};
