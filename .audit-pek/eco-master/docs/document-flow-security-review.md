# Document Flow security review

JWT logout is now server-side revocation through a persistent token version. Public signing rate limits are shared between replicas through the relational database; only hashed composite keys are stored.

## Реализованные гарантии

- Tenant определяется через проверенный membership/`OrganizationResolver`; entity lookup использует organization id.
- Assignment внутренней подписи определяется по JWT-пользователю и активному маршруту документа из path.
- CMS проверяется против bytes locked current version.
- Внешние invitation tokens хранятся как SHA-256 hash и имеют срок действия.
- `clientRequestId` защищён уникальным ограничением и идемпотентной обработкой.
- Counterparty и representatives проверяют tenant до чтения и изменения.
- Подписанный пакет формируется streaming ZIP; CMS, manifest, audit и verification report не требуют временного path от клиента.
- Обычный API не предоставляет update/delete audit events.

## Оставшиеся production-ограничения

- Public rate limiter хранит fixed-window counters в общей реляционной БД и работает между репликами; ключ содержит только SHA-256 от IP/token endpoint tuple.
- Logout проекта требует отдельной общей JWT revocation стратегии; это не локальная операция document-flow.
- Production CORS/H2 зависят от активного Spring profile и deployment configuration и должны проверяться smoke-тестом образа.
- TSA trusted timestamp для CMS пока не интегрирован.
