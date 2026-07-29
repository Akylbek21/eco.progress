import { useQuery } from '@tanstack/react-query';
import { authApi } from '../api/authApi';

export const authKeys = {
  session: ['auth', 'session'] as const,
  organizations: ['auth', 'organizations'] as const,
};

export const useAuthSession = () => useQuery({
  queryKey: authKeys.session,
  queryFn: ({ signal }) => authApi.session(signal),
  retry: false,
  staleTime: 60_000,
});
