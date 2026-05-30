import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://213.155.20.204:8080',
        changeOrigin: true,
      },
    },
  },
});
