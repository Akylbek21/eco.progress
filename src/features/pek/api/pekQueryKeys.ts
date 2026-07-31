import type {
  PekDashboardFilters,
  PekProgramFilters,
  PekReportCreationParams,
  PekReportFilters,
} from './pekContracts';

export const pekKeys = {
  all: ['pek'] as const,
  root: ['pek'] as const,
  dashboard: (filters: PekDashboardFilters = {}) => ['pek', 'dashboard', filters] as const,
  programs: (filters: PekProgramFilters = {}) => ['pek', 'programs', filters] as const,
  program: (id: string | number) => ['pek', 'program', String(id)] as const,
  programHistory: (id: string | number) => ['pek', 'program-history', String(id)] as const,
  programDocuments: (id: string | number) => ['pek', 'program-documents', String(id)] as const,
  reports: (filters?: Partial<PekReportFilters>) => ['pek', 'reports', filters || {}] as const,
  report: (id: string | number) => ['pek', 'report', String(id)] as const,
  creationContext: (params: PekReportCreationParams) => ['pek', 'creation-context', params] as const,
  assignees: (roles: string[] = []) => ['pek', 'lookups', 'assignees', roles] as const,
  permits: (objectId: string | number) => ['pek', 'lookups', 'permits', String(objectId)] as const,
};

export const pekQueryKeys = pekKeys;
