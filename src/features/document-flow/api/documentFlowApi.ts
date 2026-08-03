import axios, { type AxiosProgressEvent } from 'axios';
import api from '../../../services/api';
import type { ApiResponse } from '../../../services/apiHelpers';
import type {
  AccessContext, AuditEvent, Counterparty, CreateDocumentRequest, DashboardResponse, DocumentAttachment,
  DocumentDetail, DocumentFilters, DocumentListItem, DocumentSignature, DocumentTypeConfig,
  DocumentVersion, PageResponse, PlanAdmin, PublicInvitation, PublicPlan, Representative,
  OrganizationSigner, RevocationRequest, SelfSignPreparation, SigningRoute, SigningRouteRequest, SubscriptionAdmin, UpdateDocumentRequest,
  UsageMetric,
} from '../model/types';

const publicClient = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL
    ? `${import.meta.env.VITE_BACKEND_URL}/api/public/document-flow`
    : '/api/public/document-flow',
  timeout: 15_000,
});

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  const body = response.data;
  return body && typeof body === 'object' && 'data' in body
    ? (body as ApiResponse<T>).data
    : body as T;
};

const compact = <T extends object>(value: T) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
);

const attachment = (source: Record<string, unknown>): DocumentAttachment => ({
  id: Number(source.id),
  documentId: Number(source.documentId),
  originalFileName: String(source.originalFileName || ''),
  mimeType: String(source.mimeType || ''),
  fileSize: Number(source.fileSize || 0),
  sha256Hash: String(source.sha256Hash || ''),
  uploadedBy: Number(source.uploadedBy || 0),
  createdAt: String(source.createdAt || ''),
});

const version = (source: Record<string, unknown>): DocumentVersion => ({
  id: Number(source.id),
  documentId: Number(source.documentId),
  versionNumber: Number(source.versionNumber),
  originalFileName: String(source.originalFileName || ''),
  mimeType: String(source.mimeType || ''),
  fileSize: Number(source.fileSize || 0),
  sha256Hash: String(source.sha256Hash || ''),
  locked: source.locked === true,
  lockedAt: source.lockedAt ? String(source.lockedAt) : null,
  lockedBy: source.lockedBy == null ? null : Number(source.lockedBy),
  changeReason: source.changeReason == null ? null : String(source.changeReason),
  current: source.current === true,
  createdBy: Number(source.createdBy || 0),
  createdAt: String(source.createdAt || ''),
});

export interface UploadOptions {
  signal?: AbortSignal;
  changeReason?: string;
  organizationId?: number;
  onProgress?: (percent: number | null) => void;
}

const progress = (callback?: (percent: number | null) => void) => (event: AxiosProgressEvent) => {
  callback?.(event.total ? Math.round((event.loaded / event.total) * 100) : null);
};

