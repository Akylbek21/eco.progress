import api from './api';
import type {
  AgreementResponse,
  Client,
  CompanyProfileChangeRequest,
  CommercialOffer,
  CrmDocument,
  CrmNotification,
  InvoicePayment,
  Order,
  SendDocumentToClientPayload,
  StaffCalendarEvent,
  StaffManualOrderPayload,
  Task,
  UploadDocumentPayload,
  WasteRemoval,
} from '../types';

const dataOrFallback = async <T,>(request: Promise<{ data: { data: T } }>, fallback: T): Promise<T> => {
  try {
    const { data } = await request;
    return data.data;
  } catch (error) {
    if (!import.meta.env.DEV) throw error;
    console.warn('CRM endpoint fallback:', error);
    return fallback;
  }
};

export const createStaffManualOrder = async (payload: StaffManualOrderPayload): Promise<Order | undefined> => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'files') return;
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  payload.files?.forEach((file) => formData.append('files', file));
  return dataOrFallback(
    api.post<{ data: Order; message: string | null }>('/staff/orders', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const uploadCrmDocument = async (orderId: string, payload: UploadDocumentPayload): Promise<CrmDocument | undefined> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  formData.append('type', payload.type);
  formData.append('title', payload.title);
  formData.append('comment', payload.comment || '');
  formData.append('sendToClient', String(Boolean(payload.sendToClient)));
  formData.append('needsSignature', String(Boolean(payload.needsSignature)));
  formData.append('needsClientResponse', String(Boolean(payload.needsClientResponse)));
  if (payload.dueDate) formData.append('dueDate', payload.dueDate);
  return dataOrFallback(
    api.post<{ data: CrmDocument; message: string | null }>(`/staff/orders/${orderId}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const sendDocumentToClient = async (orderId: string, documentId: string, payload: SendDocumentToClientPayload) =>
  dataOrFallback(
    api.post<{ data: CrmDocument; message: string | null }>(`/staff/orders/${orderId}/documents/${documentId}/send-to-client`, payload),
    undefined,
  );

export const sendAgreementResponse = async (
  orderId: string,
  sourceDocumentId: string,
  payload: { action: AgreementResponse['action']; comment?: string; file?: File | null },
) => {
  const formData = new FormData();
  formData.append('action', payload.action);
  formData.append('comment', payload.comment || '');
  if (payload.file) formData.append('file', payload.file);
  return dataOrFallback(
    api.post<{ data: AgreementResponse; message: string | null }>(`/client/orders/${orderId}/agreements/${sourceDocumentId}/responses`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const uploadClientPrimaryDocumentFile = async (orderId: string, documentId: string, file: File, comment = '') =>
  dataOrFallback(
    api.post<{ data: unknown; message: string | null }>(
      `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
      (() => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('comment', comment);
        formData.append('documentId', documentId);
        return formData;
      })(),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
    undefined,
  );

export const createCommercialOffer = async (orderId: string, payload: Partial<CommercialOffer> & { file?: File | null }) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'file') return;
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (payload.file) formData.append('file', payload.file);
  return dataOrFallback(
    api.post<{ data: CommercialOffer; message: string | null }>(`/staff/orders/${orderId}/commercial-offers`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const updateCommercialOfferStatus = async (orderId: string, offerId: string, status: CommercialOffer['status']) =>
  dataOrFallback(api.patch<{ data: CommercialOffer; message: string | null }>(`/staff/orders/${orderId}/commercial-offers/${offerId}`, { status }), undefined);

export const saveInvoicePayment = async (orderId: string, payload: Partial<InvoicePayment> & { invoiceFile?: File | null; paymentOrder?: File | null }) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'invoiceFile' || key === 'paymentOrder') return;
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (payload.invoiceFile) formData.append('invoiceFile', payload.invoiceFile);
  if (payload.paymentOrder) formData.append('paymentOrder', payload.paymentOrder);
  return dataOrFallback(
    api.post<{ data: InvoicePayment; message: string | null }>(`/staff/orders/${orderId}/invoice-payment`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const saveWasteRemoval = async (orderId: string, payload: Partial<WasteRemoval> & { act?: File | null; photos?: File[] }) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (key === 'act' || key === 'photos') return;
    if (value !== undefined && value !== null) formData.append(key, String(value));
  });
  if (payload.act) formData.append('act', payload.act);
  payload.photos?.forEach((file) => formData.append('photos', file));
  return dataOrFallback(
    api.post<{ data: WasteRemoval; message: string | null }>(`/staff/orders/${orderId}/waste-removal`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    undefined,
  );
};

export const getStaffCalendar = async (): Promise<StaffCalendarEvent[]> =>
  dataOrFallback(api.get<{ data: StaffCalendarEvent[]; message: string | null }>('/staff/calendar'), []);

export const getTasks = async (): Promise<Task[]> =>
  dataOrFallback(api.get<{ data: Task[]; message: string | null }>('/staff/tasks'), []);

export const saveTask = async (payload: Partial<Task>): Promise<Task | undefined> =>
  dataOrFallback(api.post<{ data: Task; message: string | null }>('/staff/tasks', payload), undefined);

export const updateTaskStatus = async (taskId: string, status: Task['status']): Promise<Task | undefined> =>
  dataOrFallback(api.patch<{ data: Task; message: string | null }>(`/staff/tasks/${taskId}`, { status }), undefined);

export const getCrmNotifications = async (): Promise<CrmNotification[]> =>
  dataOrFallback(api.get<{ data: CrmNotification[]; message: string | null }>('/notifications'), []);

export const markNotificationRead = async (notificationId: string): Promise<CrmNotification | undefined> =>
  dataOrFallback(api.patch<{ data: CrmNotification; message: string | null }>(`/notifications/${notificationId}/read`), undefined);

export const requestCompanyProfileChange = async (payload: CompanyProfileChangeRequest) =>
  dataOrFallback(api.post<{ data: unknown; message: string | null }>('/client/company/change-requests', payload), undefined);

export const updateClient = async (clientId: string, payload: Partial<Client>) =>
  dataOrFallback(api.patch<{ data: Client; message: string | null }>(`/staff/clients/${clientId}`, payload), undefined);
