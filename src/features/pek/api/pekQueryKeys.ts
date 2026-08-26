import type {
  PekDashboardFilters,
  PekProgramFilters,
  PekReportCreationParams,
  PekReportFilters,
  PekReportDocumentKind,
} from './pekContracts';

export type PekUserScope = string | number | null | undefined;
const userScope = (userId: PekUserScope) => `user:${String(userId ?? 'anonymous')}`;
const companyScope = (companyId?: string | number | null) => String(companyId ?? 'current-company');

export const pekKeys = {
  all: ['pek'] as const,
  root: ['pek'] as const,
  dashboardRoot: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'dashboard', companyScope(companyId)] as const,
  dashboard: (filters: PekDashboardFilters = {}, userId?: PekUserScope) => [...pekKeys.dashboardRoot(filters.companyId, userId), filters] as const,
  programsRoot: () => ['pek', 'programs'] as const,
  programList: (filters: PekProgramFilters = {}) => [...pekKeys.programsRoot(), filters.companyId ?? 'current-company', filters] as const,
  programDetail: (companyId: string | number | null | undefined, programId: string | number) => ['pek', 'program', companyId ?? 'current-company', programId] as const,
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
  reportDocuments: (id: string | number, kind?: PekReportDocumentKind, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'documents', kind ?? 'all'] as const,
  reportPackage: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'package'] as const,
  reportSignatures: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'signatures'] as const,
  exceedances: (reportId: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(reportId), 'exceedances'] as const,
  exceedance: (id: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'exceedance', String(id)] as const,
  settings: (companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'settings', companyScope(companyId)] as const,
  creationContext: (params: PekReportCreationParams, userId?: PekUserScope) => ['pek', userScope(userId), 'creation-context', params] as const,
  assignees: (companyId: string | number, roles: string[] = [], userId?: PekUserScope) => ['pek', userScope(userId), 'lookups', 'assignees', companyScope(companyId), roles] as const,
  permits: (objectId: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'permits', 'object', String(objectId)] as const,
  permitHistory: (id: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'permit', String(id), 'history'] as const,
  scope: (userId?: PekUserScope) => ['pek', userScope(userId), 'scope', 'companies'] as const,
  scopeCompany: (companyId: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'scope', 'companies', String(companyId), 'objects'] as const,
  programSection: (programId: string | number, section: string, parentId?: string | number) => ['pek', 'program', String(programId), 'sections', section, parentId ?? 'all'] as const,
  companyStaff: (companyId: string | number, userId?: PekUserScope) => ['pek', userScope(userId), 'company-staff', String(companyId)] as const,
  reportHistory: (id: string | number, companyId?: string | number | null, userId?: PekUserScope) => ['pek', userScope(userId), 'report', companyScope(companyId), String(id), 'history'] as const,
};

export const pekQueryKeys = pekKeys;
