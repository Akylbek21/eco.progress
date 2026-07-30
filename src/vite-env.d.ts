/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_MSW?: string;
  readonly VITE_PEK_MSW_SCENARIO?: string;
  readonly VITE_EDO_APP_URL?: string;
}
