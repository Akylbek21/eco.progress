import type { Protocol, ProtocolAvailableAction } from '../../../types/protocols';

const legacyPermissionByAction: Partial<Record<ProtocolAvailableAction, string>> = {
  EDIT: 'canEdit',
  SAVE: 'canEdit',
  CALCULATE: 'canCalculate',
  CHECK_NORMATIVES: 'canCheckNormatives',
  PREPARE_SIGNING: 'canPrepareSigning',
  SIGN: 'canSign',
  DOWNLOAD_PDF: 'canDownload',
  DOWNLOAD_DOCX: 'canDownload',
  CREATE_CORRECTED_VERSION: 'canReplace',
  ARCHIVE: 'canArchive',
};

export const protocolHasAction = (protocol: Protocol, action: ProtocolAvailableAction): boolean => {
  const actions = protocol.availableActions || [];
  if (actions.length > 0) return actions.includes(action);
  const permission = legacyPermissionByAction[action];
  return permission ? protocol.permissions?.[permission] === true : false;
};

export const protocolActionReason = (protocol: Protocol, action: ProtocolAvailableAction): string | null => {
  if (protocolHasAction(protocol, action)) return null;
  const reason = protocol.blockingReasons?.find(Boolean);
  if (reason) return reason;
  if (action === 'SIGN' || action === 'PREPARE_SIGNING') return 'Нельзя подписать: заполните обязательные данные и выберите действующий прибор';
  return 'Действие пока недоступно';
};

export const isLegacyApprovalAction = (action: string) =>
  ['SUBMIT_FOR_REVIEW', 'APPROVE', 'RETURN_FOR_CORRECTION'].includes(action);
