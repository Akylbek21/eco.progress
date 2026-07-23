import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolStatus } from '../types/protocols';

type ProtocolUser = { role?: string | null } | null | undefined;
type ProtocolLike = Pick<Protocol, 'status'> | ProtocolStatus | string | null | undefined;

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
  hasRole(user, creatorRoles) && ['DRAFT', 'CALCULATED', 'NEEDS_REVISION'].includes(statusOf(protocol));
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
};

export const getProtocolPermissions = (protocol: ProtocolLike, role?: string, allowAll = false): ProtocolPermissions => {
  const user = { role: allowAll ? 'ADMIN' : role };
  const editable = canEditProtocol(user, protocol);
  return {
    canSave: editable,
    canCalculate: editable,
    canSendToApproval: canSendForApproval(user, protocol),
    canApprove: canApproveProtocol(user, protocol),
    canReturn: canReturnForRevision(user, protocol),
    canSign: canSignProtocol(user, protocol),
    canDownload: canDownloadProtocol(user, protocol),
    canCreateCorrection: canCreateCorrection(user, protocol),
    canDelete: false,
    canArchive: canArchiveProtocol(user, protocol),
    canCancel: canCancelProtocol(user, protocol),
    canGenerate: editable || canApproveProtocol(user, protocol),
    canCopy: canCreateProtocol(user),
  };
};
