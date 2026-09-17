# ПЭК backend fix report

## Исправлено

- Добавлен единый `PekReportWorkflowGuard` и применён к match/exclude/restore и ручному созданию/удалению protocol link.
- Закрытые статусы READY_FOR_REVIEW/APPROVED/ARCHIVED возвращают 409 с кодом `PEK_REPORT_NOT_EDITABLE`.
- Approve повторно выполняет readiness в той же транзакции и возвращает `PEK_REPORT_NOT_READY` при blockers.
- Reconciliation сохраняет STALE для аудита, но устанавливает `excluded=true` и системную причину исключения.
- Linked protocol count и plan/fact source query принимают только MATCHED/MANUALLY_MATCHED; legacy STALE с `excluded=false` также не считается.
- Причина возврата, пользователь и время сохраняются в отчёте и возвращаются как `returnInfo`.

## Изменения БД

`V68__pek_report_return_info.sql`: nullable поля `return_reason`, `returned_at`, `returned_by_user_id`, индекс и FK. Существующие строки безопасно остаются с NULL.

## Проверки

- `mvnw -DskipTests test-compile`: SUCCESS, 662 main и 107 test sources на момент первого прогона.
- Полный пакет `kz.eco.pek.**`: 95 tests, 18 failures и 1 error. Два reconciliation-теста ожидают старое физическое удаление вместо нового STALE-аудита; остальные падения включают существующую test-fixture/version проблему program activation и `Protocol.createdBy` NULL.
- Целевые guard/repository тесты после изменений: 12/12 SUCCESS.

## Оставшиеся gaps

Единый protocol eligibility service, полная workflow history, отдельный company-scope для ПЭК, отвязка settings от Document Flow, расширенный source DTO без N+1, dashboard metrics и полная LABORATORY action matrix ещё не завершены. Поэтому все acceptance criteria ТЗ пока не выполнены.
# Итог проверки 6 августа 2026

- `mvnw -Dtest=kz.eco.pek.** test`: **102 теста, 0 failures, 0 errors**.
- `mvnw clean test`: **637 тестов, 6 failures, 0 errors**. Все шесть падений находятся вне пакета ПЭК: два company security-теста, три laboratory-теста и конкурентный тест счётчика лабораторного журнала.
- Добавлен единый `PekProtocolEligibilityService`: company/object, период, deleted/replaced/cancelled/archived, финальный статус и настройка `includeOnlySignedProtocols` теперь проверяются одинаково при сборе и ручных операциях.
- Закрытые отчёты защищены единым `PekReportWorkflowGuard`; approve повторно запускает readiness.
- STALE сохраняется для аудита, исключается из plan/fact и учитывается readiness согласно настройке.
- История workflow хранит CREATE/COLLECT/MATCH/EXCLUDE/RESTORE/LINK/UNLINK/SUBMIT/RETURN/APPROVE/ARCHIVE.
- DTO источников и dashboard заполняются пакетными запросами и реальными агрегатами.

Оставшийся архитектурный gap: текущая привязка пользователя к компании для настроек ПЭК всё ещё использует существующее membership-хранилище документооборота. Выделение отдельной PEK membership-модели требует миграции существующих memberships и согласования поведения cross-company сотрудников; оно не выполнено скрытой несовместимой заменой.
