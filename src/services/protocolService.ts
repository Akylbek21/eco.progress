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
  QuickProtocolCreatePayload,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';

export type ProtocolSignRequest = {
  cmsSignatureBase64: string;
  fileHash: string;
  fileId?: string;
  version?: number;
};

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
  getProtocolById(protocolId: string): Promise<Protocol>;
  createProtocol(payload: CreateProtocolPayload): Promise<Protocol>;
  quickCreateProtocol(payload: QuickProtocolCreatePayload, idempotencyKey?: string): Promise<Protocol>;
  refreshLaboratoryData(protocolId: string): Promise<Protocol>;
  updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol>;
  deleteProtocol(protocolId: string): Promise<void>;
  addProtocolResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow>;
  updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow>;
  deleteProtocolResult(protocolId: string, resultId: string): Promise<void>;
  bulkUpdateProtocolResults(protocolId: string, resultIds: string[], patch: Record<string, unknown>): Promise<Protocol>;
  bulkDeleteProtocolResults(protocolId: string, resultIds: string[]): Promise<Protocol>;
  getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse>;
  saveRawMeasurements(
    protocolId: string,
    resultId: string,
    payload: RawMeasurementRequest[],
    methodTemplateId?: string | number | null,
  ): Promise<ProtocolResultRow | undefined>;
  calculateResult(protocolId: string, resultId: string): Promise<CalculationResultResponse>;
  calculateProtocolSummary(protocolId: string): Promise<ProtocolCalculationSummaryResponse>;
  getCalculationHistory(protocolId: string, resultId: string): Promise<CalculationResultResponse[]>;
  checkNormatives(protocolId: string): Promise<Protocol>;
  readyForApproval(protocolId: string, version?: number): Promise<Protocol>;
  markReadyForApproval(protocolId: string, version?: number): Promise<Protocol>;
  approveProtocol(protocolId: string, version?: number): Promise<Protocol>;
  returnForRevision(protocolId: string, reason: string, version?: number): Promise<Protocol>;
  signProtocol(protocolId: string, payload: ProtocolSignRequest): Promise<Protocol>;
  publishToClient(protocolId: string, version?: number): Promise<Protocol>;
  replaceProtocol(protocolId: string, reason: string): Promise<Protocol>;
  createCorrection(protocolId: string, reason: string): Promise<Protocol>;
  cancelProtocol(protocolId: string): Promise<Protocol>;
  archiveProtocol(protocolId: string): Promise<Protocol>;
  previewProtocol(protocolId: string): Promise<Blob>;
  generateDocx(protocolId: string): Promise<Protocol>;
  generatePdf(protocolId: string): Promise<Protocol>;
  downloadDocx(protocolId: string): Promise<DownloadedProtocolFile>;
  downloadPdf(protocolId: string): Promise<DownloadedProtocolFile>;
  importExcel(protocolId: string, file: File): Promise<Protocol>;
  addProtocolMeasurementDevice(protocolId: string, device: MeasurementDevice): Promise<Protocol>;
  removeProtocolMeasurementDevice(protocolId: string, deviceId: string): Promise<Protocol>;
  searchNormative(params: Record<string, string>, signal?: AbortSignal): Promise<NormativeSearchResult>;
  searchPollutants(query: string, params?: Record<string, string>, signal?: AbortSignal): Promise<Pollutant[]>;
  getWeatherConditions(params: {
    objectId: string | number;
    coordinates?: string;
    date: string;
    time: string;
    signal?: AbortSignal;
  }): Promise<WeatherConditions>;
  calculateProtocol(protocolId: string): Promise<Protocol>;
}

