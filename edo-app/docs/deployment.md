# Deployment

Production image собирается через multi-stage Docker build и обслуживается Nginx.

Обязательные env:

```text
VITE_EDO_API_URL
VITE_EDO_APP_URL
VITE_MAIN_SITE_URL
VITE_CRM_URL
VITE_NCALAYER_WS_URL
VITE_ENVIRONMENT
```

Nginx включает CSP, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `no-referrer`, COOP и immutable cache для hashed assets. Production source maps отключены.

Build artifacts хранятся в CI registry. Исходники и release tags — в Git. Пользовательские документы, CMS и tokens не входят в frontend artifacts или backup.
