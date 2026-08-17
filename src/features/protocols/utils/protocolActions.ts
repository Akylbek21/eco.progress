import type { Protocol, ProtocolAvailableActions, ProtocolPermissions } from '../../../types/protocols';

export const normalizeProtocolAvailableActions = (input: unknown): ProtocolAvailableActions => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  return Object.fromEntries(
    Object.entries(input as Record<string, unknown>)
      .filter(([, enabled]) => typeof enabled === 'boolean')
      .map(([action, enabled]) => [action, enabled === true]),
  );
};

export const hasProtocolAction = (
  protocol: Pick<Protocol, 'availableActions'> | undefined,
  action: string,
): boolean => protocol?.availableActions?.[action] === true;

export const hasProtocolPermission = (
  protocol: Pick<Protocol, 'permissions'> | undefined,
  permission: keyof ProtocolPermissions,
): boolean => protocol?.permissions?.[permission] === true;

export const protocolPermissionReason = (
  protocol: Pick<Protocol, 'permissions'> | undefined,
  permission: keyof ProtocolPermissions,
): string | null => hasProtocolPermission(protocol, permission)
  ? null
  : 'Действие недоступно для текущего состояния протокола или вашей роли.';
