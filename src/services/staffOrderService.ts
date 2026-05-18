import api from './api';
import {
  addMockComment,
  addMockDocument,
  addMockQuarterComment,
  addMockQuarterDocument,
  addMockQuarterPayment,
  addMockQuarterResult,
  assignMockOrder,
  completeMockAnnualRequest,
  getMockOrderById,
  getMockOrders,
  requestMockPrimaryDocument,
  saveMockLaboratoryMeasurementAgreement,
  sendMockContractAndInvoice,
  updateMockContract,
  updateMockEcologyStatus,
  updateMockLaboratoryMeasurementAgreementStatus,
  updateMockLaboratoryPrimaryDocumentStatus,
  updateMockLaboratoryResultDocumentStatus,
  updateMockLaboratoryStatus,
  updateMockOrderStatus,
  updateMockPayment,
  updateMockPrimaryDocumentStatus,
  updateMockQuarterWorkStatus,
  uploadMockLaboratoryResultDocument,
} from './mockOrderStore';
import type {
  ClientPrimaryDocumentStatus,
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
} from '../types';

const isLocalDemo = () => localStorage.getItem('eco-progress-token')?.startsWith('local-demo-token');

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

export const getOrders = async (filters?: StaffOrderFilters): Promise<Order[]> => {
  if (isLocalDemo()) return getMockOrders();
  const params = filters ? Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) : undefined;
  const { data } = await api.get<{ data: Order[]; message: string | null }>('/staff/orders', { params });
  return data.data;
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  if (isLocalDemo()) return getMockOrderById(id);
  const { data } = await api.get<{ data: Order; message: string | null }>(`/staff/orders/${id}`);
  return data.data;
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  if (isLocalDemo()) return updateMockOrderStatus(orderId, status);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { status });
  return data.data;
};

export const assignManager = async (orderId: string, role: string, userId?: string) => {
  if (isLocalDemo()) return assignMockOrder(orderId, role, userId);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/assign`, { role, userId });
  return data.data;
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client', _author?: string): Promise<CommentItem> => {
  if (isLocalDemo()) return addMockComment(orderId, text, visibility, _author);
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/staff/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

export const uploadDocument = async (orderId: string, file: File, type?: string): Promise<DocumentItem> => {
  if (isLocalDemo()) return addMockDocument(orderId, file.name, (type as DocumentItem['type']) || 'internal');
  const formData = new FormData();
  formData.append('file', file);
  if (type) formData.append('type', type);
  const { data } = await api.post<{ data: DocumentItem; message: string | null }>(`/staff/orders/${orderId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
};

export const sendContractAndInvoice = async (
  orderId: string,
  payload: { amount: string; paymentMethod?: string; signatureProvider?: string; contractFileName?: string; contractPeriodStart?: string; contractPeriodEnd?: string; contractServiceNote?: string; contractNote?: string },
) => {
  if (isLocalDemo()) return sendMockContractAndInvoice(orderId, payload);
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-and-invoice`, payload);
  return data.data;
};

export const updateContractStatus = async (orderId: string, status: StaffContractStatus | string, comment?: string) => {
  if (isLocalDemo()) return updateMockContract(orderId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-status`, { status, comment });
  return data.data;
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
  if (isLocalDemo()) return updateMockPayment(orderId, status, payload);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { paymentStatus: status, ...payload });
  return data.data;
};

export const updateEcologyStatus = async (orderId: string, status: EcologyStatus, comment?: string) => {
  if (isLocalDemo()) return updateMockEcologyStatus(orderId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { ecologyStatus: status, ecologyComment: comment });
  return data.data;
};

export const updateLaboratoryStatus = async (orderId: string, status: LaboratoryStatus, comment?: string) => {
  if (isLocalDemo()) return updateMockLaboratoryStatus(orderId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { laboratoryStatus: status, laboratoryComment: comment });
  return data.data;
};

export const requestPrimaryDocument = async (orderId: string, documentName: string, requiredOrComment: boolean | string = true, managerComment = '') => {
  const required = typeof requiredOrComment === 'boolean' ? requiredOrComment : true;
  const comment = typeof requiredOrComment === 'string' ? requiredOrComment : managerComment;
  if (isLocalDemo()) return requestMockPrimaryDocument(orderId, documentName, required, comment);
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/primary-documents`, { name: documentName, required, comment });
  return data.data;
};

export const updatePrimaryDocumentStatus = async (orderId: string, documentId: string, status: ClientPrimaryDocumentStatus, managerComment = '') => {
  if (isLocalDemo()) return updateMockPrimaryDocumentStatus(orderId, documentId, status, managerComment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/primary-documents/${documentId}`,
    { status, managerComment },
  );
  return data.data;
};

