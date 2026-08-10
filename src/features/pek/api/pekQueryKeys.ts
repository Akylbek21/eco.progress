import type {
  PekDashboardFilters,
  PekProgramFilters,
  PekReportCreationParams,
  PekReportFilters,
} from './pekContracts';

export type PekUserScope = string | number | null | undefined;
const userScope = (userId: PekUserScope) => `user:${String(userId ?? 'anonymous')}`;
const companyScope = (companyId?: string | number | null) => String(companyId ?? 'current-company');

export const pekKeys = {
  all: ['pek'] as const,
  root: ['pek'] as const,
  dashboardRoot: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'dashboard', companyScope(companyId)] as const,
  dashboard: (filters: PekDashboardFilters = {}, userId?: PekUserScope) => [...pekKeys.dashboardRoot(filters.companyId, userId), filters] as const,
  programsRoot: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'programs', companyScope(companyId)] as const,
  programs: (filters: PekProgramFilters = {}, userId?: PekUserScope) => [...pekKeys.programsRoot(filters.companyId, userId), filters] as const,
  program: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'program', companyScope(companyId), String(id)] as const,
  programHistory: (id: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'program-history', String(id)] as const,
  programDocuments: (id: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'program-documents', String(id)] as const,
  reportsRoot: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'reports', companyScope(companyId)] as const,
  reports: (filters?: Partial<PekReportFilters>, userId?: PekUserScope) => [...pekKeys.reportsRoot(filters?.companyId, userId), filters || {}] as const,
  report: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id)] as const,
  reportSourcesRoot: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'sources'] as const,
  reportSources: (id: string | number, filters: Record<string, unknown> = {}, companyId?: string | number | null, userId?: PekUserScope) => [...pekKeys.reportSourcesRoot(id, companyId, userId), filters] as const,
  reportSourcesSummary: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'sources-summary'] as const,
  planFact: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'plan-fact'] as const,
  readiness: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'readiness'] as const,
  settings: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'settings', companyScope(companyId)] as const,
  creationContext: (params: PekReportCreationParams, userId?: PekUserScope) => ['pek', userScope(userId), 'creation-context', params] as const,
  assignees: (roles: string[] = [], userId?: PekUserScope) => ['pek', userScope(userId), 'lookups', 'assignees', roles] as const,
  permits: (objectId: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'lookups', 'permits', String(objectId)] as const,
};

export const pekQueryKeys = pekKeys;
