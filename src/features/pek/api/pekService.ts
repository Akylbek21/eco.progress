import axios, { type AxiosProgressEvent } from 'axios';
import { getActiveCompanies, getCompanyObjects } from '../../../services/companyService';
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
  PekPermitUpdateRequest,
  PekProgram,
  PekProgramCreateRequest,
  PekProgramCloneRequest,
  PekProgramFilters,
  PekProgramUpdateRequest,
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
  PekReportDocumentFormat,
  PekReportDocumentKind,
  PekReportSignature,
  PekReportHistoryEntry,
  PekReportPackage,
  PekScopeCompany,
  PekScopeObject,
  PekTransitionExceedanceRequest,
  PekCorrectiveAction,
  PekCorrectiveActionCreateRequest,
  PekCorrectiveActionUpdateRequest,
  PekCorrectiveActionTransitionRequest,
  PekMonitoringPoint,
  PekMonitoringPointRequest,
  PekInternalInspection,
  PekInternalInspectionRequest,
  PekMeasurementQa,
  PekMeasurementQaRequest,
  PekEmergencyProcedure,
  PekEmergencyProcedureRequest,
  PekResponsibility,
  PekResponsibilityRequest,
  PekStaffAssignment,
  PekStaffAssignmentCreateRequest,
  PekStaffAssignmentUpdateRequest,
} from './pekContracts';
import {
  mapCollectionResult,
  mapDashboardResponse,
  mapExceedanceResponse,
  mapProgramResponse,
  mapReportResponse,
} from '../mappers/responseMappers';
import { mapReportPackage } from '../mappers/packageMapper';

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
  action: 'submit-review' | 'approve' | 'archive' | 'submit' | 'accept',
  version: number,
) => {
  const response = await api.post(`/pek/reports/${id}/${action}`, {}, pekMutationOptions(version));
  const payload = unwrapPekData<unknown>(response.data);
  if (payload && typeof payload === 'object' && 'id' in payload) return mapReportResponse(payload);
  return mapReportResponse(await get<unknown>(`/pek/reports/${id}`));
};

const reportDocumentPath = (id: number) => `/pek/reports/${id}/document`;

const backendDocumentType = (kind: PekReportDocumentKind): 'OFFICIAL' | 'INTERNAL' =>
  kind === 'OFFICIAL' ? 'OFFICIAL' : 'INTERNAL';

const frontendDocumentKind = (value: unknown, fallback: PekReportDocumentKind): PekReportDocumentKind => {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'OFFICIAL') return 'OFFICIAL';
  if (normalized === 'INTERNAL' || normalized === 'INTERNAL_ANALYTICAL') return 'INTERNAL_ANALYTICAL';
  return fallback;
};

const mapDocumentVersion = (value: unknown, kind: PekReportDocumentKind): PekDocumentVersion => {
  const source = unwrapPekData<Record<string, unknown>>(value);
  return {
    id: Number(source.id),
    version: Number(source.version || 0),
    documentKind: frontendDocumentKind(source.documentType ?? source.documentKind, kind),
    regulationVersion: source.regulationVersion == null ? null : String(source.regulationVersion),
    templateVersion: source.templateVersion == null ? null : String(source.templateVersion),
    generatedAt: String(source.generatedAt || ''),
    generatedById: source.generatedById == null && source.generatedBy == null ? undefined : Number(source.generatedById ?? source.generatedBy),
    generatedByName: source.generatedByName == null ? undefined : String(source.generatedByName),
    sourceContentRevision: Number(source.sourceContentRevision || 0),
    currentContentRevision: Number(source.currentContentRevision || 0),
    stale: source.stale === true,
    hasDocx: source.hasDocx === true,
    hasPdf: source.hasPdf === true,
    hasXlsx: false,
    sha256: source.sha256 == null ? undefined : String(source.sha256),
  };
};

export type PekUploadOptions = {
  signal?: AbortSignal;
  onUploadProgress?: (event: AxiosProgressEvent) => void;
};

