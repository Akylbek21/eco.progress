import type { QuickCreateProtocolRequest } from '../../../types/protocols';

export type QuickCreateAttemptState = {
  idempotencyKey: string | null;
  payloadFingerprint: string | null;
};

export const prepareQuickCreateAttempt = (
  payload: QuickCreateProtocolRequest,
  previous: QuickCreateAttemptState,
  createId = () => crypto.randomUUID(),
): { idempotencyKey: string; payloadFingerprint: string } => {
  const payloadFingerprint = JSON.stringify(payload);
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
