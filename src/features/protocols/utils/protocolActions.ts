import { protocolActionKeys, type Protocol, type ProtocolAction, type ProtocolAvailableActions, type ProtocolWorkflowBlocker } from '../../../types/protocols';

const blockerMessages: Record<string, string> = {
  NORMATIVE_NOT_SELECTED: 'Не выбран норматив.',
  NORMATIVE_NOT_FOUND: 'Норматив не найден.',
  NORMATIVE_INACTIVE: 'Выбранный норматив неактивен.',
  UNIT_MISMATCH: 'Единица результата не совпадает с единицей норматива.',
  EMPTY_RESULT: 'Не заполнено значение результата.',
};

const normalizeBlockerAction = (value: unknown) => {
  const action = String(value || '').trim();
  const normalized = action.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
  if (normalized === 'READY_FOR_APPROVAL' || normalized === 'SEND_TO_APPROVAL') return 'sendToApproval';
  if (normalized === 'APPROVE' || normalized === 'APPROVED') return 'approve';
  if (normalized === 'SIGN' || normalized === 'SIGNED') return 'sign';
  return action;
};

export const normalizeProtocolWorkflowBlockers = (input: unknown): ProtocolWorkflowBlocker[] => {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (typeof item === 'string') {
      const code = item.trim().toUpperCase();
      return code ? [{ code, message: blockerMessages[code] || item.trim() }] : [];
    }
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const code = String(source.code || source.type || '').trim().toUpperCase();
    const message = String(source.message || source.description || blockerMessages[code] || code).trim();
    const actions = Array.isArray(source.actions) ? source.actions.map(normalizeBlockerAction) : undefined;
    return code || message ? [{ code, message, actions }] : [];
  });
};

const approvalBlockerCodes = new Set([
  'NORMATIVE_NOT_SELECTED', 'NORMATIVE_NOT_FOUND', 'NORMATIVE_INACTIVE', 'UNIT_MISMATCH', 'EMPTY_RESULT',
]);

export const protocolTransitionBlockers = (
  protocol: Pick<Protocol, 'blockingReasons'> | undefined,
  action: 'sendToApproval' | 'approve' | 'sign',
): ProtocolWorkflowBlocker[] => (protocol?.blockingReasons || []).filter((blocker) =>
  approvalBlockerCodes.has(blocker.code)
  && (!blocker.actions?.length || blocker.actions.includes(action)),
);

export const normalizeProtocolAvailableActions = (input: unknown): ProtocolAvailableActions => {
  const source = input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
  return Object.fromEntries(protocolActionKeys.map((action) => [action, source[action] === true])) as ProtocolAvailableActions;
};

export const hasProtocolAction = (
  protocol: Pick<Protocol, 'availableActions'> | undefined,
  action: ProtocolAction,
): boolean => protocol?.availableActions?.[action] === true;
