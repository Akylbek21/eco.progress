import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/ToastProvider';
import App from './App';
import './index.css';
import axios from 'axios';

export const shouldRetry = (failureCount: number, error: unknown) => {
  if (!axios.isAxiosError(error)) return failureCount < 2;
  const status = error.response?.status;
  if ([400, 401, 403, 404, 409, 422].includes(status ?? 0)) return false;
  return failureCount < 2;
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

// The build-time snapshot is crawler content, not React server markup.
// Remove it before mounting so React never attempts to hydrate incompatible HTML.
if (root.dataset.prerendered === 'true') root.replaceChildren();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
