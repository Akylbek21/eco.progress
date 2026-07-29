import type { PekResultValue } from '../api/pekContracts';

export const formatPekResult = (value: unknown, fallback = '—'): string => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `${value.length} записей`;

  const result = value as PekResultValue & Record<string, unknown>;
  if (result.belowDetectionLimit) {
    return result.detectionLimit === null || result.detectionLimit === undefined
      ? 'Менее предела обнаружения'
      : `< ${result.detectionLimit}`;
  }
  if (result.numericValue !== null && result.numericValue !== undefined) return String(result.numericValue);
  if (result.rangeFrom !== null && result.rangeFrom !== undefined
      && result.rangeTo !== null && result.rangeTo !== undefined) {
    return `${result.rangeFrom}–${result.rangeTo}`;
  }
  if (result.textValue !== null && result.textValue !== undefined && result.textValue !== '') return result.textValue;

  const label = result.name ?? result.label ?? result.number;
  return label === null || label === undefined || label === '' ? fallback : String(label);
};

export const formatNullableCount = (value: number | null | undefined, fallback = '—') =>
  value === null || value === undefined ? fallback : String(value);
