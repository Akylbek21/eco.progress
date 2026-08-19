import axios, { type AxiosProgressEvent } from 'axios';
import { pekApiClient as api } from './pekApiClient';
import { filenameFromDisposition, mapPekPage, unwrapPekData } from './pekMappers';
import { createIfMatch } from '../../../services/apiHelpers';
import type {
  PageResponse,
  PekBlobResult,
  PekCreationContext,
  PekDashboard,
  PekDashboardFilters,
  PekHistoryItem,
  PekLookupOption,
  PekPermit,
  PekPermitCreateRequest,
  PekPermitHistoryEntry,
  PekPermitStatus,
  PekPermitUpdateRequest,
  PekCompanyMembership,
  PekAddMembershipRequest,
  PekUpdateMembershipRequest,
  PekMutationBody,
  PekProgram,
  PekProgramCreateRequest,
  PekProgramCloneRequest,
  PekProgramFilters,
  PekProgramUpdateRequest,
  PekProgramMonitoringResponse,
  PekMonitoringMutationRequest,
  PekReport,
  PekReportCreateRequest,
  PekReportCreationParams,
  PekReportFilters,
  PekPlanFactResponse,
  PekReadinessResponse,
  PekReportSource,
  PekReportSourceSummary,
  PekSettings,
  PekSettingsUpdateRequest,
  PekAssignExceedanceRequest,
  PekReportDocumentVersion,
  PekReportSignature,
  PekReportHistoryEntry,
  PekReportPackage,
  PekTransitionExceedanceRequest,
} from './pekContracts';
import {
  mapCollectionResult,
  mapDashboardResponse,
  mapExceedanceResponse,
  mapProgramResponse,
  mapReportResponse,
} from '../mappers/responseMappers';
import { mapReportPackage } from '../mappers/packageMapper';
import { mapProgramMonitoring } from '../mappers/monitoringMapper';

const cleanParams = (input: Record<string, unknown>) => Object.fromEntries(
  Object.entries(input).filter(([, value]) => value !== '' && value !== undefined && value !== null),
);

const get = async <T>(url: string, params: Record<string, unknown> = {}, signal?: AbortSignal) =>
  unwrapPekData<T>((await api.get(url, { params: cleanParams(params), signal })).data);

export const withEntityVersion = (version: number) => ({ 'If-Match': createIfMatch(version) });

const workflowBody = (body: PekMutationBody) => {
  const { version, ...command } = body;
  if (version === undefined) throw new Error('Для workflow ПЭК требуется актуальная версия.');
  return {
    command,
    headers: withEntityVersion(version),
  };
};

const programAction = async (
  id: number,
  action: 'submit-review' | 'return' | 'approve' | 'activate' | 'archive',
  body: PekMutationBody,
) => {
  const request = workflowBody(body);
  return mapProgramResponse(unwrapPekData<unknown>(
    (await api.post(`/pek/programs/${id}/${action}`, request.command, { headers: request.headers })).data,
  ));
};

const reportAction = async (
  id: number,
  action: 'submit-review' | 'approve' | 'archive',
  version: number,
) => mapReportResponse(unwrapPekData<unknown>(
  (await api.post(`/pek/reports/${id}/${action}`, {}, { headers: withEntityVersion(version) })).data,
));

export type PekUploadOptions = {
  signal?: AbortSignal;
  onUploadProgress?: (event: AxiosProgressEvent) => void;
};

