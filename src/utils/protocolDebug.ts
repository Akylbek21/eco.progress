export const debugProtocolPayload = (
  operation: string,
  payload: unknown,
  metadata?: Record<string, unknown>,
): void => {
  if (!import.meta.env.DEV) return;
  console.debug(`[Protocols] ${operation}`, { payload, ...metadata });
};