export const documentFlowApi = {
  access: async (organizationId?: number, signal?: AbortSignal) =>
    unwrap<AccessContext>(await api.get('/document-flow/access-context', { params: compact({ organizationId }), signal })),
  plans: async (signal?: AbortSignal) =>
    unwrap<PublicPlan[]>(await publicClient.get('/plans', { signal })),
  plan: async (code: string, signal?: AbortSignal) =>
    unwrap<PublicPlan>(await publicClient.get(`/plans/${encodeURIComponent(code)}`, { signal })),
  requestAccess: async (payload: {
    contactName: string; phone?: string; email?: string; planCode?: string;
    membersCount?: number; comment?: string;
  }) => unwrap(await api.post('/document-flow/access-requests', payload)),
  dashboard: async (organizationId?: number, signal?: AbortSignal) =>
    unwrap<DashboardResponse>(await api.get('/document-flow/dashboard', { params: compact({ organizationId }), signal })),
  documentTypes: async (signal?: AbortSignal) =>
    unwrap<DocumentTypeConfig[]>(await api.get('/document-flow/document-types', { signal })),
  documents: async (filters: DocumentFilters, signal?: AbortSignal) =>
    unwrap<PageResponse<DocumentListItem>>(await api.get('/document-flow/documents', { params: compact(filters), signal })),
  document: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    unwrap<DocumentDetail>(await api.get(`/document-flow/documents/${id}`, { params: compact({ organizationId }), signal })),
  createDocument: async (payload: CreateDocumentRequest, idempotencyKey: string) =>
    unwrap<DocumentDetail>(await api.post('/document-flow/documents', payload, { headers: { 'Idempotency-Key': idempotencyKey } })),
  selfSignPrepare: async (id: number, idempotencyKey: string) =>
    unwrap<SelfSignPreparation>(await api.post(`/document-flow/documents/${id}/self-sign/prepare`, undefined, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })),
  selfSignComplete: async (id: number, payload: { challenge: string; cms: string; clientRequestId: string }) =>
    unwrap<DocumentDetail>(await api.post(`/document-flow/documents/${id}/self-sign/complete`, payload)),
  updateDocument: async (id: number, payload: UpdateDocumentRequest, organizationId?: number) =>
    unwrap<DocumentDetail>(await api.patch(`/document-flow/documents/${id}`, payload, { params: compact({ organizationId }) })),
  deleteDocument: async (id: number, organizationId?: number) =>
    api.delete(`/document-flow/documents/${id}`, { params: compact({ organizationId }) }),
  uploadFile: async (id: number, file: File, options: UploadOptions = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (options.changeReason) form.append('changeReason', options.changeReason);
    if (options.organizationId !== undefined) form.append('organizationId', String(options.organizationId));
    const response = await api.post(`/document-flow/documents/${id}/file`, form, {
      signal: options.signal, onUploadProgress: progress(options.onProgress),
    });
    return version(unwrap<Record<string, unknown>>(response));
  },
  preview: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    api.get<Blob>(`/document-flow/documents/${id}/preview`, { params: compact({ organizationId }), responseType: 'blob', signal }),
  download: async (id: number, organizationId?: number) =>
    api.get<Blob>(`/document-flow/documents/${id}/download`, { params: compact({ organizationId }), responseType: 'blob' }),
  attachments: async (id: number, organizationId?: number, signal?: AbortSignal) => {
    const rows = unwrap<Record<string, unknown>[]>(await api.get(`/document-flow/documents/${id}/attachments`, {
      params: compact({ organizationId }), signal,
    }));
    return rows.map(attachment);
  },
  uploadAttachment: async (id: number, file: File, options: UploadOptions = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (options.organizationId !== undefined) form.append('organizationId', String(options.organizationId));
    return attachment(unwrap<Record<string, unknown>>(await api.post(`/document-flow/documents/${id}/attachments`, form, {
      signal: options.signal, onUploadProgress: progress(options.onProgress),
    })));
  },
  deleteAttachment: async (id: number, attachmentId: number, organizationId?: number) =>
    api.delete(`/document-flow/documents/${id}/attachments/${attachmentId}`, { params: compact({ organizationId }) }),
  versions: async (id: number, organizationId?: number, signal?: AbortSignal) => {
    const rows = unwrap<Record<string, unknown>[]>(await api.get(`/document-flow/documents/${id}/versions`, {
      params: compact({ organizationId }), signal,
    }));
    return rows.map(version);
  },
  audit: async (id: number, page = 0, size = 50, organizationId?: number, signal?: AbortSignal) =>
    unwrap<PageResponse<AuditEvent>>(await api.get(`/document-flow/documents/${id}/audit`, {
      params: compact({ page, size, organizationId }), signal,
    })),
  uploadVersion: async (id: number, file: File, options: UploadOptions = {}) => {
    const form = new FormData();
    form.append('file', file);
    if (options.changeReason) form.append('changeReason', options.changeReason);
    if (options.organizationId !== undefined) form.append('organizationId', String(options.organizationId));
    return version(unwrap<Record<string, unknown>>(await api.post(`/document-flow/documents/${id}/versions`, form, {
      signal: options.signal, onUploadProgress: progress(options.onProgress),
    })));
  },
  downloadVersion: async (id: number, versionId: number, organizationId?: number) =>
    api.get<Blob>(`/document-flow/documents/${id}/versions/${versionId}/download`, {
      params: compact({ organizationId }), responseType: 'blob',
    }),
  counterparties: async (page = 0, size = 20, organizationId?: number, signal?: AbortSignal) =>
    unwrap<PageResponse<Counterparty>>(await api.get('/document-flow/counterparties', {
      params: compact({ page, size, organizationId }), signal,
    })),
  counterparty: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    unwrap<Counterparty>(await api.get(`/document-flow/counterparties/${id}`, { params: compact({ organizationId }), signal })),
  createCounterparty: async (payload: {
    bin: string; name: string; linkedOrganizationId?: number | null; directorName?: string;
    address?: string; email?: string; phone?: string;
  }, organizationId?: number) =>
    unwrap<Counterparty>(await api.post('/document-flow/counterparties', payload, { params: compact({ organizationId }) })),
  archiveCounterparty: async (id: number, organizationId?: number) =>
    unwrap<Counterparty>(await api.delete(`/document-flow/counterparties/${id}`, { params: compact({ organizationId }) })),
  representatives: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    unwrap<Representative[]>(await api.get(`/document-flow/counterparties/${id}/representatives`, {
      params: compact({ organizationId }), signal,
    })),
  organizationSigners: async (organizationId: number, query: string, signal?: AbortSignal) =>
    unwrap<OrganizationSigner[]>(await api.get(`/organizations/${organizationId}/signers`, {
      params: { query }, signal,
    })),
  addRepresentative: async (id: number, payload: Omit<Representative, 'id' | 'counterpartyId' | 'active'>, organizationId?: number) =>
    unwrap<Representative>(await api.post(`/document-flow/counterparties/${id}/representatives`, payload, {
      params: compact({ organizationId }),
    })),
  signingRoute: async (id: number, signal?: AbortSignal) =>
    unwrap<SigningRoute>(await api.get(`/document-flow/documents/${id}/signing-route`, { signal })),
  createSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/signing-route`, payload)),
  updateSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    unwrap<SigningRoute>(await api.put(`/document-flow/documents/${id}/signing-route`, payload)),
  prepareForSigning: async (id: number, expectedVersion: number) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/prepare-for-signing`, { expectedVersion })),
  sendForSigning: async (id: number) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/send-for-signing`)),
  cancelSigning: async (id: number, reason?: string) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/cancel-signing`, reason ? { reason } : undefined)),
  signingData: async (id: number) =>
    unwrap<SigningRoute>(await api.get(`/document-flow/documents/${id}/signing-data`)),
  submitSignature: async (id: number, payload: {
    documentId: number; versionId: number; assignmentId: number; cms: string; clientRequestId: string;
  }) => unwrap<DocumentSignature>(await api.post(`/document-flow/documents/${id}/signatures`, {
    documentId: payload.documentId,
    versionId: payload.versionId,
    assignmentId: payload.assignmentId,
    cms: payload.cms,
    clientRequestId: payload.clientRequestId,
  })),
  signatures: async (id: number, signal?: AbortSignal) =>
    unwrap<DocumentSignature[]>(await api.get(`/document-flow/documents/${id}/signatures`, { signal })),
  verifyAll: async (id: number) =>
    unwrap<Record<string, string>>(await api.post(`/document-flow/documents/${id}/signatures/verify-all`)),
  verificationReport: async (id: number, signal?: AbortSignal) =>
    unwrap<Record<string, string>>(await api.get(`/document-flow/documents/${id}/verification-report`, { signal })),
  reject: async (id: number, reason: string) =>
    api.post(`/document-flow/documents/${id}/reject`, { reason }),
  returnForRevision: async (id: number, reason: string) =>
    api.post(`/document-flow/documents/${id}/return-for-revision`, { reason }),
  signedPackage: async (id: number) =>
    api.get<Blob>(`/document-flow/documents/${id}/signed-package`, { responseType: 'blob' }),
  revocations: async (id: number, signal?: AbortSignal) =>
    unwrap<RevocationRequest[]>(await api.get(`/document-flow/documents/${id}/revocation-requests`, { signal })),
  createRevocation: async (id: number, reason: string) =>
    unwrap<RevocationRequest>(await api.post(`/document-flow/documents/${id}/revocation-requests`, { reason })),
  revocationAction: async (requestId: number, action: 'send' | 'approve' | 'reject' | 'cancel', comment?: string) =>
    unwrap<RevocationRequest>(await api.post(`/document-flow/revocation-requests/${requestId}/${action}`,
      action === 'approve' || action === 'reject' ? { comment } : undefined)),
};

