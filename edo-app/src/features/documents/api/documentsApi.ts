import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { PageResult } from '../../../shared/types/domain';
import type { DashboardData, DocumentDetails, DocumentFilters, DocumentSummary, DocumentType } from '../types';
import type { AuthorizedDownloadResponse } from '../../../shared/lib/authorizedDownload';

const compact = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && item !== false));
const ifMatch = (version: number) => `"${version}"`;

export const documentsApi = {
  async dashboard(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DashboardData>('/dashboard', { signal });
    return data;
  },
  async types(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DocumentType[]>('/document-types', { signal });
    return data;
  },
  async list(filters: DocumentFilters, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<PageResult<DocumentSummary>>('/documents', { params: compact(filters), signal });
    return data;
  },
  async details(id: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DocumentDetails>(`/documents/${id}`, { signal });
    return data;
  },
  async createDraft(payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.post<DocumentDetails>('/documents', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    });
    return data;
  },
  async upload(documentId: string, version: number, file: File, signal?: AbortSignal, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append('file', file);
    const { data } = await edoApiClient.post<DocumentDetails>(`/documents/${documentId}/files`, form, {
      headers: { 'If-Match': ifMatch(version) },
      signal,
      onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
    return data;
  },
  async send(documentId: string, version: number, idempotencyKey: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.post<DocumentDetails>(`/documents/${documentId}/send`, { version }, {
      headers: { 'Idempotency-Key': idempotencyKey, 'If-Match': ifMatch(version) },
      signal,
    });
    return data;
  },
  async download(
    documentId: string,
    kind: 'file' | 'signed-package',
    signal?: AbortSignal,
    onProgress?: (percent: number) => void,
  ): Promise<AuthorizedDownloadResponse> {
    const response = await edoApiClient.get<Blob>(`/documents/${documentId}/${kind}`, {
      responseType: 'blob',
      signal,
      onDownloadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
    return {
      blob: response.data,
      contentDisposition: response.headers['content-disposition'] as string | undefined,
      contentType: response.headers['content-type'] as string | undefined,
    };
  },
};
