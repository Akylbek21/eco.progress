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

export const getClientDocumentBlob = async (orderId: string, documentId: string): Promise<Blob> => {
  const response = await api.get<Blob>(`/client/orders/${orderId}/documents/${documentId}/download`, { responseType: 'blob' });
  if (!(response.data instanceof Blob) || response.data.size === 0) throw new Error('Сервер вернул пустой файл.');
  const contentType = String(response.headers['content-type'] || response.data.type || '').toLowerCase();
  if (contentType.includes('text/html') || contentType.includes('application/json')) throw new Error('Сервер вернул повреждённый файл.');
  return response.data;
};

export const downloadClientDocument = (orderId: string, documentId: string | number, fallbackName = 'document') =>
  downloadAuthorizedBlob(`/client/orders/${orderId}/documents/${documentId}/download`, fallbackName);
export const downloadClientPrimaryDocument = (orderId: string, documentId: string | number, fallbackName = 'document') =>
  downloadAuthorizedBlob(`/client/orders/${orderId}/primary-documents/${documentId}/download`, fallbackName);
export const downloadClientLaboratoryDocument = (orderId: string, documentId: string | number, fallbackName = 'laboratory-document') =>
  downloadAuthorizedBlob(`/client/orders/${orderId}/laboratory/documents/${documentId}/download`, fallbackName);
export const downloadClientQuarterDocument = (orderId: string, quarterId: string, documentId: string | number, fallbackName = 'quarter-document') =>
  downloadAuthorizedBlob(`/client/orders/${orderId}/quarters/${quarterId}/documents/${documentId}/download`, fallbackName);
