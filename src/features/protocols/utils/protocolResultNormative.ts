import type { ProtocolResult } from '../../../types/protocols';

const text = (value: unknown) => value == null ? '' : String(value).trim();

/** Backend may return only normativeId without an expanded normativeReference. */
export const hasUsableProtocolResultNormative = (row: ProtocolResult, protocolDate: string): boolean => {
  const source = text(row.values.normativeSource).toUpperCase();
  if (source === 'MANUAL') return Boolean(text(row.values.manualNormativeReason));

  const reference = row.normativeReference;
  const normativeId = text(reference?.id ?? row.values.normativeId);
  if (!normativeId) return false;

  const status = text(row.values.normativeStatus).toUpperCase();
  if (status === 'INACTIVE' || status === 'REVIEW') return false;
  if (reference?.validFrom && protocolDate && reference.validFrom > protocolDate) return false;
  if (reference?.validUntil && protocolDate && reference.validUntil < protocolDate) return false;
  return true;
};