export const updateLaboratoryPrimaryDocumentStatus = async (
  orderId: string,
  documentId: string,
  status: LaboratoryPrimaryDocumentStatus,
  comment?: string,
) => {
  if (isLocalDemo()) return updateMockLaboratoryPrimaryDocumentStatus(orderId, documentId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/primary-documents/${documentId}`,
    { status, comment },
  );
  return data.data;
};

export const saveLaboratoryMeasurementAgreement = async (
  orderId: string,
  payload: Partial<Omit<LaboratoryMeasurementAgreement, 'id' | 'orderId' | 'status'>>,
) => {
  if (isLocalDemo()) return saveMockLaboratoryMeasurementAgreement(orderId, payload);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement`, payload);
  return data.data;
};

export const sendLaboratoryMeasurementAgreement = async (orderId: string) => {
  if (isLocalDemo()) return updateMockLaboratoryMeasurementAgreementStatus(orderId, 'sent_to_client');
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/laboratory/measurement/send`);
  return data.data;
};

export const updateLaboratoryMeasurementAgreementStatus = async (
  orderId: string,
  status: LaboratoryMeasurementAgreementStatus,
  comment?: string,
) => {
  if (isLocalDemo()) return updateMockLaboratoryMeasurementAgreementStatus(orderId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/measurement/status`,
    { status, comment },
  );
  return data.data;
};

export const uploadLaboratoryResultDocument = async (
  orderId: string,
  payload: { name: string; section: LaboratoryResultDocument['section']; fileName: string; status?: LaboratoryResultDocumentStatus; comment?: string; quarter?: number },
) => {
  if (isLocalDemo()) return uploadMockLaboratoryResultDocument(orderId, payload);
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
  if (isLocalDemo()) return updateMockLaboratoryResultDocumentStatus(orderId, documentId, status, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/laboratory/results/${documentId}`,
    { status, comment },
  );
  return data.data;
};

export const updateAnnualQuarterWorkStatus = async (orderId: string, quarterId: string, workStatus: QuarterWorkStatus, comment?: string) => {
  if (isLocalDemo()) return updateMockQuarterWorkStatus(orderId, quarterId, workStatus, comment);
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/quarters/${quarterId}/work-status`, { workStatus, comment });
  return data.data;
};

export const uploadAnnualQuarterDocument = async (
  orderId: string,
  quarterId: string,
  payload: { fileName: string; fileType: string; fileSize?: number; documentType: QuarterDocument['documentType']; uploadedByName?: string; uploadedByRole?: QuarterDocument['uploadedByRole'] },
) => {
  if (isLocalDemo()) return addMockQuarterDocument(orderId, quarterId, payload);
  const { data } = await api.post<{ data: { order: Order; document: QuarterDocument }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/documents`,
    payload,
  );
  return data.data;
};

export const addAnnualQuarterResult = async (
  orderId: string,
  quarterId: string,
  payload: { title: string; description?: string; resultType?: QuarterResult['resultType']; attachedDocumentIds?: string[]; createdByName?: string },
) => {
  if (isLocalDemo()) return addMockQuarterResult(orderId, quarterId, payload);
  const { data } = await api.post<{ data: { order: Order; result: QuarterResult }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/results`,
    payload,
  );
  return data.data;
};

export const addAnnualQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'internal') => {
  if (isLocalDemo()) return addMockQuarterComment(orderId, quarterId, text, visibility);
  const { data } = await api.post<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/comments`,
    { text, visibility },
  );
  return data.data;
};

export const addAnnualQuarterPayment = async (
  orderId: string,
  quarterId: string,
  payload: { amount: number; paidAt?: string; method?: string; comment?: string },
) => {
  if (isLocalDemo()) return addMockQuarterPayment(orderId, quarterId, payload);
  const { data } = await api.post<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/payments`,
    payload,
  );
  return data.data;
};

export const completeAnnualRequest = async (orderId: string) => {
  if (isLocalDemo()) return completeMockAnnualRequest(orderId);
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/complete-annual`);
  return data.data;
};

export const getClients = async () => {
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/clients');
  return data.data;
};