export const pekApi = {
  getScopeCompanies: async (signal?: AbortSignal): Promise<PekScopeCompany[]> =>
    (await getActiveCompanies(signal)).map((company) => ({ id: Number(company.id), name: company.name, bin: company.bin || null })),
  getScopeCompanyObjects: async (companyId: number, signal?: AbortSignal): Promise<PekScopeObject[]> =>
    (await getCompanyObjects(String(companyId), false, signal)).map((object) => ({
      id: Number(object.id),
      companyId,
      name: object.name,
      address: object.address || null,
      status: 'ACTIVE',
    })),

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
  deleteProgram: async (id: number, version: number) => {
    await api.delete(`/pek/programs/${id}`, pekMutationOptions(version));
  },
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
  createProgramMonitoring: async (id: number, version: number, body: PekMonitoringMutationRequest) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.post(`/pek/programs/${id}/monitoring`, body, pekMutationOptions(version))).data)),
  updateProgramMonitoring: async (id: number, monitoringId: number, body: PekMonitoringMutationRequest, programVersion: number) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.put(`/pek/programs/${id}/monitoring/${monitoringId}`, body, pekMutationOptions(programVersion))).data)),
  deleteProgramMonitoring: async (id: number, monitoringId: number, programVersion: number) =>
    mapProgramResponse(unwrapPekData<unknown>((await api.delete(`/pek/programs/${id}/monitoring/${monitoringId}`, pekMutationOptions(programVersion))).data)),
  getMonitoringPoints: (programId: number, monitoringId: number, signal?: AbortSignal) =>
    get<PekMonitoringPoint[]>(`/pek/programs/${programId}/monitoring/${monitoringId}/points`, {}, signal),
  createMonitoringPoint: (programId: number, monitoringId: number, body: PekMonitoringPointRequest) =>
    api.post(`/pek/programs/${programId}/monitoring/${monitoringId}/points`, body).then(({ data }) => unwrapPekData<PekMonitoringPoint>(data)),
  updateMonitoringPoint: (programId: number, pointId: number, version: number, body: PekMonitoringPointRequest) =>
    api.put(`/pek/programs/${programId}/monitoring/points/${pointId}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekMonitoringPoint>(data)),
  deleteMonitoringPoint: (programId: number, pointId: number, version: number) =>
    api.delete(`/pek/programs/${programId}/monitoring/points/${pointId}`, pekMutationOptions(version)),

  getInternalInspections: (programId: number, signal?: AbortSignal) => get<PekInternalInspection[]>(`/pek/programs/${programId}/internal-inspections`, {}, signal),
  createInternalInspection: (programId: number, body: PekInternalInspectionRequest) => api.post(`/pek/programs/${programId}/internal-inspections`, body).then(({ data }) => unwrapPekData<PekInternalInspection>(data)),
  updateInternalInspection: (programId: number, id: number, version: number, body: PekInternalInspectionRequest) => api.put(`/pek/programs/${programId}/internal-inspections/${id}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekInternalInspection>(data)),
  deleteInternalInspection: (programId: number, id: number, version: number) => api.delete(`/pek/programs/${programId}/internal-inspections/${id}`, pekMutationOptions(version)),

  getMeasurementQa: (programId: number, signal?: AbortSignal) => get<PekMeasurementQa[]>(`/pek/programs/${programId}/measurement-qa`, {}, signal),
  createMeasurementQa: (programId: number, body: PekMeasurementQaRequest) => api.post(`/pek/programs/${programId}/measurement-qa`, body).then(({ data }) => unwrapPekData<PekMeasurementQa>(data)),
  updateMeasurementQa: (programId: number, id: number, version: number, body: PekMeasurementQaRequest) => api.put(`/pek/programs/${programId}/measurement-qa/${id}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekMeasurementQa>(data)),
  deleteMeasurementQa: (programId: number, id: number, version: number) => api.delete(`/pek/programs/${programId}/measurement-qa/${id}`, pekMutationOptions(version)),

  getEmergencyProcedures: (programId: number, signal?: AbortSignal) => get<PekEmergencyProcedure[]>(`/pek/programs/${programId}/emergency-procedures`, {}, signal),
  createEmergencyProcedure: (programId: number, body: PekEmergencyProcedureRequest) => api.post(`/pek/programs/${programId}/emergency-procedures`, body).then(({ data }) => unwrapPekData<PekEmergencyProcedure>(data)),
  updateEmergencyProcedure: (programId: number, id: number, version: number, body: PekEmergencyProcedureRequest) => api.put(`/pek/programs/${programId}/emergency-procedures/${id}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekEmergencyProcedure>(data)),
  deleteEmergencyProcedure: (programId: number, id: number, version: number) => api.delete(`/pek/programs/${programId}/emergency-procedures/${id}`, pekMutationOptions(version)),

  getResponsibilities: (programId: number, signal?: AbortSignal) => get<PekResponsibility[]>(`/pek/programs/${programId}/responsibilities`, {}, signal),
  createResponsibility: (programId: number, body: PekResponsibilityRequest) => api.post(`/pek/programs/${programId}/responsibilities`, body).then(({ data }) => unwrapPekData<PekResponsibility>(data)),
  updateResponsibility: (programId: number, id: number, version: number, body: PekResponsibilityRequest) => api.put(`/pek/programs/${programId}/responsibilities/${id}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekResponsibility>(data)),
  deleteResponsibility: (programId: number, id: number, version: number) => api.delete(`/pek/programs/${programId}/responsibilities/${id}`, pekMutationOptions(version)),
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

  getAssignees: (companyId: number, roles: string[], signal?: AbortSignal) =>
    get<PekLookupOption[]>('/pek/lookups/assignees', { companyId, roles: roles.join(',') }, signal),
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
  getPermitHistory: (id: number, signal?: AbortSignal) =>
    get<PekPermitHistoryEntry[]>(`/pek/permits/${id}/history`, {}, signal),
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
  submitReport: (id: number, version: number) => reportAction(id, 'submit', version),
  acceptReport: (id: number, version: number) => reportAction(id, 'accept', version),
  rejectReport: async (id: number, version: number, rejectionReason: string) =>
    api.post(`/pek/reports/${id}/reject`, { rejectionReason }, pekMutationOptions(version)).then(() => get<unknown>(`/pek/reports/${id}`)).then(mapReportResponse),
  archiveReport: (id: number, version: number) => reportAction(id, 'archive', version),
  generateReportDocument: async (id: number, kind: PekReportDocumentKind, format: PekReportDocumentFormat, version: number) => {
    if (format === 'xlsx') throw new Error('Backend ПЭК не поддерживает формирование XLSX.');
    const target = kind === 'OFFICIAL' ? `generate-official-${format}` : `generate-internal-${format}`;
    return mapDocumentVersion((await api.post(`${reportDocumentPath(id)}/${target}`, {}, pekMutationOptions(version))).data, kind);
  },
  getReportDocumentVersions: async (id: number, kind: PekReportDocumentKind, signal?: AbortSignal) =>
    (await get<unknown[]>(`${reportDocumentPath(id)}/versions`, { documentType: backendDocumentType(kind) }, signal))
      .map((item) => mapDocumentVersion(item, kind)),
  downloadReportDocumentVersion: async (reportId: number, kind: PekReportDocumentKind, versionId: number, format: PekReportDocumentFormat): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`${reportDocumentPath(reportId)}/versions/${versionId}/download/${format}`, {
      params: { documentType: backendDocumentType(kind) },
      responseType: 'blob',
    });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${reportId}-v${versionId}.${format}`),
    };
  },
  downloadReportDocument: async (id: number, kind: PekReportDocumentKind, format: PekReportDocumentFormat, _preview = false): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`${reportDocumentPath(id)}/download/${format}`, {
      params: { documentType: backendDocumentType(kind) },
      responseType: 'blob',
    });
    return {
      blob: response.data,
      filename: filenameFromDisposition(response.headers['content-disposition'], `pek-report-${id}.${format}`),
    };
  },
  signReportDocument: async (id: number, version: number, cms: string) =>
    unwrapPekData<PekReportSignature>((await api.post(`${reportDocumentPath(id)}/sign`, { cms }, pekMutationOptions(version))).data),
  getReportSignatures: (id: number, signal?: AbortSignal) =>
    get<PekReportSignature[]>(`${reportDocumentPath(id)}/signatures`, {}, signal),
  downloadReportSignature: async (reportId: number, signatureId: number): Promise<PekBlobResult> => {
    const response = await api.get<Blob>(`${reportDocumentPath(reportId)}/signatures/${signatureId}/download`, { responseType: 'blob' });
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
  uploadExceedanceEvidence: async (id: number, version: number, file: File): Promise<{ fileId: string; fileName?: string; version: number }> => {
    const form = new FormData();
    form.append('file', file);
    return unwrapPekData<{ fileId: string; fileName?: string; version: number }>((await api.post(`/pek/exceedances/${id}/evidence-files`, form, pekMutationOptions(version))).data);
  },
  attachExceedanceEvidence: async (id: number, version: number, fileId: string) =>
    mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/evidence`, { fileId }, pekMutationOptions(version))).data)),
  transitionExceedance: async (id: number, body: PekTransitionExceedanceRequest) => {
    const { version, ...request } = body;
    return mapExceedanceResponse(unwrapPekData<unknown>((await api.post(`/pek/exceedances/${id}/transition`, request, pekMutationOptions(version))).data));
  },
  createCorrectiveAction: async (exceedanceId: number, version: number, body: PekCorrectiveActionCreateRequest) =>
    unwrapPekData<PekCorrectiveAction>((await api.post(`/pek/exceedances/${exceedanceId}/corrective-actions`, body, pekMutationOptions(version))).data),
  updateCorrectiveAction: async (exceedanceId: number, actionId: number, body: PekCorrectiveActionUpdateRequest) => {
    const { version, ...payload } = body;
    return unwrapPekData<PekCorrectiveAction>((await api.put(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}`, payload, pekMutationOptions(version))).data);
  },
  deleteCorrectiveAction: async (exceedanceId: number, actionId: number, version: number): Promise<void> => {
    await api.delete(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}`, pekMutationOptions(version));
  },
  transitionCorrectiveAction: async (exceedanceId: number, actionId: number, body: PekCorrectiveActionTransitionRequest) => {
    const { version, ...payload } = body;
    return unwrapPekData<PekCorrectiveAction>((await api.post(`/pek/exceedances/${exceedanceId}/corrective-actions/${actionId}/transition`, payload, pekMutationOptions(version))).data);
  },
  getSettings: (companyId: number, signal?: AbortSignal) => get<PekSettings>('/pek/settings', { companyId }, signal),
  updateSettings: async (companyId: number, version: number, body: PekSettingsUpdateRequest) =>
    unwrapPekData<PekSettings>((await api.put('/pek/settings', body, { ...pekMutationOptions(version), params: { companyId } })).data),
  runSchedulerNow: async (companyId: number, version: number): Promise<void> => {
    await api.post('/pek/scheduler/run', null, { ...pekMutationOptions(version), params: { companyId } });
  },
  getCompanyStaff: (companyId: number, signal?: AbortSignal) => get<PekStaffAssignment[]>(`/pek/companies/${companyId}/staff`, {}, signal),
  assignCompanyStaff: (companyId: number, body: PekStaffAssignmentCreateRequest) => api.post(`/pek/companies/${companyId}/staff`, body).then(({ data }) => unwrapPekData<PekStaffAssignment>(data)),
  updateCompanyStaff: (companyId: number, assignmentId: number, version: number, body: PekStaffAssignmentUpdateRequest) => api.patch(`/pek/companies/${companyId}/staff/${assignmentId}`, body, pekMutationOptions(version)).then(({ data }) => unwrapPekData<PekStaffAssignment>(data)),
  removeCompanyStaff: (companyId: number, assignmentId: number, version: number) => api.delete(`/pek/companies/${companyId}/staff/${assignmentId}`, pekMutationOptions(version)),
};

export { cleanParams };
