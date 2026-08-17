import type { ProtocolStatus } from '../types/protocols';

export type ProtocolStatusColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const protocolStatusConfig: Record<ProtocolStatus, { label: string; editable: boolean; color: ProtocolStatusColor }> = {
  DRAFT: { label: 'Черновик', editable: true, color: 'neutral' },
  CALCULATED: { label: 'Расчёт выполнен', editable: true, color: 'info' },
  READY_FOR_APPROVAL: { label: 'На утверждении', editable: false, color: 'warning' },
  NEEDS_REVISION: { label: 'Нужно исправить', editable: true, color: 'warning' },
  APPROVED: { label: 'Утверждён', editable: false, color: 'info' },
  SIGNED: { label: 'Подписан', editable: false, color: 'success' },
  REPLACED: { label: 'Заменён новой версией', editable: false, color: 'neutral' },
  CANCELLED: { label: 'Отменён', editable: false, color: 'danger' },
  ARCHIVED: { label: 'Архив', editable: false, color: 'neutral' },
  UNKNOWN: { label: 'Неизвестный статус', editable: false, color: 'danger' },
};

export const normalizeProtocolStatus = (status?: string | null): ProtocolStatus => {
  const value = String(status || '').trim().toUpperCase();
  // Legacy READY is folded into the current DRAFT -> CALCULATED workflow.
  if (value === 'READY') return 'CALCULATED';
  if (value in protocolStatusConfig) return value as ProtocolStatus;
  console.error('[Protocols] Unsupported backend status', { status });
  return 'UNKNOWN';
};

export const isProtocolStatusEditable = (status?: string | null) => protocolStatusConfig[normalizeProtocolStatus(status)].editable;
