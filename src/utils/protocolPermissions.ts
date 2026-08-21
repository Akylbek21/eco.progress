import { normalizeProtocolStatus } from '../config/protocolStatus';
import type { Protocol } from '../types/protocols';
import { hasProtocolAction } from '../features/protocols/utils/protocolActions';

export { normalizeProtocolStatus };

type ProtocolUser = { id?: string | number | null; role?: string | null; permissions?: string[] | null } | null | undefined;
type ProtocolLike = Pick<Protocol, 'status' | 'availableActions'> | null | undefined;

export const isInternalProtocolUser = (_user: ProtocolUser | string): boolean => false;
export const canViewProtocol = (_user: ProtocolUser, protocol?: ProtocolLike) => hasProtocolAction(protocol || undefined, 'view');
export const canCreateProtocol = (user: ProtocolUser) => user?.permissions?.includes('create_protocols') === true;
export const canEditProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'edit');
export const canEditResults = canEditProtocol;
export const canSendForApproval = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'sendToApproval');
export const canReturnForRevision = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'returnForRevision');
export const canReturnToDraft = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'returnToDraft');
export const canApproveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'approve');
export const canSignProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'sign');
export const canCreateCorrection = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'createCorrection');
export const canCancelProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'cancel');
export const canArchiveProtocol = (_user: ProtocolUser, protocol: ProtocolLike) => hasProtocolAction(protocol || undefined, 'archive');
export const canDownloadProtocolDocument = (protocol: ProtocolLike, _role?: string | null): boolean =>
  hasProtocolAction(protocol || undefined, 'downloadPdf') || hasProtocolAction(protocol || undefined, 'downloadDocx');
export const canDownloadProtocol = (user: ProtocolUser, protocol: ProtocolLike) =>
  canDownloadProtocolDocument(protocol, user?.role);
