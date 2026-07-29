# EcoProgress EDO

Самостоятельное frontend-приложение для `https://edo.ecoprogress.kz`.

Приложение не импортирует auth, роли, токены или API client основной CRM. Все запросы идут только в `VITE_EDO_API_URL`, refresh token ожидается в `HttpOnly Secure` cookie, access token хранится только в памяти процесса страницы.

## Запуск

1. Скопировать `.env.example` в `.env.local`.
2. Указать адрес отдельного backend ЭДО.
3. Запустить `npm install`.
4. Запустить `npm run dev`.

Команды:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run e2e`

## Backend

Без backend `api-edo.ecoprogress.kz` приложение показывает loading/error/empty состояния и не подменяет документы, пользователей или права mock-данными.

Backend должен выдавать OpenAPI schema, после чего generated client размещается в `src/shared/api/generated`. Ручные API-модули в текущем репозитории являются типизированной boundary-реализацией до появления схемы.
