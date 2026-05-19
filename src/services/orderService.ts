import api from './api';
import { readDemoOrders } from './staffOrderService';
import type {
  CommentItem,
  DocumentItem,
  LaboratoryMeasurementAgreement,
  LaboratoryPrimaryDocument,
  NotificationItem,
  Order,
  OrderPrimaryDocument,
  RequestQuarter,
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
  try {
    const { data } = await api.get<{ data: Order[]; message: string | null }>('/client/orders');
    const demoOrders = readDemoOrders();
    const existingIds = new Set(data.data.map((order) => order.id));
    return [...data.data, ...demoOrders.filter((order) => !existingIds.has(order.id))];
  } catch {
    return readDemoOrders();
  }
};

export const getClientOrders = async (): Promise<Order[]> => getOrders();

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  const demoOrder = readDemoOrders().find((order) => order.id === id);
  if (demoOrder) return demoOrder;
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

export const uploadDocument = async (orderId: string, file: File, type?: string): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', file);
  if (type) formData.append('type', type);
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
  fileName: string,
  clientComment = '',
): Promise<OrderPrimaryDocument | undefined> => {
  const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
    `/client/orders/${orderId}/primary-documents/${documentId}`,
    { fileName, clientComment },
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
  return orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);
};
