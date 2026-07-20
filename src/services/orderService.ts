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
import { mapDocument, mapOrder } from './backendAdapters';
import { signBase64WithNCALayer } from './ncalayer';
import { getClientDocumentBlob, uploadClientDocument } from './clientDocumentService';
import { signClientContract, uploadSignedClientContract } from './clientContractService';
import { getClientOrderDetails, listClientOrders } from './clientOrderService';
import { respondClientMeasurementAgreement, uploadClientLaboratoryPrimaryDocument } from './clientLaboratoryService';

export const primaryDocumentTemplates = [
  'Карточка компании',
  'Реквизиты',
  'БИН / ИИН',
  'Адрес объекта',
  'Договор аренды / право собственности',
  'Предыдущие экологические документы',
] as const;

export const getOrders = async (): Promise<Order[]> => {
  return listClientOrders();
};

export const getClientOrders = async (): Promise<Order[]> => getOrders();

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  return getClientOrderDetails(id);
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

export const uploadDocument = async (orderId: string, fileOrPayload: File | UploadDocumentPayload, type?: string): Promise<DocumentItem> => {
  const isFile = fileOrPayload instanceof File;
  const file = isFile ? fileOrPayload : fileOrPayload.file;
  const requestedCategory = isFile ? type : fileOrPayload.type;
  const category = requestedCategory === 'other' ? 'OTHER_CLIENT_DOCUMENT' : requestedCategory === 'SUPPORTING_DOCUMENT' ? 'SUPPORTING_DOCUMENT' : 'CLIENT_DOCUMENT';
  return uploadClientDocument(orderId, { file, category, comment: isFile ? '' : fileOrPayload.comment });
};

export const uploadSignedContract = async (
  orderId: string,
  payload: { file: File; comment?: string },
): Promise<{ document: DocumentItem; message: string | null }> => {
  const data = await uploadSignedClientContract(orderId, payload.file, payload.comment);
  return { document: mapDocument(data as never, orderId), message: 'Подписанный договор загружен на проверку' };
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

export const signOrderContractWithNCALayer = async (orderId: string, document: DocumentItem) => {
  return signClientContract(orderId, document.id);
};

export type ClientDocumentResponsePayload = {
  action: 'ACCEPTED' | 'REVISION_REQUESTED' | 'SIGNED';
  comment?: string;
  cms?: string;
  certificateInfo?: Record<string, string | undefined>;
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

export const signDocumentForResponse = async (orderId: string, document: Pick<DocumentItem, 'id' | 'fileUrl'>) => {
  const blob = await getClientDocumentBlob(orderId, document.id);
  const fileBytes = await blob.arrayBuffer();
  return signBase64WithNCALayer(arrayBufferToBase64(fileBytes));
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
  documentType = 'QUARTER_CLIENT_DATA',
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', documentType === 'QUARTER_CLIENT_DATA' ? documentType : 'QUARTER_CLIENT_DATA');
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/client/orders/${orderId}/quarters/${quarterId}/documents`,
    formData,
  );
  return data.data;
};

export const uploadPrimaryDocument = async (
  orderId: string,
  documentId: string,
  file: File,
  clientComment = '',
): Promise<OrderPrimaryDocument | undefined> => {
  if (!file?.name) throw new Error('Выберите файл документа');
  const formData = new FormData();
  formData.append('file', file);
  formData.append('comment', clientComment);
  const { data } = await api.post<{ data: OrderPrimaryDocument; message: string | null }>(
    `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
    formData,
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
  return uploadClientLaboratoryPrimaryDocument(orderId, documentId, file, comment);
};

export const respondLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: { action: 'accept' | 'reschedule'; rescheduleDate?: string; rescheduleTime?: string; comment?: string },
): Promise<LaboratoryMeasurementAgreement | undefined> => {
  return respondClientMeasurementAgreement(orderId, payload);
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
