import type { AxiosProgressEvent } from 'axios';
import api from '../../../services/api';
import { unwrapApiResponse, type ApiResponse } from '../../../services/apiHelpers';
import type {
  AccessContext, AuditEvent, AvailableAction, Counterparty, CounterpartyListParams, CreateCounterpartyRequest, CreateDocumentRequest, CreateMemberRequest, DashboardResponse, DocumentAttachment,
  DocumentFlowMember, DocumentFlowOrganization, MemberListParams, MembershipRole, MyAssignment,
  DocumentDetail, DocumentFilters, DocumentListItem, DocumentSignature, DocumentTypeConfig,
  DocumentVersion, PageResponse, PlanAdmin, PublicInvitation, PublicPlan, Representative,
  RevocationRequest, SigningRoute, SigningRouteRequest, SubscriptionAdmin, UpdateCounterpartyRequest, UpdateDocumentRequest,
  UsageMetric,
} from '../model/types';
import {
  accessContextSchema, documentDetailSchema, documentFlowOrganizationsSchema, documentListItemSchema, pageSchema, publicInvitationSchema, signingRouteSchema,
} from './contractSchemas';

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  return unwrapApiResponse<T>(response.data);
};

const parseContract = <T>(schema: { parse(value: unknown): unknown }, value: unknown): T => schema.parse(value) as T;

const compact = <T extends object>(value: T) => Object.fromEntries(
  Object.entries(value).filter(([, item]) => item !== undefined && item !== ''),
);

const counterparty = (source: Record<string, unknown>): Counterparty => ({
  id: Number(source.id),
  organizationId: Number(source.organizationId ?? source.ownerOrganizationId),
  linkedOrganizationId: source.linkedOrganizationId == null ? null : Number(source.linkedOrganizationId),
  bin: String(source.bin ?? ''),
  name: String(source.name ?? ''),
  directorName: source.directorName == null ? null : String(source.directorName),
  address: source.address == null ? null : String(source.address),
  email: source.email == null ? null : String(source.email),
  phone: source.phone == null ? null : String(source.phone),
  status: source.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
  createdAt: String(source.createdAt ?? ''),
  updatedAt: String(source.updatedAt ?? ''),
  version: Number(source.version ?? 0),
});

const counterpartyPage = (source: PageResponse<Record<string, unknown>>): PageResponse<Counterparty> => ({
  ...source,
  items: source.items.map(counterparty),
});

const member = (source: Record<string, unknown>): DocumentFlowMember => {
  const user = typeof source.user === 'object' && source.user !== null ? source.user as Record<string, unknown> : {};
  return {
    id: Number(source.id),
    organizationId: Number(source.organizationId),
    userId: Number(source.userId ?? user.id),
    fullName: String(source.fullName ?? user.fullName ?? ''),
    email: source.email ?? user.email ? String(source.email ?? user.email) : null,
    role: String(source.role) as MembershipRole,
    status: String(source.status ?? source.membershipStatus ?? ''),
  };
};

const memberPage = (source: PageResponse<Record<string, unknown>>): PageResponse<DocumentFlowMember> => ({
  ...source,
  items: source.items.map(member),
});

