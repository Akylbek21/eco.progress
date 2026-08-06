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
const companyScope = (companyId?: string | number | null) => String(companyId ?? 'current-company');

export const pekKeys = {
  all: ['pek'] as const,
  root: ['pek'] as const,
  dashboardRoot: (companyId?: string | number | null) => ['pek', 'dashboard', currentScope(), companyScope(companyId)] as const,
  dashboard: (filters: PekDashboardFilters = {}) => [...pekKeys.dashboardRoot(filters.companyId), filters] as const,
  programsRoot: (companyId?: string | number | null) => ['pek', 'programs', currentScope(), companyScope(companyId)] as const,
  programs: (filters: PekProgramFilters = {}) => [...pekKeys.programsRoot(filters.companyId), filters] as const,
  program: (id: string | number, companyId?: string | number | null) => ['pek', 'program', currentScope(), companyScope(companyId), String(id)] as const,
  programHistory: (id: string | number) => ['pek', 'program-history', currentScope(), String(id)] as const,
  programDocuments: (id: string | number) => ['pek', 'program-documents', currentScope(), String(id)] as const,
  reportsRoot: (companyId?: string | number | null) => ['pek', 'reports', currentScope(), companyScope(companyId)] as const,
  reports: (filters?: Partial<PekReportFilters>) => [...pekKeys.reportsRoot(filters?.companyId), filters || {}] as const,
  report: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id)] as const,
  reportSourcesRoot: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id), 'sources'] as const,
  reportSources: (id: string | number, filters: Record<string, unknown> = {}, companyId?: string | number | null) => [...pekKeys.reportSourcesRoot(id, companyId), filters] as const,
  reportSourcesSummary: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id), 'sources-summary'] as const,
  planFact: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id), 'plan-fact'] as const,
  readiness: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id), 'readiness'] as const,
  history: (id: string | number, companyId?: string | number | null) => ['pek', 'report', currentScope(), companyScope(companyId), String(id), 'history'] as const,
  settings: (companyId?: string | number | null) => ['pek', 'settings', currentScope(), companyScope(companyId)] as const,
  creationContext: (params: PekReportCreationParams) => ['pek', 'creation-context', currentScope(), params] as const,
  assignees: (roles: string[] = []) => ['pek', 'lookups', 'assignees', currentScope(), roles] as const,
  permits: (objectId: string | number) => ['pek', 'lookups', 'permits', currentScope(), String(objectId)] as const,
};

export const pekQueryKeys = pekKeys;
