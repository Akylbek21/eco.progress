# Testing

Локальные проверки:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Vitest покрывает error mapping, tenant query keys, rate limiting helpers, download security и document UI utilities.

Текущий Playwright suite проверяет публичные desktop/mobile routes. Полный system E2E должен работать против Spring Boot test environment и не использовать MSW.
