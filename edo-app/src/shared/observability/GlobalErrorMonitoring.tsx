import { useEffect } from 'react';
import { reportFrontendError } from './errorMonitoring';

export const GlobalErrorMonitoring = () => {
  useEffect(() => {
    const onError = (event: ErrorEvent) => reportFrontendError({
      boundary: 'window',
      errorName: event.error instanceof Error ? event.error.name : 'WindowError',
    });
    const onUnhandledRejection = (event: PromiseRejectionEvent) => reportFrontendError({
      boundary: 'unhandled-rejection',
      errorName: event.reason instanceof Error ? event.reason.name : 'UnhandledRejection',
    });
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);
  return null;
};
