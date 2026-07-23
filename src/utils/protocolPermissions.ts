import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolStatus } from '../types/protocols';

type ProtocolUser = { role?: string | null } | null | undefined;
type ProtocolLike = Pick<Protocol, 'status'> & Partial<Pick<Protocol, 'permissions'>> | ProtocolStatus | string | null | undefined;

const creatorRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY']);
const headRoles = new Set(['ADMIN', 'DIRECTOR', 'HEAD']);
const roleOf = (user: ProtocolUser | string) => String(typeof user === 'string' ? user : user?.role || '').trim().toUpperCase();
const statusOf = (protocol: ProtocolLike) => normalizeProtocolStatus(typeof protocol === 'object' && protocol ? protocol.status : protocol);
const hasRole = (user: ProtocolUser | string, roles: Set<string>) => roles.has(roleOf(user));

export { normalizeProtocolStatus };
export const canViewProtocol = (user: ProtocolUser, _protocol?: ProtocolLike) => hasRole(user, creatorRoles);
export const canCreateProtocol = (user: ProtocolUser) => hasRole(user, creatorRoles);
export const canEditProtocol = (user: ProtocolUser, protocol: ProtocolLike) => hasRole(user, creatorRoles) && isProtocolStatusEditable(statusOf(protocol));
export const canEditResults = canEditProtocol;
export const canSendForApproval = (user: ProtocolUser, protocol: ProtocolLike) =>
  hasRole(user, creatorRoles) && ['DRAFT', 'CALCULATED', 'READY', 'NEEDS_REVISION'].includes(statusOf(protocol));
export const canReturnForRevision = (user: ProtocolUser, protocol: ProtocolLike) => hasRole(user, headRoles) && statusOf(protocol) === 'READY_FOR_APPROVAL';
export const canApproveProtocol = (user: ProtocolUser, protocol: ProtocolLike) => hasRole(user, headRoles) && statusOf(protocol) === 'READY_FOR_APPROVAL';
export const canSignProtocol = (user: ProtocolUser, protocol: ProtocolLike) => hasRole(user, headRoles) && statusOf(protocol) === 'APPROVED';
export const canCreateCorrection = (user: ProtocolUser, protocol: ProtocolLike) => hasRole(user, headRoles) && statusOf(protocol) === 'SIGNED';
export const canCancelProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  hasRole(user, headRoles) && ['DRAFT', 'CALCULATED', 'NEEDS_REVISION'].includes(statusOf(protocol));
export const canArchiveProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  hasRole(user, headRoles) && ['REPLACED', 'CANCELLED'].includes(statusOf(protocol));
export const canDownloadProtocol = (user: ProtocolUser, protocol: ProtocolLike) => canViewProtocol(user, protocol);

export type ProtocolPermissions = {
  canSave: boolean;
  canCalculate: boolean;
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
  canCopy: boolean;
  canPublish: boolean;
};

export const getProtocolPermissions = (protocol: ProtocolLike, role?: string, allowAll = false): ProtocolPermissions => {
  const backend = typeof protocol === 'object' && protocol ? protocol.permissions : undefined;
  const backendFlag = (...keys: string[]) => keys.some((key) => backend?.[key] === true);
  if (backend && Object.keys(backend).length) {
    return {
      canSave: backendFlag('canEdit', 'canSave'),
      canCalculate: backendFlag('canCalculate'),
      canSendToApproval: backendFlag('canSendToApproval', 'canSubmitForApproval'),
      canApprove: backendFlag('canApprove'),
      canReturn: backendFlag('canReturn', 'canReturnForRevision'),
      canSign: backendFlag('canSign'),
      canDownload: backendFlag('canDownload'),
      canCreateCorrection: backendFlag('canCreateCorrection'),
      canDelete: backendFlag('canDelete'),
      canArchive: backendFlag('canArchive'),
      canCancel: backendFlag('canCancel'),
      canGenerate: backendFlag('canGenerate', 'canGenerateDocuments'),
      canCopy: backendFlag('canCopy', 'canCreateCorrection'),
      canPublish: backendFlag('canPublish', 'canPublishToClient'),
    };
  }
  void role;
  void allowAll;
  return {
    canSave: false,
    canCalculate: false,
    canSendToApproval: false,
    canApprove: false,
    canReturn: false,
    canSign: false,
    canDownload: false,
    canCreateCorrection: false,
    canDelete: false,
    canArchive: false,
    canCancel: false,
    canGenerate: false,
    canCopy: false,
    canPublish: false,
  };
};
