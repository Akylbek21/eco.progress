import type { ProtocolStatus } from '../types/protocols';

export type ProtocolStatusColor = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const protocolStatusConfig: Record<ProtocolStatus, { label: string; color: ProtocolStatusColor }> = {
  DRAFT: { label: 'Черновик', color: 'neutral' },
  CALCULATED: { label: 'Расчёт выполнен', color: 'info' },
  READY_FOR_APPROVAL: { label: 'На утверждении', color: 'warning' },
  NEEDS_REVISION: { label: 'Нужно исправить', color: 'warning' },
  APPROVED: { label: 'Утверждён, ожидает подписи', color: 'info' },
  SIGNED: { label: 'Подписан', color: 'success' },
  REPLACED: { label: 'Заменён новой версией', color: 'neutral' },
  CANCELLED: { label: 'Отменён', color: 'danger' },
  ARCHIVED: { label: 'Архив', color: 'neutral' },
  UNKNOWN: { label: 'Неизвестный статус', color: 'danger' },
};

export const normalizeProtocolStatus = (status?: string | null): ProtocolStatus => {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'READY') return 'READY_FOR_APPROVAL';
  if (value in protocolStatusConfig) return value as ProtocolStatus;
  console.error('[Protocols] Unsupported backend status', { status });
  return 'UNKNOWN';
};
