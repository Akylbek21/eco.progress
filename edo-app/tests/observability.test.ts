import { afterEach, describe, expect, it, vi } from 'vitest';
import { redactRoute, reportFrontendError } from '../src/shared/observability/errorMonitoring';
import {
  currentTraceContext,
  reportTelemetry,
  sanitizeTelemetryRoute,
} from '../src/shared/observability/telemetry';

afterEach(() => {
  window.__EDO_ERROR_REPORTER__ = undefined;
  window.__EDO_TELEMETRY_REPORTER__ = undefined;
  window.__EDO_TRACE_CONTEXT__ = undefined;
});

describe('safe observability boundary', () => {
  it('redacts public tokens, invitation tokens, identifiers and query strings', () => {
    expect(redactRoute('/external-sign/secret-token?next=/')).toBe('/external-sign/[redacted]?next=/');
    expect(sanitizeTelemetryRoute('/documents/123?token=secret')).toBe('/documents/[id]');
    expect(sanitizeTelemetryRoute('/invitations/invite-secret/accept')).toBe('/invitations/[redacted]/accept');
  });

  it('passes only valid W3C trace context to API requests', () => {
    window.__EDO_TRACE_CONTEXT__ = () => ({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=value',
    });
    expect(currentTraceContext()?.tracestate).toBe('vendor=value');
    window.__EDO_TRACE_CONTEXT__ = () => ({ traceparent: 'unsafe' });
    expect(currentTraceContext()).toBeUndefined();
  });

  it('sanitizes routes before invoking monitoring adapters', () => {
    const errors = vi.fn();
    const telemetry = vi.fn();
    window.__EDO_ERROR_REPORTER__ = errors;
    window.__EDO_TELEMETRY_REPORTER__ = telemetry;

    reportFrontendError({ boundary: 'route', errorName: 'Error', route: '/external-sign/token-1' });
    reportTelemetry({ name: 'api.error', status: 500, route: '/documents/987?access_token=secret' });

    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ route: '/external-sign/[redacted]' }));
    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({ route: '/documents/[id]' }));
  });
});
