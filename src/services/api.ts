import axios from 'axios';
import { getApiErrorMessage } from './apiHelpers';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL ? `${import.meta.env.VITE_BACKEND_URL}/api` : '/api',
});

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
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    if (import.meta.env.DEV) {
      console.error('[API error]', {
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        method: String(error.config?.method || 'GET').toUpperCase(),
        params: error.config?.params,
        data: error.config?.data instanceof FormData ? '[FormData]' : error.config?.data,
        status: error.response?.status,
        body: error.response?.data instanceof Blob ? `[Blob ${error.response.data.size} bytes]` : error.response?.data,
        message: error.message,
        code: error.code,
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
