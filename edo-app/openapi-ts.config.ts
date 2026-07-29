import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: process.env.EDO_OPENAPI_URL || 'https://api-edo.ecoprogress.kz/v3/api-docs',
  output: {
    path: 'src/shared/api/generated',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
  ],
});
