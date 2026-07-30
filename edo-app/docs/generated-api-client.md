# Generated API client

Источник контракта: `openapi/edo-api.yaml`, доступный через `EDO_OPENAPI_URL`.

```bash
npm run api:generate
npm run api:lint
npm run api:diff
npm run api:check
```

`api:diff` генерирует client во временную директорию и сравнивает SHA-256 каждого файла с `src/shared/api/generated`. Generated-файлы вручную не редактируются.

На 30 июля 2026 года схема недоступна из рабочего окружения, поэтому committed generated client отсутствует и `api:check` ожидаемо завершается ошибкой.
