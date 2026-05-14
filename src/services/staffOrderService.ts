import api from './api';
import type {
  CommentItem,
  DocumentItem,
  EcologyStatus,
  LaboratoryStatus,
  Order,
  OrderStatus,
  PaymentStatus,
  QuarterDocument,
  QuarterResult,
  QuarterWorkStatus,
  StaffContractStatus,
} from '../types';

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
  const params = filters ? Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) : undefined;
  const { data } = await api.get<{ data: Order[]; message: string | null }>('/staff/orders', { params });
  return data.data;
};

export const getOrderById = async (id: string): Promise<Order | undefined> => {
  const { data } = await api.get<{ data: Order; message: string | null }>(`/staff/orders/${id}`);
  return data.data;
};

export const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { status });
  return data.data;
};

export const assignManager = async (orderId: string, role: string, userId?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/assign`, { role, userId });
  return data.data;
};

export const addComment = async (orderId: string, text: string, visibility: 'client' | 'internal' = 'client', _author?: string): Promise<CommentItem> => {
  const { data } = await api.post<{ data: CommentItem; message: string | null }>(`/staff/orders/${orderId}/comments`, { text, visibility });
  return data.data;
};

export const uploadDocument = async (orderId: string, file: File, type?: string): Promise<DocumentItem> => {
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
  payload: { amount: string; paymentMethod: string; signatureProvider: string; contractFileName?: string },
) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-and-invoice`, payload);
  return data.data;
};

export const updateContractStatus = async (orderId: string, status: StaffContractStatus | string, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/contract-status`, { status, comment });
  return data.data;
};

export const updatePaymentStatus = async (
  orderId: string,
  status: PaymentStatus,
  payload: { amount?: string; paidAt?: string; comment?: string; method?: string; invoiceNumber?: string; actNumber?: string } = {},
) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { paymentStatus: status, ...payload });
  return data.data;
};

export const updateEcologyStatus = async (orderId: string, status: EcologyStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { ecologyStatus: status, ecologyComment: comment });
  return data.data;
};

export const updateLaboratoryStatus = async (orderId: string, status: LaboratoryStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/status`, { laboratoryStatus: status, laboratoryComment: comment });
  return data.data;
};

export const updateAnnualQuarterWorkStatus = async (orderId: string, quarterId: string, workStatus: QuarterWorkStatus, comment?: string) => {
  const { data } = await api.patch<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/quarters/${quarterId}/work-status`, { workStatus, comment });
  return data.data;
};

export const uploadAnnualQuarterDocument = async (
  orderId: string,
  quarterId: string,
  payload: { fileName: string; fileType: string; fileSize?: number; documentType: QuarterDocument['documentType']; uploadedByName?: string; uploadedByRole?: QuarterDocument['uploadedByRole'] },
) => {
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
  const { data } = await api.post<{ data: { order: Order; result: QuarterResult }; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/results`,
    payload,
  );
  return data.data;
};

export const addAnnualQuarterComment = async (orderId: string, quarterId: string, text: string, visibility: 'client' | 'internal' = 'internal') => {
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
  const { data } = await api.post<{ data: Order; message: string | null }>(
    `/staff/orders/${orderId}/quarters/${quarterId}/payments`,
    payload,
  );
  return data.data;
};

export const completeAnnualRequest = async (orderId: string) => {
  const { data } = await api.post<{ data: Order; message: string | null }>(`/staff/orders/${orderId}/complete-annual`);
  return data.data;
};

export const getClients = async () => {
  const { data } = await api.get<{ data: unknown[]; message: string | null }>('/clients');
  return data.data;
};
