import type { Protocol, ProtocolPermissions } from '../../../types/protocols';

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
