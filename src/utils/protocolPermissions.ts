import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolPermissions as BackendProtocolPermissions } from '../types/protocols';
import { hasProtocolPermission } from '../features/protocols/utils/protocolActions';

export { hasProtocolPermission, normalizeProtocolStatus };

type ProtocolUser = { id?: string | number | null; role?: string | null } | null | undefined;
type ProtocolLike = Pick<Protocol, 'permissions' | 'status'> | null | undefined;

export const PROTOCOL_DOCUMENT_ROLES = ['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'] as const;
export const PROTOCOL_CREATE_ROLES = PROTOCOL_DOCUMENT_ROLES;
type ProtocolDocumentRole = typeof PROTOCOL_DOCUMENT_ROLES[number];
const isProtocolDocumentRole = (role?: string | null): role is ProtocolDocumentRole =>
  Boolean(role && PROTOCOL_DOCUMENT_ROLES.includes(role as ProtocolDocumentRole));

export const isInternalProtocolUser = (_user: ProtocolUser | string): boolean => false;
export const canViewProtocol = (_user: ProtocolUser, protocol?: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canView');
export const canCreateProtocol = (user: ProtocolUser) => isProtocolDocumentRole(user?.role);
export const canEditProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canEdit');
export const canEditResults = canEditProtocol;
export const canSendForApproval = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canSendToApproval');
export const canReturnForRevision = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canReturnForRevision');
export const canApproveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canApprove');
export const canSignProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canSign');
export const canCreateCorrection = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canCreateCorrection');
export const canCancelProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canCancel');
export const canArchiveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canArchive');
export const canDownloadProtocolDocument = (protocol: ProtocolLike, role?: string | null): boolean =>
  hasProtocolPermission(protocol || undefined, 'canView') && isProtocolDocumentRole(role);
export const canDownloadProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  canDownloadProtocolDocument(protocol, user?.role);

export type ProtocolPermissions = Required<BackendProtocolPermissions> & {
  canReadyForApproval: boolean;
  canReplace: boolean;
  canDownload: boolean;
  canManageResults: boolean;
  canManageDevices: boolean;
  canViewAudit: boolean;
};

export const getProtocolPermissions = (protocol: ProtocolLike, role?: string, _allowAll = false): ProtocolPermissions => {
  const backend = protocol?.permissions;
  const unknownStatus = Boolean(protocol?.status) && normalizeProtocolStatus(protocol?.status) === 'UNKNOWN';
  const flag = (key: keyof BackendProtocolPermissions) => {
    if (unknownStatus && key !== 'canView') return false;
    return backend?.[key] === true;
  };
  return {
    canView: flag('canView'), canEdit: flag('canEdit'), canDelete: flag('canDelete'),
    canCalculate: flag('canCalculate'), canCheckNormatives: flag('canCheckNormatives'),
    canGeneratePreview: flag('canGeneratePreview'), canSendToApproval: flag('canSendToApproval'),
    canReturnForRevision: flag('canReturnForRevision'), canApprove: flag('canApprove'),
    canSign: flag('canSign'), canCreateCorrection: flag('canCreateCorrection'),
    canCancel: flag('canCancel'), canArchive: flag('canArchive'), canPublish: flag('canPublish'),
    canGenerateDocuments: flag('canGenerateDocuments'), canRegenerateDocuments: flag('canRegenerateDocuments'),
    canReadyForApproval: flag('canSendToApproval'), canReplace: flag('canCreateCorrection'),
    canDownload: canDownloadProtocolDocument(protocol, role), canManageResults: flag('canEdit'), canManageDevices: flag('canEdit'),
    canViewAudit: flag('canView'),
  };
};

export const editableProtocolStatus = (status?: string | null): boolean => isProtocolStatusEditable(status);
