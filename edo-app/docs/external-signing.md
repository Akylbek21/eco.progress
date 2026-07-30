# External signing

Маршрут: `/external-sign/:token`.

Используется `publicEdoApiClient`:

- без Bearer token;
- без refresh interceptor;
- без organization header;
- без cookies;
- с `X-Correlation-ID`;
- с optional trace context от согласованного OpenTelemetry provider.

Token не сохраняется. Telemetry заменяет значение пути на `/external-sign/[redacted]`. Nginx отправляет `Referrer-Policy: no-referrer`.
