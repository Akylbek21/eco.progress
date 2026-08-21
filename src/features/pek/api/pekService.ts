import axios, { type AxiosProgressEvent } from 'axios';
import { pekApiClient as api } from './pekApiClient';
import { filenameFromDisposition, mapPekPage, unwrapPekData } from './pekMappers';
import { pekMutationOptions } from './pekMutation';
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
  PekPermitStatusRequest,
  PekPermitDeleteRequest,
  PekPermitUpdateRequest,
  PekCompanyMembership,
  PekAddMembershipRequest,
  PekUpdateMembershipRequest,
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
  PekDocumentVersion,
  PekReportSignature,
  PekReportHistoryEntry,
  PekReportPackage,
  PekTransitionExceedanceRequest,
  PekCorrectiveAction,
  PekCorrectiveActionCreateRequest,
  PekCorrectiveActionUpdateRequest,
  PekCorrectiveActionStatusRequest,
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

const programAction = async (
  id: number,
  action: 'submit-review' | 'return' | 'approve' | 'activate' | 'archive',
  version: number,
  command: Record<string, unknown> = {},
) => {
  return mapProgramResponse(unwrapPekData<unknown>(
    (await api.post(`/pek/programs/${id}/${action}`, command, pekMutationOptions(version))).data,
  ));
};

