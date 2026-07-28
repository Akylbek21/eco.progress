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
  SignProtocolResponse,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';
import type { QuickCreateProtocolApiRequest } from '../features/protocols/api/protocolContracts';

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
  quickCreateProtocol(payload: QuickCreateProtocolApiRequest, idempotencyKey: string): Promise<Protocol>;
  refreshLaboratoryData(protocolId: string): Promise<Protocol>;
  updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol>;
  deleteProtocol(protocolId: string, version?: number): Promise<void>;
  addProtocolResult(protocolId: string, payload: ProtocolResultPayload, version?: number): Promise<ProtocolResultRow>;
  updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload, version?: number): Promise<ProtocolResultRow>;
  deleteProtocolResult(protocolId: string, resultId: string, version?: number): Promise<void>;
  bulkAssignDevice(protocolId: string, resultIds: string[], measurementDeviceId: string | number, version?: number): Promise<Protocol>;
  bulkUpdatePlace(protocolId: string, resultIds: string[], measurementPlace: string, version?: number): Promise<Protocol>;
  bulkDeleteResults(protocolId: string, resultIds: string[], version?: number): Promise<Protocol>;
  getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse>;
  saveRawMeasurements(
    protocolId: string,
    resultId: string,
    payload: RawMeasurementRequest[],
    methodTemplateId?: string | number | null,
    version?: number,
  ): Promise<ProtocolResultRow | undefined>;
  calculateResult(protocolId: string, resultId: string, version?: number): Promise<CalculationResultResponse>;
  calculateProtocolSummary(protocolId: string, version?: number): Promise<ProtocolCalculationSummaryResponse>;
  getCalculationHistory(protocolId: string, resultId: string): Promise<CalculationResultResponse[]>;
  checkNormatives(protocolId: string, version?: number): Promise<Protocol>;
  readyForApproval(protocolId: string, version?: number): Promise<Protocol>;
  markReadyForApproval(protocolId: string, version?: number): Promise<Protocol>;
  approveProtocol(protocolId: string, version?: number): Promise<Protocol>;
  returnForRevision(protocolId: string, reason: string, version?: number): Promise<Protocol>;
  signProtocol(protocolId: string | number, version: number): Promise<SignProtocolResponse>;
  publishToClient(protocolId: string, version?: number): Promise<Protocol>;
  replaceProtocol(protocolId: string, reason: string): Promise<Protocol>;
  createCorrection(protocolId: string, reason: string, version?: number): Promise<Protocol>;
  cancelProtocol(protocolId: string, version?: number): Promise<Protocol>;
  archiveProtocol(protocolId: string, version?: number): Promise<Protocol>;
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
  readyForApproval: async (protocolId, version) => (await implementation()).readyForApproval(protocolId, version),
  markReadyForApproval: async (protocolId, version) => (await implementation()).markReadyForApproval(protocolId, version),
  approveProtocol: async (protocolId, version) => (await implementation()).approveProtocol(protocolId, version),
  returnForRevision: async (protocolId, reason, version) => (await implementation()).returnForRevision(protocolId, reason, version),
  signProtocol: async (protocolId, version) => (await implementation()).signProtocol(protocolId, version),
  publishToClient: async (protocolId, version) => (await implementation()).publishToClient(protocolId, version),
  replaceProtocol: async (protocolId, reason) => (await implementation()).replaceProtocol(protocolId, reason),
  createCorrection: async (protocolId, reason, version) => (await implementation()).createCorrection(protocolId, reason, version),
  cancelProtocol: async (protocolId, version) => (await implementation()).cancelProtocol(protocolId, version),
  archiveProtocol: async (protocolId, version) => (await implementation()).archiveProtocol(protocolId, version),
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
