import type {
  CreateProtocolPayload,
  CalculationResultResponse,
  MeasurementDevice,
  MethodTemplateResponse,
  NormativeSearchResult,
  Pollutant,
  Protocol,
  ProtocolCalculationSummaryResponse,
  ProtocolPage,
  ProtocolListQuery,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';
import type {
  CancelProtocolRequest,
  QuickCreateProtocolRequest,
  ReplaceProtocolRequest,
  ReturnForRevisionRequest,
  SignProtocolRequest,
  ProtocolVersionRequest,
  CreateProtocolDraftRequest,
  UpdateProtocolDraftRequest,
  SaveProtocolDraftResultsRequest,
} from '../features/protocols/api/protocolContracts';

export type DownloadedProtocolFile = {
  blob: Blob;
  fileName?: string;
};

export interface ProtocolService {
  getProtocols(params?: Record<string, string>): Promise<Protocol[]>;
  getProtocolsPage(params: ProtocolListQuery, signal?: AbortSignal): Promise<ProtocolPage>;
  getProtocolTemplates(): Promise<ProtocolTemplate[]>;
  getProtocolTypes(): Promise<ProtocolTemplate[]>;
  getMethodTemplates(): Promise<MethodTemplateResponse[]>;
  getMethodTemplate(id: string): Promise<MethodTemplateResponse>;
  getProtocol(protocolId: string): Promise<Protocol>;
  getProtocolAudit(protocolId: string): Promise<Protocol['history']>;
  getProtocolById(protocolId: string): Promise<Protocol>;
  createProtocol(payload: CreateProtocolPayload): Promise<Protocol>;
  createProtocolDraft(payload: CreateProtocolDraftRequest, idempotencyKey: string): Promise<Protocol>;
  updateProtocolDraft(protocolId: string, payload: UpdateProtocolDraftRequest): Promise<Protocol>;
  saveProtocolDraftResults(protocolId: string, payload: SaveProtocolDraftResultsRequest): Promise<Protocol>;
  quickCreateProtocol(params: { payload: QuickCreateProtocolRequest; idempotencyKey: string }): Promise<Protocol>;
  refreshLaboratoryData(protocolId: string, version: number): Promise<Protocol>;
  updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol>;
  deleteProtocol(protocolId: string, version: number): Promise<void>;
  addProtocolResult(protocolId: string, payload: ProtocolResultPayload, version: number): Promise<ProtocolResultRow>;
  updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload, version: number): Promise<ProtocolResultRow>;
  deleteProtocolResult(protocolId: string, resultId: string, version: number): Promise<void>;
  bulkAssignDevice(protocolId: string, resultIds: string[], measurementDeviceId: string | number, version: number): Promise<Protocol>;
  bulkUpdatePlace(protocolId: string, resultIds: string[], measurementPlace: string, version: number): Promise<Protocol>;
  bulkDeleteResults(protocolId: string, resultIds: string[], version: number): Promise<Protocol>;
  getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse>;
  saveRawMeasurements(
    protocolId: string,
    resultId: string,
    payload: RawMeasurementRequest[],
    methodTemplateId: string | number | null | undefined,
    version: number,
  ): Promise<ProtocolResultRow | undefined>;
  calculateResult(protocolId: string, resultId: string, version: number): Promise<CalculationResultResponse>;
  calculateProtocolSummary(protocolId: string, version: number): Promise<ProtocolCalculationSummaryResponse>;
  getCalculationHistory(protocolId: string, resultId: string): Promise<CalculationResultResponse[]>;
  checkNormatives(protocolId: string, version: number): Promise<Protocol>;
  readyForApproval(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol>;
  markReadyForApproval(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol>;
  approveProtocol(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol>;
  returnForRevision(protocolId: string, request: ReturnForRevisionRequest): Promise<Protocol>;
  signProtocol(protocolId: string | number, request: SignProtocolRequest): Promise<Protocol>;
  publishToClient(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol>;
  replaceProtocol(protocolId: string, request: ReplaceProtocolRequest): Promise<Protocol>;
  createCorrection(protocolId: string, request: ReplaceProtocolRequest): Promise<Protocol>;
  cancelProtocol(protocolId: string, request: CancelProtocolRequest): Promise<Protocol>;
  archiveProtocol(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol>;
  previewProtocol(protocolId: string): Promise<Blob>;
  generateDocx(protocolId: string, version: number): Promise<Protocol>;
  generatePdf(protocolId: string, version: number): Promise<Protocol>;
  downloadDocx(protocolId: string): Promise<DownloadedProtocolFile>;
  downloadPdf(protocolId: string): Promise<DownloadedProtocolFile>;
  importExcel(protocolId: string, file: File, version: number): Promise<Protocol>;
  addProtocolMeasurementDevice(protocolId: string, device: MeasurementDevice, version: number): Promise<Protocol>;
  removeProtocolMeasurementDevice(protocolId: string, deviceId: string, version: number): Promise<Protocol>;
  searchNormative(params: Record<string, string>, signal?: AbortSignal): Promise<NormativeSearchResult>;
  searchPollutants(query: string, params?: Record<string, string>, signal?: AbortSignal): Promise<Pollutant[]>;
  getWeatherConditions(params: {
    objectId: string | number;
    coordinates?: string;
    date: string;
    time: string;
    signal?: AbortSignal;
  }): Promise<WeatherConditions>;
  calculateProtocol(protocolId: string, version: number): Promise<Protocol>;
}

let implementationPromise: Promise<ProtocolService> | undefined;
const implementation = () => {
  if (!implementationPromise) {
    implementationPromise = import('./apiProtocolService').then((module) => module as unknown as ProtocolService);
  }
  return implementationPromise;
};

const protocolService: ProtocolService = {
  getProtocols: async (params) => (await implementation()).getProtocols(params),
  getProtocolsPage: async (params, signal) => (await implementation()).getProtocolsPage(params, signal),
  getProtocolTemplates: async () => (await import('./apiProtocolService')).getProtocolTemplates(),
  getProtocolTypes: async () => (await implementation()).getProtocolTypes(),
  getMethodTemplates: async () => (await implementation()).getMethodTemplates(),
  getMethodTemplate: async (id) => (await implementation()).getMethodTemplate(id),
  getProtocol: async (protocolId) => (await import('./apiProtocolService')).getProtocol(protocolId),
  getProtocolAudit: async (protocolId) => (await import('../features/protocols/api/protocolQueries')).getProtocolAudit(protocolId),
  getProtocolById: async (protocolId) => (await implementation()).getProtocolById(protocolId),
  createProtocol: async (payload) => (await implementation()).createProtocol(payload),
  createProtocolDraft: async (payload, idempotencyKey) => (await implementation()).createProtocolDraft(payload, idempotencyKey),
  updateProtocolDraft: async (protocolId, payload) => (await implementation()).updateProtocolDraft(protocolId, payload),
  saveProtocolDraftResults: async (protocolId, payload) => (await implementation()).saveProtocolDraftResults(protocolId, payload),
  quickCreateProtocol: async (params) => (await import('./apiProtocolService')).quickCreateProtocol(params),
  // Snapshot refresh must always use the real transactional backend endpoint.
  refreshLaboratoryData: async (protocolId, version) => (await import('./apiProtocolService')).refreshLaboratoryData(protocolId, version),
  updateProtocol: async (protocolId, payload) => (await implementation()).updateProtocol(protocolId, payload),
  deleteProtocol: async (protocolId, version) => (await implementation()).deleteProtocol(protocolId, version),
  addProtocolResult: async (protocolId, payload, version) => (await implementation()).addProtocolResult(protocolId, payload, version),
  updateProtocolResult: async (protocolId, resultId, payload, version) => (await implementation()).updateProtocolResult(protocolId, resultId, payload, version),
  deleteProtocolResult: async (protocolId, resultId, version) => (await implementation()).deleteProtocolResult(protocolId, resultId, version),
  bulkAssignDevice: async (protocolId, resultIds, measurementDeviceId, version) => (await implementation()).bulkAssignDevice(protocolId, resultIds, measurementDeviceId, version),
  bulkUpdatePlace: async (protocolId, resultIds, measurementPlace, version) => (await implementation()).bulkUpdatePlace(protocolId, resultIds, measurementPlace, version),
  bulkDeleteResults: async (protocolId, resultIds, version) => (await implementation()).bulkDeleteResults(protocolId, resultIds, version),
  getRawMeasurements: async (protocolId, resultId) => (await implementation()).getRawMeasurements(protocolId, resultId),
  saveRawMeasurements: async (protocolId, resultId, payload, methodTemplateId, version) =>
    (await implementation()).saveRawMeasurements(protocolId, resultId, payload, methodTemplateId, version),
  calculateResult: async (protocolId, resultId, version) => (await implementation()).calculateResult(protocolId, resultId, version),
  calculateProtocolSummary: async (protocolId, version) => (await implementation()).calculateProtocolSummary(protocolId, version),
  getCalculationHistory: async (protocolId, resultId) => (await implementation()).getCalculationHistory(protocolId, resultId),
  checkNormatives: async (protocolId, version) => (await implementation()).checkNormatives(protocolId, version),
  readyForApproval: async (protocolId, request) => (await implementation()).readyForApproval(protocolId, request),
  markReadyForApproval: async (protocolId, request) => (await implementation()).markReadyForApproval(protocolId, request),
  approveProtocol: async (protocolId, request) => (await implementation()).approveProtocol(protocolId, request),
  returnForRevision: async (protocolId, request) => (await implementation()).returnForRevision(protocolId, request),
  signProtocol: async (protocolId, request) => (await implementation()).signProtocol(protocolId, request),
  publishToClient: async (protocolId, request) => (await implementation()).publishToClient(protocolId, request),
  replaceProtocol: async (protocolId, request) => (await implementation()).replaceProtocol(protocolId, request),
  createCorrection: async (protocolId, request) => (await implementation()).createCorrection(protocolId, request),
  cancelProtocol: async (protocolId, request) => (await implementation()).cancelProtocol(protocolId, request),
  archiveProtocol: async (protocolId, request) => (await implementation()).archiveProtocol(protocolId, request),
  previewProtocol: async (protocolId) => (await implementation()).previewProtocol(protocolId),
  generateDocx: async (protocolId, version) => (await implementation()).generateDocx(protocolId, version),
  generatePdf: async (protocolId, version) => (await implementation()).generatePdf(protocolId, version),
  downloadDocx: async (protocolId) => (await implementation()).downloadDocx(protocolId),
  downloadPdf: async (protocolId) => (await implementation()).downloadPdf(protocolId),
  importExcel: async (protocolId, file, version) => (await implementation()).importExcel(protocolId, file, version),
  addProtocolMeasurementDevice: async (protocolId, device, version) => (await implementation()).addProtocolMeasurementDevice(protocolId, device, version),
  removeProtocolMeasurementDevice: async (protocolId, deviceId, version) => (await implementation()).removeProtocolMeasurementDevice(protocolId, deviceId, version),
  searchNormative: async (params, signal) => (await implementation()).searchNormative(params, signal),
  searchPollutants: async (query, params, signal) => (await implementation()).searchPollutants(query, params, signal),
  getWeatherConditions: async (params) => (await implementation()).getWeatherConditions(params),
  calculateProtocol: async (protocolId, version) => (await implementation()).calculateProtocol(protocolId, version),
};

export default protocolService;
