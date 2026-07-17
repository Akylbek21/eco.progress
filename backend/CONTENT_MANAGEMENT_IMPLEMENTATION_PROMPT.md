# Промт для реализации backend Content Management EcoProgress

Ты работаешь с реальным backend EcoProgress. Не создавай отдельный проект и не делай mock API. Сначала полностью изучи стек, существующую авторизацию, пользователей, роли, API envelope, Flyway, PostgreSQL, CRM leads/orders/tasks/notifications, файловое хранилище, scheduler, кеш, логирование и deployment.

Frontend уже подготовлен и ожидает API с префиксом `/api`. Ответы имеют envelope:

```json
{ "data": {}, "message": null }
```

Не создавай вторую модель пользователей. Добавь permissions в существующий RBAC и проверяй их на backend для каждого endpoint:

```text
view_content
edit_content
review_content_expert
review_content_legal
review_content_seo
publish_content
manage_content
```

## 1. Исходные контракты

Обязательно прочитай и используй как контракт:

```text
src/types/contentManagement.ts
src/services/contentManagementService.ts
src/content/types.ts
src/content/apiRepository.ts
src/services/serviceService.ts
src/services/newsService.ts
backend/src/main/resources/db/migration/V5__create_content_management.sql
scripts/content-export.mjs
```

Если Flyway V5 ещё не применялась, разрешено корректировать её. Если применялась хотя бы в одной среде — не изменяй V5, создай следующую forward-only миграцию.

## 2. Модуль backend

Создай модуль в стиле существующей архитектуры backend:

```text
content/
  controller
  service
  repository
  domain
  dto
  mapper
  validation
  workflow
  versioning
  publishing
  preview
  files
  audit
  analytics
```

Сущности: category, content item, version, status history, comment, legal source, region, trust document, redirect, file, review policy, experiment, audit log, lead attribution и analytics event.

JSONB `payload` и `seo` нельзя принимать как произвольный JSON. Создай versioned JSON Schema/typed DTO для каждого `content_type`, reject unknown fields и валидируй вложенные блоки. Не сохраняй произвольный HTML. Если legacy HTML нужен при импорте — sanitize на сервере allowlist-политикой и преобразуй в структурированные блоки.

## 3. Public API

```http
GET /api/public/content/services
GET /api/public/content/services/{slug}
GET /api/public/content/articles
GET /api/public/content/articles/{slug}
GET /api/public/content/regions
GET /api/public/content/regions/{slug}
GET /api/public/content/regional-pages/{slug}
GET /api/public/content/cases
GET /api/public/content/cases/{slug}
GET /api/public/content/experts/{slug}
GET /api/public/content/trust-documents
GET /api/public/content/sitemap
GET /api/public/content/redirects/resolve?path=
```

`services` возвращает `ServiceContent[]`, `articles` — `ArticleContent[]`, `regions` — `RegionContent[]` строго по `src/content/types.ts`. Detail endpoint возвращает один объект того же типа. Возвращай только активную опубликованную версию. Не отдавай draft, комментарии, audit, internal file URL, PII, неподтверждённые документы или служебные поля.

Для коллекций поддержи пагинацию без изменения обратной совместимости: либо массив для текущего frontend, либо после согласованного frontend-релиза `{items,page,size,total,totalPages,version}`. Добавь `ETag`, `Last-Modified`, `Cache-Control` и обработку `If-None-Match`.

## 4. Admin API

Для resources `services`, `articles`, `regions`, `regional-pages`, `cases`, `experts`, `trust-documents`, `legal-sources`, `redirects` реализуй:

```http
GET    /api/admin/content/{resource}
POST   /api/admin/content/{resource}
GET    /api/admin/content/{resource}/{id}
PUT    /api/admin/content/{resource}/{id}
DELETE /api/admin/content/{resource}/{id}
```

DELETE по умолчанию архивирует. Физическое удаление разрешено только `manage_content`, только для никогда не публиковавшихся записей и с обязательной причиной.

PUT принимает whitelist из `updateContentItem()` и обязательный `optimisticLockVersion`. При конфликте вернуть `409 Conflict` с текущей версией и correlation ID. Каждое изменение создаёт `content_versions`; опубликованную версию не менять на месте.

## 5. Workflow

Разрешённые команды — только отдельными action endpoints:

```text
submit-content-review, approve-content,
submit-expert-review, approve-expert,
submit-legal-review, approve-legal,
submit-seo-review, approve-seo,
schedule, publish, unpublish, archive, reject
```

Обычный PUT не может менять status, publishedVersionId, draftVersionId или author/audit fields. Для каждой команды проверь permission, текущий статус, обязательные review stages, открытые blocking comments и validation result. Запиши status history, audit log и причину.

