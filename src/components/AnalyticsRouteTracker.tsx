import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { initializeAnalytics, recordContentTouch, trackPageView } from '../services/analytics';

const AnalyticsRouteTracker = () => {
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      initializeAnalytics();
      trackPageView(`${window.location.pathname}${window.location.search}`);
    };
    const onLoad = () => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 2500 });
      else setTimeout(start, 1200);
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad, { once: true });
    return () => { cancelled = true; window.removeEventListener('load', onLoad); };
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
