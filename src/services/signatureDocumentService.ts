import api from './api';
import { extractItem, extractList, unwrapApiData } from './apiHelpers';

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

export interface SignatureDocumentPage {
  items: SignatureDocument[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
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
  async list(page = 0, size = 20, signal?: AbortSignal): Promise<SignatureDocumentPage> {
    const response = await api.get<unknown>(BASE_PATH, { params: { page, size }, signal });
    const payload = unwrapApiData<unknown>(response.data);
    const source = asRecord(payload);
    const items = extractList(payload, ['documents', 'signatureDocuments'])
      .map(normalizeDocument)
      .filter((item) => item.id);
    const responsePage = number(source.page, source.number, page);
    const responseSize = number(source.size, source.pageSize, size) || size;
    const totalElements = number(source.totalElements, source.total, items.length);
    const totalPages = number(source.totalPages, source.pages, responseSize > 0 ? Math.ceil(totalElements / responseSize) : 0);
    return {
      items,
      page: responsePage,
      size: responseSize,
      totalElements,
      totalPages,
      first: typeof source.first === 'boolean' ? source.first : responsePage === 0,
      last: typeof source.last === 'boolean' ? source.last : totalPages === 0 || responsePage >= totalPages - 1,
      hasNext: typeof source.hasNext === 'boolean' ? source.hasNext : responsePage + 1 < totalPages,
      hasPrevious: typeof source.hasPrevious === 'boolean' ? source.hasPrevious : responsePage > 0,
    };
  },

  async upload(file: File, name = file.name): Promise<SignatureDocument> {
    const form = new FormData();
    form.append('file', file);
    form.append('title', name.trim() || file.name);
    const response = await api.post<unknown>(BASE_PATH, form);
    return normalizeDocument(extractItem(response.data, ['document', 'signatureDocument']));
  },

  async downloadOriginal(document: SignatureDocument): Promise<DownloadedSignatureFile> {
    const response = await api.get<Blob>(`${BASE_PATH}/${document.id}/content`, { responseType: 'blob' });
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
    await api.post(`${BASE_PATH}/${payload.documentId}/signatures`, payload);
  },

  async downloadSignedPackage(document: SignatureDocument): Promise<DownloadedSignatureFile> {
    const response = await api.get<Blob>(`${BASE_PATH}/${document.id}/signed-package`, { responseType: 'blob' });
    return {
      blob: response.data,
      fileName: fileNameFromDisposition(response.headers['content-disposition'], `${document.name || document.fileName}-signed.zip`),
    };
  },
};
