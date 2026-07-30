import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { reportTelemetry } from './telemetry';

export const RouteTelemetry = () => {
  const location = useLocation();
  useEffect(() => {
    reportTelemetry({ name: 'route.change', route: location.pathname });
  }, [location.pathname]);
  useEffect(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (navigation) {
      reportTelemetry({ name: 'page.load', durationMs: Math.round(navigation.duration), route: location.pathname });
    }
  }, [location.pathname]);
  return null;
};
