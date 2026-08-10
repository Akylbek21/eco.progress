import { defineConfig, loadEnv, type ProxyOptions } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.DEV_BACKEND_URL || env.BACKEND_URL || env.VITE_BACKEND_URL || 'http://localhost:8080';
  const publicApiBaseUrl = env.VITE_API_URL?.trim() || '/api';

  if (mode === 'production' && /^http:\/\//i.test(publicApiBaseUrl)) {
    throw new Error('VITE_API_URL must not use insecure HTTP in a production build. Use /api or an HTTPS URL.');
  }

  const apiProxy = (): Record<string, ProxyOptions> => ({
    '/api': {
      target: backendUrl,
      changeOrigin: true,
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyRequest) => {
          proxyRequest.removeHeader('origin');
        });
      },
    },
  });

  return {
    plugins: [react()],
    define: {
      __BUILD_INFO__: JSON.stringify({
        frontendCommit: env.VITE_FRONTEND_COMMIT || env.GIT_COMMIT || 'unknown',
        buildTimestamp: new Date().toISOString(),
        apiBaseUrl: publicApiBaseUrl,
      }),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query', 'axios'],
            icons: ['lucide-react', 'react-icons'],
          },
        },
      },
    },
    server: {
      port: 4173,
      proxy: apiProxy(),
    },
    preview: {
      port: 4173,
      proxy: apiProxy(),
    },
  };
});
