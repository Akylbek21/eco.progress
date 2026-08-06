# Подтверждённые backend gaps ПЭК

Проверено по контроллерам, DTO, enum и сервисам архива `eco-master (17).zip` от 06.08.2026. Здесь нет предположений о желаемых endpoint.

## Доступ и company scope

- `GET /api/auth/me` возвращает `UserResponse` без массива `permissions`. ПЭК защищён role-union выражениями `@PreAuthorize`, поэтому frontend вынужден использовать подтверждённую матрицу ролей, когда поле permissions отсутствует.
- `PekAccessService` не предоставляет пользователю список доступных компаний и не накладывает membership/company scope на списки программ и dashboard. Роль с `PEK_VIEW` фактически получает общий доступ, если другие слои не вводят ограничение.
- `ProgramResponse.availableActions` формируется только по статусу, без роли текущего пользователя. Frontend обязан пересекать его с controller permission. `ReportResponse.availableActions` уже role-aware.

## Отчёты

- Нет endpoint изменения заголовка отчёта и нет `PekReportUpdateRequest`.
- `CreateReportRequest` не содержит `responsibleUserId`; сотрудника нельзя явно назначить при создании согласно текущему контракту.
- Нет endpoint истории/audit отчёта. Причина возврата принимается командой `/return`, но отсутствует в `ReportResponse`, поэтому после перезагрузки показать её нельзя.
- Нет endpoint документов отчёта.
- Нет controller API для списка/карточки превышений, назначения ответственного и изменения их статуса. `plan-fact` возвращает только агрегированные `hasExceedance` и `exceedanceCount`.
- Нет controller API корректирующих мероприятий отчёта. `ReadinessSummary.overdueActions` сейчас всегда `0`.
- Нет отдельного API комментариев проверяющего.
- Список отчётов требует одновременно `companyId` и `objectId`; backend не принимает status/search/responsible/period filters.

## Источники и сопоставление

`ReportSourceItem` не возвращает данные, необходимые для полного UX ручного сопоставления:

- исходное название показателя протокола для несопоставленной строки;
- исходное значение и единицу;
- дату протокола;
- компанию и объект протокола;
- норматив исходного результата;
- место контроля;
- кандидатов и причины различий для `AMBIGUOUS`;
- автора и дату исключения.

Также `/sources` возвращает обычный список без pagination. Frontend показывает только реально доступные поля и не восстанавливает их из потенциального общего списка протоколов.

## План/факт

`PlanFactItem` не содержит:

- периодичность;
- номер и ID последнего протокола;
- дату последнего измерения;
- количество несопоставленных результатов по строке;
- ответственного.

Frontend не рассчитывает эти значения самостоятельно и показывает только контрактные поля.

## Dashboard и справочники

- `criticalIssueCount`, `openExceedanceCount`, `overdueActionCount`, `missingProtocolCount` жёстко возвращаются как `0`, хотя соответствующие dashboard-функции ещё не реализованы. DTO не содержит `NOT_AVAILABLE` или capability для этих KPI. Frontend в этой версии показывает `—` для таких нулей.
- `overdueRiskCount` фактически означает активные программы, срок которых заканчивается в ближайшие 30 дней, а не просроченные программы.
- `/lookups/objects/{objectId}/permits` всегда возвращает пустой список: сущность разрешений в backend отсутствует.
- Настройки возвращают `automaticCollectionSupported=false` и `notificationsSupported=false`; автоматический сбор backend отклоняет validation error.

## Что нужно добавить в backend для полного acceptance

1. Company-scoped capabilities/current-user DTO для ПЭК.
2. Расширенный `ReportSourceItem` и список кандидатов ambiguous match.
3. Report history, documents, comments и update API.
4. Exceedance и corrective-action controller API.
5. Расширенный plan/fact DTO.
6. Явный `available/null` contract для неподдерживаемых dashboard KPI.
7. Возможность выбрать ответственного в `CreateReportRequest`.

