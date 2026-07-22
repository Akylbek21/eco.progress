import type { AccreditationStatus } from '../../../types/laboratories';

export function getAccreditationStatus(validUntil?: string | null): AccreditationStatus {
  if (!validUntil) return 'NOT_SPECIFIED';
  const end = new Date(`${validUntil.slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return 'NOT_SPECIFIED';
  const now = Date.now();
  if (now > end.getTime()) return 'EXPIRED';
  const days = Math.ceil((end.getTime() - now) / 86_400_000);
  return days <= 90 ? 'EXPIRING' : 'VALID';
}

export const accreditationStatusLabels: Record<AccreditationStatus, string> = {
  VALID: 'Действует', EXPIRING: 'Истекает', EXPIRED: 'Истёк', NOT_SPECIFIED: 'Не указан',
};

export const accreditationDaysLeft = (validUntil?: string | null) => {
  if (!validUntil) return null;
  const days = Math.ceil((new Date(`${validUntil.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  return Number.isFinite(days) ? days : null;
};
