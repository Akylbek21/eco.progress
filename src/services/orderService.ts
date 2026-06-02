import api from './api';
import type {
  CommentItem,
  DocumentItem,
  LaboratoryMeasurementAgreement,
  LaboratoryPrimaryDocument,
  NotificationItem,
  Order,
  OrderPrimaryDocument,
  RequestQuarter,
  UploadDocumentPayload,
} from '../types';
import { mapDocument, mapOrder, mapOrders } from './backendAdapters';
import { signBase64WithNCALayer } from './ncalayer';

export const primaryDocumentTemplates = [
  'Карточка компании',
  'Реквизиты',
  'БИН / ИИН',
  'Адрес объекта',
  'Договор аренды / право собственности',
  'Предыдущие экологические документы',
] as const;

export const getOrders = async (): Promise<Order[]> => {
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/client/orders');
  return mapOrders(data.data as never[]);
};

export const getClientOrders = async (): Promise<Order[]> => getOrders();

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  const { data } = await api.get<{ data: unknown; message: string | null }>(`/client/orders/${id}`);
  return mapOrder(data.data as never);
};

export type CreateOrderPayload = {
  contactPerson: string;
  phone: string;
  email: string;
  companyName: string;
  bin: string;
  city?: string;
  objectAddress?: string;
  serviceId: string;
  service: string;
  urgency: string;
  comment: string;
  contractType?: 'one_time' | 'annual_quarterly';
  signatureProvider?: string;
  paymentMethod?: string;
  fileName?: string;
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const { data } = await api.post<{ data: unknown; message: string | null }>('/client/orders', payload);
  return mapOrder(data.data as never);
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client'): Promise<CommentItem> => {
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/client/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

const appendFileMetadata = (formData: FormData, file: File, title?: string) => {
  const documentName = title?.trim() || file.name || 'Документ';
  formData.append('name', documentName);
  formData.append('title', documentName);
  formData.append('fileName', file.name || documentName);
  formData.append('fileType', file.type || 'application/octet-stream');
  formData.append('fileSize', String(file.size || 0));
};

export const uploadDocument = async (orderId: string, fileOrPayload: File | UploadDocumentPayload, type?: string): Promise<DocumentItem> => {
  const isFile = fileOrPayload instanceof File;
  const file = isFile ? fileOrPayload : fileOrPayload.file;
  const formData = new FormData();
  formData.append('file', file);
  appendFileMetadata(formData, file, isFile ? file.name : fileOrPayload.title);
  if (isFile) {
    if (type) formData.append('type', type);
  } else {
    formData.append('type', fileOrPayload.type);
    formData.append('comment', fileOrPayload.comment || '');
    formData.append('sendToClient', String(Boolean(fileOrPayload.sendToClient)));
    formData.append('needsSignature', String(Boolean(fileOrPayload.needsSignature)));
    formData.append('needsClientResponse', String(Boolean(fileOrPayload.needsClientResponse)));
    if (fileOrPayload.dueDate) formData.append('dueDate', fileOrPayload.dueDate);
  }
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/client/orders/${orderId}/documents`, formData);
  return mapDocument(data.data as never, orderId);
};

export const uploadSignedContract = async (
  orderId: string,
  payload: { file: File; comment?: string },
): Promise<{ document: DocumentItem; message: string | null }> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  appendFileMetadata(formData, payload.file, payload.file.name || 'Подписанный договор');
  formData.append('type', 'contract');
  formData.append('comment', payload.comment?.trim() || 'Клиент загрузил подписанный договор');
  formData.append('sendToClient', 'false');
  formData.append('needsSignature', 'false');
  formData.append('needsClientResponse', 'false');
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/client/orders/${orderId}/documents`, formData);
  return { document: mapDocument(data.data as never, orderId), message: data.message };
};

export type ContractSignaturePayload = {
  signatureProvider?: string;
  signedCms?: string;
  signerSubject?: string;
  documentId?: string;
  signedAt?: string;
};

export const signOrderContract = async (orderId: string, payload: string | ContractSignaturePayload = 'NCALayer') => {
  const body = typeof payload === 'string' ? { signatureProvider: payload } : { signatureProvider: 'NCALayer', ...payload };
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/client/orders/${orderId}/contract/sign`, body);
  return mapOrder(data.data as never);
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const fileUrlToApiPath = (document: DocumentItem) => {
  const fileUrl = document.fileUrl || `/api/files/documents/${encodeURIComponent(document.id)}`;
  if (fileUrl.startsWith('/api/')) return fileUrl.slice(4);
  return fileUrl;
};

export const signOrderContractWithNCALayer = async (orderId: string, document: DocumentItem) => {
  const filePath = fileUrlToApiPath(document);
  const { data: fileBytes } = await api.get<ArrayBuffer>(filePath, { responseType: 'arraybuffer' });
  const { signedCms, signerSubject } = await signBase64WithNCALayer(arrayBufferToBase64(fileBytes));
  return signOrderContract(orderId, {
    signatureProvider: 'NCALayer',
    signedCms,
    signerSubject,
    documentId: document.id,
    signedAt: new Date().toISOString(),
  });
};

export type ClientDocumentResponsePayload = {
  action: 'accept' | 'reject' | 'sign';
  comment?: string;
  signedCms?: string;
  signerSubject?: string;
};

export const respondOrderDocument = async (
  orderId: string,
  documentId: string,
  payload: ClientDocumentResponsePayload,
) => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/documents/${documentId}/respond`,
    payload,
  );
  return data.data;
};

