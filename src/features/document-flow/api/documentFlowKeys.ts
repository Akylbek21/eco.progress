import type { DocumentFilters } from '../model/types';

const stable = (value: object) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== '').sort(([a], [b]) => a.localeCompare(b)),
);

export const documentFlowKeys = {
  all: ['document-flow'] as const,
  access: () => [...documentFlowKeys.all, 'access'] as const,
  plans: () => [...documentFlowKeys.all, 'plans'] as const,
  dashboard: (organizationId?: number) => [...documentFlowKeys.all, 'dashboard', organizationId ?? null] as const,
  documents: (filters: DocumentFilters) => [...documentFlowKeys.all, 'documents', stable(filters)] as const,
  document: (id: number, organizationId?: number) => [...documentFlowKeys.all, 'document', id, organizationId ?? null] as const,
  documentTypes: () => [...documentFlowKeys.all, 'document-types'] as const,
  versions: (id: number) => [...documentFlowKeys.all, 'document', id, 'versions'] as const,
  attachments: (id: number) => [...documentFlowKeys.all, 'document', id, 'attachments'] as const,
  counterparties: (filters: object) => [...documentFlowKeys.all, 'counterparties', stable(filters)] as const,
  counterparty: (id: number) => [...documentFlowKeys.all, 'counterparty', id] as const,
  representatives: (id: number) => [...documentFlowKeys.all, 'counterparty', id, 'representatives'] as const,
  signingRoute: (id: number) => [...documentFlowKeys.all, 'document', id, 'signing-route'] as const,
  signatures: (id: number) => [...documentFlowKeys.all, 'document', id, 'signatures'] as const,
  revocations: (id: number) => [...documentFlowKeys.all, 'document', id, 'revocations'] as const,
  publicSigning: (token: string) => [...documentFlowKeys.all, 'public-signing', token] as const,
  adminPlans: () => [...documentFlowKeys.all, 'admin', 'plans'] as const,
  adminSubscriptions: () => [...documentFlowKeys.all, 'admin', 'subscriptions'] as const,
};
