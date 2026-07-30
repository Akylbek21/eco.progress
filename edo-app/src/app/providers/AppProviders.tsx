import { useEffect, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { theme } from '../theme/theme';
import { setSessionRevokedHandler } from '../../shared/api/edoApiClient';
import { useAuthStore } from '../../shared/auth/authStore';
import { AppErrorBoundary } from '../../shared/components/AppErrorBoundary';
import { clearSensitiveSigningState } from '../../shared/security/sensitiveSigningState';
import { RouteTelemetry } from '../../shared/observability/RouteTelemetry';
import { GlobalErrorMonitoring } from '../../shared/observability/GlobalErrorMonitoring';

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
    const clearSensitiveData = () => clearSensitiveSigningState();
    window.addEventListener('pagehide', clearSensitiveData);
    setSessionRevokedHandler(() => {
      clearSensitiveSigningState();
      void client.cancelQueries().finally(() => {
        client.clear();
        reset();
        navigate('/session-expired', { replace: true });
      });
    });
    return () => {
      window.removeEventListener('pagehide', clearSensitiveData);
      setSessionRevokedHandler();
    };
  }, [client, navigate, reset]);
  return null;
};

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionRevokedBridge />
        <RouteTelemetry />
        <GlobalErrorMonitoring />
        <AppErrorBoundary>{children}</AppErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </ThemeProvider>
);
