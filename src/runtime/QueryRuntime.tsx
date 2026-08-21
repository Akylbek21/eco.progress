import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const shouldRetry = (failureCount: number, error: unknown) => {
  const status = typeof error === 'object' && error !== null && 'response' in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
  if (status === undefined) return failureCount < 2;
  if ([400, 401, 403, 404, 409, 412, 422].includes(status)) return false;
  return failureCount < 2;
};

export default function QueryRuntime({ children }: { children: ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
