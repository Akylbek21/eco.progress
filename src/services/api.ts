import axios from 'axios';
import { getApiErrorMessage, normalizeApiError, type ApiResponse } from './apiHelpers';

const apiBaseUrl = import.meta.env.VITE_API_URL?.trim() || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eco-progress-token');
  const requestPath = String(config.url || '').replace(/^\/api/, '').split('?')[0];
  const isPublicRequest = ['/auth/login', '/auth/staff/login', '/auth/register'].includes(requestPath)
    || requestPath.startsWith('/public/');
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
  if (token && !isPublicRequest) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = String(config.method || 'GET').toUpperCase();
  if (!config.headers['X-Correlation-ID']) {
    config.headers['X-Correlation-ID'] = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  if (import.meta.env.DEV) {
    console.debug('[API]', {
      method,
      url: config.url,
      params: config.params,
    });
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    if (import.meta.env.DEV) {
      const parsed = normalizeApiError(error);
      console.error('[API error]', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: String(error.config?.method || 'GET').toUpperCase(),
        params: error.config?.params,
        status: error.response?.status,
        code: error.code,
        backendCode: parsed.code,
        message: parsed.message,
        fieldErrors: parsed.fieldErrors,
        traceId: parsed.traceId,
        requestCode: parsed.requestCode,
        resourceId: parsed.resourceId,
      });
    }
    error.message = getApiErrorMessage(error, error.message);
    const requestPath = String(error.config?.url || '').replace(/^\/api/, '').split('?')[0];
    if (error.response?.status === 401 && !requestPath.startsWith('/public/')) {
      localStorage.removeItem('eco-progress-token');
      localStorage.removeItem('eco-progress-user');
      const path = window.location.pathname;
      const loginPath = path.startsWith('/staff') || path.startsWith('/admin') ? '/staff/login' : '/login';
      if (!path.includes('/login') && sessionStorage.getItem('eco-progress-401-redirect') !== '1') {
        sessionStorage.setItem('eco-progress-401-redirect', '1');
        window.location.replace(loginPath);
      }
    }
    return Promise.reject(error);
  },
);

export default api;

export type { ApiResponse } from './apiHelpers';

export async function fetcher<T>(url: string): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url);
  return data.data;
}
