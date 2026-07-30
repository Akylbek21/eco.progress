import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: process.env.EDO_OPENAPI_URL || 'https://api-edo.ecoprogress.kz/openapi/edo-api.yaml',
  output: {
    path: 'src/shared/api/generated',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
