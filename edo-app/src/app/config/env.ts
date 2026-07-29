import { z } from 'zod';

const envSchema = z.object({
  VITE_EDO_API_URL: z.string().url(),
  VITE_EDO_APP_URL: z.string().url(),
  VITE_MAIN_SITE_URL: z.string().url(),
  VITE_MAIN_CRM_URL: z.string().url(),
  VITE_NCALAYER_ENABLED: z.enum(['true', 'false']),
  VITE_ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']),
});

const developmentDefaults = {
  VITE_EDO_API_URL: 'http://localhost:8081',
  VITE_EDO_APP_URL: 'http://localhost:4174',
  VITE_MAIN_SITE_URL: 'https://ecoprogress.kz',
  VITE_MAIN_CRM_URL: 'https://crm.ecoprogress.kz',
  VITE_NCALAYER_ENABLED: 'true',
  VITE_ENVIRONMENT: 'development',
};

const values = import.meta.env.DEV
  ? { ...developmentDefaults, ...import.meta.env }
  : import.meta.env;
const parsed = envSchema.safeParse(values);

if (!parsed.success) {
  const missing = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`EcoProgress EDO: некорректная env-конфигурация (${missing}).`);
}

export const env = {
  edoApiUrl: parsed.data.VITE_EDO_API_URL.replace(/\/$/, ''),
  edoAppUrl: parsed.data.VITE_EDO_APP_URL.replace(/\/$/, ''),
  mainSiteUrl: parsed.data.VITE_MAIN_SITE_URL.replace(/\/$/, ''),
  mainCrmUrl: parsed.data.VITE_MAIN_CRM_URL.replace(/\/$/, ''),
  ncaLayerEnabled: parsed.data.VITE_NCALAYER_ENABLED === 'true',
  environment: parsed.data.VITE_ENVIRONMENT,
};