Перед publish блокируй: пустые title/slug/body/description/canonical, конфликт slug/canonical, invalid dates, неизвестные связи, битые internal links, непроверенные legal/trust данные, redirect loop, неразрешённый региональный office claim, unresolved blocking comments и отсутствие обязательных approvals.

## 6. Версии, comments и preview

Реализуй endpoints из `contentManagementService.ts` для versions, compare, restore, history и comments. Compare возвращает field diff `ADDED|REMOVED|CHANGED`; для текста сравнивает строки/абзацы. Restore создаёт новую draft-версию.

Preview endpoint:

```http
POST /api/admin/content/{resource}/{id}/preview-token
GET  /api/preview/content/{type}/{id}?token=...
```

Token: криптографически стойкий, однократный или отзывной, TTL 15 минут, связан с user/content/version, read-only; preview всегда `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, отсутствует в sitemap и audit-логируется.

## 7. Файлы

```http
POST /api/admin/content/{resource}/{id}/files
```

Multipart содержит `file` и JSON part `metadata`. Проверяй реальный MIME/magic bytes, extension, размер, permissions, антивирусный статус, SVG sanitization, безопасное уникальное имя и public/private storage. DOCX только private. Публичный документ разрешай только после подтверждения обезличивания. Генерируй thumbnail, WebP/AVIF и OG variant асинхронно, не теряя оригинальную запись при ошибке derivative job.

## 8. Redirects и публикация

Изменение опубликованного slug транзакционно создаёт 301, проверяет loop/chain и обновляет внутренние ссылки. Запретить redirect на draft/unpublished target. Sitemap содержит только конечный canonical URL.

Scheduled publishing хранит время UTC, отображает Asia/Almaty и выполняется idempotent backend job. После commit публикации запусти через transactional outbox: cache invalidation, sitemap, prerender/search index, related content, analytics event. Ошибки post-publish jobs повторяются и видны администратору, но не откатывают уже зафиксированную опубликованную версию.

## 9. CRM и аналитика

Расширь существующий create lead endpoint полями `LeadContentAttribution`. Не доверяй `calculatorValue`: пересчитай по опубликованной версии услуги или сохрани отдельно как unverified client estimate. Сохраняй first/last touch без полного журнала просмотров.

Реализуй `/api/admin/content/analytics` как backend aggregates: views, CTA, form starts/submits, qualified leads, offers, contracts и funnel. Revenue считать только из реальных CRM contract/payment статусов. Analytics endpoint никогда не возвращает ФИО, телефон, email, ИИН/БИН или текст заявки.

## 10. Import

Прими JSON из `npm run content:export`. Добавь backend CLI/import job с `--dry-run` и transactional apply. Dry-run сообщает creates, updates, duplicates, slug conflicts, missing relations, date errors и fields requiring verification. При критической ошибке вся транзакция откатывается. Import idempotent по `(content_type, slug, locale)` и не перезаписывает более новую ручную версию.

## 11. Безопасность и эксплуатация

Обязательно: endpoint RBAC tests, validation, output DTO allowlist, rate limit public search/preview, CSRF при cookie auth, audit log append-only, correlation ID, логирование без payload/PII, redirect validation, scheduler lock, idempotency keys, cache metrics и health metrics.

Добавь метрики `content_api_requests`, `content_api_errors`, `content_publish_success`, `content_publish_failure`, `content_fallback_usage`, `content_validation_errors`, `content_scheduled_jobs`, `content_expired_documents`, `content_broken_links`, `content_cache_hit`, `content_cache_miss`.

## 12. Тесты и готовность

Добавь unit, integration и security tests для workflow, permissions, versions, optimistic locking, publish/unpublish/restore, validation, sanitization, files, preview token, redirect loops, scheduler idempotency, cache invalidation, public DTO leakage и lead attribution.

Обязательные security assertions:

```text
viewer не редактирует;
editor не публикует;
expert не меняет published version;
draft недоступен public API;
blocking comment блокирует переход;
expired/revoked preview token не работает;
script/iframe/javascript URL отклоняются;
опасный MIME и SVG отклоняются;
mass assignment status/actor/version игнорируется или отклоняется;
redirect loop и redirect на draft отклоняются.
```

После реализации запусти реальные команды backend build/test, применяй миграции на чистой PostgreSQL и upgrade-копии, затем запусти frontend `npm run typecheck`, `npm run test`, `npm run build`, `npm run seo:audit`, `npm run content:audit`, `npm run content:migrate:dry-run`.

В отчёте не называй endpoint или тест реализованным, если он фактически не запускался. Приведи список файлов, миграций, API, permission matrix, workflow transitions, результаты тестов и оставшиеся operational/legal risks.
