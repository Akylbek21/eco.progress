import type {
  CreateProtocolPayload,
  MeasurementDevice,
  NormativeSearchResult,
  Protocol,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';

export type DownloadedProtocolFile = {
  blob: Blob;
  fileName?: string;
};

export interface ProtocolService {
  getProtocols(params?: Record<string, string>): Promise<Protocol[]>;
  getProtocolTemplates(): Promise<ProtocolTemplate[]>;
  getProtocol(protocolId: string): Promise<Protocol>;
  getProtocolById(protocolId: string): Promise<Protocol>;
  createProtocol(payload: CreateProtocolPayload): Promise<Protocol>;
  updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol>;
  deleteProtocol(protocolId: string): Promise<void>;
  addProtocolResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow>;
  updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow>;
  deleteProtocolResult(protocolId: string, resultId: string): Promise<void>;
  checkNormatives(protocolId: string): Promise<Protocol>;
  readyForApproval(protocolId: string): Promise<Protocol>;
  approveProtocol(protocolId: string): Promise<Protocol>;
  returnToDraft(protocolId: string): Promise<Protocol>;
  signProtocol(protocolId: string, cmsSignatureBase64: string): Promise<Protocol>;
  replaceProtocol(protocolId: string, reason: string): Promise<Protocol>;
  cancelProtocol(protocolId: string): Promise<Protocol>;
  previewProtocol(protocolId: string): Promise<Blob>;
  generateDocx(protocolId: string): Promise<Protocol>;
  generatePdf(protocolId: string): Promise<Protocol>;
  downloadDocx(protocolId: string): Promise<DownloadedProtocolFile>;
  downloadPdf(protocolId: string): Promise<DownloadedProtocolFile>;
  importExcel(protocolId: string, file: File): Promise<Protocol>;
  addProtocolMeasurementDevice(protocolId: string, device: MeasurementDevice): Promise<Protocol>;
  removeProtocolMeasurementDevice(protocolId: string, deviceId: string): Promise<Protocol>;
  searchNormative(params: Record<string, string>): Promise<NormativeSearchResult>;
}

export const useProtocolMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';

let implementationPromise: Promise<ProtocolService> | undefined;
const implementation = () => {
  if (!implementationPromise) {
    implementationPromise = useProtocolMocks
      ? import('./mockProtocolService').then((module) => module as unknown as ProtocolService)
      : import('./apiProtocolService').then((module) => module as unknown as ProtocolService);
  }
  return implementationPromise;
};

const protocolService: ProtocolService = {
  getProtocols: async (params) => (await implementation()).getProtocols(params),
  getProtocolTemplates: async () => (await implementation()).getProtocolTemplates(),
  getProtocol: async (protocolId) => (await implementation()).getProtocol(protocolId),
  getProtocolById: async (protocolId) => (await implementation()).getProtocolById(protocolId),
  createProtocol: async (payload) => (await implementation()).createProtocol(payload),
  updateProtocol: async (protocolId, payload) => (await implementation()).updateProtocol(protocolId, payload),
  deleteProtocol: async (protocolId) => (await implementation()).deleteProtocol(protocolId),
  addProtocolResult: async (protocolId, payload) => (await implementation()).addProtocolResult(protocolId, payload),
  updateProtocolResult: async (protocolId, resultId, payload) => (await implementation()).updateProtocolResult(protocolId, resultId, payload),
  deleteProtocolResult: async (protocolId, resultId) => (await implementation()).deleteProtocolResult(protocolId, resultId),
  checkNormatives: async (protocolId) => (await implementation()).checkNormatives(protocolId),
  readyForApproval: async (protocolId) => (await implementation()).readyForApproval(protocolId),
  approveProtocol: async (protocolId) => (await implementation()).approveProtocol(protocolId),
  returnToDraft: async (protocolId) => (await implementation()).returnToDraft(protocolId),
  signProtocol: async (protocolId, cmsSignatureBase64) => (await implementation()).signProtocol(protocolId, cmsSignatureBase64),
  replaceProtocol: async (protocolId, reason) => (await implementation()).replaceProtocol(protocolId, reason),
  cancelProtocol: async (protocolId) => (await implementation()).cancelProtocol(protocolId),
  previewProtocol: async (protocolId) => (await implementation()).previewProtocol(protocolId),
  generateDocx: async (protocolId) => (await implementation()).generateDocx(protocolId),
  generatePdf: async (protocolId) => (await implementation()).generatePdf(protocolId),
  downloadDocx: async (protocolId) => (await implementation()).downloadDocx(protocolId),
  downloadPdf: async (protocolId) => (await implementation()).downloadPdf(protocolId),
  importExcel: async (protocolId, file) => (await implementation()).importExcel(protocolId, file),
  addProtocolMeasurementDevice: async (protocolId, device) => (await implementation()).addProtocolMeasurementDevice(protocolId, device),
  removeProtocolMeasurementDevice: async (protocolId, deviceId) => (await implementation()).removeProtocolMeasurementDevice(protocolId, deviceId),
  searchNormative: async (params) => (await implementation()).searchNormative(params),
};

export default protocolService;
