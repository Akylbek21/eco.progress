const normalizeSiteUrl = (value: string) => value.trim().replace(/\/+$/, '');

export const appConfig = {
  siteUrl: normalizeSiteUrl(import.meta.env.VITE_SITE_URL || 'https://ecoprogress.kz'),
  gaMeasurementId: (import.meta.env.VITE_GA_MEASUREMENT_ID || '').trim(),
  googleSiteVerification: (import.meta.env.VITE_GOOGLE_SITE_VERIFICATION || '').trim(),
  yandexMetrikaId: (import.meta.env.VITE_YANDEX_METRIKA_ID || '').trim(),
};

