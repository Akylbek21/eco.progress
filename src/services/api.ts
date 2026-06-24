import axios from 'axios';
import { getApiErrorMessage } from './apiHelpers';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api` : '/api',
});

const sanitizeHeaders = (headers: unknown) => {
  if (!headers || typeof headers !== 'object') return headers;
  const copy = { ...(headers as Record<string, unknown>) };
  delete copy.Authorization;
  delete copy.authorization;
  return copy;
};

const logRequest = (config: { url?: string; method?: string; data?: unknown; params?: unknown; headers?: unknown }) => {
  if (!import.meta.env.DEV) return;
  console.debug('[API request]', {
    url: `${config.url || ''}`,
    method: String(config.method || 'GET').toUpperCase(),
    params: config.params,
    payload: config.data instanceof FormData ? '[FormData]' : config.data,
    headers: sanitizeHeaders(config.headers),
  });
};

const logResponse = (response: { config?: { url?: string; method?: string }; status?: number; data?: unknown }) => {
  if (!import.meta.env.DEV) return;
  console.debug('[API response]', {
    url: response.config?.url,
    method: String(response.config?.method || 'GET').toUpperCase(),
    status: response.status,
    body: response.data instanceof Blob ? `[Blob ${response.data.size} bytes]` : response.data,
  });
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eco-progress-token');
  const requestPath = String(config.url || '').replace(/^\/api/, '').split('?')[0];
  const isPublicAuthRequest = ['/auth/login', '/auth/staff/login', '/auth/register'].includes(requestPath);
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const headers = config.headers as Record<string, unknown> & { delete?: (key: string) => void };
    if (typeof headers.delete === 'function') {
      headers.delete('Content-Type');
      headers.delete('content-type');
    } else {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
  }
  if (token && !isPublicAuthRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  logRequest(config);
  return config;
});

api.interceptors.response.use(
  (response) => {
    logResponse(response);
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('[API error]', {
        url: error.config?.url,
        method: String(error.config?.method || 'GET').toUpperCase(),
        status: error.response?.status,
        body: error.response?.data instanceof Blob ? `[Blob ${error.response.data.size} bytes]` : error.response?.data,
      });
    }
    error.message = getApiErrorMessage(error, error.message);
    if (error.response?.status === 401) {
      localStorage.removeItem('eco-progress-token');
      localStorage.removeItem('eco-progress-user');
      const path = window.location.pathname;
      const loginPath = path.startsWith('/staff') || path.startsWith('/admin') ? '/staff/login' : '/login';
      if (!path.includes('/login')) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export type ApiResponse<T> = {
  data: T;
  message: string | null;
};

export async function fetcher<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url);
  return data.data;
}
