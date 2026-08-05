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

export type MembershipRole =
  | 'OWNER' | 'DOCUMENT_FLOW_ADMIN' | 'DOCUMENT_MANAGER'
  | 'SIGNER' | 'ACCOUNTANT' | 'VIEWER' | 'EXTERNAL_SIGNER';

export type DocumentFlowPermission =
  | 'VIEW_DOCUMENTS' | 'CREATE_DOCUMENT' | 'EDIT_DOCUMENT' | 'DELETE_DOCUMENT'
  | 'SIGN_DOCUMENT' | 'SIGN_EXTERNAL' | 'REVOKE_SIGNATURE' | 'MANAGE_MEMBERS'
  | 'MANAGE_COUNTERPARTIES' | 'MANAGE_TEMPLATES' | 'VIEW_AUDIT_LOG'
  | 'MANAGE_SUBSCRIPTION';

export type AvailableAction =
  | 'EDIT' | 'DELETE' | 'SEND_FOR_SIGNING' | 'DOWNLOAD'
  | 'UPLOAD_VERSION' | 'ARCHIVE' | 'MANAGE_ATTACHMENTS';

export interface AccessContext {
  available: boolean;
  readOnly: boolean;
  status: SubscriptionStatus | null;
  plan: { code: string; name: string } | null;
  startsAt: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  features: FeatureCode[];
  permissions: DocumentFlowPermission[];
  limits: Partial<Record<UsageMetric, number>>;
  usage: Partial<Record<UsageMetric, number>>;
  availableActions: DocumentFlowPermission[];
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
  type: DocumentType;
  direction: DocumentDirection;
  counterparty: { id: number; name: string; bin: string } | null;
  author: { id: number; fullName: string } | null;
  createdAt: string;
  deadline: string | null;
  status: DocumentStatus;
  signedCount?: number;
  requiredCount?: number;
  requiresMySignature?: boolean;
  version: number;
  permissions: DocumentPermissions;
  availableActions: AvailableAction[];
}

export interface DocumentDetail extends Omit<DocumentListItem, 'signedCount' | 'requiredCount' | 'requiresMySignature'> {
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

export interface AuditEvent {
  id: number;
  createdAt: string;
  actorName: string | null;
  action: string;
  status: string | null;
  comment: string | null;
}

export interface Counterparty {
  id: number;
  organizationId: number;
  linkedOrganizationId: number | null;
  bin: string;
  name: string;
  directorName: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CreateCounterpartyRequest {
  bin: string;
  name: string;
  linkedOrganizationId?: number | null;
  directorName?: string;
  address?: string;
  email?: string;
  phone?: string;
}

export interface CounterpartyListParams {
  organizationId?: number;
  page: number;
  size: number;
  signal?: AbortSignal;
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
  userId?: number | null;
  signerFullName?: string | null;
  signerIin?: string | null;
  organizationName?: string | null;
  organizationBin?: string | null;
  email?: string | null;
  phone?: string | null;
  roleCode?: string | null;
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
  status: SigningAssignmentStatus;
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
  status: SigningRouteStatus;
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
  verificationStatus: 'VALID' | 'INVALID' | 'EXPIRED_CERTIFICATE' | 'REVOKED_CERTIFICATE';
}

export type SigningRouteStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type SigningAssignmentStatus = 'PENDING' | 'AVAILABLE' | 'VIEWED' | 'SIGNED' | 'REJECTED' | 'EXPIRED';

export interface PublicInvitation {
  documentId: number;
  documentTitle: string;
  roleCode: string | null;
  required: boolean;
  status: 'AVAILABLE' | 'VIEWED' | 'SIGNED' | 'REJECTED' | 'EXPIRED';
  invitationExpiresAt: string | null;
  signingDeadline: string | null;
}

export interface RevocationRequest {
  id: number;
  documentId: number;
  requestedBy: number;
  status: RevocationStatus;
  reason: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: number | null;
  resolutionComment: string | null;
}

export type RevocationStatus = 'DRAFT' | 'SENT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

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
