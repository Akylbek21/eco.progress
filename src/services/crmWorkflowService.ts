import api from './api';
import { unwrapApiResponse } from './apiHelpers';
import { createClient, createStaffOrder, uploadDocument } from './staffOrderService';
import type {
  AgreementResponse,
  CommercialOffer,
  CrmDocument,
  CrmNotification,
  Order,
  SendDocumentToClientPayload,
  StaffCalendarEvent,
  StaffManualOrderPayload,
  Task,
  CreateTaskApiRequest,
  TaskApiResponse,
  UploadDocumentPayload,
  WasteRemoval,
} from '../types';

const appendFileMetadata = (formData: FormData, file: File, title?: string) => {
  const documentName = title?.trim() || file.name || 'Документ';
  formData.append('name', documentName);
  formData.append('title', documentName);
  formData.append('fileName', file.name || documentName);
  formData.append('fileType', file.type || 'application/octet-stream');
  formData.append('fileSize', String(file.size || 0));
};

export const createStaffManualOrder = async (payload: StaffManualOrderPayload): Promise<Order> => {
  let clientId = Number(payload.clientId);
  if (!Number.isFinite(clientId) || clientId <= 0) {
    if (!payload.email?.trim()) throw new Error('Для создания нового клиента укажите email.');
    const client = await createClient({
      companyName: payload.companyName || payload.clientName,
      binIin: payload.bin || undefined,
      email: payload.email.trim(),
      phone: payload.phone,
      contactPerson: payload.clientName,
      clientType: payload.companyName ? 'company' : 'individual',
    });
    clientId = Number(client.id);
  }
  if (!Number.isFinite(clientId) || clientId <= 0) throw new Error('Сервер не вернул корректный ID клиента.');

  const order = await createStaffOrder({
    clientId,
    serviceId: payload.serviceId || undefined,
    serviceName: payload.service,
    businessCompanyId: undefined,
    contractType: payload.serviceType || 'one_time',
    urgency: payload.urgency,
    comment: payload.comment,
    contactPerson: payload.clientName,
    phone: payload.phone,
    city: payload.city,
  });
  if (!order.id) throw new Error('Сервер создал заявку без ID. Загрузка документов отменена.');
  for (const file of payload.files || []) await uploadDocument(String(order.id), file, 'client');
  return order;
};

export const uploadCrmDocument = async (orderId: string, payload: UploadDocumentPayload): Promise<CrmDocument | undefined> => {
  const formData = new FormData();
  formData.append('file', payload.file);
  appendFileMetadata(formData, payload.file, payload.title);
  formData.append('type', payload.type);
  formData.append('comment', payload.comment || '');
  formData.append('sendToClient', String(Boolean(payload.sendToClient)));
  formData.append('needsSignature', String(Boolean(payload.needsSignature)));
  formData.append('needsClientResponse', String(Boolean(payload.needsClientResponse)));
  if (payload.dueDate) formData.append('dueDate', payload.dueDate);
  const { data } = await api.post<{ data: CrmDocument; message: string | null }>(`/staff/orders/${orderId}/documents`, formData);
  return unwrapApiResponse(data);
};

export const sendDocumentToClient = async (orderId: string, documentId: string, payload: SendDocumentToClientPayload) =>
  api.post<{ data: CrmDocument; message: string | null }>(`/staff/orders/${orderId}/documents/${documentId}/send-to-client`, payload)
    .then(({ data }) => unwrapApiResponse(data));

export const sendAgreementResponse = async (
  orderId: string,
  documentId: string,
  payload: { action: 'ACCEPTED' | 'REVISION_REQUESTED' | 'SIGNED'; comment?: string; cms?: string; certificateInfo?: Record<string, string | undefined> },
) => {
  const { data } = await api.post<{ data: AgreementResponse; message: string | null }>(
    `/client/orders/${orderId}/agreements/${documentId}/responses`,
    payload,
  );
  return unwrapApiResponse(data);
};

