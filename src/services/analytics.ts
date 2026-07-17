import { appConfig } from '../config/app';
import type { ContentAnalyticsEvent, LeadContentAttribution } from '../types/contentManagement';

export type AnalyticsValue = string | number | boolean | undefined;
export type AnalyticsPayload = Record<string, AnalyticsValue>;
export type AnalyticsEventName =
  | 'generate_lead' | 'form_start' | 'form_submit' | 'form_error'
  | 'phone_click' | 'whatsapp_click' | 'email_click'
  | 'service_view' | 'city_page_view' | 'consultation_click'
  | 'calculator_start' | 'calculator_complete' | 'file_download'
  | 'login_click' | 'cabinet_open' | 'order_create_start' | 'order_create_success'
  | 'content_view' | 'article_view' | 'regional_page_view' | 'cta_click'
  | 'related_service_click' | 'related_article_click' | 'document_view' | 'document_download'
  | 'table_of_contents_click' | 'scroll_depth'
  | 'content_cache_hit' | 'content_cache_miss' | 'content_fallback_usage';

export interface LeadAttribution extends LeadContentAttribution {
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
const CONTENT_CONTEXT_KEY = 'ecoprogress_content_context';
const forbiddenKey = /(name|phone|email|iin|bin|token|jwt|client|company|comment|message|full.?text)/i;
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
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    const attribution: LeadAttribution = {
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
      utmContent: params.get('utm_content') || undefined,
      utmTerm: params.get('utm_term') || undefined,
      gclid: params.get('gclid') || undefined,
      landingPage: currentUrl,
      firstTouchUrl: currentUrl,
      lastTouchUrl: currentUrl,
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

export const recordContentTouch = (pagePath: string) => {
  if (typeof window === 'undefined') return;
  try {
    const saved = JSON.parse(sessionStorage.getItem(ATTRIBUTION_KEY) || '{}') as LeadAttribution;
    const withoutQuery = pagePath.split('?')[0];
    const segments = withoutQuery.split('/').filter(Boolean);
    const context: Partial<LeadContentAttribution> = withoutQuery.startsWith('/services/')
      ? { sourceType: 'SERVICE', sourceSlug: segments[1], serviceSlug: segments[1] }
      : withoutQuery.startsWith('/news/')
        ? { sourceType: 'ARTICLE', sourceSlug: segments[1] }
        : withoutQuery.startsWith('/ecologicheskie-uslugi-')
          ? { sourceType: 'REGIONAL_PAGE', sourceSlug: withoutQuery.slice(1) }
          : withoutQuery === '/tariffs' ? { sourceType: 'TARIFF' } : withoutQuery === '/' ? { sourceType: 'HOME' } : {};
    const next = { ...saved, ...context, sourceUrl: pagePath, firstTouchUrl: saved.firstTouchUrl || saved.landingPage || pagePath, lastTouchUrl: pagePath } satisfies LeadAttribution;
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
    sessionStorage.setItem(CONTENT_CONTEXT_KEY, JSON.stringify(context));
  } catch { /* Attribution is optional. */ }
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

export const trackContentEvent = (event: ContentAnalyticsEvent) => trackEvent(event.eventName, {
  page_type: event.pageType,
  content_id: event.contentId,
  content_slug: event.contentSlug,
  service_id: event.serviceId,
  service_slug: event.serviceSlug,
  region_id: event.regionId,
  cta_id: event.ctaId,
  position: event.position,
  value: event.value,
  currency: event.currency,
});

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
