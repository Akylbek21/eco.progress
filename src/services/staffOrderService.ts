import api from './api';
import type {
  CommentItem,
  DocumentItem,
  EcologyStatus,
  LaboratoryMeasurementAgreement,
  LaboratoryMeasurementAgreementStatus,
  LaboratoryPrimaryDocumentStatus,
  LaboratoryResultDocument,
  LaboratoryResultDocumentStatus,
  LaboratoryStatus,
  Order,
  OrderStatus,
  PaymentStatus,
  QuarterDocument,
  QuarterResult,
  QuarterWorkStatus,
  StaffContractStatus,
  UploadDocumentPayload,
} from '../types';
import { mapDocument, mapOrder, mapOrders } from './backendAdapters';
import {
  toBackendLaboratoryPrimaryStatus,
  toBackendLaboratoryResultStatus,
  toBackendLaboratoryStatus,
  toBackendMeasurementStatus,
  toBackendOrderStatus,
  toBackendPaymentStatus,
  toBackendPrimaryDocumentStatus,
} from './apiNormalizers';

export type StaffOrderFilters = {
  q?: string;
  businessCompanyId?: string;
  status?: string;
  paymentStatus?: string;
  contractType?: string;
  managerId?: string;
  dateFrom?: string;
  dateTo?: string;
};

const applyStaffFilters = (orders: Order[], filters?: StaffOrderFilters) => {
  if (!filters) return orders;
  return orders
    .filter((order) => !filters.q || `${order.id} ${order.companyName} ${order.clientName} ${order.service}`.toLowerCase().includes(filters.q.toLowerCase()))
    .filter((order) => !filters.businessCompanyId || order.businessCompanyId === filters.businessCompanyId)
    .filter((order) => !filters.status || order.status === filters.status)
    .filter((order) => !filters.paymentStatus || order.paymentStatus === filters.paymentStatus)
    .filter((order) => !filters.contractType || order.contractType === filters.contractType);
};

export const getOrders = async (filters?: StaffOrderFilters): Promise<Order[]> => {
  const params = filters ? Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) : undefined;
  if (params?.status) params.status = toBackendOrderStatus(String(params.status));
  if (params?.paymentStatus) params.paymentStatus = toBackendPaymentStatus(String(params.paymentStatus));
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/staff/orders', { params });
  return applyStaffFilters(mapOrders(data.data as never[]), filters);
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  const { data } = await api.get<{ data: unknown; message: string | null }>(`/staff/orders/${id}`);
  return mapOrder(data.data as never);
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  const { data } = await api.patch<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/status`, { status: toBackendOrderStatus(status) });
  return mapOrder(data.data as never);
};

export const assignManager = async (orderId: string, role: string, userId?: string) => {
  const { data } = await api.patch<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/assign`, { role, userId });
  return mapOrder(data.data as never);
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client'): Promise<CommentItem> => {
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/staff/orders/${orderId}/comments`, { text, visibility });
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
    // TODO backend: accept extended document metadata above in addition to file/type.
  }
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/staff/orders/${orderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return mapDocument(data.data as never, orderId);
};

export const sendContractAndInvoice = async (
  orderId: string,
  payload: { amount: string; paymentMethod?: string; signatureProvider?: string; contractFileName?: string; contractPeriodStart?: string; contractPeriodEnd?: string; contractServiceNote?: string; contractNote?: string },
) => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/contract-and-invoice`, payload);
  return mapOrder(data.data as never);
};

export const updateContractStatus = async (orderId: string, status: StaffContractStatus | string, comment?: string) => {
  const { data } = await api.patch<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/contract-status`, { crmContractStatus: status, comment });
  return mapOrder(data.data as never);
};

export const updatePaymentStatus = async (
  orderId: string,
  status: PaymentStatus,
  payload: {
    amount?: string;
    totalAmount?: string | number;
    paidAmount?: string | number;
    paidAt?: string;
    comment?: string;
    method?: string;
    invoiceNumber?: string;
    actNumber?: string;
    invoiceFileName?: string;
    paymentTerms?: Order['paymentTerms'];
    minPrepaymentPercent?: string | number;
  } = {},
) => {
  const { data } = await api.patch<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/payment`, {
    paymentStatus: toBackendPaymentStatus(status),
    paymentMethod: payload.method,
  });
  return mapOrder(data.data as never);
};

export const updateEcologyStatus = async (orderId: string, status: EcologyStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/ecology-status`, { ecologyStatus: status, comment });
  return data.data;
};

export const updateLaboratoryStatus = async (orderId: string, status: LaboratoryStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory-status`, { laboratoryStatus: toBackendLaboratoryStatus(status), comment });
  return data.data;
};

export const requestPrimaryDocument = async (orderId: string, documentName: string, requiredOrComment: boolean | string = true, managerComment = '') => {
  const required = typeof requiredOrComment === 'boolean' ? requiredOrComment : true;
  const comment = typeof requiredOrComment === 'string' ? requiredOrComment : managerComment;
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/primary-documents`, { name: documentName, required, comment });
  return data.data;
};

export const updatePrimaryDocumentStatus = async (orderId: string, documentId: string, status: string, managerComment = '') => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/primary-documents/${documentId}`,
    { status: toBackendPrimaryDocumentStatus(status), comment: managerComment },
  );
  return data.data;
};

