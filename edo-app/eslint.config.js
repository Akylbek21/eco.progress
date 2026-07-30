import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/shared/api/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: [
      'src/**/*Page.{ts,tsx}',
      'src/**/pages/**/*.{ts,tsx}',
      'src/**/components/**/*.{ts,tsx}',
      'src/layouts/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'axios',
          message: 'Pages and components must use feature hooks or API adapters.',
        }],
        patterns: [{
          group: ['**/shared/api/edoApiClient', '**/shared/api/publicEdoApiClient', '**/api/generated/**'],
          message: 'Raw HTTP/generated clients are restricted to feature API adapters.',
        }],
      }],
      'no-restricted-globals': ['error', {
        name: 'fetch',
        message: 'Pages and components must use feature hooks or API adapters.',
      }],
    },
  },
);
