import type {
  PekDashboardFilters,
  PekProgramFilters,
  PekReportCreationParams,
  PekReportFilters,
} from './pekContracts';

const currentScope = () => {
  if (typeof localStorage === 'undefined') return 'anonymous';
  try {
    const user = JSON.parse(localStorage.getItem('eco-progress-user') || '{}') as Record<string, unknown>;
    return `${String(user.id ?? 'anonymous')}:${String(user.companyId ?? user.organizationId ?? 'all')}`;
  } catch {
    return 'anonymous';
  }
};

export const pekKeys = {
  all: ['pek'] as const,
  root: ['pek'] as const,
  dashboard: (filters: PekDashboardFilters = {}) => ['pek', 'dashboard', currentScope(), filters] as const,
  programs: (filters: PekProgramFilters = {}) => ['pek', 'programs', currentScope(), filters] as const,
  program: (id: string | number) => ['pek', 'program', currentScope(), String(id)] as const,
  programHistory: (id: string | number) => ['pek', 'program-history', currentScope(), String(id)] as const,
  programDocuments: (id: string | number) => ['pek', 'program-documents', currentScope(), String(id)] as const,
  reports: (filters?: Partial<PekReportFilters>) => ['pek', 'reports', currentScope(), filters || {}] as const,
  report: (id: string | number) => ['pek', 'report', currentScope(), String(id)] as const,
  reportSourcesRoot: (id: string | number) => ['pek', 'report', currentScope(), String(id), 'sources'] as const,
  reportSources: (id: string | number, filters: Record<string, unknown> = {}) => [...pekKeys.reportSourcesRoot(id), filters] as const,
  reportSourcesSummary: (id: string | number) => ['pek', 'report', currentScope(), String(id), 'sources-summary'] as const,
  planFact: (id: string | number) => ['pek', 'report', currentScope(), String(id), 'plan-fact'] as const,
  readiness: (id: string | number) => ['pek', 'report', currentScope(), String(id), 'readiness'] as const,
  settings: () => ['pek', 'settings', currentScope()] as const,
  creationContext: (params: PekReportCreationParams) => ['pek', 'creation-context', currentScope(), params] as const,
  assignees: (roles: string[] = []) => ['pek', 'lookups', 'assignees', currentScope(), roles] as const,
  permits: (objectId: string | number) => ['pek', 'lookups', 'permits', currentScope(), String(objectId)] as const,
};

export const pekQueryKeys = pekKeys;
