import type { AxiosProgressEvent } from 'axios';
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
  PekMutationBody,
  PekProgram,
  PekProgramCreateRequest,
  PekProgramCloneRequest,
  PekProgramFilters,
  PekProgramUpdateRequest,
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
  PekTransitionExceedanceRequest,
} from './pekContracts';
import {
  mapCollectionResult,
  mapDashboardResponse,
  mapExceedanceResponse,
  mapProgramResponse,
  mapReportResponse,
} from '../mappers/responseMappers';

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

const getDocumentMutation = async <T>(url: string): Promise<T> =>
  unwrapPekData<T>((await api.post(url)).data);

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
      (await api.patch(`/pek/programs/${id}`, { ...body, version })).data,
    )),
  saveProgramDraft: async (id: number, version: number, body: PekProgramUpdateRequest, signal?: AbortSignal) =>
    mapProgramResponse(unwrapPekData<unknown>(
      (await api.patch(`/pek/programs/${id}/draft`, { ...body, version }, { signal })).data,
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
  getObjectPermits: (objectId: number, signal?: AbortSignal) =>
    get<PekLookupOption[]>(`/pek/lookups/objects/${objectId}/permits`, {}, signal),

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
    return { ...context, programs: (context.programs || []).map(mapProgramResponse) };
  },
  createReport: async (body: PekReportCreateRequest) =>
    mapReportResponse(unwrapPekData<unknown>((await api.post('/pek/reports', body)).data)),
  collectReport: async (id: number) =>
    mapCollectionResult(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/collect`)).data)),
  getReportPlanFact: (id: number, signal?: AbortSignal) =>
    get<PekPlanFactResponse>(`/pek/reports/${id}/plan-fact`, {}, signal),
  getReportSources: (id: number, filters: Record<string, unknown> = {}, signal?: AbortSignal) =>
    get<PekReportSource[]>(`/pek/reports/${id}/sources`, filters, signal),
  getReportSourcesSummary: (id: number, signal?: AbortSignal) =>
    get<PekReportSourceSummary>(`/pek/reports/${id}/sources/summary`, {}, signal),
  matchReportSource: async (reportId: number, sourceId: number, indicatorId: number, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/match`, { indicatorId, version })).data),
  excludeReportSource: async (reportId: number, sourceId: number, reason: string, version: number) =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/exclude`, { version, reason })).data),
  restoreReportSource: async (reportId: number, sourceId: number, version: number, reason = 'Источник восстановлен сотрудником') =>
    unwrapPekData<PekReportSource>((await api.post(`/pek/reports/${reportId}/sources/${sourceId}/restore`, { version, reason })).data),
  getReportReadiness: (id: number, signal?: AbortSignal) =>
    get<PekReadinessResponse>(`/pek/reports/${id}/readiness`, {}, signal),
  submitReportReview: (id: number, version: number) => reportAction(id, 'submit-review', version),
  returnReport: async (id: number, version: number, reason: string) =>
    mapReportResponse(unwrapPekData<unknown>((await api.post(`/pek/reports/${id}/return`, { version, reason })).data)),
  approveReport: (id: number, version: number) => reportAction(id, 'approve', version),
  archiveReport: (id: number, version: number) => reportAction(id, 'archive', version),
  generateReportDocx: (id: number) =>
    getDocumentMutation<PekReportDocumentVersion>(`/pek/reports/${id}/document/generate-docx`),
  generateReportPdf: (id: number) =>
    getDocumentMutation<PekReportDocumentVersion>(`/pek/reports/${id}/document/generate-pdf`),
  getReportDocumentVersions: (id: number, signal?: AbortSignal) =>
    get<PekReportDocumentVersion[]>(`/pek/reports/${id}/document/versions`, {}, signal),
  downloadReportDocument: async (id: number, format: 'docx' | 'pdf'): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`/pek/reports/${id}/document/download/${format}`, { responseType: 'blob' });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${id}.${format}`),
    };
  },
  signReportDocument: async (id: number, cms: string) =>
    unwrapPekData<PekReportSignature>((await api.post(`/pek/reports/${id}/document/sign`, { cms })).data),
  getReportSignatures: (id: number, signal?: AbortSignal) =>
    get<PekReportSignature[]>(`/pek/reports/${id}/document/signatures`, {}, signal),
  getReportExceedances: async (reportId: number, signal?: AbortSignal) =>
    (await get<unknown[]>(`/pek/reports/${reportId}/exceedances`, {}, signal)).map(mapExceedanceResponse),
  getExceedance: async (id: number, signal?: AbortSignal) =>
    mapExceedanceResponse(await get<unknown>(`/pek/exceedances/${id}`, {}, signal)),
  assignExceedance: async (id: number, body: PekAssignExceedanceRequest) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/assign`, body)).data)),
  attachExceedanceEvidence: async (id: number, version: number, fileId: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/evidence`, { version, fileId })).data)),
  transitionExceedance: async (id: number, body: PekTransitionExceedanceRequest) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/transition`, body)).data)),
  getSettings: (companyId: number, signal?: AbortSignal) => get<PekSettings>('/pek/settings', { companyId }, signal),
  updateSettings: async (companyId: number, body: PekSettingsUpdateRequest) =>
    unwrapPekData<PekSettings>((await api.put('/pek/settings', body, { params: { companyId } })).data),
};

// Compatibility alias: there is still only one PEK transport implementation.
export const pekService = pekApi;
export type PekService = typeof pekApi;
export { cleanParams };