export const signDocumentForResponse = async (document: Pick<DocumentItem, 'id' | 'fileUrl'>) => {
  const filePath = fileUrlToApiPath(document as DocumentItem);
  const { data: fileBytes } = await api.get<ArrayBuffer>(filePath, { responseType: 'arraybuffer' });
  return signBase64WithNCALayer(arrayBufferToBase64(fileBytes));
};

export const payOrderOnline = async (orderId: string, method: string) => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/client/orders/${orderId}/pay`, { paymentMethod: method });
  return mapOrder(data.data as never);
};

export const getQuarters = async (orderId: string): Promise<RequestQuarter[]> => {
  const { data } = await api.get<{ data: RequestQuarter[]; message: string | null }>(`/client/orders/${orderId}/quarters`);
  return data.data;
};

export const getQuarterDetail = async (orderId: string, quarterId: string): Promise<RequestQuarter> => {
  const { data } = await api.get<{ data: RequestQuarter; message: string | null }>(`/client/orders/${orderId}/quarters/${quarterId}`);
  return data.data;
};

export const uploadQuarterDocument = async (
  orderId: string,
  quarterId: string,
  file: File,
  documentType = 'client_data',
) => {
  const formData = new FormData();
  formData.append('file', file);
  appendFileMetadata(formData, file, file.name);
  formData.append('type', documentType);
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/quarters/${quarterId}/documents`,
    formData,
  );
  return data.data;
};

export const uploadPrimaryDocument = async (
  orderId: string,
  documentId: string,
  fileOrName: File | string,
  clientComment = '',
): Promise<OrderPrimaryDocument | undefined> => {
  if (fileOrName instanceof File) {
    const formData = new FormData();
    formData.append('file', fileOrName);
    appendFileMetadata(formData, fileOrName, fileOrName.name);
    formData.append('comment', clientComment);
    formData.append('documentId', documentId);
    const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
      `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
      formData,
    );
    return data.data;
  }
  const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
    `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
    (() => {
      const formData = new FormData();
      const placeholder = new File([fileOrName], fileOrName || 'document.txt', { type: 'text/plain' });
      formData.append('file', placeholder);
      appendFileMetadata(formData, placeholder, fileOrName || 'document.txt');
      formData.append('comment', clientComment);
      formData.append('documentId', documentId);
      return formData;
    })(),
  );
  return data.data;
};

export const deletePrimaryDocumentFile = async (orderId: string, documentId: string): Promise<Order | undefined> => {
  const { data } = await api.delete<{ data: unknown; message: string | null }>(`/client/orders/${orderId}/primary-documents/${documentId}/file`);
  return mapOrder(data.data as never);
};

export const sendPrimaryDocumentsForReview = async (orderId: string, clientComment = ''): Promise<Order | undefined> => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/client/orders/${orderId}/primary-documents/review`, { clientComment });
  return mapOrder(data.data as never);
};

export const sendPrimaryDocumentForReview = async (orderId: string, documentId: string, clientComment = ''): Promise<Order | undefined> => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/client/orders/${orderId}/primary-documents/${documentId}/review`, { clientComment });
  return mapOrder(data.data as never);
};

export const uploadLaboratoryPrimaryDocument = async (
  orderId: string,
  documentId: string,
  file: File,
  comment = '',
): Promise<{ order?: Order; document?: LaboratoryPrimaryDocument }> => {
  const formData = new FormData();
  formData.append('file', file);
  appendFileMetadata(formData, file, file.name);
  formData.append('comment', comment);
  formData.append('documentId', documentId);
  const { data } = await api.post<{ data: { order?: Order; document?: LaboratoryPrimaryDocument }; message: string | null }>(
    `/client/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    formData,
  );
  return data.data;
};

export const respondLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: { action: 'accept' | 'reschedule'; rescheduleDate?: string; rescheduleTime?: string; comment?: string },
): Promise<LaboratoryMeasurementAgreement | undefined> => {
  const status = payload.action === 'reschedule' ? 'rescheduled' : 'accepted';
  const { data } = await api.post<{ data: LaboratoryMeasurementAgreement; message: string | null }>(
    `/client/orders/${orderId}/laboratory/measurement/respond`,
    {
      status,
      comment: payload.comment,
      rescheduleDate: payload.rescheduleDate,
      rescheduleTime: payload.rescheduleTime,
    },
  );
  return data.data;
};

export const addQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'client') => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/quarters/${quarterId}/comments`,
    { text, visibility },
  );
  return data.data;
};

export const getNotifications = async (): Promise<NotificationItem[]> => {
  const { data } = await api.get<{ data: NotificationItem[]; message: string | null }>('/notifications');
  return data.data;
};

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const orders = await getOrders();
  return orders.flatMap((order) => [...(order.documents || []), ...(order.resultDocuments || [])]);
};
