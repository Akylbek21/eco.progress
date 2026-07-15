import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, trackPageView } from '../services/analytics';

const AnalyticsRouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    initializeAnalytics();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      trackPageView(`${location.pathname}${location.search}`);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsRouteTracker;

