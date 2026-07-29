import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../../app/config/env';
import { useAuthStore } from '../auth/authStore';

let accessToken: string | undefined;
let refreshPromise: Promise<string | undefined> | undefined;
let onSessionRevoked: (() => void) | undefined;

export const setAccessToken = (token?: string) => {
  accessToken = token;
};

export const setSessionRevokedHandler = (handler: () => void) => {
  onSessionRevoked = handler;
};

export const edoApiClient = axios.create({
  baseURL: `${env.edoApiUrl}/api`,
  timeout: 20_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken?: string }>(`${env.edoApiUrl}/api/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
};

edoApiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  const activeOrganizationId = useAuthStore.getState().activeOrganizationId;
  if (activeOrganizationId) config.headers['X-Organization-Context'] = activeOrganizationId;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

edoApiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.code;
    if (code === 'SESSION_REVOKED' || code === 'ORGANIZATION_ACCESS_REVOKED') {
      setAccessToken();
      onSessionRevoked?.();
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes('/auth/')) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        if (token) original.headers.Authorization = `Bearer ${token}`;
        return edoApiClient(original);
      } catch {
        setAccessToken();
        onSessionRevoked?.();
      }
    }
    return Promise.reject(error);
  },
);
