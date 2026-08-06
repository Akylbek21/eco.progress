import { isProtocolStatusEditable, normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol, ProtocolStatus } from '../types/protocols';

type ProtocolUser = { id?: string | number | null; role?: string | null } | null | undefined;
type ProtocolLike =
  | (Pick<Protocol, 'status'> & Partial<Pick<Protocol, 'permissions' | 'availableActions' | 'signatureCount' | 'maxSignatures' | 'signedByCurrentUser' | 'signatures' | 'publishedAt' | 'publishedToClientAt'>>)
  | ProtocolStatus
  | string
  | null
  | undefined;

const statusOf = (protocol: ProtocolLike) =>
  normalizeProtocolStatus(typeof protocol === 'object' && protocol ? protocol.status : protocol);
const actionOf = (protocol: ProtocolLike, action: string) => typeof protocol === 'object'
  && protocol !== null
  && statusOf(protocol) !== 'UNKNOWN'
  && Array.isArray(protocol.availableActions)
  && protocol.availableActions.includes(action);
export const isInternalProtocolUser = (_user: ProtocolUser | string): boolean => false;

export { normalizeProtocolStatus };
export const canViewProtocol = (_user: ProtocolUser, protocol?: ProtocolLike) => actionOf(protocol, 'VIEW');
export const canCreateProtocol = (_user: ProtocolUser) => false;
export const canEditProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'EDIT');
export const canEditResults = canEditProtocol;
export const canSendForApproval = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'SUBMIT_FOR_REVIEW');
export const canReturnForRevision = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'RETURN_FOR_CORRECTION');
export const canApproveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'APPROVE');
export const canSignProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'SIGN');
export const canCreateCorrection = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'CREATE_CORRECTED_VERSION');
export const canCancelProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'CANCEL');
export const canArchiveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'ARCHIVE');
export const canDownloadProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => actionOf(protocol, 'DOWNLOAD_PDF') || actionOf(protocol, 'DOWNLOAD_DOCX');

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
  const actions = typeof protocol === 'object' && protocol && Array.isArray(protocol.availableActions)
    ? new Set(protocol.availableActions)
    : null;
  if (actions) {
    const has = (action: string) => statusOf(protocol) !== 'UNKNOWN' && actions.has(action);
    return {
      canView: has('VIEW'), canEdit: has('EDIT') || has('SAVE'), canDelete: has('DELETE'),
      canCalculate: has('CALCULATE'), canCheckNormatives: has('CHECK_NORMATIVES'),
      canGeneratePreview: has('PREPARE_SIGNING') || has('PREVIEW'),
      canGenerateDocuments: has('GENERATE_PDF') || has('GENERATE_DOCX'),
      canReadyForApproval: has('SUBMIT_FOR_REVIEW'), canReturnForRevision: has('RETURN_FOR_CORRECTION'),
      canApprove: has('APPROVE'), canSign: has('SIGN'), canReplace: has('CREATE_CORRECTED_VERSION'),
      canCancel: has('CANCEL'), canArchive: has('ARCHIVE'), canPublish: has('PUBLISH_TO_CLIENT'),
      canDownload: has('DOWNLOAD_PDF') || has('DOWNLOAD_DOCX'),
      canManageResults: has('EDIT_RESULTS') || has('EDIT'), canManageDevices: has('EDIT_DEVICES') || has('EDIT'),
      canViewAudit: has('VIEW_AUDIT') || has('VIEW'),
    };
  }
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
