import type { AxiosProgressEvent } from 'axios';
import api from '../../../services/api';
import type { ApiResponse } from '../../../services/apiHelpers';
import type {
  AccessContext, AccessRequestPayload, AuditEvent, Counterparty, CounterpartyListParams, CreateCounterpartyRequest, CreateDocumentRequest, CreateMemberRequest, DashboardResponse, DocumentAttachment,
  DocumentFlowMember, DocumentFlowOrganization, MemberListParams, MembershipRole, MyAssignment,
  DocumentDetail, DocumentFilters, DocumentListItem, DocumentSignature, DocumentTypeConfig,
  DocumentVersion, PageResponse, PublicInvitation, PublicPlan, PublicSigningChallenge, Representative,
  RevocationRequest, SigningRoute, SigningRouteRequest, UpdateDocumentRequest,
} from '../model/types';
import {
  accessContextSchema, auditEventSchema, documentDetailSchema, documentFlowOrganizationsSchema, documentListItemSchema, memberSchema,
  myAssignmentSchema, pageSchema, publicInvitationSchema, publicSigningChallengeSchema, signingRouteSchema,
} from './contractSchemas';

const unwrap = <T>(response: { data: ApiResponse<T> | T }): T => {
  const envelope = response.data;
  if (!envelope || typeof envelope !== 'object' || !('success' in envelope) || !('data' in envelope)) {
    throw new DocumentFlowContractError('API envelope', [{ message: 'Ожидался ApiResponse<T>' }]);
  }
  if (envelope.success !== true) {
    const error = new Error(envelope.message || 'Backend отклонил запрос.');
    Object.assign(error, { code: envelope.code, fieldErrors: envelope.fieldErrors, traceId: envelope.traceId });
    throw error;
  }
  return envelope.data;
};

export class DocumentFlowContractError extends Error {
  readonly code = 'CONTRACT_MISMATCH';
  constructor(readonly endpoint: string, readonly issues: unknown) {
    super(`Не удалось обработать ответ сервера. Код: CONTRACT_MISMATCH`);
    if (import.meta.env.DEV) console.error('[Document flow contract mismatch]', { endpoint, issues });
  }
}

