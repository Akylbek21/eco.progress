import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eco-progress-token');
  const requestPath = String(config.url || '').replace(/^\/api/, '').split('?')[0];
  const isPublicAuthRequest = ['/auth/login', '/auth/staff/login', '/auth/register'].includes(requestPath);
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
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
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
