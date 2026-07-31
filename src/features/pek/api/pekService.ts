import type { AxiosProgressEvent } from 'axios';
import { pekApiClient as api } from './pekApiClient';
import { filenameFromDisposition, mapPekPage, unwrapPekData } from './pekMappers';
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
} from './pekContracts';
import {
  mapCollectionResult,
  mapDashboardResponse,
  mapProgramResponse,
  mapReportResponse,
} from '../mappers/responseMappers';

const cleanParams = (input: Record<string, unknown>) => Object.fromEntries(
  Object.entries(input).filter(([, value]) => value !== '' && value !== undefined && value !== null),
);

const get = async <T>(url: string, params: Record<string, unknown> = {}, signal?: AbortSignal) =>
  unwrapPekData<T>((await api.get(url, { params: cleanParams(params), signal })).data);

const ifMatch = (version: number) => ({ 'If-Match': String(version) });

const workflowBody = (body: PekMutationBody, keepVersionInBody = false) => {
  const { version, ...command } = body;
  if (version === undefined) throw new Error('Для workflow ПЭК требуется актуальная версия.');
  return {
    command: keepVersionInBody ? { ...command, version } : command,
    headers: ifMatch(version),
  };
};

const programAction = async (
  id: number,
  action: 'submit-review' | 'return' | 'approve' | 'activate' | 'archive',
  body: PekMutationBody,
) => {
  const request = workflowBody(body, action === 'return');
  return mapProgramResponse(unwrapPekData<unknown>(
    (await api.post(`/pek/programs/${id}/${action}`, request.command, { headers: request.headers })).data,
  ));
};

const reportAction = async (
  id: number,
  action: 'submit-review' | 'approve' | 'archive',
  version: number,
) => mapReportResponse(unwrapPekData<unknown>(
  (await api.post(`/pek/reports/${id}/${action}`, {}, { headers: ifMatch(version) })).data,
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
      (await api.patch(`/pek/programs/${id}`, { ...body, version })).data,
    )),
  saveProgramDraft: async (id: number, version: number, body: PekProgramUpdateRequest) =>
    mapProgramResponse(unwrapPekData<unknown>(
      (await api.patch(`/pek/programs/${id}/draft`, { ...body, version })).data,
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
        headers: { 'Content-Type': 'multipart/form-data' },
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
  submitReportReview: (id: number, version: number) => reportAction(id, 'submit-review', version),
  approveReport: (id: number, version: number) => reportAction(id, 'approve', version),
  archiveReport: (id: number, version: number) => reportAction(id, 'archive', version),
};

// Compatibility alias: there is still only one PEK transport implementation.
export const pekService = pekApi;
export type PekService = typeof pekApi;
export { cleanParams, ifMatch };
