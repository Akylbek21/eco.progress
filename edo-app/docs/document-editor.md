# Document editor

Документ создаётся серверным draft. Мутации используют `AbortSignal`, стабильный `Idempotency-Key` и `If-Match`.

Upload последовательно применяет version из полного backend response. Отправка не выполняется до подтверждённого ответа upload.

UI foundation для autosave и version conflict существует, но подключение PATCH должно выполняться только через generated DTO после публикации OpenAPI. Автоматический overwrite при 409/412 запрещён.