export const pekApi = {
  async getDashboard(filters: PekDashboardFilters, signal?: AbortSignal) {
    return mapDashboardResponse(await get<unknown>('/pek/dashboard', filters, signal));
  },

  async getPrograms(filters: PekProgramFilters, signal?: AbortSignal): Promise<PageResponse<PekProgram>> {
    const page = mapPekPage<unknown>(
      (await api.get('/pek/programs', { params: cleanParams(filters), signal })).data,
    );
    return { ...page, content: page.content.map(mapProgramResponse) };
  },
  getProgram: async (id: number, signal?: AbortSignal) =>
    mapProgramResponse(await get<unknown>(`/pek/programs/${id}`, {}, signal)),
  createProgram: async (body: PekProgramCreateRequest) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.post('/pek/programs', body)).data)),
  updateProgram: async (id: number, version: number, body: PekProgramUpdateRequest) =>
    mapProgramResponse(unwrapPekData<unknown>(
      (await api.patch(`/pek/programs/${id}`, body, { headers: withEntityVersion(version) })).data,
    )),
  saveProgramDraft: async (id: number, version: number, body: PekProgramUpdateRequest, signal?: AbortSignal) =>
    mapProgramResponse(unwrapPekData<unknown>(
      (await api.patch(`/pek/programs/${id}/draft`, body, { signal, headers: withEntityVersion(version) })).data,
    )),
  submitProgramReview: (id: number, body: PekMutationBody) => programAction(id, 'submit-review', body),
  returnProgram: (id: number, body: PekMutationBody) => programAction(id, 'return', body),
  approveProgram: (id: number, body: PekMutationBody) => programAction(id, 'approve', body),
  activateProgram: (id: number, body: PekMutationBody) => programAction(id, 'activate', body),
  archiveProgram: (id: number, body: PekMutationBody) => programAction(id, 'archive', body),
  cloneProgram: async (id: number, body: PekProgramCloneRequest) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.post(`/pek/programs/${id}/clone`, body)).data)),
  getProgramHistory: (id: number, signal?: AbortSignal) =>
    get<PekHistoryItem[]>(`/pek/programs/${id}/history`, {}, signal),
  getProgramMonitoring: async (id: number, signal?: AbortSignal): Promise<PekProgramMonitoringResponse> =>
    mapProgramMonitoring((await api.get(`/pek/programs/${id}/monitoring`, { signal })).data, id),
  createProgramMonitoring: async (id: number, body: PekMonitoringMutationRequest): Promise<void> => {
    await api.post(`/pek/programs/${id}/monitoring`, body);
  },
  updateProgramMonitoring: async (id: number, monitoringId: number, body: PekMonitoringMutationRequest, version: number): Promise<void> => {
    await api.put(`/pek/programs/${id}/monitoring/${monitoringId}`, body, { headers: { 'If-Match': String(version) } });
  },
  deleteProgramMonitoring: async (id: number, monitoringId: number, version: number): Promise<void> => {
    await api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`, { headers: { 'If-Match': String(version) } });
  },
  uploadProgramDocument: async (
    id: number,
    file: File,
    documentType: string,
    options: PekUploadOptions = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    form.append('documentType', documentType);
    return unwrapPekData<Record<string, unknown>>((await api.post(
      `/pek/programs/${id}/documents`,
      form,
      {
        signal: options.signal,
        onUploadProgress: options.onUploadProgress,
      },
    )).data);
  },
  downloadProgramDocument: async (programId: number, documentId: number): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/programs/${programId}/documents/${documentId}`, {
      responseType: 'blob',
    });
    return {
      blob: response.data,
      filename: filenameFromDisposition(
        response.headers['content-disposition'],
        `pek-program-${programId}-document-${documentId}`,
      ),
    };
  },

  getAssignees: (roles: string[], signal?: AbortSignal) =>
    get<PekLookupOption[]>('/pek/lookups/assignees', { roles: roles.join(',') }, signal),
  getPermits: (objectId: number, signal?: AbortSignal) =>
    get<PekPermit[]>('/pek/permits', { objectId }, signal),
  getPermit: (id: number, signal?: AbortSignal) =>
    get<PekPermit>(`/pek/permits/${id}`, {}, signal),
  createPermit: async (body: PekPermitCreateRequest) =>
    unwrapPekData<PekPermit>((await api.post('/pek/permits', body)).data),
  updatePermit: async (id: number, body: PekPermitUpdateRequest) => {
    const { version, ...request } = body;
    return unwrapPekData<PekPermit>((await api.patch(`/pek/permits/${id}`, request, { headers: withEntityVersion(version) })).data);
  },
  changePermitStatus: async (id: number, version: number, status: PekPermitStatus, comment: string) =>
    unwrapPekData<PekPermit>((await api.post(`/pek/permits/${id}/status`, { status, comment }, { headers: withEntityVersion(version) })).data),
  getPermitHistory: (id: number, signal?: AbortSignal) =>
    get<PekPermitHistoryEntry[]>(`/pek/permits/${id}/history`, {}, signal),
  getPekMemberships: (companyId: number, signal?: AbortSignal) =>
    get<PekCompanyMembership[]>(`/pek/companies/${companyId}/members`, {}, signal),
  addPekMembership: async (companyId: number, body: PekAddMembershipRequest) =>
    unwrapPekData<PekCompanyMembership>((await api.post(`/pek/companies/${companyId}/members`, body)).data),
  updatePekMembership: async (companyId: number, membershipId: number, body: PekUpdateMembershipRequest) =>
    unwrapPekData<PekCompanyMembership>((await api.patch(`/pek/companies/${companyId}/members/${membershipId}`, body)).data),
  deactivatePekMembership: async (companyId: number, membershipId: number) =>
    unwrapPekData<null>((await api.delete(`/pek/companies/${companyId}/members/${membershipId}`)).data),

  async getReports(filters: PekReportFilters, signal?: AbortSignal): Promise<PageResponse<PekReport>> {
    const { status, issue: _issue, ...backendFilters } = filters;
    const page = mapPekPage<unknown>(
      (await api.get('/pek/reports', { params: cleanParams(backendFilters), signal })).data,
    );
    // TODO(backend): pass status/issue when GET /pek/reports supports those filters.
    const mapped = page.content.map((item) => mapReportResponse(item));
    const content = mapped.filter((report) => !status || report.status === status);
    return { ...page, content };
  },
  getReport: async (id: number, signal?: AbortSignal) =>
    mapReportResponse(await get<unknown>(`/pek/reports/${id}`, {}, signal)),
  getReportCreationContext: async (params: PekReportCreationParams, signal?: AbortSignal) => {
    const context = await get<PekCreationContext>('/pek/reports/creation-context', params, signal);
    return {
      ...context,
      programs: (context.programs || []).map(mapProgramResponse),
      warnings: context.warnings || [],
      blockingReasons: context.blockingReasons || [],
    };
  },
  createReport: async (body: PekReportCreateRequest) =>
    mapReportResponse(unwrapPekData<unknown>((await api.post('/pek/reports', body)).data)),
  collectReport: async (id: number, version: number) =>
    mapCollectionResult(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/collect`, {}, { headers: withEntityVersion(version) })).data)),
  getReportPlanFact: (id: number, signal?: AbortSignal) =>
    get<PekPlanFactResponse>(`/pek/reports/${id}/plan-fact`, {}, signal),
  getReportSources: (id: number, filters: Record<string, unknown> = {}, signal?: AbortSignal) =>
    get<PekReportSource[]>(`/pek/reports/${id}/sources`, filters, signal),
  getReportSourcesSummary: (id: number, signal?: AbortSignal) =>
    get<PekReportSourceSummary>(`/pek/reports/${id}/sources/summary`, {}, signal),
  matchReportSource: async (reportId: number, sourceId: number, indicatorId: number, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/match`, { indicatorId }, { headers: withEntityVersion(version) })).data),
  excludeReportSource: async (reportId: number, sourceId: number, reason: string, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/exclude`, { reason }, { headers: withEntityVersion(version) })).data),
  restoreReportSource: async (reportId: number, sourceId: number, version: number, reason = 'Источник восстановлен сотрудником') =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/restore`, { reason }, { headers: withEntityVersion(version) })).data),
  getReportReadiness: (id: number, signal?: AbortSignal) =>
    get<PekReadinessResponse>(`/pek/reports/${id}/readiness`, {}, signal),
  getReportHistory: (id: number, signal?: AbortSignal) =>
    get<PekReportHistoryEntry[]>(`/pek/reports/${id}/history`, {}, signal),
  submitReportReview: (id: number, version: number) => reportAction(id, 'submit-review', version),
  returnReport: async (id: number, version: number, reason: string) =>
    mapReportResponse(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/return`, { reason }, { headers: withEntityVersion(version) })).data)),
  approveReport: (id: number, version: number) => reportAction(id, 'approve', version),
  archiveReport: (id: number, version: number) => reportAction(id, 'archive', version),
  generateReportDocx: async (id: number, version: number) =>
    unwrapPekData<PekReportDocumentVersion>((await api.post(`/pek/reports/${id}/document/generate-docx`, {}, { headers: withEntityVersion(version) })).data),
  generateReportPdf: async (id: number, version: number) =>
    unwrapPekData<PekReportDocumentVersion>((await api.post(`/pek/reports/${id}/document/generate-pdf`, {}, { headers: withEntityVersion(version) })).data),
  getReportDocumentVersions: (id: number, signal?: AbortSignal) =>
    get<PekReportDocumentVersion[]>(`/pek/reports/${id}/document/versions`, {}, signal),
  downloadReportDocument: async (id: number, format: 'docx' | 'pdf'): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${id}/document/download/${format}`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${id}.${format}`),
    };
  },
  signReportDocument: async (id: number, version: number, cms: string) =>
    unwrapPekData<PekReportSignature>((await api.post(`/pek/reports/${id}/document/sign`, { cms }, { headers: withEntityVersion(version) })).data),
  getReportSignatures: (id: number, signal?: AbortSignal) =>
    get<PekReportSignature[]>(`/pek/reports/${id}/document/signatures`, {}, signal),
  downloadReportSignature: async (reportId: number, signatureFileId: string | number): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${reportId}/document/signatures/${encodeURIComponent(signatureFileId)}/download`, { responseType: 'blob' });
    return { blob: response.data, filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${reportId}-signature.cms`) };
  },
  getReportPackage: async (id: number, signal?: AbortSignal): Promise<PekReportPackage | null> => {
    try {
      return mapReportPackage((await api.get(`/pek/reports/${id}/package`, { signal })).data);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  },
  generateReportPackage: async (id: number, version: number): Promise<void> => {
    await api.post(`/pek/reports/${id}/package/generate`, {}, { headers: withEntityVersion(version) });
  },
  downloadReportPackage: async (id: number): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${id}/package/download`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-package-${id}.zip`),
    };
  },
  getReportExceedances: async (reportId: number, signal?: AbortSignal) =>
    (await get<unknown[]>(`/pek/reports/${reportId}/exceedances`, {}, signal)).map(mapExceedanceResponse),
  getExceedance: async (id: number, signal?: AbortSignal) =>
    mapExceedanceResponse(await get<unknown>(`/pek/exceedances/${id}`, {}, signal)),
  assignExceedance: async (id: number, body: PekAssignExceedanceRequest) => {
    const { version, ...request } = body;
    return mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/assign`, request, { headers: withEntityVersion(version) })).data));
  },
  uploadExceedanceEvidence: async (id: number, file: File): Promise<{ fileId: string; fileName?: string }> => {
    const form = new FormData();
    form.append('file', file);
    return unwrapPekData<{ fileId: string; fileName?: string }>((await api.post(`/pek/exceedances/${id}/evidence-files`, form)).data);
  },
  attachExceedanceEvidence: async (id: number, version: number, fileId: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/evidence`, { fileId }, { headers: withEntityVersion(version) })).data)),
  transitionExceedance: async (id: number, body: PekTransitionExceedanceRequest) => {
    const { version, ...request } = body;
    return mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/transition`, request, { headers: withEntityVersion(version) })).data));
  },
  getSettings: (companyId: number, signal?: AbortSignal) => get<PekSettings>('/pek/settings', { companyId }, signal),
  updateSettings: async (companyId: number, version: number, body: PekSettingsUpdateRequest) =>
    unwrapPekData<PekSettings>((await api.patch('/pek/settings', body, { params: { companyId }, headers: withEntityVersion(version) })).data),
  runSchedulerNow: async (companyId: number): Promise<void> => {
    await api.post('/pek/scheduler/run', null, { params: { companyId } });
  },
};

export { cleanParams };
