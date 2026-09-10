# Отчёт о реализации backend ПЭК

Дата: 2026-08-06. Статус: частичная итерация; критерии полной готовности не достигнуты.

## Причины разрывов

Модуль развивался вертикальными срезами: legacy PEK-поля протокола оказались read-only, source reconciliation первоначально удалял устаревшие строки, workflow submit был привязан к праву руководителя, readiness ограничивалась `linkedProtocolCount > 0`, а access service не имел user membership данных. Dashboard contract использует primitives и тем самым не отличает ноль от отсутствующей метрики.

## Изменённые файлы

- Repository compile repair: `ProtocolResultRepository`, `CompanyRepository`.
- Source workflow: `PekMatchStatus`, `PekReportProtocolSource`, repository, collector, DTO/controller/report service.
- Report workflow/readiness/actions: `PekReportStatus`, `PekSecurityExpressions`, `PekReportReadinessService`, `PekReportService`, `PekController`, DTO.
- Migration: `V64__pek_source_readiness_workflow.sql` добавляет `match_reason`, `updated_at`, индекс; rollback описан комментариями, старые данные не удаляются.
- Audit: `docs/pek-backend-contract-audit.md`.

## Реализованный контракт

- `GET /api/pek/reports/{id}/sources/summary`.
- `POST /api/pek/reports/{id}/sources/{sourceId}/match|exclude|restore` с source `version`.
- `GET /api/pek/reports/{id}/readiness`.
- `POST /api/pek/reports/{id}/return` с обязательной причиной.
- `submit-review` заново вычисляет readiness и блокирует неполный отчёт.
- Report responses возвращают role/status-specific `availableActions`.
- Reconciliation помечает отсутствующий protocol/result как `STALE`, manual/excluded решения не затираются.
- Distinct protocol count остаётся источником `linkedProtocolCount`.

Матрица ролей текущего кода: ECOLOGIST создаёт/собирает/сопоставляет/отправляет; HEAD/DIRECTOR/ADMIN возвращают, утверждают и архивируют; LABORATORY сохраняет существующее право создания протоколов, но не получает approval через ПЭК.

## Проверки команд

```text
.\mvnw.cmd -q -DskipTests compile
BUILD SUCCESS

.\mvnw.cmd -q -Dtest="kz.eco.pek.*" test
FAIL: Surefire pattern не сопоставил тесты (команда некорректна для этой конфигурации).

.\mvnw.cmd -q -Dtest="Pek*Test" test
Tests run: 88, Failures: 18, Errors: 1
```

В ПЭК-наборе успешно прошли frequency (10), plan/fact/exceedance calculation (11), program validation (9), status (7), distinct-count (5). Два reconciliation assertions ожидают старое физическое удаление и теперь расходятся с новым требованием `STALE`. Основная масса `PekModuleApiTest` падает на существующей chained optimistic-version проблеме (200 ожидался, возвращён 409); `PekProgramApiTest` также содержит fixture protocol без обязательного `createdBy`. Полный suite после изменений не запускался.

## Оставшиеся gaps

Не реализованы полный `pekContext` write path и explicit-link priority, candidates/audit history, staged program validation, report documents, полноценные exceedance endpoints, corrective actions, user-company membership, nullable dashboard, OpenAPI и весь обязательный integration test matrix. Поэтому backend нельзя считать завершённым и готовым к приёмке.

Команды запуска: `./mvnw spring-boot:run`, `./mvnw test`, `docker compose up -d --build`.
# Повторная верификация 6 августа 2026

Фактические команды:

```text
.\mvnw.cmd -Dtest=kz.eco.pek.** test
Tests run: 102, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

.\mvnw.cmd clean test
Tests run: 637, Failures: 6, Errors: 0, Skipped: 0 — BUILD FAILURE

.\mvnw.cmd -DskipTests package
BUILD SUCCESS; target/eco-0.0.1-SNAPSHOT.jar

docker compose build app
не запущен: Docker Desktop daemon недоступен (dockerDesktopLinuxEngine pipe отсутствует)
```

Шесть общих падений не относятся к ПЭК: `CompanyApiTest`, `CompanyPaginationAndLifecycleApiTest`, `LabJournalRowCounterServiceTest`, `LaboratoryApiTest` и два сценария `LaboratoryEmployeeApiTest`.

Дополнительно реализованы единый eligibility протокола, неизменяемость связей закрытого отчёта, сохранение STALE для аудита, повторная readiness-проверка при approve, return metadata, workflow history, расширенный source DTO, реальные dashboard-агрегаты и ролевые действия лаборатории.

Оставшийся gap: settings ПЭК пока разрешают компанию через существующее membership-хранилище документооборота. Отдельная PEK membership-модель не введена без миграции действующих membership-данных.
