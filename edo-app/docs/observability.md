# Observability

Приложение поддерживает privacy-safe integration hooks:

```text
window.__EDO_TELEMETRY_REPORTER__
window.__EDO_ERROR_REPORTER__
window.__EDO_TRACE_CONTEXT__
```

События: page load, route change, API duration/error, refresh failure, rate limit и external signing failure.

Trace context передаётся только если согласованный provider вернул валидный W3C `traceparent`; frontend не генерирует собственную несовместимую трассировку.

URL очищаются от document ID, invitation token и external token. Payload, title, ИИН/БИН, CMS, passwords, comments и file content не отправляются.
