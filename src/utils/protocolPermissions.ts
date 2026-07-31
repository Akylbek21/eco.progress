import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolStatus } from '../types/protocols';

type ProtocolUser = { id?: string | number | null; role?: string | null } | null | undefined;
type ProtocolLike =
  | (Pick<Protocol, 'status'> & Partial<Pick<Protocol, 'permissions' | 'signatureCount' | 'maxSignatures' | 'signedByCurrentUser' | 'signatures' | 'publishedAt' | 'publishedToClientAt'>>)
  | ProtocolStatus
  | string
  | null
  | undefined;

const EDITABLE_STATUSES = new Set<ProtocolStatus>([
  'DRAFT',
  'CALCULATED',
  'READY',
  'NEEDS_REVISION',
]);
const TERMINAL_STATUSES = new Set<ProtocolStatus>(['ARCHIVED', 'CANCELLED']);
const CORRECTION_STATUSES = new Set<ProtocolStatus>(['SIGNED', 'REPLACED']);

const roleOf = (user: ProtocolUser | string) =>
  String(typeof user === 'string' ? user : user?.role || '').trim().toUpperCase();
const statusOf = (protocol: ProtocolLike) =>
  normalizeProtocolStatus(typeof protocol === 'object' && protocol ? protocol.status : protocol);
const signatureCountOf = (protocol: ProtocolLike) => typeof protocol === 'object' && protocol
  ? Number(protocol.signatureCount ?? protocol.signatures?.length ?? 0)
  : 0;
const maxSignaturesOf = (protocol: ProtocolLike) => typeof protocol === 'object' && protocol
  ? Number(protocol.maxSignatures)
  : 0;
const signedByCurrentUser = (protocol: ProtocolLike) => typeof protocol === 'object'
  && protocol?.signedByCurrentUser === true;
const canSignCurrentVersion = (protocol: ProtocolLike) => {
  const status = statusOf(protocol);
  return ['APPROVED', 'SIGNED'].includes(status)
    && !signedByCurrentUser(protocol)
    && signatureCountOf(protocol) < maxSignaturesOf(protocol);
};
export const isInternalProtocolUser = (user: ProtocolUser | string): boolean => {
  const role = roleOf(user);
  return Boolean(role && role !== 'CLIENT');
};

export { normalizeProtocolStatus };
export const canViewProtocol = (user: ProtocolUser, _protocol?: ProtocolLike) =>
  isInternalProtocolUser(user);
export const canCreateProtocol = (user: ProtocolUser) => isInternalProtocolUser(user);
export const canEditProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && EDITABLE_STATUSES.has(statusOf(protocol));
export const canEditResults = canEditProtocol;
export const canSendForApproval = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && EDITABLE_STATUSES.has(statusOf(protocol));
export const canReturnForRevision = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && statusOf(protocol) === 'READY_FOR_APPROVAL';
export const canApproveProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && statusOf(protocol) === 'READY_FOR_APPROVAL';
export const canSignProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && canSignCurrentVersion(protocol);
export const canCreateCorrection = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && CORRECTION_STATUSES.has(statusOf(protocol));
export const canCancelProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && EDITABLE_STATUSES.has(statusOf(protocol));
export const canArchiveProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  isInternalProtocolUser(user) && ['REPLACED', 'CANCELLED'].includes(statusOf(protocol));
export const canDownloadProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  canViewProtocol(user, protocol);

export type ProtocolPermissions = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canCalculate: boolean;
  canCheckNormatives: boolean;
  canGeneratePreview: boolean;
  canGenerateDocuments: boolean;
  canReadyForApproval: boolean;
  canReturnForRevision: boolean;
  canApprove: boolean;
  canSign: boolean;
  canReplace: boolean;
  canCancel: boolean;
  canArchive: boolean;
  canPublish: boolean;
  canDownload: boolean;
  canManageResults: boolean;
  canManageDevices: boolean;
  canViewAudit: boolean;
};

export const getProtocolPermissions = (
  protocol: ProtocolLike,
  role?: string,
  allowAll = false,
): ProtocolPermissions => {
  const backend = typeof protocol === 'object' && protocol ? protocol.permissions : undefined;
  const backendFlag = (key: keyof ProtocolPermissions) => backend?.[key] === true;
  if (backend && Object.keys(backend).length) {
    if (statusOf(protocol) === 'UNKNOWN') {
      return {
        canView: backendFlag('canView'),
        canEdit: false,
        canDelete: false,
        canCalculate: false,
        canCheckNormatives: false,
        canGeneratePreview: false,
        canGenerateDocuments: false,
        canReadyForApproval: false,
        canReturnForRevision: false,
        canApprove: false,
        canSign: false,
        canReplace: false,
        canCancel: false,
        canArchive: false,
        canPublish: false,
        canDownload: backendFlag('canDownload'),
        canManageResults: false,
        canManageDevices: false,
        canViewAudit: backendFlag('canViewAudit'),
      };
    }
    return {
      canView: backendFlag('canView'),
      canEdit: backendFlag('canEdit'),
      canDelete: backendFlag('canDelete'),
      canCalculate: backendFlag('canCalculate'),
      canCheckNormatives: backendFlag('canCheckNormatives'),
      canGeneratePreview: backendFlag('canGeneratePreview'),
      canGenerateDocuments: backendFlag('canGenerateDocuments'),
      canReadyForApproval: backendFlag('canReadyForApproval'),
      canReturnForRevision: backendFlag('canReturnForRevision'),
      canApprove: backendFlag('canApprove'),
      canSign: backendFlag('canSign'),
      canReplace: backendFlag('canReplace'),
      canCancel: backendFlag('canCancel'),
      canArchive: backendFlag('canArchive'),
      canPublish: backendFlag('canPublish'),
      canDownload: backendFlag('canDownload'),
      canManageResults: backendFlag('canManageResults'),
      canManageDevices: backendFlag('canManageDevices'),
      canViewAudit: backendFlag('canViewAudit'),
    };
  }

  // A protocol DTO without server permissions is intentionally fail-closed.
  // Role/status helpers remain exported for non-entity navigation only.
  void role;
  void allowAll;
  return {
    canView: false,
    canEdit: false,
    canDelete: false,
    canCalculate: false,
    canCheckNormatives: false,
    canGeneratePreview: false,
    canGenerateDocuments: false,
    canReadyForApproval: false,
    canReturnForRevision: false,
    canApprove: false,
    canSign: false,
    canReplace: false,
    canCancel: false,
    canArchive: false,
    canPublish: false,
    canDownload: false,
    canManageResults: false,
    canManageDevices: false,
    canViewAudit: false,
  };
};

export const editableProtocolStatus = (status?: string | null): boolean =>
  isProtocolStatusEditable(status);
