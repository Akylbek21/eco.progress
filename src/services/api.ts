import axios from 'axios';

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
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) {
      error.message = message;
    }
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
