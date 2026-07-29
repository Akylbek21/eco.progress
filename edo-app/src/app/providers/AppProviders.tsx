import { useEffect, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { theme } from '../theme/theme';
import { setSessionRevokedHandler } from '../../shared/api/edoApiClient';
import { useAuthStore } from '../../shared/auth/authStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        return !status || status >= 500 ? count < 2 : false;
      },
    },
    mutations: { retry: false },
  },
});

const SessionRevokedBridge = () => {
  const navigate = useNavigate();
  const client = useQueryClient();
  const reset = useAuthStore((state) => state.reset);
  useEffect(() => {
    setSessionRevokedHandler(() => {
      client.clear();
      reset();
      navigate('/session-expired', { replace: true });
    });
  }, [client, navigate, reset]);
  return null;
};

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionRevokedBridge />
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);
