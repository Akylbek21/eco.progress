import { z } from 'zod';

const envSchema = z.object({
  VITE_EDO_API_URL: z.string().url(),
  VITE_EDO_APP_URL: z.string().url(),
  VITE_MAIN_SITE_URL: z.string().url(),
  VITE_CRM_URL: z.string().url(),
  VITE_NCALAYER_WS_URL: z.string().url().refine((value) => value.startsWith('wss://'), 'NCALayer URL must use wss://'),
  VITE_ENVIRONMENT: z.enum(['development', 'test', 'staging', 'production']),
});

const developmentDefaults = {
  VITE_EDO_API_URL: 'http://localhost:8080/api',
  VITE_EDO_APP_URL: 'http://localhost:4174',
  VITE_MAIN_SITE_URL: 'https://ecoprogress.kz',
  VITE_CRM_URL: 'https://crm.ecoprogress.kz',
  VITE_NCALAYER_WS_URL: 'wss://127.0.0.1:13579/',
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
  crmUrl: parsed.data.VITE_CRM_URL.replace(/\/$/, ''),
  ncaLayerWsUrl: parsed.data.VITE_NCALAYER_WS_URL,
  environment: parsed.data.VITE_ENVIRONMENT,
};
