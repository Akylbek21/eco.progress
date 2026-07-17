import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, recordContentTouch, trackPageView } from '../services/analytics';

const AnalyticsRouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    initializeAnalytics();
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const path = `${location.pathname}${location.search}`;
      recordContentTouch(path);
      trackPageView(path);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);

  return null;
};

export default AnalyticsRouteTracker;
