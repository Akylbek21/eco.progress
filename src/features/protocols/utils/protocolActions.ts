import type { Protocol, ProtocolPermissions } from '../../../types/protocols';

const actionAliases = {
  COMPLETE: ['COMPLETE', 'READY_FOR_APPROVAL', 'SEND_TO_APPROVAL'],
  APPROVE: ['APPROVE'],
  SIGN: ['SIGN'],
  DOWNLOAD: ['DOWNLOAD', 'DOWNLOAD_PDF', 'DOWNLOAD_DOCX'],
  DOWNLOAD_PDF: ['DOWNLOAD', 'DOWNLOAD_PDF'],
  DOWNLOAD_DOCX: ['DOWNLOAD', 'DOWNLOAD_DOCX'],
} as const;

export const hasProtocolAction = (
  protocol: Pick<Protocol, 'availableActions'> | undefined,
  action: keyof typeof actionAliases,
): boolean => {
  const available = new Set((protocol?.availableActions || []).map((item) => String(item).trim().toUpperCase()));
  return actionAliases[action].some((candidate) => available.has(candidate));
};

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
