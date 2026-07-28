import type { AxiosError } from 'axios';

const statusOf = (failure: unknown) =>
  typeof failure === 'object' && failure !== null && 'response' in failure
    ? Number((failure as AxiosError).response?.status || 0)
    : 0;

export const retryPekQuery = (failureCount: number, failure: unknown) => {
  const status = statusOf(failure);
  if ([400, 401, 403, 404, 409, 422].includes(status)) return false;
  return failureCount < 2 && (status === 0 || [502, 503, 504].includes(status));
};

export const PEK_STALE_TIME_MS = 30_000;
