# EcoProgress EDO

Отдельное frontend-приложение для `https://edo.ecoprogress.kz`. Оно не импортирует авторизацию, роли, токены или API client основного сайта.

## Конфигурация

Скопируйте `.env.example` в `.env.local` и задайте:

- `VITE_EDO_API_URL` — полный API prefix, например `https://api-edo.ecoprogress.kz/api`;
- `VITE_EDO_APP_URL`;
- `VITE_MAIN_SITE_URL`;
- `VITE_CRM_URL`;
- `VITE_NCALAYER_WS_URL`.

Refresh token ожидается только в `HttpOnly Secure` cookie. Access token хранится только в памяти страницы.

## OpenAPI

Единственный источник backend-контракта — `/openapi/edo-api.yaml`.

```bash
npm run api:generate
npm run api:check
```

Для альтернативного расположения схемы задайте `EDO_OPENAPI_URL`. `api:check` повторно генерирует client и завершает CI с ошибкой при расхождении `src/shared/api/generated`.

## Проверки

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

E2E полного workflow должен запускаться против Spring Boot test environment без MSW. Публичные route-тесты могут выполняться без backend.
