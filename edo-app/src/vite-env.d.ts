/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EDO_API_URL: string;
  readonly VITE_EDO_APP_URL: string;
  readonly VITE_MAIN_SITE_URL: string;
  readonly VITE_MAIN_CRM_URL: string;
  readonly VITE_NCALAYER_ENABLED: string;
  readonly VITE_ENVIRONMENT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
