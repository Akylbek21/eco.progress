type AnalyticsPayload = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export const trackEvent = (eventName: string, payload: AnalyticsPayload = {}) => {
  const event = { event: eventName, ...payload };
  if (typeof window !== 'undefined' && Array.isArray(window.dataLayer)) {
    window.dataLayer.push(event);
  }
};

export const trackLeadSubmit = (payload: AnalyticsPayload = {}) => trackEvent('lead_submit', payload);
export const trackWhatsAppClick = (payload: AnalyticsPayload = {}) => trackEvent('whatsapp_click', payload);
export const trackServiceView = (payload: AnalyticsPayload = {}) => trackEvent('service_view', payload);
export const trackPhoneClick = (payload: AnalyticsPayload = {}) => trackEvent('phone_click', payload);
