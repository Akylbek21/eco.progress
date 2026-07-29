import api from '../../../services/api';
import {
  filenameFromDisposition,
  mapPekPage,
  unwrapPekData,
} from './pekMappers';
import type {
  PageResponse,
  PekBlobResult,
  PekCollectionRun,
  PekControlItemLinkOption,
  PekCreationContext,
  PekDashboard,
  PekExceedance,
  PekHistoryItem,
  PekLookupOption,
  PekMutationBody,
  PekPlanFactRow,
  PekProgram,
  PekProgramFilters,
  PekProgramRequest,
  PekReport,
  PekReportFilters,
  PekReportIssue,
  PekReviewComment,
  PekSectionCode,
  PekSettings,
  PekUnmatchedSource,
} from './pekContracts';

const cleanParams = (input: Record<string, unknown>) => Object.fromEntries(
  Object.entries(input).filter(([, value]) => value !== '' && value !== undefined && value !== null),
);
const get = async <T>(url: string, params: Record<string, unknown> = {}, signal?: AbortSignal) =>
  unwrapPekData<T>((await api.get(url, { params: cleanParams(params), signal })).data);
const post = async <T>(url: string, body?: unknown) =>
  unwrapPekData<T>((await api.post(url, body)).data);
const optimisticRequest = (body: unknown) => {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const version = body.get('version');
    const payload = new FormData();
    body.forEach((value, key) => { if (key !== 'version') payload.append(key, value); });
    return {
      body: payload,
      headers: version === null ? undefined : { 'If-Match': String(version) },
    };
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const { version, ...payload } = body as Record<string, unknown>;
    return {
      body: payload,
      headers: version === undefined || version === null ? undefined : { 'If-Match': String(version) },
    };
  }
  return { body, headers: undefined };
};
const versionedPost = async <T>(url: string, body: unknown = {}) => {
  const request = optimisticRequest(body);
  return unwrapPekData<T>((await api.post(url, request.body, { headers: request.headers })).data);
};
const versionedPatch = async <T>(url: string, body: unknown) => {
  const request = optimisticRequest(body);
  return unwrapPekData<T>((await api.patch(url, request.body, { headers: request.headers })).data);
};
const download = async (url: string, fallback: string): Promise<PekBlobResult> => {
  const response = await api.get<Blob>(url, { responseType: 'blob' });
  const contentType = String(response.headers['content-type'] || '');
  if (contentType.includes('json')) {
    const text = await response.data.text();
    const parsed = JSON.parse(text) as { message?: string };
    throw new Error(parsed.message || 'Не удалось скачать файл.');
  }
  return {
    blob: response.data,
    filename: filenameFromDisposition(response.headers['content-disposition'], fallback),
  };
};
const programAction = (id: number, action: string, body: PekMutationBody = {}) =>
  versionedPost<PekProgram>(`/pek/programs/${id}/${action}`, body);
const reportAction = (id: number, action: string, body: PekMutationBody = {}) =>
  versionedPost<PekReport>(`/pek/reports/${id}/${action}`, body);

