import { appConfig } from '../config/app';

export type AnalyticsValue = string | number | boolean | undefined;
export type AnalyticsPayload = Record<string, AnalyticsValue>;
export type AnalyticsEventName =
  | 'generate_lead' | 'form_start' | 'form_submit' | 'form_error'
  | 'phone_click' | 'whatsapp_click' | 'email_click'
  | 'service_view' | 'city_page_view' | 'consultation_click'
  | 'calculator_start' | 'calculator_complete' | 'file_download'
  | 'login_click' | 'cabinet_open' | 'order_create_start' | 'order_create_success';

export interface LeadAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  gclid?: string;
  landingPage?: string;
  referrer?: string;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    ym?: (...args: unknown[]) => void;
  }
}

const ATTRIBUTION_KEY = 'ecoprogress_lead_attribution';
const forbiddenKey = /(name|phone|email|iin|bin|token|jwt|document|client|company|comment)/i;
let initialized = false;

const safePayload = (payload: AnalyticsPayload): AnalyticsPayload => Object.fromEntries(
  Object.entries(payload).filter(([key, value]) => !forbiddenKey.test(key) && value !== undefined),
);

const injectScript = (id: string, src: string) => {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

const captureAttribution = () => {
  try {
    if (sessionStorage.getItem(ATTRIBUTION_KEY)) return;
    const params = new URLSearchParams(window.location.search);
    const attribution: LeadAttribution = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      gclid: params.get('gclid') || undefined,
      landingPage: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || undefined,
    };
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // Storage and analytics blockers must never affect the application.
  }
};

export const getLeadAttribution = (): LeadAttribution => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}') as LeadAttribution;
  } catch {
    return {};
  }
};

export const initializeAnalytics = () => {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;
  captureAttribution();

  if (appConfig.gaMeasurementId) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || ((...args: unknown[]) => window.dataLayer?.push(args));
    window.gtag('js', new Date());
    window.gtag('config', appConfig.gaMeasurementId, { send_page_view: false, anonymize_ip: true });
    injectScript('google-analytics', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(appConfig.gaMeasurementId)}`);
  }

  if (appConfig.yandexMetrikaId) {
    const id = Number(appConfig.yandexMetrikaId);
    if (Number.isFinite(id)) {
      window.ym = window.ym || function (...args: unknown[]) {
        const queue = window.ym as ((...values: unknown[]) => void) & { a?: number; l?: unknown[] };
        queue.l = queue.l || [];
        queue.l.push(args);
      };
      window.ym(id, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
      injectScript('yandex-metrika', 'https://mc.yandex.ru/metrika/tag.js');
    }
  }
};

export const trackEvent = (eventName: AnalyticsEventName, payload: AnalyticsPayload = {}) => {
  if (typeof window === 'undefined') return;
  const params = { ...safePayload(payload), page_path: window.location.pathname };
  window.gtag?.('event', eventName, params);
  if (appConfig.yandexMetrikaId) window.ym?.(Number(appConfig.yandexMetrikaId), 'reachGoal', eventName, params);
};

export const trackPageView = (pagePath: string) => {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: pagePath,
    page_title: document.title,
  });
  if (appConfig.yandexMetrikaId) window.ym?.(Number(appConfig.yandexMetrikaId), 'hit', pagePath, { title: document.title });
};

export const trackLeadSubmit = (payload: AnalyticsPayload = {}) => trackEvent('generate_lead', payload);
export const trackWhatsAppClick = (payload: AnalyticsPayload = {}) => trackEvent('whatsapp_click', payload);
export const trackServiceView = (payload: AnalyticsPayload = {}) => trackEvent('service_view', payload);
export const trackPhoneClick = (payload: AnalyticsPayload = {}) => trackEvent('phone_click', payload);
export const trackEmailClick = (payload: AnalyticsPayload = {}) => trackEvent('email_click', payload);
