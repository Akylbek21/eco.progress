import api from './api';
import { extractItem, extractList } from './apiHelpers';

const BASE_PATH = '/staff/signature-documents';

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (...values: unknown[]): string => {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim());
  return value === undefined ? '' : String(value);
};
const number = (...values: unknown[]): number => {
  const value = values.find((item) => item !== undefined && item !== null && Number.isFinite(Number(item)));
  return value === undefined ? 0 : Number(value);
};

export type SignatureDocumentStatus = 'UNSIGNED' | 'SIGNED';

export interface SignatureDocument {
  id: string;
  name: string;
  fileName: string;
  uploadedAt: string;
  status: SignatureDocumentStatus;
  signedAt?: string;
  version: number;
}

export interface PrepareSignatureDocumentResponse {
  signingSessionId: string;
  documentId: string;
  version: number;
  sha256: string;
}

export interface SubmitSignatureDocumentPayload extends PrepareSignatureDocumentResponse {
  cmsBase64: string;
}

export interface DownloadedSignatureFile {
  blob: Blob;
  fileName: string;
}

const normalizeDocument = (raw: unknown): SignatureDocument => {
  const source = asRecord(raw);
  const rawStatus = text(source.status, source.signatureStatus).toUpperCase();
  return {
    id: text(source.id, source.documentId),
    name: text(source.name, source.title, source.fileName, source.originalFileName, 'Документ'),
    fileName: text(source.fileName, source.originalFileName, source.name, 'документ'),
    uploadedAt: text(source.uploadedAt, source.createdAt, source.uploadDate),
    status: rawStatus === 'SIGNED' ? 'SIGNED' : 'UNSIGNED',
    signedAt: text(source.signedAt, source.signatureDate) || undefined,
    version: number(source.version, 0),
  };
};

const fileNameFromDisposition = (disposition: unknown, fallback: string): string => {
  const value = typeof disposition === 'string' ? disposition : '';
  const utf = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf) {
    try { return decodeURIComponent(utf); } catch { return utf; }
  }
  return value.match(/filename="?([^";]+)"?/i)?.[1] || fallback;
};

export const signatureDocumentService = {
  async list(signal?: AbortSignal): Promise<SignatureDocument[]> {
    const response = await api.get<unknown>(BASE_PATH, { signal });
    return extractList(response.data, ['documents', 'signatureDocuments']).map(normalizeDocument).filter((item) => item.id);
  },

  async upload(file: File, name = file.name): Promise<SignatureDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('name', name.trim() || file.name);
    const response = await api.post<unknown>(BASE_PATH, form);
    return normalizeDocument(extractItem(response.data, ['document', 'signatureDocument']));
  },

  async downloadOriginal(document: SignatureDocument): Promise<DownloadedSignatureFile> {
    const response = await api.get<Blob>(`${BASE_PATH}/${document.id}/original`, { responseType: 'blob' });
    return { blob: response.data, fileName: fileNameFromDisposition(response.headers['content-disposition'], document.fileName) };
  },

  async prepareSigning(document: SignatureDocument): Promise<PrepareSignatureDocumentResponse> {
    const response = await api.post<unknown>(`${BASE_PATH}/${document.id}/prepare-signing`, { version: document.version });
    const source = asRecord(extractItem(response.data, ['signing', 'signingSession']));
    return {
      signingSessionId: text(source.signingSessionId, source.sessionId),
      documentId: text(source.documentId, document.id),
      version: number(source.version, document.version),
      sha256: text(source.sha256, source.hash),
    };
  },

  async downloadSigningContent(prepared: PrepareSignatureDocumentResponse): Promise<Blob> {
    const response = await api.get<Blob>(`${BASE_PATH}/${prepared.documentId}/content`, {
      params: { signingSessionId: prepared.signingSessionId },
      responseType: 'blob',
    });
    return response.data;
  },

  async submitSignature(payload: SubmitSignatureDocumentPayload): Promise<void> {
    await api.post(`${BASE_PATH}/${payload.documentId}/sign`, payload);
  },

  async downloadSignedPackage(document: SignatureDocument): Promise<DownloadedSignatureFile> {
    const response = await api.get<Blob>(`${BASE_PATH}/${document.id}/signed-package`, { responseType: 'blob' });
    return {
      blob: response.data,
      fileName: fileNameFromDisposition(response.headers['content-disposition'], `${document.name || document.fileName}-signed.zip`),
    };
  },
};

