import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || env.BACKEND_URL || 'http://localhost:8080';
  const publicApiBaseUrl = env.VITE_BACKEND_URL ? `${env.VITE_BACKEND_URL}/api` : '/api';

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
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