const reportAction = async (
  id: number,
  action: 'submit-review' | 'approve' | 'archive',
  version: number,
) => mapReportResponse(unwrapPekData<unknown>(
  (await api.post(`/pek/reports/${id}/${action}`, {}, pekMutationOptions(version))).data,
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
      (await api.patch(`/pek/programs/${id}`, body, pekMutationOptions(version))).data,
    )),
  saveProgramDraft: async (id: number, version: number, body: PekProgramUpdateRequest, signal?: AbortSignal) =>
    mapProgramResponse(unwrapPekData<unknown>(
      (await api.patch(`/pek/programs/${id}/draft`, body, { ...pekMutationOptions(version), signal })).data,
    )),
  submitProgramReview: (id: number, version: number) => programAction(id, 'submit-review', version),
  returnProgram: (id: number, version: number, reason: string) => programAction(id, 'return', version, { reason }),
  approveProgram: (id: number, version: number) => programAction(id, 'approve', version),
  activateProgram: (id: number, version: number) => programAction(id, 'activate', version),
  archiveProgram: (id: number, version: number) => programAction(id, 'archive', version),
  cloneProgram: async (id: number, version: number, body: PekProgramCloneRequest) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.post(`/pek/programs/${id}/clone`, body, pekMutationOptions(version))).data)),
  getProgramHistory: (id: number, signal?: AbortSignal) =>
    get<PekHistoryItem[]>(`/pek/programs/${id}/history`, {}, signal),
  getProgramMonitoring: async (id: number, signal?: AbortSignal): Promise<PekProgramMonitoringResponse> =>
    mapProgramMonitoring((await api.get(`/pek/programs/${id}/monitoring`, { signal })).data, id),
  createProgramMonitoring: async (id: number, version: number, body: PekMonitoringMutationRequest): Promise<void> => {
    await api.post(`/pek/programs/${id}/monitoring`, body, pekMutationOptions(version));
  },
  updateProgramMonitoring: async (id: number, monitoringId: number, body: PekMonitoringMutationRequest, version: number): Promise<void> => {
    await api.put(`/pek/programs/${id}/monitoring/${monitoringId}`, body, pekMutationOptions(version));
  },
  deleteProgramMonitoring: async (id: number, monitoringId: number, version: number): Promise<void> => {
    await api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`, pekMutationOptions(version));
  },
  uploadProgramDocument: async (
    id: number,
    file: File,
    documentType: string,
    version: number,
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
        ...pekMutationOptions(version),
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
    const { version, ...payload } = body;
    return unwrapPekData<PekPermit>((await api.patch(`/pek/permits/${id}`, payload, pekMutationOptions(version))).data);
  },
  changePermitStatus: async (id: number, request: PekPermitStatusRequest) => {
    const { version, ...payload } = request;
    return unwrapPekData<PekPermit>((await api.post(`/pek/permits/${id}/status`, payload, pekMutationOptions(version))).data);
  },
  deletePermit: async (id: number, request: PekPermitDeleteRequest): Promise<void> => {
    const { version, ...payload } = request;
    void payload;
    await api.delete(`/pek/permits/${id}`, pekMutationOptions(version));
  },
  getPermitHistory: (id: number, signal?: AbortSignal) =>
    get<PekPermitHistoryEntry[]>(`/pek/permits/${id}/history`, {}, signal),
  getPekMemberships: (companyId: number, signal?: AbortSignal) =>
    get<PekCompanyMembership[]>(`/pek/companies/${companyId}/members`, {}, signal),
  addPekMembership: async (companyId: number, body: PekAddMembershipRequest) =>
    unwrapPekData<PekCompanyMembership>((await api.post(`/pek/companies/${companyId}/members`, body)).data),
  updatePekMembership: async (companyId: number, membershipId: number, request: PekUpdateMembershipRequest) => {
    const { version, ...payload } = request;
    return unwrapPekData<PekCompanyMembership>((await api.patch(`/pek/companies/${companyId}/members/${membershipId}`, payload, pekMutationOptions(version))).data);
  },
  deactivatePekMembership: async (companyId: number, membershipId: number, version: number) =>
    unwrapPekData<null>((await api.delete(`/pek/companies/${companyId}/members/${membershipId}`, pekMutationOptions(version))).data),

  async getReports(filters: PekReportFilters, signal?: AbortSignal): Promise<PageResponse<PekReport>> {
    const page = mapPekPage<unknown>(
      (await api.get('/pek/reports', { params: cleanParams(filters), signal })).data,
    );
    return { ...page, content: page.content.map((item) => mapReportResponse(item)) };
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
    mapCollectionResult(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/collect`, {}, pekMutationOptions(version))).data)),
  getReportPlanFact: (id: number, signal?: AbortSignal) =>
    get<PekPlanFactResponse>(`/pek/reports/${id}/plan-fact`, {}, signal),
  getReportSources: (id: number, filters: Record<string, unknown> = {}, signal?: AbortSignal) =>
    get<PekReportSource[]>(`/pek/reports/${id}/sources`, filters, signal),
  getReportSourcesSummary: (id: number, signal?: AbortSignal) =>
    get<PekReportSourceSummary>(`/pek/reports/${id}/sources/summary`, {}, signal),
  matchReportSource: async (reportId: number, sourceId: number, indicatorId: number, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/match`, { indicatorId }, pekMutationOptions(version))).data),
  excludeReportSource: async (reportId: number, sourceId: number, reason: string, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/exclude`, { reason }, pekMutationOptions(version))).data),
  restoreReportSource: async (reportId: number, sourceId: number, version: number, reason = 'Источник восстановлен сотрудником') =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/restore`, { reason }, pekMutationOptions(version))).data),
  getReportReadiness: (id: number, signal?: AbortSignal) =>
    get<PekReadinessResponse>(`/pek/reports/${id}/readiness`, {}, signal),
  getReportHistory: (id: number, signal?: AbortSignal) =>
    get<PekReportHistoryEntry[]>(`/pek/reports/${id}/history`, {}, signal),
  submitReportReview: (id: number, version: number) => reportAction(id, 'submit-review', version),
  returnReport: async (id: number, version: number, reason: string) =>
    mapReportResponse(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/return`, { reason }, pekMutationOptions(version))).data)),
  approveReport: (id: number, version: number) => reportAction(id, 'approve', version),
  archiveReport: (id: number, version: number) => reportAction(id, 'archive', version),
  generateReportDocx: async (id: number, version: number) =>
    unwrapPekData<PekDocumentVersion>((await api.post(`/pek/reports/${id}/document/generate-docx`, {}, pekMutationOptions(version))).data),
  generateReportPdf: async (id: number, version: number) =>
    unwrapPekData<PekDocumentVersion>((await api.post(`/pek/reports/${id}/document/generate-pdf`, {}, pekMutationOptions(version))).data),
  getReportDocumentVersions: (id: number, signal?: AbortSignal) =>
    get<PekDocumentVersion[]>(`/pek/reports/${id}/document/versions`, {}, signal),
  downloadReportDocumentVersion: async (reportId: number, versionId: number, format: 'docx' | 'pdf'): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${reportId}/document/versions/${versionId}/download/${format}`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${reportId}-v${versionId}.${format}`),
    };
  },
  downloadReportDocument: async (id: number, format: 'docx' | 'pdf'): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${id}/document/download/${format}`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${id}.${format}`),
    };
  },
  signReportDocument: async (id: number, version: number, cms: string) =>
    unwrapPekData<PekReportSignature>((await api.post(`/pek/reports/${id}/document/sign`, { cms }, pekMutationOptions(version))).data),
  getReportSignatures: (id: number, signal?: AbortSignal) =>
    get<PekReportSignature[]>(`/pek/reports/${id}/document/signatures`, {}, signal),
  downloadReportSignature: async (reportId: number, signatureId: number): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${reportId}/document/signatures/${signatureId}/download`, { responseType: 'blob' });
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
    await api.post(`/pek/reports/${id}/package/generate`, {}, pekMutationOptions(version));
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
    return mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/assign`, request, pekMutationOptions(version))).data));
  },
  uploadExceedanceEvidence: async (id: number, version: number, file: File): Promise<{ fileId: string; fileName?: string }> => {
    const form = new FormData();
    form.append('file', file);
    return unwrapPekData<{ fileId: string; fileName?: string }>((await api.post(`/pek/exceedances/${id}/evidence-files`, form, pekMutationOptions(version))).data);
  },
  attachExceedanceEvidence: async (id: number, version: number, fileId: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/evidence`, { fileId }, pekMutationOptions(version))).data)),
  transitionExceedance: async (id: number, body: PekTransitionExceedanceRequest) => {
    const { version, ...request } = body;
    return mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/transition`, request, pekMutationOptions(version))).data));
  },
  closeExceedance: async (id: number, version: number, resolutionComment: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/close`, { resolutionComment }, pekMutationOptions(version))).data)),
  reopenExceedance: async (id: number, version: number, comment?: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/reopen`, comment ? { comment } : {}, pekMutationOptions(version))).data)),
  createCorrectiveAction: async (exceedanceId: number, version: number, body: PekCorrectiveActionCreateRequest) =>
    unwrapPekData<PekCorrectiveAction>((await api.post(`/pek/exceedances/${exceedanceId}/corrective-actions`, body, pekMutationOptions(version))).data),
  updateCorrectiveAction: async (exceedanceId: number, actionId: number, body: PekCorrectiveActionUpdateRequest) => {
    const { version, ...payload } = body;
    return unwrapPekData<PekCorrectiveAction>((await api.put(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}`, payload, pekMutationOptions(version))).data);
  },
  deleteCorrectiveAction: async (exceedanceId: number, actionId: number, version: number): Promise<void> => {
    await api.delete(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}`, pekMutationOptions(version));
  },
  changeCorrectiveActionStatus: async (exceedanceId: number, actionId: number, body: PekCorrectiveActionStatusRequest) => {
    const { version, ...payload } = body;
    return unwrapPekData<PekCorrectiveAction>((await api.post(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}/status`, payload, pekMutationOptions(version))).data);
  },
  getSettings: (companyId: number, signal?: AbortSignal) => get<PekSettings>('/pek/settings', { companyId }, signal),
  updateSettings: async (companyId: number, version: number, body: PekSettingsUpdateRequest) =>
    unwrapPekData<PekSettings>((await api.put('/pek/settings', body, { ...pekMutationOptions(version), params: { companyId } })).data),
  runSchedulerNow: async (companyId: number, version: number): Promise<void> => {
    await api.post('/pek/scheduler/run', null, { ...pekMutationOptions(version), params: { companyId } });
  },
};

export { cleanParams };
