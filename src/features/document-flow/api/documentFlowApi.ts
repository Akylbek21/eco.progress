import api from '../../../services/api';
import type {
  AccessRequestPayload,
  AdminSubscription,
  DocumentFilters,
  DocumentFlowAccess,
  DocumentFlowDashboard,
  DocumentFlowDetails,
  DocumentFlowList,
  DocumentFlowPlan,
  SigningData,
} from '../types';

type Envelope<T> = T | { data: T };
const unwrap = <T>(payload: Envelope<T>): T =>
  payload && typeof payload === 'object' && 'data' in payload ? (payload as { data: T }).data : payload as T;

const get = async <T>(url: string, params?: Record<string, unknown>) =>
  unwrap((await api.get<Envelope<T>>(url, { params })).data);
const post = async <T>(url: string, body?: unknown, headers?: Record<string, string>) =>
  unwrap((await api.post<Envelope<T>>(url, body, { headers })).data);

export const documentFlowAccessApi = {
  get: () => get<DocumentFlowAccess>('/document-flow/access'),
  request: (payload: AccessRequestPayload, idempotencyKey: string) =>
    post<{ requestId: string; status: string }>('/document-flow/access-requests', payload, { 'Idempotency-Key': idempotencyKey }),
};

export const documentFlowPlansApi = {
  list: () => get<DocumentFlowPlan[]>('/public/document-flow/plans'),
};

export const documentFlowSubscriptionApi = {
  get: () => get<DocumentFlowAccess>('/document-flow/subscription'),
  requestChange: (payload: { planCode?: string; action: string; comment?: string }, idempotencyKey: string) =>
    post<{ requestId: string; status: string }>('/document-flow/subscription/requests', payload, { 'Idempotency-Key': idempotencyKey }),
};

export const documentFlowDashboardApi = {
  get: () => get<DocumentFlowDashboard>('/document-flow/dashboard'),
};

export const documentFlowDocumentsApi = {
  list: (filters: DocumentFilters) => get<DocumentFlowList>('/document-flow/documents', filters as Record<string, unknown>),
  get: (id: string) => get<DocumentFlowDetails>(`/document-flow/documents/${id}`),
  createDraft: async (form: FormData, idempotencyKey: string) =>
    unwrap((await api.post<Envelope<DocumentFlowDetails>>('/document-flow/documents', form, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })).data),
  action: (id: string, action: string, body?: unknown, idempotencyKey = crypto.randomUUID()) =>
    post<DocumentFlowDetails>(`/document-flow/documents/${id}/${action}`, body, { 'Idempotency-Key': idempotencyKey }),
  resource: <T>(resource: string, params?: Record<string, unknown>) => get<T>(`/document-flow/${resource}`, params),
};

export const documentFlowSigningApi = {
  prepare: (id: string) => get<SigningData>(`/document-flow/documents/${id}/signing-data`),
  submit: (id: string, payload: { version: number; hash: string; cms: string; signerSubject?: string }, idempotencyKey: string) =>
    post<DocumentFlowDetails>(`/document-flow/documents/${id}/signatures`, payload, { 'Idempotency-Key': idempotencyKey }),
};

export const documentFlowAdminApi = {
  subscriptions: (filters: Record<string, unknown>) =>
    get<{ items: AdminSubscription[]; total: number }>('/admin/document-flow/subscriptions', filters),
  plans: () => get<DocumentFlowPlan[]>('/admin/document-flow/plans'),
  action: (organizationId: string, action: string, payload: Record<string, unknown>, idempotencyKey: string) =>
    post<AdminSubscription>(`/admin/document-flow/subscriptions/${organizationId}/${action}`, payload, { 'Idempotency-Key': idempotencyKey }),
};

