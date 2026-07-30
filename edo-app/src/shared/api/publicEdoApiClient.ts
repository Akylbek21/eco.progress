import axios from 'axios';
import { env } from '../../app/config/env';
import { currentTraceContext, reportTelemetry } from '../observability/telemetry';

export const publicEdoApiClient = axios.create({
  baseURL: env.edoApiUrl,
  timeout: 20_000,
  withCredentials: false,
  headers: { Accept: 'application/json' },
});

publicEdoApiClient.interceptors.request.use((config) => {
  if (!config.headers['X-Correlation-ID']) config.headers['X-Correlation-ID'] = crypto.randomUUID();
  const traceContext = currentTraceContext();
  if (traceContext) {
    config.headers.traceparent = traceContext.traceparent;
    if (traceContext.tracestate) config.headers.tracestate = traceContext.tracestate;
  }
  return config;
});

publicEdoApiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    reportTelemetry({ name: 'external-signing.failure', route: window.location.pathname });
    return Promise.reject(error);
  },
);
