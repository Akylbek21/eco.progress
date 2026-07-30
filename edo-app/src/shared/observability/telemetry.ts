import { env } from '../../app/config/env';
import { redactRoute } from './errorMonitoring';

export type TelemetryEvent = {
  name: string;
  durationMs?: number;
  status?: number;
  problemCode?: string;
  route?: string;
  environment: string;
};

type TraceContext = { traceparent: string; tracestate?: string };

declare global {
  interface Window {
    __EDO_TELEMETRY_REPORTER__?: (event: TelemetryEvent) => void;
    __EDO_TRACE_CONTEXT__?: () => TraceContext | undefined;
  }
}

const traceParentPattern = /^[\da-f]{2}-[\da-f]{32}-[\da-f]{16}-[\da-f]{2}$/i;

export const currentTraceContext = () => {
  const context = window.__EDO_TRACE_CONTEXT__?.();
  return context && traceParentPattern.test(context.traceparent) ? context : undefined;
};

export const sanitizeTelemetryRoute = (route: string) => redactRoute(route)
  .replace(/\/documents\/[^/?#]+/gi, '/documents/[id]')
  .replace(/\/invitations\/[^/?#]+/gi, '/invitations/[redacted]')
  .split('?')[0] || '/';

export const reportTelemetry = (event: Omit<TelemetryEvent, 'environment'>) => {
  const reporter = window.__EDO_TELEMETRY_REPORTER__;
  if (!reporter) return;
  reporter({
    ...event,
    route: event.route ? sanitizeTelemetryRoute(event.route) : undefined,
    environment: env.environment,
  });
};
