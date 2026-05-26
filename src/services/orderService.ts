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

export const primaryDocumentTemplates = [
  'Карточка компании',
  'Реквизиты',
  'БИН / ИИН',
  'Адрес объекта',
  'Договор аренды / право собственности',
  'Предыдущие экологические документы',
] as const;

export const getOrders = async (): Promise<Order[]> => {
  const { data } = await api.get<{ data: Order[]; message: string | null }>('/client/orders');
  return data.data;
};

export const getClientOrders = async (): Promise<Order[]> => getOrders();

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  const { data } = await api.get<{ data: Order; message: string | null }>(`/client/orders/${id}`);
  return data.data;
};

export type CreateOrderPayload = {
  contactPerson: string;
  phone: string;
  email: string;
  companyName: string;
  bin: string;
  serviceId: string;
  service: string;
  urgency: string;
  comment: string;
  signatureProvider?: string;
  paymentMethod?: string;
  fileName?: string;
};

export const createOrder = async (payload: CreateOrderPayload): Promise<Order> => {
  const { data } = await api.post<{ data: Order; message: string | null }>('/client/orders', payload);
  return data.data;
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client'): Promise<CommentItem> => {
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/client/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

export const uploadDocument = async (orderId: string, fileOrPayload: File | UploadDocumentPayload, type?: string): Promise<DocumentItem> => {
  const isFile = fileOrPayload instanceof File;
  const file = isFile ? fileOrPayload : fileOrPayload.file;
  const formData = new FormData();
  formData.append('file', file);
  if (isFile) {
    if (type) formData.append('type', type);
  } else {
    formData.append('type', fileOrPayload.type);
    formData.append('title', fileOrPayload.title);
    formData.append('comment', fileOrPayload.comment || '');
    formData.append('sendToClient', String(Boolean(fileOrPayload.sendToClient)));
    formData.append('needsSignature', String(Boolean(fileOrPayload.needsSignature)));
    formData.append('needsClientResponse', String(Boolean(fileOrPayload.needsClientResponse)));
    if (fileOrPayload.dueDate) formData.append('dueDate', fileOrPayload.dueDate);
    // TODO backend: accept extended document metadata when client uploads a response/result file.
  }
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/client/orders/${orderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const signOrderContract = async (orderId: string, provider: string) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/contract/sign`, { provider });
  return data.data;
};

export const payOrderOnline = async (orderId: string, method: string) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/pay`, { method });
  return data.data;
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
  formData.append('documentType', documentType);
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/quarters/${quarterId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
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
    formData.append('comment', clientComment);
    formData.append('documentId', documentId);
    const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
      `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  }
  const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
    `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
    (() => {
      const formData = new FormData();
      const placeholder = new File([fileOrName], fileOrName || 'document.txt', { type: 'text/plain' });
      formData.append('file', placeholder);
      formData.append('comment', clientComment);
      formData.append('documentId', documentId);
      return formData;
    })(),
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.data;
};

export const deletePrimaryDocumentFile = async (orderId: string, documentId: string): Promise<Order | undefined> => {
  const { data } = await api.delete<{ data: Order; message: string | null }>(`/client/orders/${orderId}/primary-documents/${documentId}/file`);
  return data.data;
};

export const sendPrimaryDocumentsForReview = async (orderId: string, clientComment = ''): Promise<Order | undefined> => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/primary-documents/review`, { clientComment });
  return data.data;
};

export const sendPrimaryDocumentForReview = async (orderId: string, documentId: string, clientComment = ''): Promise<Order | undefined> => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/primary-documents/${documentId}/review`, { clientComment });
  return data.data;
};

export const uploadLaboratoryPrimaryDocument = async (
  orderId: string,
  documentId: string,
  fileName: string,
): Promise<{ order?: Order; document?: LaboratoryPrimaryDocument }> => {
  const { data } = await api.post<{ data: { order?: Order; document?: LaboratoryPrimaryDocument }; message: string | null }>(
    `/client/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    { fileName },
  );
  return data.data;
};

export const respondLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: { action: 'accept' | 'reschedule'; rescheduleDate?: string; rescheduleTime?: string; comment?: string },
): Promise<LaboratoryMeasurementAgreement | undefined> => {
  const { data } = await api.post<{ data: LaboratoryMeasurementAgreement; message: string | null }>(
    `/client/orders/${orderId}/laboratory/measurement/respond`,
    payload,
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
