import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolStatus } from '../types/protocols';

type ProtocolUser = { id?: string | number | null; role?: string | null } | null | undefined;
type ProtocolLike =
  | (Pick<Protocol, 'status'> & Partial<Pick<Protocol, 'permissions' | 'signatureCount' | 'maxSignatures' | 'signedByCurrentUser' | 'signatures'>>)
  | ProtocolStatus
  | string
  | null
  | undefined;

const EDITABLE_STATUSES = new Set<ProtocolStatus>([
  'DRAFT',
  'CALCULATED',
  'RETURNED_FOR_REVISION',
]);
const TERMINAL_STATUSES = new Set<ProtocolStatus>(['ARCHIVED', 'CANCELLED']);
const CORRECTION_STATUSES = new Set<ProtocolStatus>(['SIGNED', 'PUBLISHED']);

const roleOf = (user: ProtocolUser | string) =>
  String(typeof user === 'string' ? user : user?.role || '').trim().toUpperCase();
const statusOf = (protocol: ProtocolLike) =>
  normalizeProtocolStatus(typeof protocol === 'object' && protocol ? protocol.status : protocol);
const signatureCountOf = (protocol: ProtocolLike) => typeof protocol === 'object' && protocol
  ? Number(protocol.signatureCount ?? protocol.signatures?.length ?? 0)
  : 0;
const maxSignaturesOf = (protocol: ProtocolLike) => typeof protocol === 'object' && protocol
  ? Number(protocol.maxSignatures || 5)
  : 5;
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
  canCreate: boolean;
  canEdit: boolean;
  canSave: boolean;
  canCalculate: boolean;
  canCheckNormatives: boolean;
  canSendToApproval: boolean;
  canApprove: boolean;
  canReturn: boolean;
  canSign: boolean;
  canDownload: boolean;
  canCreateCorrection: boolean;
  canDelete: boolean;
  canArchive: boolean;
  canCancel: boolean;
  canGenerate: boolean;
  canGeneratePreview: boolean;
  canCopy: boolean;
  canPublish: boolean;
};

export const getProtocolPermissions = (
  protocol: ProtocolLike,
  role?: string,
  allowAll = false,
): ProtocolPermissions => {
  const backend = typeof protocol === 'object' && protocol ? protocol.permissions : undefined;
  const backendFlag = (...keys: string[]) => keys.some((key) => backend?.[key] === true);
  const internal = allowAll || isInternalProtocolUser(role || '');
  if (backend && Object.keys(backend).length) {
    const contentLocked = signatureCountOf(protocol) > 0;
    const canEdit = backendFlag('canEdit', 'canSave') && !contentLocked;
    const canGenerate = backendFlag('canGenerate', 'canGenerateDocuments', 'canGeneratePreview') && !contentLocked;
    return {
      canView: backendFlag('canView'),
      canCreate: backendFlag('canCreate'),
      canEdit,
      canSave: canEdit,
      canCalculate: backendFlag('canCalculate') && !contentLocked,
      canCheckNormatives: backendFlag('canCheckNormatives', 'canCalculate') && !contentLocked,
      canSendToApproval: backendFlag('canSendToApproval', 'canSubmitForApproval'),
      canApprove: backendFlag('canApprove'),
      canReturn: backendFlag('canReturn', 'canReturnForRevision'),
      canSign: internal && backendFlag('canSign') && canSignCurrentVersion(protocol),
      canDownload: backendFlag('canDownload'),
      canCreateCorrection: backendFlag('canCreateCorrection'),
      canDelete: backendFlag('canDelete'),
      canArchive: backendFlag('canArchive'),
      canCancel: backendFlag('canCancel'),
      canGenerate,
      canGeneratePreview: backendFlag('canGeneratePreview') || canGenerate,
      canCopy: backendFlag('canCopy', 'canCreateCorrection'),
      canPublish: backendFlag('canPublish', 'canPublishToClient'),
    };
  }

  const status = statusOf(protocol);
  const editable = internal && EDITABLE_STATUSES.has(status);
  const contentLocked = signatureCountOf(protocol) > 0;
  const effectiveEditable = editable && !contentLocked;
  const generate = internal && !TERMINAL_STATUSES.has(status) && !contentLocked;
  const correction = internal && CORRECTION_STATUSES.has(status);
  return {
    canView: internal,
    canCreate: internal,
    canEdit: effectiveEditable,
    canSave: effectiveEditable,
    canCalculate: effectiveEditable,
    canCheckNormatives: effectiveEditable,
    canSendToApproval: effectiveEditable,
    canApprove: false,
    canReturn: internal && status === 'READY_FOR_APPROVAL',
    canSign: internal && canSignCurrentVersion(protocol),
    canDownload: internal,
    canCreateCorrection: correction,
    canDelete: internal && status === 'DRAFT' && !contentLocked,
    canArchive: internal && ['REPLACED', 'CANCELLED'].includes(status),
    canCancel: effectiveEditable,
    canGenerate: generate,
    canGeneratePreview: generate,
    canCopy: correction,
    canPublish: false,
  };
};

export const editableProtocolStatus = (status?: string | null): boolean =>
  isProtocolStatusEditable(status);