const myAssignment = (source: Record<string, unknown>): MyAssignment => ({
  required: source.required === true || source.requiresMySignature === true,
  assignmentId: Number(source.assignmentId ?? source.id),
  stepOrder: Number(source.stepOrder ?? source.stepNumber ?? 0),
  action: String(source.action ?? source.actionType ?? 'SIGN'),
  status: String(source.status ?? ''),
  versionId: Number(source.versionId ?? source.documentVersionId),
  deadline: source.deadline == null ? null : String(source.deadline),
  availableActions: Array.isArray(source.availableActions) ? source.availableActions.map(String) as AvailableAction[] : [],
});

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
  organizations: async (signal?: AbortSignal) =>
    parseContract<DocumentFlowOrganization[]>(documentFlowOrganizationsSchema, unwrap<unknown>(await api.get('/document-flow/organizations', { signal }))),
  access: async (organizationId: number, signal?: AbortSignal) =>
    parseContract<AccessContext>(accessContextSchema, unwrap<unknown>(await api.get('/document-flow/access', {
      params: { organizationId }, signal,
    }))),
  plans: async (signal?: AbortSignal) =>
    unwrap<PublicPlan[]>(await api.get('/public/document-flow/plans', { signal })),
  plan: async (code: string, signal?: AbortSignal) =>
    unwrap<PublicPlan>(await api.get(`/public/document-flow/plans/${encodeURIComponent(code)}`, { signal })),
  requestAccess: async (payload: {
    contactName: string; phone?: string; email?: string; planCode?: string;
    membersCount?: number; comment?: string;
  }) => unwrap(await api.post('/document-flow/access-requests', payload)),
  dashboard: async (organizationId?: number, signal?: AbortSignal) =>
    unwrap<DashboardResponse>(await api.get('/document-flow/dashboard', { params: compact({ organizationId }), signal })),
  documentTypes: async (signal?: AbortSignal) =>
    unwrap<DocumentTypeConfig[]>(await api.get('/document-flow/document-types', { signal })),
  documents: async (filters: DocumentFilters, signal?: AbortSignal) =>
    parseContract<PageResponse<DocumentListItem>>(pageSchema(documentListItemSchema), unwrap<unknown>(await api.get('/document-flow/documents', { params: compact(filters), signal }))),
  document: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.get(`/document-flow/documents/${id}`, { params: compact({ organizationId }), signal }))),
  createDocument: async (payload: CreateDocumentRequest, idempotencyKey: string) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.post('/document-flow/documents', payload, { headers: { 'Idempotency-Key': idempotencyKey } }))),
  updateDocument: async (id: number, payload: UpdateDocumentRequest, organizationId?: number) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.patch(`/document-flow/documents/${id}`, payload, { params: compact({ organizationId }) }))),
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
  downloadAttachment: async (id: number, attachmentId: number, organizationId: number) =>
    api.get<Blob>(`/document-flow/documents/${id}/attachments/${attachmentId}/download`, {
      params: { organizationId }, responseType: 'blob',
    }),
  getCounterparties: async ({ organizationId, query, status, sort, page, size, signal }: CounterpartyListParams) =>
    counterpartyPage(unwrap<PageResponse<Record<string, unknown>>>(await api.get('/document-flow/counterparties', {
      params: compact({ organizationId, query: query?.trim(), status, sort, page, size }), signal,
    }))),
  getCounterparty: async (id: number, organizationId: number, signal?: AbortSignal) =>
    counterparty(unwrap<Record<string, unknown>>(await api.get(`/document-flow/counterparties/${id}`, {
      params: { organizationId }, signal,
    }))),
  createCounterparty: async (request: CreateCounterpartyRequest) =>
    counterparty(unwrap<Record<string, unknown>>(await api.post('/document-flow/counterparties', request))),
  updateCounterparty: async (id: number, request: UpdateCounterpartyRequest, organizationId: number) =>
    counterparty(unwrap<Record<string, unknown>>(await api.patch(`/document-flow/counterparties/${id}`, request, {
      params: { organizationId },
    }))),
  archiveCounterparty: async (id: number, organizationId: number) =>
    counterparty(unwrap<Record<string, unknown>>(await api.delete(`/document-flow/counterparties/${id}`, {
      params: { organizationId },
    }))),
  representatives: async (id: number, signal?: AbortSignal) =>
    unwrap<Representative[]>(await api.get(`/document-flow/counterparties/${id}/representatives`, {
      signal,
    })),
  addRepresentative: async (id: number, payload: Omit<Representative, 'id' | 'counterpartyId' | 'active'>) =>
    unwrap<Representative>(await api.post(`/document-flow/counterparties/${id}/representatives`, payload)),
  members: async ({ organizationId, query, status, role, page, size, sort, signal }: MemberListParams) =>
    memberPage(unwrap<PageResponse<Record<string, unknown>>>(await api.get('/document-flow/members', {
      params: compact({ organizationId, query: query?.trim(), status, role, page, size, sort }), signal,
    }))),
  createMember: async (payload: CreateMemberRequest) =>
    member(unwrap<Record<string, unknown>>(await api.post('/document-flow/members', payload))),
  updateMemberRole: async (id: number, role: MembershipRole, organizationId: number) =>
    member(unwrap<Record<string, unknown>>(await api.patch(`/document-flow/members/${id}`, { role }, {
      params: { organizationId },
    }))),
  activateMember: async (id: number, organizationId: number) =>
    member(unwrap<Record<string, unknown>>(await api.post(`/document-flow/members/${id}/activate`, undefined, {
      params: { organizationId },
    }))),
  deactivateMember: async (id: number, organizationId: number) =>
    member(unwrap<Record<string, unknown>>(await api.post(`/document-flow/members/${id}/deactivate`, undefined, {
      params: { organizationId },
    }))),
  signingRoute: async (id: number, signal?: AbortSignal) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.get(`/document-flow/documents/${id}/signing-route`, { signal }))),
  createSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.post(`/document-flow/documents/${id}/signing-route`, payload))),
  updateSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.put(`/document-flow/documents/${id}/signing-route`, payload))),
  sendForSigning: async (id: number) =>
    unwrap<unknown>(await api.post(`/document-flow/documents/${id}/send`)),
  cancelSigning: async (id: number, reason?: string) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/cancel-signing`, reason ? { reason } : undefined)),
  signingData: async (id: number) =>
    unwrap<SigningRoute>(await api.get(`/document-flow/documents/${id}/signing-data`)),
  myAssignment: async (id: number, organizationId: number, signal?: AbortSignal) =>
    myAssignment(unwrap<Record<string, unknown>>(await api.get(`/document-flow/documents/${id}/my-assignment`, {
      params: { organizationId }, signal,
    }))),
  submitSignature: async (payload: {
    documentId: number; versionId: number; assignmentId: number; cms: string; clientRequestId: string;
  }) => unwrap<DocumentSignature>(await api.post('/document-flow/signatures', {
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
  reject: async (id: number, reason: string, organizationId: number) =>
    api.post(`/document-flow/documents/${id}/reject`, { reason }, { params: { organizationId } }),
  returnForRevision: async (id: number, reason: string, organizationId: number) =>
    api.post(`/document-flow/documents/${id}/return-for-revision`, { reason }, { params: { organizationId } }),
  archive: async (id: number, organizationId: number) =>
    api.post(`/document-flow/documents/${id}/archive`, undefined, { params: { organizationId } }),
  audit: async (id: number, organizationId: number, page: number, size: number, signal?: AbortSignal) =>
    unwrap<PageResponse<AuditEvent>>(await api.get(`/document-flow/documents/${id}/audit`, {
      params: { organizationId, page, size }, signal,
    })),
  signedPackage: async (id: number, organizationId: number) =>
    api.get<Blob>(`/document-flow/documents/${id}/signed-package`, { params: { organizationId }, responseType: 'blob' }),
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
    parseContract<PublicInvitation>(publicInvitationSchema, unwrap<unknown>(await api.get(`/public/document-flow/signing/${encodeURIComponent(token)}`, { signal }))),
  file: async (token: string, signal?: AbortSignal) =>
    api.get<Blob>(`/public/document-flow/signing/${encodeURIComponent(token)}/file`, { responseType: 'blob', signal }),
  challenge: async (token: string, signal?: AbortSignal) =>
    unwrap<unknown>(await api.get(`/public/document-flow/signing/${encodeURIComponent(token)}/challenge`, { signal })),
  sign: async (token: string, payload: { cms: string; clientRequestId: string }) =>
    unwrap<DocumentSignature>(await api.post(`/public/document-flow/signing/${encodeURIComponent(token)}/sign`, payload)),
  reject: async (token: string, reason: string) =>
    api.post(`/public/document-flow/signing/${encodeURIComponent(token)}/reject`, { reason }),
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
