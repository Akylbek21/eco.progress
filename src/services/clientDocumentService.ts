import api from './api';
import { getApiErrorMessage, getContentDispositionFileName, unwrapApiResponse, type ApiResponse } from './apiHelpers';
import { validateClientFile } from '../config/clientFiles';
import type { ClientDocumentCategory } from '../types/clientWorkflow';
import type { DocumentItem, Order, OrderPrimaryDocument } from '../types';
import { mapDocument, mapOrder } from './backendAdapters';

export const CLIENT_DOCUMENT_CATEGORIES: readonly ClientDocumentCategory[] = [
  'CLIENT_DOCUMENT', 'PAYMENT_RECEIPT', 'SUPPORTING_DOCUMENT', 'OTHER_CLIENT_DOCUMENT',
];

export interface ClientDocumentUploadPayload { file: File; category: ClientDocumentCategory; comment?: string }

export const uploadClientDocument = async (orderId: string, payload: ClientDocumentUploadPayload): Promise<DocumentItem> => {
  const fileError = validateClientFile(payload.file);
  if (fileError) throw new Error(fileError);
  if (!CLIENT_DOCUMENT_CATEGORIES.includes(payload.category)) throw new Error('Недоступная категория клиентского документа.');
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('category', payload.category);
  formData.append('comment', payload.comment?.trim() || '');
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/documents`, formData);
  return mapDocument(unwrapApiResponse(data) as Record<string, unknown>, orderId);
};

export const uploadClientPrimaryDocument = async (orderId: string, documentId: string, file: File, comment = ''): Promise<OrderPrimaryDocument> => {
  const fileError = validateClientFile(file);
  if (fileError) throw new Error(fileError);
  const formData = new FormData();
  formData.append('file', file);
  formData.append('comment', comment.trim());
  const { data } = await api.post<ApiResponse<OrderPrimaryDocument>>(`/client/orders/${orderId}/primary-documents/${documentId}/upload`, formData);
  return unwrapApiResponse(data);
};

export const deleteClientPrimaryDocument = async (orderId: string, documentId: string): Promise<Order | undefined> => {
  const { data } = await api.delete<ApiResponse<unknown>>(`/client/orders/${orderId}/primary-documents/${documentId}/file`);
  return mapOrder(unwrapApiResponse(data) as Record<string, unknown>);
};

export const sendClientPrimaryDocumentForReview = async (orderId: string, documentId: string, clientComment = ''): Promise<Order | undefined> => {
  const { data } = await api.post<ApiResponse<unknown>>(`/client/orders/${orderId}/primary-documents/${documentId}/review`, { clientComment });
  return mapOrder(unwrapApiResponse(data) as Record<string, unknown>);
};

const safeFileName = (value: string) => value.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'document';

export const downloadAuthorizedBlob = async (endpoint: string, fallbackName = 'document'): Promise<void> => {
  try {
    const response = await api.get<Blob>(endpoint, { responseType: 'blob' });
    const blob = response.data;
    if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Сервер вернул пустой файл.');
    const contentType = String(response.headers['content-type'] || blob.type || '').toLowerCase();
    if (contentType.includes('text/html') || contentType.includes('application/json')) throw new Error('Сервер вернул повреждённый файл.');
    const headerName = getContentDispositionFileName(response.headers['content-disposition']);
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = safeFileName(headerName || fallbackName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Не удалось скачать документ.'));
  }
};

// NOTE: there is no per-order/per-document download route on the backend - every stored file
// (client documents, primary documents, laboratory results, quarter documents alike) is served
// through a single generic, ownership-checked FileController endpoint in kz.eco.storage, and each
// document object the backend returns already carries that exact endpoint's path in its own
// `fileUrl` field (see DocumentItem/OrderPrimaryDocument/LaboratoryResultDocument types and
// FileController's authorize() javadoc). So downloading a document means fetching its `fileUrl`
// directly, never building a path out of orderId+documentId.

export const getClientDocumentBlob = async (fileUrl: string): Promise<Blob> => {
  const response = await api.get<Blob>(fileUrl, { responseType: 'blob' });
  if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('Сервер вернул пустой файл.');
  const contentType = String(response.headers['content-type'] || response.data.type || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json')) throw new Error('Сервер вернул повреждённый файл.');
  return response.data;
};

const downloadByFileUrl = (fileUrl: string | undefined, fallbackName: string): Promise<void> => {
  if (!fileUrl) return Promise.reject(new Error('Файл ещё не загружен.'));
  return downloadAuthorizedBlob(fileUrl, fallbackName);
};

export const downloadClientDocument = (fileUrl: string | undefined, fallbackName = 'document') =>
  downloadByFileUrl(fileUrl, fallbackName);
export const downloadClientPrimaryDocument = (fileUrl: string | undefined, fallbackName = 'document') =>
  downloadByFileUrl(fileUrl, fallbackName);
export const downloadClientLaboratoryDocument = (fileUrl: string | undefined, fallbackName = 'laboratory-document') =>
  downloadByFileUrl(fileUrl, fallbackName);
export const downloadClientQuarterDocument = (fileUrl: string | undefined, fallbackName = 'quarter-document') =>
  downloadByFileUrl(fileUrl, fallbackName);
