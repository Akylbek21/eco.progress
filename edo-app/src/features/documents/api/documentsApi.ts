import { edoApiClient } from '../../../shared/api/edoApiClient';
import type { PageResult } from '../../../shared/types/domain';
import type { DashboardData, DocumentDetails, DocumentFilters, DocumentSummary, DocumentType } from '../types';
import type { AuthorizedDownloadResponse } from '../../../shared/lib/authorizedDownload';

const compact = <T extends object>(value: T) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && item !== false));
const ifMatch = (version: number) => `"${version}"`;

// Every route on this object lives on the backend under /api/document-flow, not bare /api
// (see kz.ecoprogress.documentflow.document.DocumentController) - edoApiClient's baseURL only
// carries /api, so every path here must include this prefix explicitly.
const DF = '/document-flow';

export const documentsApi = {
  async dashboard(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DashboardData>(`${DF}/dashboard`, { signal });
    return data;
  },
  async types(signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DocumentType[]>(`${DF}/document-types`, { signal });
    return data;
  },
  async list(filters: DocumentFilters, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<PageResult<DocumentSummary>>(`${DF}/documents`, { params: compact(filters), signal });
    return data;
  },
  async details(id: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.get<DocumentDetails>(`${DF}/documents/${id}`, { signal });
    return data;
  },
  async createDraft(payload: Record<string, unknown>, idempotencyKey: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.post<DocumentDetails>(`${DF}/documents`, payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
      signal,
    });
    return data;
  },
  async upload(documentId: string, version: number, file: File, signal?: AbortSignal, onProgress?: (percent: number) => void) {
    const form = new FormData();
    form.append('file', file);
    // Backend route is singular /file (DocumentController.java:150), not /files.
    const { data } = await edoApiClient.post<DocumentDetails>(`${DF}/documents/${documentId}/file`, form, {
      headers: { 'If-Match': ifMatch(version) },
      signal,
      onUploadProgress: (event) => onProgress?.(event.total ? Math.round((event.loaded / event.total) * 100) : 0),
    });
    return data;
  },
  /** Backend has no /documents/{id}/send route - "sending" a document is
   *  DocumentFlowSigningController's POST /documents/{id}/send-for-signing, which returns a
   *  SigningRouteResponse, not a DocumentDetails. Path fixed here; response type below is a
   *  placeholder cast until the caller is updated to consume the route response - see the
   *  gaps report for this specific TODO. */
  async send(documentId: string, version: number, idempotencyKey: string, signal?: AbortSignal) {
    const { data } = await edoApiClient.post<DocumentDetails>(`${DF}/documents/${documentId}/send-for-signing`, undefined, {
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
    // Backend: plain file is GET .../download (DocumentController.java:167); the signed ZIP
    // package is GET .../signed-package, which lives on DocumentFlowSigningController instead
    // (same base path prefix though, so no separate client needed).
    const path = kind === 'file' ? 'download' : 'signed-package';
    const response = await edoApiClient.get<Blob>(`${DF}/documents/${documentId}/${path}`, {
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