export const pekService = {
  async getPrograms(filters: PekProgramFilters, signal?: AbortSignal): Promise<PageResponse<PekProgram>> {
    return mapPekPage<PekProgram>((await api.get('/pek/programs', { params: cleanParams(filters), signal })).data);
  },
  getProgram: (id: number, signal?: AbortSignal) => get<PekProgram>(`/pek/programs/${id}`, {}, signal),
  createProgram: (body: PekProgramRequest) => post<PekProgram>('/pek/programs', body),
  updateProgram: (id: number, body: PekProgramRequest & { version: number }) => versionedPatch<PekProgram>(`/pek/programs/${id}`, body),
  saveProgramDraft: (id: number, body: Partial<PekProgramRequest> & { version: number }) =>
    versionedPatch<PekProgram>(`/pek/programs/${id}/draft`, body),
  uploadProgramDocument: (id: number, body: FormData) =>
    versionedPost<Record<string, unknown>>(`/pek/programs/${id}/documents`, body),
  submitProgramReview: (id: number, body: PekMutationBody) => programAction(id, 'submit-review', body),
  returnProgram: (id: number, body: PekMutationBody) => programAction(id, 'return', body),
  approveProgram: (id: number, body: PekMutationBody) => programAction(id, 'approve', body),
  activateProgram: (id: number, body: PekMutationBody) => programAction(id, 'activate', body),
  archiveProgram: (id: number, body: PekMutationBody) => programAction(id, 'archive', body),
  cloneProgram: (id: number, body: PekMutationBody) => programAction(id, 'clone', body),
  getProgramHistory: (id: number, signal?: AbortSignal) => get<PekHistoryItem[]>(`/pek/programs/${id}/history`, {}, signal),
  getAssignees: (roles: string[] = [], signal?: AbortSignal) =>
    get<PekLookupOption[]>('/pek/lookups/assignees', { roles: roles.join(',') }, signal),
  getObjectPermits: (objectId: number, signal?: AbortSignal) =>
    get<PekLookupOption[]>(`/pek/lookups/objects/${objectId}/permits`, {}, signal),

  async getReports(filters: PekReportFilters, signal?: AbortSignal): Promise<PageResponse<PekReport>> {
    return mapPekPage<PekReport>((await api.get('/pek/reports', { params: cleanParams(filters), signal })).data);
  },
  getReport: (id: number, signal?: AbortSignal) => get<PekReport>(`/pek/reports/${id}`, {}, signal),
  getReportCreationContext: (params: Record<string, unknown>, signal?: AbortSignal) =>
    get<PekCreationContext>('/pek/reports/creation-context', params, signal),
  createReport: (body: PekMutationBody) => post<PekReport>('/pek/reports', body),
  updateReport: (id: number, body: PekMutationBody) => versionedPatch<PekReport>(`/pek/reports/${id}`, body),
  collectReport: (id: number, body: PekMutationBody) => versionedPost<PekCollectionRun>(`/pek/reports/${id}/collect`, body),
  getLatestCollectionRun: (id: number, signal?: AbortSignal) => get<PekCollectionRun>(`/pek/reports/${id}/collection-runs/latest`, {}, signal),
  validateReport: (id: number, body: PekMutationBody) => reportAction(id, 'validate', body),
  getReportIssues: (id: number, signal?: AbortSignal) => get<PekReportIssue[]>(`/pek/reports/${id}/issues`, {}, signal),
  getReportSection: (id: number, code: PekSectionCode, signal?: AbortSignal) =>
    get<Record<string, unknown>>(`/pek/reports/${id}/sections/${code}`, {}, signal),
  uploadReportDocument: (id: number, body: FormData) =>
    versionedPost<Record<string, unknown>>(`/pek/reports/${id}/documents`, body),
  getPlanFact: (id: number, signal?: AbortSignal) => get<PekPlanFactRow[]>(`/pek/reports/${id}/plan-fact`, {}, signal),
  getUnmatchedSources: (id: number, signal?: AbortSignal) => get<PekUnmatchedSource[]>(`/pek/reports/${id}/unmatched-sources`, {}, signal),
  getUnmatchedLinkOptions: (id: number, sourceId: number, signal?: AbortSignal) =>
    get<PekControlItemLinkOption[]>(`/pek/reports/${id}/unmatched-sources/${sourceId}/link-options`, {}, signal),
  linkUnmatchedSource: (id: number, sourceId: number, body: PekMutationBody) =>
    versionedPost<PekReport>(`/pek/reports/${id}/unmatched-sources/${sourceId}/link`, body),
  excludeUnmatchedSource: (id: number, sourceId: number, body: PekMutationBody) =>
    versionedPost<PekReport>(`/pek/reports/${id}/unmatched-sources/${sourceId}/exclude`, body),
  getExceedances: (id: number, signal?: AbortSignal) => get<PekExceedance[]>(`/pek/reports/${id}/exceedances`, {}, signal),
  updateExceedance: (id: number, exceedanceId: number, body: PekMutationBody | FormData) =>
    versionedPatch<PekExceedance>(`/pek/reports/${id}/exceedances/${exceedanceId}`, body),
  createRepeatControl: (id: number, exceedanceId: number, body: PekMutationBody) =>
    versionedPost<Record<string, unknown>>(`/pek/reports/${id}/exceedances/${exceedanceId}/repeat-control`, body),
  createManualOverride: (id: number, body: PekMutationBody | FormData) => versionedPost<PekReport>(`/pek/reports/${id}/manual-overrides`, body),
  keepManualOverride: (id: number, overrideId: number, body: PekMutationBody) =>
    versionedPost<PekReport>(`/pek/reports/${id}/manual-overrides/${overrideId}/keep`, body),
  restoreSourceValue: (id: number, overrideId: number, body: PekMutationBody) =>
    versionedPost<PekReport>(`/pek/reports/${id}/manual-overrides/${overrideId}/restore`, body),
  getReviewComments: (id: number, signal?: AbortSignal) => get<PekReviewComment[]>(`/pek/reports/${id}/review-comments`, {}, signal),
  createReviewComment: (id: number, body: PekMutationBody) => versionedPost<PekReviewComment>(`/pek/reports/${id}/review-comments`, body),
  resolveReviewComment: (id: number, commentId: number, body: PekMutationBody) =>
    versionedPost<PekReviewComment>(`/pek/reports/${id}/review-comments/${commentId}/resolve`, body),
  submitReportReview: (id: number, body: PekMutationBody) => reportAction(id, 'submit-review', body),
  startReview: (id: number, body: PekMutationBody) => reportAction(id, 'start-review', body),
  returnReport: (id: number, body: PekMutationBody) => reportAction(id, 'return', body),
  acceptReview: (id: number, body: PekMutationBody) => reportAction(id, 'accept-review', body),
  approveReport: (id: number, body: PekMutationBody) => reportAction(id, 'approve', body),
  recallApproval: (id: number, body: PekMutationBody) => reportAction(id, 'recall-approval', body),
  prepareSigning: (id: number, body: PekMutationBody) => versionedPost<Record<string, unknown>>(`/pek/reports/${id}/prepare-signing`, body),
  signReport: (id: number, body: PekMutationBody | FormData) => versionedPost<PekReport>(`/pek/reports/${id}/sign`, body),
  registerSubmission: (id: number, body: PekMutationBody | FormData) => versionedPost<PekReport>(`/pek/reports/${id}/submission`, body),
  registerResult: (id: number, body: PekMutationBody | FormData) => versionedPost<PekReport>(`/pek/reports/${id}/result`, body),
  createRevision: (id: number, body: PekMutationBody) => reportAction(id, 'revision', body),
  archiveReport: (id: number, body: PekMutationBody) => reportAction(id, 'archive', body),
  getHistory: (id: number, signal?: AbortSignal) => get<PekHistoryItem[]>(`/pek/reports/${id}/history`, {}, signal),
  getDashboard: (params: Record<string, unknown>, signal?: AbortSignal) => get<PekDashboard>('/pek/dashboard', params, signal),
  getSettings: (signal?: AbortSignal) => get<PekSettings>('/pek/settings', {}, signal),
  updateSettings: (body: PekSettings) => versionedPatch<PekSettings>('/pek/settings', body),
  downloadPreviewPdf: (id: number) => download(`/pek/reports/${id}/exports/preview.pdf`, `pek-report-${id}-preview.pdf`),
  downloadPdf: (id: number) => download(`/pek/reports/${id}/exports/report.pdf`, `pek-report-${id}.pdf`),
  downloadXlsx: (id: number) => download(`/pek/reports/${id}/exports/report.xlsx`, `pek-report-${id}.xlsx`),
  downloadJson: (id: number) => download(`/pek/reports/${id}/exports/report.json`, `pek-report-${id}.json`),
  downloadZip: (id: number) => download(`/pek/reports/${id}/exports/archive.zip`, `pek-report-${id}.zip`),
};

export type PekService = typeof pekService;