const parseContract = <T>(schema: { safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues: unknown } } }, value: unknown, endpoint: string): T => {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new DocumentFlowContractError(endpoint, parsed.error?.issues);
  return parsed.data as T;
};

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
    organizationId: source.organizationId == null ? undefined : Number(source.organizationId),
    userId: Number(source.userId ?? user.id),
    fullName: String(source.fullName ?? user.fullName ?? ''),
    email: source.email ?? user.email ? String(source.email ?? user.email) : null,
    role: String(source.role) as MembershipRole,
    status: String(source.status ?? source.membershipStatus ?? ''),
  };
};

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
    parseContract<DocumentFlowOrganization[]>(documentFlowOrganizationsSchema, unwrap<unknown>(await api.get('/document-flow/organizations', { signal })), 'GET /document-flow/organizations'),
  access: async (organizationId: number, signal?: AbortSignal) =>
    parseContract<AccessContext>(accessContextSchema, unwrap<unknown>(await api.get('/document-flow/access', {
      params: { organizationId }, signal,
    })), 'GET /document-flow/access'),
  plans: async (signal?: AbortSignal) =>
    unwrap<PublicPlan[]>(await api.get('/public/document-flow/plans', { signal })),
  plan: async (code: string, signal?: AbortSignal) =>
    unwrap<PublicPlan>(await api.get(`/public/document-flow/plans/${encodeURIComponent(code)}`, { signal })),
  requestAccess: async (payload: AccessRequestPayload) => unwrap(await api.post('/document-flow/access-requests', payload)),
  dashboard: async (organizationId?: number, signal?: AbortSignal) =>
    unwrap<DashboardResponse>(await api.get('/document-flow/dashboard', { params: compact({ organizationId }), signal })),
  documentTypes: async (signal?: AbortSignal) =>
    unwrap<DocumentTypeConfig[]>(await api.get('/document-flow/document-types', { signal })),
  documents: async (filters: DocumentFilters, signal?: AbortSignal) =>
    parseContract<PageResponse<DocumentListItem>>(pageSchema(documentListItemSchema), unwrap<unknown>(await api.get('/document-flow/documents', { params: compact(filters), signal })), 'GET /document-flow/documents'),
  document: async (id: number, organizationId?: number, signal?: AbortSignal) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.get(`/document-flow/documents/${id}`, { params: compact({ organizationId }), signal })), 'GET /document-flow/documents/{id}'),
  createDocument: async (payload: CreateDocumentRequest, idempotencyKey: string) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.post('/document-flow/documents', payload, { headers: { 'Idempotency-Key': idempotencyKey } })), 'POST /document-flow/documents'),
  updateDocument: async (id: number, payload: UpdateDocumentRequest, organizationId?: number) =>
    parseContract<DocumentDetail>(documentDetailSchema, unwrap<unknown>(await api.patch(`/document-flow/documents/${id}`, payload, { params: compact({ organizationId }) })), 'PATCH /document-flow/documents/{id}'),
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
  createCounterparty: async (request: CreateCounterpartyRequest, organizationId?: number) =>
    counterparty(unwrap<Record<string, unknown>>(await api.post('/document-flow/counterparties', request, {
      params: compact({ organizationId }),
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
  members: async ({ organizationId, query, status, role, page, size, signal }: MemberListParams) => {
    const raw = unwrap<unknown>(await api.get('/document-flow/members', { params: { organizationId }, signal }));
    const rows = parseContract<DocumentFlowMember[]>(memberSchema.array(), raw, 'GET /document-flow/members');
    const needle = query?.trim().toLocaleLowerCase('ru');
    const filtered = rows.filter((item) => (!needle || `${item.fullName} ${item.email ?? ''}`.toLocaleLowerCase('ru').includes(needle))
      && (!status || item.status === status) && (!role || item.role === role));
    const items = filtered.slice(page * size, page * size + size);
    const totalPages = Math.ceil(filtered.length / size);
    return { items, page, size, totalElements: filtered.length, totalPages, first: page === 0, last: page + 1 >= totalPages, hasNext: page + 1 < totalPages, hasPrevious: page > 0 };
  },
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
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.get(`/document-flow/documents/${id}/signing-route`, { signal })), 'GET /document-flow/documents/{id}/signing-route'),
  createSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.post(`/document-flow/documents/${id}/signing-route`, payload)), 'POST /document-flow/documents/{id}/signing-route'),
  updateSigningRoute: async (id: number, payload: SigningRouteRequest) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.put(`/document-flow/documents/${id}/signing-route`, payload)), 'PUT /document-flow/documents/{id}/signing-route'),
  prepareForSigning: async (id: number, expectedVersion: number) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.post(`/document-flow/documents/${id}/prepare-for-signing`, { expectedVersion })), 'POST /document-flow/documents/{id}/prepare-for-signing'),
  sendForSigning: async (id: number) =>
    parseContract<SigningRoute>(signingRouteSchema, unwrap<unknown>(await api.post(`/document-flow/documents/${id}/send-for-signing`)), 'POST /document-flow/documents/{id}/send-for-signing'),
  cancelSigning: async (id: number, reason?: string) =>
    unwrap<SigningRoute>(await api.post(`/document-flow/documents/${id}/cancel-signing`, reason ? { reason } : undefined)),
  signingData: async (id: number) =>
    unwrap<SigningRoute>(await api.get(`/document-flow/documents/${id}/signing-data`)),
  myAssignment: async (id: number, organizationId: number, signal?: AbortSignal) => {
    const raw = unwrap<unknown>(await api.get(`/document-flow/documents/${id}/my-assignment`, { params: { organizationId }, signal }));
    return raw == null ? null : parseContract<MyAssignment>(myAssignmentSchema, raw, 'GET /document-flow/documents/{id}/my-assignment');
  },
  submitSignature: async (payload: {
    documentId: number; versionId: number; assignmentId: number; cms: string; clientRequestId: string;
  }) => unwrap<DocumentSignature>(await api.post(`/document-flow/documents/${payload.documentId}/signatures`, {
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
  archive: async (id: number, organizationId: number, expectedVersion: number, reason: string) =>
    unwrap<DocumentDetail>(await api.post(`/document-flow/documents/${id}/archive`, { expectedVersion, reason }, { params: { organizationId } })),
  audit: async (id: number, organizationId: number, page: number, size: number, signal?: AbortSignal) =>
    parseContract<PageResponse<AuditEvent>>(pageSchema(auditEventSchema), unwrap<unknown>(await api.get(`/document-flow/documents/${id}/audit`, {
      params: { organizationId, page, size }, signal,
    })), 'GET /document-flow/documents/{id}/audit'),
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
    parseContract<PublicInvitation>(publicInvitationSchema, unwrap<unknown>(await api.get(`/public/document-flow/signing/${encodeURIComponent(token)}`, { signal })), 'GET /public/document-flow/signing/{token}'),
  file: async (token: string, signal?: AbortSignal) =>
    api.get<Blob>(`/public/document-flow/signing/${encodeURIComponent(token)}/file`, { responseType: 'blob', signal }),
  challenge: async (token: string, signal?: AbortSignal) =>
    parseContract<PublicSigningChallenge>(publicSigningChallengeSchema, unwrap<unknown>(await api.get(`/public/document-flow/signing/${encodeURIComponent(token)}/challenge`, { signal })), 'GET /public/document-flow/signing/{token}/challenge'),
  sign: async (token: string, payload: { cms: string; clientRequestId: string }) =>
    unwrap<DocumentSignature>(await api.post(`/public/document-flow/signing/${encodeURIComponent(token)}/sign`, payload)),
  reject: async (token: string, reason: string) =>
    api.post(`/public/document-flow/signing/${encodeURIComponent(token)}/reject`, { reason }),
};
