export type FrontendErrorEvent = {
  boundary: string;
  errorName: string;
  route: string;
  requestId?: string;
  release?: string;
  environment: string;
};

declare global {
  interface Window {
    __EDO_ERROR_REPORTER__?: (event: FrontendErrorEvent) => void;
  }
}

export const redactRoute = (route: string) =>
  route.replace(/\/external-sign\/[^/?#]+/i, '/external-sign/[redacted]');

export const reportFrontendError = (
  event: Omit<FrontendErrorEvent, 'route' | 'environment'> & { route?: string },
) => {
  const reporter = window.__EDO_ERROR_REPORTER__;
  if (!reporter) return;
  reporter({
    ...event,
    route: redactRoute(event.route || window.location.pathname),
    environment: env.environment,
  });
};
import { env } from '../../app/config/env';