export const updateLaboratoryPrimaryDocumentStatus = async (
  orderId: string,
  documentId: string,
  status: LaboratoryPrimaryDocumentStatus,
  comment?: string,
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    { status: toBackendLaboratoryPrimaryStatus(status), comment },
  );
  return data.data;
};

export const saveLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: Partial<Omit<LaboratoryMeasurementAgreement, 'id' | 'orderId' | 'status'>>,
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement`, payload);
  return data.data;
};

export const sendLaboratoryMeasurementAgreement = async (orderId: string) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement/send`);
  return data.data;
};

export const updateLaboratoryMeasurementAgreementStatus = async (
  orderId: string,
  status: LaboratoryMeasurementAgreementStatus,
  comment?: string,
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/measurement/status`,
    { status: toBackendMeasurementStatus(status), comment },
  );
  return data.data;
};

export const uploadLaboratoryResultDocument = async (
  orderId: string,
  payload: { name: string; section: LaboratoryResultDocument['section']; fileName: string; status?: LaboratoryResultDocumentStatus; comment?: string; quarter?: number },
) => {
  const { data } = await api.post<{ data: { order: Order; document: LaboratoryResultDocument }; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/results`,
    payload,
  );
  return data.data;
};

export const updateLaboratoryResultDocumentStatus = async (
  orderId: string,
  documentId: string,
  status: LaboratoryResultDocumentStatus,
  comment?: string,
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/results/${documentId}`,
    { status: toBackendLaboratoryResultStatus(status), comment },
  );
  return data.data;
};

export const updateAnnualQuarterWorkStatus = async (orderId: string, quarterId: string, workStatus: QuarterWorkStatus, comment?: string) => {
  const { data } = await api.patch<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/quarters/${quarterId}/work-status`, { workStatus, comment });
  return mapOrder(data.data as never);
};

export const uploadAnnualQuarterDocument = async (
  orderId: string,
  quarterId: string,
  payload: { file?: File; fileName: string; fileType: string; fileSize?: number; documentType: QuarterDocument['documentType']; uploadedByName?: string; uploadedByRole?: QuarterDocument['uploadedByRole'] },
) => {
  const formData = new FormData();
  formData.append('file', payload.file || new File([payload.fileName], payload.fileName || 'quarter-document.pdf', { type: payload.fileType || 'application/pdf' }));
  formData.append('type', payload.documentType);
  const { data } = await api.post<{ data: { order: unknown; document: QuarterDocument }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return { ...data.data, order: mapOrder(data.data.order as never) };
};

export const addAnnualQuarterResult = async (
  orderId: string,
  quarterId: string,
  payload: { title: string; description?: string; resultType?: QuarterResult['resultType']; attachedDocumentIds?: string[]; createdByName?: string },
) => {
  const { data } = await api.post<{ data: { order: unknown; result: QuarterResult }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/results`,
    payload,
  );
  return { ...data.data, order: mapOrder(data.data.order as never) };
};

export const addAnnualQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'internal') => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/comments`,
    { text, visibility },
  );
  return mapOrder(data.data as never);
};

export const addAnnualQuarterPayment = async (
  orderId: string,
  quarterId: string,
  payload: { amount: number; paidAt?: string; method?: string; comment?: string },
) => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/payments`,
    payload,
  );
  return mapOrder(data.data as never);
};

export const completeAnnualRequest = async (orderId: string) => {
  const { data } = await api.post<{ data: unknown; message: string | null }>(`/staff/orders/${orderId}/complete-annual`);
  return mapOrder(data.data as never);
};

export const getClients = async () => {
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/clients');
  return data.data;
};

export type CreateClientPayload = {
  companyName?: string;
  binIin?: string;
  email: string;
  phone?: string;
  contactPerson?: string;
  legalAddress?: string;
  clientType?: 'company' | 'individual';
};

export type CreateClientResult = {
  id: number;
  companyName: string;
  email: string;
  phone: string;
  contactPerson: string;
  tempPassword: string;
};

export const createClient = async (payload: CreateClientPayload): Promise<CreateClientResult> => {
  const { data } = await api.post<{ data: CreateClientResult; message: string | null }>('/staff/clients', payload);
  return data.data;
};

export type StaffCreateOrderPayload = {
  clientId: number;
  serviceId?: string;
  serviceName?: string;
  businessCompanyId?: string;
  contractType?: string;
  urgency?: string;
  comment?: string;
  contactPerson?: string;
  phone?: string;
  city?: string;
};

export const createStaffOrder = async (payload: StaffCreateOrderPayload): Promise<Order> => {
  const { data } = await api.post<{ data: unknown; message: string | null }>('/staff/orders', payload);
  return mapOrder(data.data as never);
};