export const uploadClientPrimaryDocumentFile = async (orderId: string, documentId: string, file: File, comment = '') =>
  api.post<{ data: unknown; message: string | null }>(
      `/client/orders/${orderId}/primary-documents/${documentId}/upload`,
      (() => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('comment', comment);
        formData.append('documentId', documentId);
        return formData;
      })(),
    ).then(({ data }) => unwrapApiResponse(data));

export const createCommercialOffer = async (orderId: string, payload: Partial<CommercialOffer> & { file?: File | null }) => {
  void orderId; void payload;
  throw new Error('Функция пока не подключена к серверу.');
};

export const saveWasteRemoval = async (orderId: string, payload: Partial<WasteRemoval> & { act?: File | null; photos?: File[] }) => {
  void orderId; void payload;
  throw new Error('Функция пока не подключена к серверу.');
};

type CalendarApiEvent = {
  id: number | string;
  orderId?: number | string;
  sourceId?: number | string;
  type?: string;
  sourceType?: string;
  title: string;
  date?: string;
  startDate?: string;
  time?: string;
  status?: string | null;
  address?: string;
  contactPerson?: string;
  assigneeName?: string;
};

const mapCalendarEventType = (type?: string): StaffCalendarEvent['type'] =>
  type === 'measurement' ? 'laboratory' : type === 'waste' ? 'waste' : 'task';

const mapCalendarEventStatus = (status: string | null | undefined, eventDate?: string): StaffCalendarEvent['status'] => {
  if (status === 'done' || status === 'completed' || status === 'cancelled') return 'completed';
  if (status === 'reschedule_requested') return 'rescheduled';
  const date = eventDate?.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  if (date && date < today) return 'overdue';
  if (date === today) return 'today';
  return 'planned';
};

export const getStaffCalendar = async (): Promise<StaffCalendarEvent[]> => {
  const { data } = await api.get<{ data: CalendarApiEvent[]; message: string | null }>('/staff/calendar');
  const events = unwrapApiResponse(data);
  const unique = new Map<string, StaffCalendarEvent>();
  events.forEach((event) => {
    const date = String(event.startDate || event.date || '');
    const key = `${event.sourceType || event.type || 'event'}:${event.sourceId || event.id}:${date}`;
    unique.set(key, {
      id: String(event.id),
      orderId: event.orderId == null ? undefined : String(event.orderId),
      type: mapCalendarEventType(event.type || event.sourceType),
      title: event.title,
      date,
      time: event.time,
      address: event.address,
      contactPerson: event.contactPerson,
      executor: event.assigneeName,
      status: mapCalendarEventStatus(event.status, date),
    });
  });
  return [...unique.values()];
};

const mapTask = (task: TaskApiResponse): Task => ({
  id: String(task.id),
  orderId: task.orderId == null ? undefined : String(task.orderId),
  title: task.title,
  description: task.description,
  assigneeId: task.assigneeId == null ? undefined : String(task.assigneeId),
  assigneeName: task.assigneeName,
  dueDate: task.dueDate,
  status: task.status,
  createdAt: task.createdAt,
});

export const getTasks = async (): Promise<Task[]> => {
  const { data } = await api.get<{ data: TaskApiResponse[]; message: string | null }>('/staff/tasks');
  return unwrapApiResponse(data).map(mapTask);
};

export const saveTask = async (payload: CreateTaskApiRequest): Promise<Task> => {
  const { data } = await api.post<{ data: TaskApiResponse; message: string | null }>('/staff/tasks', payload);
  return mapTask(unwrapApiResponse(data));
};

export const updateTaskStatus = async (taskId: string, status: Task['status']): Promise<Task> => {
  const { data } = await api.patch<{ data: TaskApiResponse; message: string | null }>(`/staff/tasks/${taskId}`, { status });
  return mapTask(unwrapApiResponse(data));
};

export const getCrmNotifications = async (): Promise<CrmNotification[]> => {
  const { data } = await api.get<{ data: CrmNotification[]; message: string | null }>('/notifications');
  return unwrapApiResponse(data);
};

export const markNotificationRead = async (notificationId: string): Promise<CrmNotification> => {
  const { data } = await api.patch<{ data: CrmNotification; message: string | null }>(`/notifications/${notificationId}/read`);
  return unwrapApiResponse(data);
};
