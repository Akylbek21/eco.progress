export type FeatureCode =
  | 'DOCUMENT_FLOW' | 'DOCUMENT_CREATE' | 'MULTI_SIGNING'
  | 'SEQUENTIAL_SIGNING' | 'PARALLEL_SIGNING' | 'MIXED_SIGNING'
  | 'EXTERNAL_SIGNING' | 'NCALAYER_SIGNING' | 'DOCUMENT_TEMPLATES'
  | 'VERSIONING' | 'REVOCATION' | 'AUDIT_LOG' | 'API_ACCESS'
  | 'CRM_INTEGRATION' | 'CUSTOM_LIMITS';

export type UsageMetric =
  | 'DOCUMENTS_CREATED' | 'SIGNATURES_CREATED'
  | 'EXTERNAL_SIGNATURES_CREATED' | 'STORAGE_BYTES' | 'ACTIVE_MEMBERS';

export type SubscriptionStatus =
  | 'PENDING' | 'TRIAL' | 'ACTIVE' | 'GRACE_PERIOD'
  | 'SUSPENDED' | 'EXPIRED' | 'CANCELLED';

export interface AccessContext {
  available: boolean;
  readOnly: boolean;
  status: SubscriptionStatus | string | null;
  plan: { code: string; name: string } | null;
  startsAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  features: FeatureCode[];
  permissions: string[];
  limits: Partial<Record<UsageMetric, number>>;
  usage: Partial<Record<UsageMetric, number>>;
  availableActions: string[];
  reason: string | null;
}

export interface PublicPlanFeature {
  code: FeatureCode;
  enabled: boolean;
  limitValue: number | null;
}

export interface PublicPlan {
  code: string;
  nameRu: string;
  nameKk: string;
  descriptionRu: string | null;
  descriptionKk: string | null;
  billingPeriod: 'MONTHLY' | 'YEARLY' | 'ONE_TIME' | string;
  price: number;
  currency: string;
  trialDays: number;
  features: PublicPlanFeature[];
}

export type DocumentDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL';
export type DocumentStatus =
  | 'DRAFT' | 'READY_FOR_SIGNING' | 'SENT_FOR_SIGNING'
  | 'PARTIALLY_SIGNED' | 'SIGNED' | 'REJECTED'
  | 'RETURNED_FOR_REVISION' | 'REVOCATION_REQUESTED' | 'REVOKED'
  | 'CANCELLED' | 'EXPIRED' | 'ARCHIVED';

export type DocumentType =
  | 'REALIZATION_OF_GOODS_SERVICES' | 'RECEIPT_OF_GOODS_SERVICES'
  | 'RETURN_TO_SUPPLIER' | 'RETURN_FROM_CUSTOMER' | 'RECONCILIATION_ACT'
  | 'CONTRACT' | 'ADDITIONAL_AGREEMENT' | 'COMPLETION_ACT' | 'SERVICE_ACT'
  | 'INVOICE' | 'COMMERCIAL_OFFER' | 'LAB_PROTOCOL' | 'SAMPLING_ACT'
  | 'ENVIRONMENTAL_REPORT' | 'PEC_REPORT' | 'WASTE_PASSPORT'
  | 'WASTE_TRANSFER_ACT' | 'DISPOSAL_ACT' | 'CUSTOM_DOCUMENT'
  | 'REVOCATION_REQUEST';

export interface DocumentTypeConfig {
  type: DocumentType;
  title: string;
  allowedDirections: 'IN' | 'OUT' | 'BOTH';
  requiredFeature: FeatureCode | null;
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  signingRequired: boolean;
  counterpartyRequired: boolean;
  active: boolean;
}

export interface DocumentPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canSend: boolean;
  canDownload: boolean;
  canUploadVersion: boolean;
  canArchive: boolean;
  canManageAttachments: boolean;
}

export interface DocumentListItem {
  id: number;
  number: string | null;
  title: string;
  type: DocumentType | string;
  direction: DocumentDirection | string;
  counterparty: { id: number; name: string; bin: string } | null;
  author: { id: number; fullName: string } | null;
  createdAt: string;
  deadline: string | null;
  status: DocumentStatus | string;
  signedCount: number;
  requiredCount: number;
  requiresMySignature: boolean;
  version: number;
  permissions: DocumentPermissions;
  availableActions: string[];
}

