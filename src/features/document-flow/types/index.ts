export type DocumentFlowAccessStatus =
  | 'ACTIVE'
  | 'TRIAL'
  | 'GRACE_PERIOD'
  | 'READ_ONLY'
  | 'NO_SUBSCRIPTION'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'FEATURE_DISABLED';

export type DocumentFlowPermission =
  | 'DOCUMENT_VIEW'
  | 'DOCUMENT_CREATE'
  | 'DOCUMENT_EDIT'
  | 'DOCUMENT_SEND'
  | 'DOCUMENT_SIGN'
  | 'DOCUMENT_REJECT'
  | 'DOCUMENT_REVOKE'
  | 'DOCUMENT_ARCHIVE'
  | 'DOCUMENT_CREATE_VERSION'
  | 'COUNTERPARTY_MANAGE'
  | 'MEMBER_MANAGE'
  | 'TEMPLATE_MANAGE'
  | 'AUDIT_VIEW'
  | 'SETTINGS_MANAGE'
  | string;

export type DocumentFlowFeature =
  | 'DOCUMENT_FLOW'
  | 'MULTI_SIGNING'
  | 'EXTERNAL_SIGNING'
  | 'SEQUENTIAL_SIGNING'
  | 'PARALLEL_SIGNING'
  | 'MIXED_SIGNING'
  | 'NCALAYER_SIGNING'
  | 'AUDIT_LOG'
  | 'TEMPLATES'
  | 'API'
  | 'CRM_INTEGRATION'
  | string;

export interface DocumentFlowAccess {
  available: boolean;
  readOnly: boolean;
  status: DocumentFlowAccessStatus;
  reason?: string;
  plan?: { code: string; name: string };
  startsAt?: string;
  expiresAt?: string;
  trial?: boolean;
  daysRemaining?: number;
  permissions: DocumentFlowPermission[];
  features: DocumentFlowFeature[];
  limits: {
    members?: number;
    documentsPerMonth?: number;
    storageBytes?: number;
    externalSignaturesPerMonth?: number;
  };
  usage: {
    members?: number;
    documentsThisMonth?: number;
    storageBytes?: number;
    externalSignaturesThisMonth?: number;
  };
  availableActions: string[];
  organization?: { id: string; name: string; bin?: string };
}

export interface DocumentFlowPlan {
  code: string;
  name: string;
  description?: string;
  price?: number;
  currency?: string;
  period?: string;
  trialDays?: number;
  active: boolean;
  features: DocumentFlowFeature[];
  limits: DocumentFlowAccess['limits'];
}

export interface DocumentFlowDashboard {
  counters: Record<string, number>;
  usage: DocumentFlowAccess['usage'];
  limits: DocumentFlowAccess['limits'];
}

export type DocumentDirection = 'INCOMING' | 'OUTGOING';
export type DocumentRouteMode = 'SEQUENTIAL' | 'PARALLEL' | 'MIXED';

export interface DocumentFlowDocument {
  id: string;
  number: string;
  title: string;
  type: string;
  direction: DocumentDirection;
  status: string;
  counterparty?: { id?: string; name: string; bin?: string };
  author?: { id?: string; name: string };
  createdAt: string;
  dueAt?: string;
  version: number;
  hash?: string;
  signaturesCompleted: number;
  signaturesTotal: number;
  availableActions: string[];
  permissions?: DocumentFlowPermission[];
  immutable?: boolean;
}

export interface DocumentFlowList {
  items: DocumentFlowDocument[];
  page: number;
  size: number;
  total: number;
}

export interface DocumentSigner {
  id?: string;
  fullName: string;
  iinMasked?: string;
  organization?: string;
  binMasked?: string;
  position?: string;
  email: string;
  phone?: string;
  role?: string;
  required: boolean;
  step: number;
  deadline?: string;
  external?: boolean;
  status?: string;
}

export interface DocumentFlowDetails extends DocumentFlowDocument {
  description?: string;
  file?: { id: string; name: string; mimeType: string; size: number; downloadUrl?: string };
  attachments?: Array<{ id: string; name: string; mimeType: string; size: number }>;
  signers: DocumentSigner[];
  routeMode: DocumentRouteMode;
  history?: Array<{ id: string; action: string; actor: string; createdAt: string; details?: string }>;
  versions?: Array<{ id: string; version: number; hash: string; createdAt: string; immutable: boolean }>;
}

export interface DocumentFilters {
  direction?: string;
  type?: string;
  status?: string;
  counterpartyId?: string;
  authorId?: string;
  signerId?: string;
  createdFrom?: string;
  createdTo?: string;
  dueFrom?: string;
  dueTo?: string;
  requiresMySignature?: boolean;
  overdue?: boolean;
  search?: string;
  page?: number;
  size?: number;
}

export interface SigningData {
  documentId: string;
  version: number;
  hash: string;
  contentBase64: string;
  algorithm?: string;
}

export interface AccessRequestPayload {
  organization: string;
  bin: string;
  contactPerson: string;
  phone: string;
  email: string;
  planCode?: string;
  membersCount: number;
  comment?: string;
}

export interface AdminSubscription {
  organizationId: string;
  organizationName: string;
  bin: string;
  plan: { code: string; name: string };
  status: DocumentFlowAccessStatus;
  startsAt?: string;
  expiresAt?: string;
  trial: boolean;
  usage: DocumentFlowAccess['usage'];
  limits: DocumentFlowAccess['limits'];
  availableActions: string[];
}

