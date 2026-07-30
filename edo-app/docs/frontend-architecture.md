# Frontend architecture

`edo-app` — отдельный SPA для `edo.ecoprogress.kz`. Основной сайт содержит только публичный `/document-flow`.

Зависимости направлены так:

```text
route/page → feature hook or adapter → generated API client → HTTP
```

Это целевая цепочка после публикации backend OpenAPI. На 30 июля 2026 года
`src/shared/api/generated` отсутствует, поэтому feature adapters временно используют
централизованные HTTP clients и ручные DTO. CI намеренно остаётся красным на
`api:check`, пока схема и сгенерированный client не станут доступны.

Pages и components не могут импортировать Axios или raw generated client — это проверяет ESLint. Tenant-зависимые query keys содержат `organizationId`.

Public `/external-sign/:token` использует отдельный client без Authorization, refresh и organization headers.