export const publicDocumentFlowApi = {
  invitation: async (token: string, signal?: AbortSignal) =>
    unwrap<PublicInvitation>(await publicClient.get(`/signing/${encodeURIComponent(token)}`, { signal })),
  file: async (token: string, signal?: AbortSignal) =>
    publicClient.get<Blob>(`/signing/${encodeURIComponent(token)}/file`, { responseType: 'blob', signal }),
  viewed: async (token: string) =>
    publicClient.post(`/signing/${encodeURIComponent(token)}/viewed`),
  prepare: async (token: string) =>
    unwrap<SelfSignPreparation>(await publicClient.post(`/signing/${encodeURIComponent(token)}/prepare`)),
  sign: async (token: string, payload: {
    documentId: number; versionId: number; assignmentId: number; cms: string; clientRequestId: string;
  }) => unwrap<DocumentSignature>(await publicClient.post(`/signing/${encodeURIComponent(token)}/sign`, {
    documentId: payload.documentId,
    versionId: payload.versionId,
    assignmentId: payload.assignmentId,
    cms: payload.cms,
    clientRequestId: payload.clientRequestId,
  })),
  reject: async (token: string, reason: string) =>
    publicClient.post(`/signing/${encodeURIComponent(token)}/reject`, { reason }),
};

export const adminDocumentFlowApi = {
  plans: async (signal?: AbortSignal) =>
    unwrap<PlanAdmin[]>(await api.get('/admin/document-flow/plans', { signal })),
  createPlan: async (payload: object) =>
    unwrap<PlanAdmin>(await api.post('/admin/document-flow/plans', payload)),
  updatePlan: async (id: number, payload: object) =>
    unwrap<PlanAdmin>(await api.patch(`/admin/document-flow/plans/${id}`, payload)),
  subscriptions: async (signal?: AbortSignal) =>
    unwrap<SubscriptionAdmin[]>(await api.get('/admin/document-flow/subscriptions', { signal })),
  subscription: async (organizationId: number) =>
    unwrap<SubscriptionAdmin>(await api.get(`/admin/document-flow/subscriptions/${organizationId}`)),
  subscriptionAction: async (
    organizationId: number,
    action: 'extend' | 'suspend' | 'restore' | 'revoke' | 'change-plan' | 'limits' | 'entitlements',
    payload: object,
  ) => unwrap<AccessContext>(await api.post(`/admin/document-flow/subscriptions/${organizationId}/${action}`, payload)),
  grantAccess: async (payload: {
    organizationId: number; planCode: string; startsAt: string; expiresAt?: string;
    graceEndsAt?: string; paymentMode: string; paymentReference?: string; reason?: string;
    limits?: Partial<Record<UsageMetric, number>>;
  }, idempotencyKey: string) =>
    unwrap<AccessContext>(await api.post('/admin/document-flow/access-grants', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    })),
};
