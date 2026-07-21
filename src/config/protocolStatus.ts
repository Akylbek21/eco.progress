import type { LegacyProtocolStatus, ProtocolStatus } from '../types/protocols';

export type ProtocolStatusColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const protocolStatusConfig: Record<ProtocolStatus, { label: string; editable: boolean; color: ProtocolStatusColor }> = {
  DRAFT: { label: 'Черновик', editable: true, color: 'neutral' },
  CALCULATED: { label: 'Рассчитан', editable: true, color: 'info' },
  READY_FOR_APPROVAL: { label: 'На утверждении', editable: false, color: 'warning' },
  NEEDS_REVISION: { label: 'На доработке', editable: true, color: 'warning' },
  APPROVED: { label: 'Утверждён', editable: false, color: 'info' },
  SIGNED: { label: 'Подписан', editable: false, color: 'success' },
  REPLACED: { label: 'Заменён', editable: false, color: 'neutral' },
  CANCELLED: { label: 'Аннулирован', editable: false, color: 'danger' },
  ARCHIVED: { label: 'Архивный', editable: false, color: 'neutral' },
};

const legacyStatusMap: Record<LegacyProtocolStatus, ProtocolStatus> = {
  READY: 'READY_FOR_APPROVAL',
  READY_FOR_APPROVE: 'READY_FOR_APPROVAL',
  RETURNED: 'NEEDS_REVISION',
  CORRECTION: 'NEEDS_REVISION',
};

export const normalizeProtocolStatus = (status?: string | null): ProtocolStatus => {
  const value = String(status || 'DRAFT').trim().toUpperCase();
  if (value in legacyStatusMap) return legacyStatusMap[value as LegacyProtocolStatus];
  return value in protocolStatusConfig ? value as ProtocolStatus : 'DRAFT';
};

export const isProtocolStatusEditable = (status?: string | null) => protocolStatusConfig[normalizeProtocolStatus(status)].editable;
