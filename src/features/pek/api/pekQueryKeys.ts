import type { PekProgramFilters, PekReportFilters, PekSectionCode } from './pekContracts';

export const pekKeys = {
  root: ['pek'] as const,
  dashboard: (filters: Record<string, unknown> = {}) => ['pek', 'dashboard', filters] as const,
  programs: (filters: PekProgramFilters = {}) => ['pek', 'programs', filters] as const,
  program: (id: string | number) => ['pek', 'program', String(id)] as const,
  programHistory: (id: string | number) => ['pek', 'program-history', String(id)] as const,
  reports: (filters: PekReportFilters = {}) => ['pek', 'reports', filters] as const,
  report: (id: string | number) => ['pek', 'report', String(id)] as const,
  creationContext: (params: Record<string, unknown>) => ['pek', 'creation-context', params] as const,
  section: (id: string | number, code: PekSectionCode) => ['pek', 'section', String(id), code] as const,
  issues: (id: string | number) => ['pek', 'issues', String(id)] as const,
  collection: (id: string | number) => ['pek', 'collection', String(id)] as const,
  planFact: (id: string | number) => ['pek', 'plan-fact', String(id)] as const,
  unmatched: (id: string | number) => ['pek', 'unmatched', String(id)] as const,
  exceedances: (id: string | number) => ['pek', 'exceedances', String(id)] as const,
  comments: (id: string | number) => ['pek', 'comments', String(id)] as const,
  history: (id: string | number) => ['pek', 'history', String(id)] as const,
};
