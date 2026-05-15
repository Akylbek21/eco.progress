import api from './api';
import { notifications as mockNotifications } from '../data/mockData';
import {
  addMockComment,
  addMockDocument,
  createMockOrder,
  getMockOrderById,
  getMockOrders,
  getMockQuarters,
  payMockOrderOnline,
  replaceMockOrder,
  signMockOrderContract,
  uploadMockLaboratoryPrimaryDocument,
  uploadMockPrimaryDocument,
  updateMockLaboratoryMeasurementAgreementStatus,
} from './mockOrderStore';
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

const isLocalDemo = () => localStorage.getItem('eco-progress-token')?.startsWith('local-demo-token');

export const primaryDocumentTemplates = [
  'Карточка компании',
  'Реквизиты',
  'БИН / ИИН',
  'Адрес объекта',
  'Договор аренды / право собственности',
  'Предыдущие экологические документы',
] as const;

export const getOrders = async (): Promise<Order[]> => {
  if (isLocalDemo()) return getMockOrders();
  const { data } = await api.get<{ data: Order[]; message: string | null }>('/client/orders');
  return data.data;
};

export const getClientOrders = async (): Promise<Order[]> => getOrders();

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  if (isLocalDemo()) return getMockOrderById(id);
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
  if (isLocalDemo()) return createMockOrder({
    clientId: 'client-1',
    clientType: 'company',
    clientName: payload.contactPerson,
    companyName: payload.companyName,
    bin: payload.bin,
    organizationType: 'ТОО',
    legalAddress: '',
    contactPerson: payload.contactPerson,
    phone: payload.phone,
    email: payload.email,
    serviceId: payload.serviceId,
    service: payload.service,
    urgency: payload.urgency,
    comment: payload.comment,
    signatureProvider: payload.signatureProvider,
    paymentMethod: payload.paymentMethod,
  });
  const { data } = await api.post<{ data: Order; message: string | null }>('/client/orders', payload);
  return data.data;
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client', _author?: string): Promise<CommentItem> => {
  if (isLocalDemo()) return addMockComment(orderId, text, visibility, _author || 'Client');
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/client/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

export const uploadDocument = async (orderId: string, file: File, type?: string): Promise<DocumentItem> => {
  if (isLocalDemo()) return addMockDocument(orderId, file.name, (type as DocumentItem['type']) || 'client');
  const formData = new FormData();
  formData.append('file', file);
  if (type) formData.append('type', type);
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/client/orders/${orderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const signOrderContract = async (orderId: string, provider: string) => {
  if (isLocalDemo()) return signMockOrderContract(orderId, provider);
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/contract/sign`, { provider });
  return data.data;
};

export const payOrderOnline = async (orderId: string, method: string) => {
  if (isLocalDemo()) return payMockOrderOnline(orderId, method);
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/pay`, { method });
  return data.data;
};

export const getQuarters = async (orderId: string): Promise<RequestQuarter[]> => {
  if (isLocalDemo()) return getMockQuarters(orderId);
  const { data } = await api.get<{ data: RequestQuarter[]; message: string | null }>(`/client/orders/${orderId}/quarters`);
  return data.data;
};

export const getQuarterDetail = async (orderId: string, quarterId: string): Promise<RequestQuarter> => {
  if (isLocalDemo()) {
    const quarter = getMockQuarters(orderId).find((item) => item.id === quarterId);
    if (!quarter) throw new Error('Quarter not found');
    return quarter;
  }
  const { data } = await api.get<{ data: RequestQuarter; message: string | null }>(`/client/orders/${orderId}/quarters/${quarterId}`);
  return data.data;
};

export const uploadQuarterDocument = async (
  orderId: string,
  quarterId: string,
  file: File,
  documentType = 'client_data',
) => {
  if (isLocalDemo()) return { orderId, quarterId, fileName: file.name, documentType };
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
  if (isLocalDemo()) return uploadMockPrimaryDocument(orderId, documentId, fileName, clientComment);
  const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
    `/client/orders/${orderId}/primary-documents/${documentId}`,
    { fileName, clientComment },
  );
  return data.data;
};

export const deletePrimaryDocumentFile = async (orderId: string, documentId: string): Promise<Order | undefined> => {
  if (isLocalDemo()) return replaceMockOrder(orderId, (order) => ({
    ...order,
    primaryDocuments: (order.primaryDocuments ?? []).map((document) => (
      document.id === documentId
        ? { ...document, status: 'need_upload', fileName: undefined, uploadedAt: undefined, updatedAt: new Date().toLocaleString('ru-RU') }
        : document
    )),
  }));
  const { data } = await api.delete<{ data: Order; message: string | null }>(`/client/orders/${orderId}/primary-documents/${documentId}/file`);
  return data.data;
};

export const sendPrimaryDocumentsForReview = async (orderId: string, clientComment = ''): Promise<Order | undefined> => {
  if (isLocalDemo()) return replaceMockOrder(orderId, (order) => ({
    ...order,
    primaryDocuments: (order.primaryDocuments ?? []).map((document) => (
      document.status === 'sent' ? { ...document, status: 'in_review', clientComment, updatedAt: new Date().toLocaleString('ru-RU') } : document
    )),
  }));
  const { data } = await api.post<{ data: Order; message: string | null }>(`/client/orders/${orderId}/primary-documents/review`, { clientComment });
  return data.data;
};

export const uploadLaboratoryPrimaryDocument = async (
  orderId: string,
  documentId: string,
  fileName: string,
): Promise<{ order?: Order; document?: LaboratoryPrimaryDocument }> => {
  if (isLocalDemo()) return uploadMockLaboratoryPrimaryDocument(orderId, documentId, fileName);
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
  if (isLocalDemo()) {
    const order = updateMockLaboratoryMeasurementAgreementStatus(orderId, payload.action === 'accept' ? 'accepted_by_client' : 'reschedule_requested', payload.comment);
    return order?.laboratoryMeasurementAgreement;
  }
  const { data } = await api.post<{ data: LaboratoryMeasurementAgreement; message: string | null }>(
    `/client/orders/${orderId}/laboratory/measurement/respond`,
    payload,
  );
  return data.data;
};

export const addQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'client') => {
  if (isLocalDemo()) return { orderId, quarterId, text, visibility };
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/quarters/${quarterId}/comments`,
    { text, visibility },
  );
  return data.data;
};

export const getNotifications = async (): Promise<NotificationItem[]> => {
  if (isLocalDemo()) return mockNotifications as NotificationItem[];
  const { data } = await api.get<{ data: NotificationItem[]; message: string | null }>('/notifications');
  return data.data;
};

export const getDocuments = async (): Promise<DocumentItem[]> => {
  const orders = await getOrders();
  return orders.flatMap((order) => [...order.documents, ...order.resultDocuments]);
};
