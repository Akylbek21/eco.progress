import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../../app/config/env';
import { useAuthStore } from '../auth/authStore';
import { currentTraceContext, reportTelemetry } from '../observability/telemetry';

let accessToken: string | undefined;
let refreshPromise: Promise<string | undefined> | undefined;
let onSessionRevoked: (() => void) | undefined;
const requestStartedAt = new WeakMap<object, number>();

export const setAccessToken = (token?: string) => {
  accessToken = token;
};

export const setSessionRevokedHandler = (handler?: () => void) => {
  onSessionRevoked = handler;
};

export const edoApiClient = axios.create({
  baseURL: env.edoApiUrl,
  timeout: 20_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken?: string }>(`${env.edoApiUrl}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch((error: unknown) => {
        reportTelemetry({ name: 'auth.refresh.failure', route: '/auth/refresh' });
        throw error;
      })
      .finally(() => {
        refreshPromise = undefined;
      });
  }
  return refreshPromise;
};

edoApiClient.interceptors.request.use((config) => {
  requestStartedAt.set(config, performance.now());
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (!config.headers['X-Correlation-ID']) config.headers['X-Correlation-ID'] = crypto.randomUUID();
  const traceContext = currentTraceContext();
  if (traceContext) {
    config.headers.traceparent = traceContext.traceparent;
    if (traceContext.tracestate) config.headers.tracestate = traceContext.tracestate;
  }
  const activeOrganizationId = useAuthStore.getState().activeOrganizationId;
  if (activeOrganizationId) config.headers['X-Organization-Context'] = activeOrganizationId;
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

edoApiClient.interceptors.response.use(
  (response) => {
    const startedAt = requestStartedAt.get(response.config);
    reportTelemetry({
      name: 'api.duration',
      durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
      status: response.status,
      route: response.config.url,
    });
    return response;
  },
  async (error: AxiosError<{ code?: string }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const code = error.response?.data?.code;
    const startedAt = original ? requestStartedAt.get(original) : undefined;
    reportTelemetry({
      name: error.response?.status === 429 ? 'rate.limit' : 'api.error',
      durationMs: startedAt === undefined ? undefined : Math.round(performance.now() - startedAt),
      status: error.response?.status,
      problemCode: code,
      route: original?.url,
    });
    if (code === 'SESSION_REVOKED' || code === 'ORGANIZATION_ACCESS_REVOKED') {
      setAccessToken();
      onSessionRevoked?.();
      return Promise.reject(error);
    }
    const refreshExcluded = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password']
      .some((path) => original?.url?.includes(path));
    if (error.response?.status === 401 && original && !original._retried && !refreshExcluded) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        if (!token) throw new Error('Refresh response did not contain an access token.');
        original.headers.Authorization = `Bearer ${token}`;
        return edoApiClient(original);
      } catch {
        setAccessToken();
        onSessionRevoked?.();
      }
    }
    return Promise.reject(error);
  },
);
