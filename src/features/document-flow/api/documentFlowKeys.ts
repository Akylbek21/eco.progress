import type { DocumentFilters } from '../types';

const stableFilters = (filters: DocumentFilters) => Object.fromEntries(
  Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
);

export const documentFlowKeys = {
  root: ['document-flow'] as const,
  access: () => [...documentFlowKeys.root, 'access'] as const,
  plans: () => [...documentFlowKeys.root, 'plans'] as const,
  subscription: () => [...documentFlowKeys.root, 'subscription'] as const,
  dashboard: () => [...documentFlowKeys.root, 'dashboard'] as const,
  usage: () => [...documentFlowKeys.root, 'usage'] as const,
  documents: (filters: DocumentFilters) => [...documentFlowKeys.root, 'documents', stableFilters(filters)] as const,
  document: (id: string) => [...documentFlowKeys.root, 'document', id] as const,
  route: (id: string) => [...documentFlowKeys.document(id), 'route'] as const,
  signatures: (id: string) => [...documentFlowKeys.document(id), 'signatures'] as const,
  versions: (id: string) => [...documentFlowKeys.document(id), 'versions'] as const,
  resource: (resource: string) => [...documentFlowKeys.root, resource] as const,
  adminSubscriptions: (filters: Record<string, unknown>) => [...documentFlowKeys.root, 'admin', 'subscriptions', filters] as const,
};