export interface DocumentDetail extends DocumentListItem {
  publicId: string;
  description: string | null;
  updatedAt: string;
  currentVersionId: number | null;
}

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface DocumentFilters {
  organizationId?: number;
  direction?: DocumentDirection;
  type?: DocumentType;
  status?: DocumentStatus;
  counterpartyId?: number;
  authorId?: number;
  signerId?: number;
  requiresMySignature?: boolean;
  overdue?: boolean;
  createdFrom?: string;
  createdTo?: string;
  deadlineFrom?: string;
  deadlineTo?: string;
  query?: string;
  page: number;
  size: number;
  sort: string;
}

export interface CreateDocumentRequest {
  documentType: DocumentType;
  direction: DocumentDirection;
  title: string;
  description?: string;
  counterpartyId?: number;
  signingDeadline?: string;
  organizationId?: number;
}

export interface UpdateDocumentRequest {
  title?: string;
  description?: string | null;
  documentNumber?: string | null;
  counterpartyId?: number | null;
  signingDeadline?: string | null;
}

export interface DocumentVersion {
  id: number;
  documentId: number;
  versionNumber: number;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  locked: boolean;
  lockedAt: string | null;
  lockedBy: number | null;
  changeReason: string | null;
  current: boolean;
  createdBy: number;
  createdAt: string;
}

export interface DocumentAttachment {
  id: number;
  documentId: number;
  originalFileName: string;
  mimeType: string;
  fileSize: number;
  sha256Hash: string;
  uploadedBy: number;
  createdAt: string;
}

export interface Counterparty {
  id: number;
  organizationId: number;
  bin: string;
  name: string;
  directorName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  version: number;
}

export interface Representative {
  id: number;
  counterpartyId: number;
  fullName: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
}

export type SigningRouteType = 'SEQUENTIAL' | 'PARALLEL' | 'MIXED';
export type SignerType = 'ORGANIZATION_MEMBER' | 'COUNTERPARTY_REPRESENTATIVE' | 'EXTERNAL';

export interface SigningAssignmentInput {
  signerType: SignerType;
  userId?: number;
  signerFullName?: string;
  signerIin?: string;
  organizationName?: string;
  organizationBin?: string;
  email?: string;
  phone?: string;
  roleCode?: string;
  required: boolean;
}

export interface SigningStepInput {
  requiredCount: number;
  assignments: SigningAssignmentInput[];
}

export interface SigningRouteRequest {
  routeType: SigningRouteType;
  steps: SigningStepInput[];
}

export interface SigningAssignment extends SigningAssignmentInput {
  id: number;
  stepId: number;
  status: string;
  availableAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  invitationExpiresAt: string | null;
}

export interface SigningRoute {
  id: number;
  documentId: number;
  routeType: SigningRouteType;
  status: string;
  createdBy: number;
  createdAt: string;
  activatedAt: string | null;
  completedAt: string | null;
  version: number;
  steps: Array<{ id: number; stepOrder: number; requiredCount: number; assignments: SigningAssignment[] }>;
}

export interface DocumentSignature {
  id: number;
  documentId: number;
  documentVersionId: number;
  routeId: number;
  assignmentId: number;
  signerUserId: number | null;
  certificateSerialNumber: string;
  certificateSubject: string;
  certificateIssuer: string;
  certificateBin: string;
  certificateValidFrom: string;
  certificateValidTo: string;
  signedAt: string;
  verificationStatus: 'VALID' | 'INVALID' | 'EXPIRED_CERTIFICATE' | 'REVOKED_CERTIFICATE' | string;
}

export interface PublicInvitation {
  documentId: number;
  documentTitle: string;
  roleCode: string | null;
  required: boolean;
  status: 'AVAILABLE' | 'VIEWED' | 'SIGNED' | 'REJECTED' | 'EXPIRED' | string;
  invitationExpiresAt: string | null;
  signingDeadline: string | null;
}

export interface RevocationRequest {
  id: number;
  documentId: number;
  requestedBy: number;
  status: 'DRAFT' | 'SENT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;
  reason: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolutionComment: string | null;
}

export interface DashboardResponse {
  total: number;
  byStatus: Record<string, number>;
  byDirection: Record<string, number>;
}

export interface SubscriptionAdmin {
  id: number;
  organizationId: number;
  planId: number;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  autoRenew: boolean;
  paymentMode: string;
  paymentReference: string | null;
  suspensionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanAdmin extends Omit<PublicPlan, 'features'> {
  id: number;
  active: boolean;
  visible: boolean;
  sortOrder: number;
  features: Array<PublicPlanFeature & { metadataJson: string | null }>;
}
