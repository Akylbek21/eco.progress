import type { Protocol, ProtocolStatus } from '../types/protocols';

const editableStatuses = new Set(['DRAFT', 'CALCULATED', 'READY', 'NEEDS_REVISION', 'RETURNED', 'CORRECTION']);

export type ProtocolPermissions = {
  canSave: boolean;
  canCalculate: boolean;
  canSendToApproval: boolean;
  canApprove: boolean;
  canReturn: boolean;
  canSign: boolean;
  canDownload: boolean;
  canCreateCorrection: boolean;
  canDelete: boolean;
  canCancel: boolean;
  canGenerate: boolean;
  canCopy: boolean;
};

const none: ProtocolPermissions = {
  canSave: false,
  canCalculate: false,
  canSendToApproval: false,
  canApprove: false,
  canReturn: false,
  canSign: false,
  canDownload: false,
  canCreateCorrection: false,
  canDelete: false,
  canCancel: false,
  canGenerate: false,
  canCopy: false,
};

export const normalizeProtocolStatus = (status?: ProtocolStatus | string | null) => String(status || '').trim().toUpperCase();

export const getProtocolPermissions = (
  protocolOrStatus: Pick<Protocol, 'status'> | ProtocolStatus | string | null | undefined,
  role?: string,
  allowAll = false,
): ProtocolPermissions => {
  const status = normalizeProtocolStatus(typeof protocolOrStatus === 'object' && protocolOrStatus ? protocolOrStatus.status : protocolOrStatus);
  const normalizedRole = String(role || '').trim().toUpperCase();
  const isAdmin = allowAll || normalizedRole === 'ADMIN';
  const isHead = allowAll || ['ADMIN', 'DIRECTOR', 'HEAD'].includes(normalizedRole);
  const isLaboratory = allowAll || isHead || normalizedRole === 'LABORATORY';

  if (editableStatuses.has(status)) return {
    ...none,
    canSave: isLaboratory,
    canCalculate: isLaboratory,
    canSendToApproval: isLaboratory,
    canDelete: isAdmin && status === 'DRAFT',
    canCancel: isHead,
    canGenerate: isLaboratory,
    canCopy: isLaboratory,
  };
  if (status === 'READY_FOR_APPROVAL') return {
    ...none,
    canApprove: isHead,
    canReturn: isHead,
    canDownload: true,
    canCancel: isHead,
    canGenerate: isHead,
    canCopy: isLaboratory,
  };
  if (status === 'APPROVED') return {
    ...none,
    canSign: isHead,
    canDownload: true,
    canCreateCorrection: isHead,
    canCopy: isLaboratory,
  };
  if (status === 'SIGNED') return { ...none, canDownload: true, canCreateCorrection: isHead, canCopy: isLaboratory };
  if (status === 'ARCHIVED' || status === 'REPLACED') return { ...none, canDownload: true, canCopy: isLaboratory };
  return none;
};
