import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type { PekProgramFilters, PekReportFilters } from './pekContracts';
import { pekKeys } from './pekQueryKeys';
import { pekApi } from './pekApi';
import { PEK_STALE_TIME_MS, retryPekQuery } from '../utils/pekQueryPolicy';

export const pekQueries = {
  dashboard: (filters: Record<string, unknown> = {}) => queryOptions({
    queryKey: pekKeys.dashboard(filters),
    queryFn: ({ signal }) => pekApi.getDashboard(filters, signal),
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
  programs: (filters: PekProgramFilters = {}) => queryOptions({
    queryKey: pekKeys.programs(filters),
    queryFn: ({ signal }) => pekApi.getPrograms(filters, signal),
    placeholderData: keepPreviousData,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
  program: (id: number) => queryOptions({
    queryKey: pekKeys.program(id),
    queryFn: ({ signal }) => pekApi.getProgram(id, signal),
    enabled: Number.isFinite(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
  reports: (filters: PekReportFilters = {}) => queryOptions({
    queryKey: pekKeys.reports(filters),
    queryFn: ({ signal }) => pekApi.getReports(filters, signal),
    placeholderData: keepPreviousData,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
  report: (id: number) => queryOptions({
    queryKey: pekKeys.report(id),
    queryFn: ({ signal }) => pekApi.getReport(id, signal),
    enabled: Number.isFinite(id) && id > 0,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
  creationContext: (params: Record<string, unknown>, enabled = true) => queryOptions({
    queryKey: pekKeys.creationContext(params),
    queryFn: ({ signal }) => pekApi.getReportCreationContext(params, signal),
    enabled,
    retry: retryPekQuery,
    staleTime: PEK_STALE_TIME_MS,
  }),
};
