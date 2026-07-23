import type { LegacyProtocolStatus, ProtocolStatus } from '../types/protocols';

export type ProtocolStatusColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const protocolStatusConfig: Record<ProtocolStatus, { label: string; editable: boolean; color: ProtocolStatusColor }> = {
  DRAFT: { label: 'Черновик', editable: true, color: 'neutral' },
  CALCULATED: { label: 'Расчёт выполнен', editable: true, color: 'info' },
  READY: { label: 'Подготовлен', editable: false, color: 'info' },
  READY_FOR_APPROVAL: { label: 'На проверке', editable: false, color: 'warning' },
  NEEDS_REVISION: { label: 'Нужно исправить', editable: true, color: 'warning' },
  APPROVED: { label: 'Утверждён', editable: false, color: 'success' },
  SIGNED: { label: 'Подписан', editable: false, color: 'success' },
  REPLACED: { label: 'Заменён новой версией', editable: false, color: 'neutral' },
  CANCELLED: { label: 'Отменён', editable: false, color: 'danger' },
  ARCHIVED: { label: 'В архиве', editable: false, color: 'neutral' },
};

const legacyStatusMap: Record<LegacyProtocolStatus, ProtocolStatus> = {
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