// CRM protocols always use the production contract. The mock module remains only
// as isolated test data and is never selected by the application at runtime.
export const useProtocolMocks = false;

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
  getProtocolById: async (protocolId) => (await implementation()).getProtocolById(protocolId),
  createProtocol: async (payload) => (await implementation()).createProtocol(payload),
  quickCreateProtocol: async (payload, idempotencyKey) => (await import('./apiProtocolService')).quickCreateProtocol(payload, idempotencyKey),
  // Snapshot refresh must always use the real transactional backend endpoint.
  refreshLaboratoryData: async (protocolId) => (await import('./apiProtocolService')).refreshLaboratoryData(protocolId),
  updateProtocol: async (protocolId, payload) => (await implementation()).updateProtocol(protocolId, payload),
  deleteProtocol: async (protocolId) => (await implementation()).deleteProtocol(protocolId),
  addProtocolResult: async (protocolId, payload) => (await implementation()).addProtocolResult(protocolId, payload),
  updateProtocolResult: async (protocolId, resultId, payload) => (await implementation()).updateProtocolResult(protocolId, resultId, payload),
  deleteProtocolResult: async (protocolId, resultId) => (await implementation()).deleteProtocolResult(protocolId, resultId),
  bulkUpdateProtocolResults: async (protocolId, resultIds, patch) => (await implementation()).bulkUpdateProtocolResults(protocolId, resultIds, patch),
  bulkDeleteProtocolResults: async (protocolId, resultIds) => (await implementation()).bulkDeleteProtocolResults(protocolId, resultIds),
  getRawMeasurements: async (protocolId, resultId) => (await implementation()).getRawMeasurements(protocolId, resultId),
  saveRawMeasurements: async (protocolId, resultId, payload, methodTemplateId) =>
    (await implementation()).saveRawMeasurements(protocolId, resultId, payload, methodTemplateId),
  calculateResult: async (protocolId, resultId) => (await implementation()).calculateResult(protocolId, resultId),
  calculateProtocolSummary: async (protocolId) => (await implementation()).calculateProtocolSummary(protocolId),
  getCalculationHistory: async (protocolId, resultId) => (await implementation()).getCalculationHistory(protocolId, resultId),
  checkNormatives: async (protocolId) => (await implementation()).checkNormatives(protocolId),
  readyForApproval: async (protocolId, version) => (await implementation()).readyForApproval(protocolId, version),
  markReadyForApproval: async (protocolId, version) => (await implementation()).markReadyForApproval(protocolId, version),
  approveProtocol: async (protocolId, version) => (await implementation()).approveProtocol(protocolId, version),
  returnForRevision: async (protocolId, reason, version) => (await implementation()).returnForRevision(protocolId, reason, version),
  signProtocol: async (protocolId, payload) => (await implementation()).signProtocol(protocolId, payload),
  publishToClient: async (protocolId, version) => (await implementation()).publishToClient(protocolId, version),
  replaceProtocol: async (protocolId, reason) => (await implementation()).replaceProtocol(protocolId, reason),
  createCorrection: async (protocolId, reason) => (await implementation()).createCorrection(protocolId, reason),
  cancelProtocol: async (protocolId) => (await implementation()).cancelProtocol(protocolId),
  archiveProtocol: async (protocolId) => (await implementation()).archiveProtocol(protocolId),
  previewProtocol: async (protocolId) => (await implementation()).previewProtocol(protocolId),
  generateDocx: async (protocolId) => (await implementation()).generateDocx(protocolId),
  generatePdf: async (protocolId) => (await implementation()).generatePdf(protocolId),
  downloadDocx: async (protocolId) => (await implementation()).downloadDocx(protocolId),
  downloadPdf: async (protocolId) => (await implementation()).downloadPdf(protocolId),
  importExcel: async (protocolId, file) => (await implementation()).importExcel(protocolId, file),
  addProtocolMeasurementDevice: async (protocolId, device) => (await implementation()).addProtocolMeasurementDevice(protocolId, device),
  removeProtocolMeasurementDevice: async (protocolId, deviceId) => (await implementation()).removeProtocolMeasurementDevice(protocolId, deviceId),
  searchNormative: async (params, signal) => (await implementation()).searchNormative(params, signal),
  searchPollutants: async (query, params, signal) => (await implementation()).searchPollutants(query, params, signal),
  getWeatherConditions: async (params) => (await implementation()).getWeatherConditions(params),
  calculateProtocol: async (protocolId) => (await implementation()).calculateProtocol(protocolId),
};

export default protocolService;
