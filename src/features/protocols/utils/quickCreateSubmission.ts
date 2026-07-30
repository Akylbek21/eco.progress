import type { QuickCreateProtocolRequest } from '../api/protocolContracts';

export type QuickCreateAttemptState = {
  idempotencyKey: string | null;
  payloadFingerprint: string | null;
};

export const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

export const prepareQuickCreateAttempt = (
  payload: QuickCreateProtocolRequest,
  previous: QuickCreateAttemptState,
  createId = () => crypto.randomUUID(),
): { idempotencyKey: string; payloadFingerprint: string } => {
  const payloadFingerprint = stableStringify(payload);
  const canReuse = Boolean(
    previous.idempotencyKey && previous.payloadFingerprint === payloadFingerprint,
  );
  return {
    idempotencyKey: canReuse ? previous.idempotencyKey as string : createId(),
    payloadFingerprint,
  };
};

export const acquireQuickCreateLock = (lock: { current: boolean }): boolean => {
  if (lock.current) return false;
  lock.current = true;
  return true;
};

export const releaseQuickCreateLock = (lock: { current: boolean }): void => {
  lock.current = false;
};
