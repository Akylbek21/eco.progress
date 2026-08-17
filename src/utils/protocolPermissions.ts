import { normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolPermissions as BackendProtocolPermissions } from '../types/protocols';
import { hasProtocolAction, hasProtocolPermission } from '../features/protocols/utils/protocolActions';

export { hasProtocolPermission, normalizeProtocolStatus };

type ProtocolUser = { id?: string | number | null; role?: string | null } | null | undefined;
type ProtocolLike = Pick<Protocol, 'permissions' | 'status' | 'availableActions'> | null | undefined;

export const PROTOCOL_DOCUMENT_ROLES = ['ADMIN', 'DIRECTOR', 'HEAD', 'LABORATORY'] as const;
export const PROTOCOL_CREATE_ROLES = PROTOCOL_DOCUMENT_ROLES;
type ProtocolDocumentRole = typeof PROTOCOL_DOCUMENT_ROLES[number];
const isProtocolDocumentRole = (role?: string | null): role is ProtocolDocumentRole =>
  Boolean(role && PROTOCOL_DOCUMENT_ROLES.includes(role as ProtocolDocumentRole));

export const isInternalProtocolUser = (_user: ProtocolUser | string): boolean => false;
export const canViewProtocol = (_user: ProtocolUser, protocol?: ProtocolLike) => hasProtocolPermission(protocol || undefined, 'canView');
export const canCreateProtocol = (user: ProtocolUser) => isProtocolDocumentRole(user?.role);
export const canEditProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'edit');
export const canEditResults = canEditProtocol;
export const canSendForApproval = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'sendToApproval');
export const canReturnForRevision = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'returnForRevision');
export const canApproveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'approve');
export const canSignProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'sign');
export const canCreateCorrection = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'createCorrection');
export const canCancelProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'cancel');
export const canArchiveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'archive');
export const canDownloadProtocolDocument = (protocol: ProtocolLike, _role?: string | null): boolean =>
  hasProtocolAction(protocol || undefined, 'downloadPdf') || hasProtocolAction(protocol || undefined, 'downloadDocx');
export const canDownloadProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  canDownloadProtocolDocument(protocol, user?.role);

export type ProtocolPermissions = Required<BackendProtocolPermissions> & {
  canReadyForApproval: boolean;
  canReplace: boolean;
  canDownload: boolean;
  canDownloadPdf: boolean;
  canDownloadDocx: boolean;
  canManageResults: boolean;
  canManageDevices: boolean;
  canViewAudit: boolean;
};

export const getProtocolPermissions = (protocol: ProtocolLike, role?: string, _allowAll = false): ProtocolPermissions => {
  const backend = protocol?.permissions;
  const action = (key: string) => hasProtocolAction(protocol || undefined, key);
  return {
    canView: backend?.canView === true,
    canEdit: action('edit'), canDelete: action('delete'),
    canCalculate: action('calculate'), canCheckNormatives: action('checkNormatives'),
    canGeneratePreview: action('generatePreview'), canSendToApproval: action('sendToApproval'),
    canReturnForRevision: action('returnForRevision'), canApprove: action('approve'),
    canSign: action('sign'), canCreateCorrection: action('createCorrection'),
    canCancel: action('cancel'), canArchive: action('archive'), canPublish: action('publish'),
    canGenerateDocuments: action('generateDocuments'), canRegenerateDocuments: action('regenerateDocuments'),
    canReadyForApproval: action('sendToApproval'), canReplace: action('createCorrection'),
    canDownload: canDownloadProtocolDocument(protocol, role),
    canDownloadPdf: action('downloadPdf'), canDownloadDocx: action('downloadDocx'),
    canManageResults: action('edit'), canManageDevices: action('edit'),
    canViewAudit: backend?.canView === true,
  };
};

export const editableProtocolStatus = (_status?: string | null): boolean => false;
