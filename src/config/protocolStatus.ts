import type { ProtocolStatus } from '../types/protocols';

export type ProtocolStatusColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const protocolStatusConfig: Record<ProtocolStatus, { label: string; editable: boolean; color: ProtocolStatusColor }> = {
  DRAFT: { label: 'Черновик', editable: true, color: 'neutral' },
  READY_TO_SIGN: { label: 'Готов к подписи', editable: false, color: 'info' },
  CALCULATED: { label: 'Расчёт выполнен', editable: true, color: 'info' },
  READY: { label: 'Готов к подписи', editable: true, color: 'info' },
  READY_FOR_APPROVAL: { label: 'Готов к подписи', editable: false, color: 'info' },
  UNDER_REVIEW: { label: 'На проверке', editable: false, color: 'warning' },
  RETURNED_FOR_CORRECTION: { label: 'Нужно исправить', editable: true, color: 'warning' },
  NEEDS_REVISION: { label: 'Нужно исправить', editable: true, color: 'warning' },
  APPROVED: { label: 'Готов к подписи', editable: false, color: 'info' },
  SIGNED: { label: 'Подписан', editable: false, color: 'success' },
  REPLACED: { label: 'Заменён новой версией', editable: false, color: 'neutral' },
  CANCELLED: { label: 'Отменён', editable: false, color: 'danger' },
  ARCHIVED: { label: 'Архив', editable: false, color: 'neutral' },
  UNKNOWN: { label: 'Неизвестный статус', editable: false, color: 'danger' },
};

export const normalizeProtocolStatus = (status?: string | null): ProtocolStatus => {
  const value = String(status || '').trim().toUpperCase();
  if (value in protocolStatusConfig) return value as ProtocolStatus;
  console.error('[Protocols] Unsupported backend status', { status });
  return 'UNKNOWN';
};

export const isProtocolStatusEditable = (status?: string | null) => protocolStatusConfig[normalizeProtocolStatus(status)].editable;
