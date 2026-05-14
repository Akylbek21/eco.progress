import api from './api';
import type { CommentItem, DocumentItem, NotificationItem, Order, RequestQuarter } from '../types';

export const getOrders = async (): Promise<Order[]> => {
  const { data } = await api.get<{ data: Order[]; message: string | null }>('/client/orders');
  return data.data;
};

export const getClientOrders = async (): Promise<Order[]> => {
  return getOrders();
};

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

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client', _author?: string): Promise<CommentItem> => {
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
