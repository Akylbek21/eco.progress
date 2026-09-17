# ПЭК backend security report

## Подтверждённые меры

- Spring Security защищает `/api/**`; операции ПЭК дополнительно используют `PekSecurityExpressions`.
- Resource IDs проверяются через report/source association; source ID из другого отчёта не принимается.
- Source и report mutations используют optimistic version и 409 conflict.
- Evidence закрытого отчёта защищена общим `PekReportWorkflowGuard` во всех найденных ручных mutation paths.
- STALE evidence хранится для аудита, но исключается из бизнес-расчётов независимо от legacy `excluded` flag.
- Protocol link delete проверяет принадлежность link указанному protocol и запрещает физическое удаление автоматической связи.

## Риски, требующие исправления

- `PekAccessService` пока проверяет согласованность company/object, но не membership текущего пользователя: известный ID компании остаётся потенциальным IDOR для ролей с глобальным `PEK_VIEW`.
- `PekSettingsService` использует `OrganizationResolver` и `DocumentFlowMembershipRepository`; это ошибочная межмодульная зависимость.
- Не все read/list/dashboard endpoints применяют отдельный подтверждённый company scope.
- Отсутствует единая history таблица для всех workflow и evidence mutations.
- Source DTO выполняет точечные repository lookups и требует batch/projection решения для устранения N+1.

До устранения этих пунктов security acceptance criterion по company isolation нельзя считать подтверждённым.
# Результат повторной проверки

Мутации источников и связей протоколов разрешены только для `DRAFT`, `COLLECTING`, `RETURNED`; для закрытого отчёта возвращается conflict с кодом `PEK_REPORT_NOT_EDITABLE`. Eligibility протокола централизована. Роль `LABORATORY` получает `edit/collect/matchSources` только для редактируемого отчёта и не получает `submitReview/approve/archive`.

Известный gap: отдельная таблица PEK company membership пока отсутствует; settings используют существующее membership-хранилище. Это явно оставлено в отчёте, а не замаскировано ролью или фиктивным company scope.
