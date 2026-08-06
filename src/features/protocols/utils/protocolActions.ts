import type { Protocol, ProtocolAvailableAction } from '../../../types/protocols';

export const protocolHasAction = (protocol: Protocol, action: ProtocolAvailableAction): boolean => {
  if (protocol.status === 'UNKNOWN') return false;
  return Array.isArray(protocol.availableActions) && protocol.availableActions.includes(action);
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
