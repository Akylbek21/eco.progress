/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_MSW?: string;
  readonly VITE_PEK_MSW_SCENARIO?: string;
}

declare const __BUILD_INFO__: {
  frontendCommit: string;
  buildTimestamp: string;
  apiBaseUrl: string;
};
