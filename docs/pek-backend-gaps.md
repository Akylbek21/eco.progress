# Backend gaps ПЭК

Проверено по Java-коду commit `a78d98e` (последний backend snapshot перед удалением из репозитория), 11.08.2026. Это не список предположений по README.

## P0 — безопасность и целостность

1. Нет модели и endpoint lifecycle превышений. Невозможно серверно проверить роль при переходе в `CLOSED`, принадлежность evidence отчёту, обязательную причину возврата или историю переходов.
2. Нет endpoint документов отчёта, version DTO, `reportVersion`, `isCurrent`, `signable` и SHA-256 актуальной версии. Fail-closed подписание реализовать невозможно; frontend не должен угадывать актуальность по дате.
3. Нет endpoint CMS/ЭЦП, списка подписей и скачивания signature file. Серверная защита от IDOR для `signatureFileId` отсутствует как контракт.
4. Backend enum не содержит `SIGNED`. Сервер не может обеспечить read-only после подписи и переход `SIGNED -> ARCHIVED`.
5. `ReportResponse` не содержит resource-level прав (`availableActions`, `allowedTransitions`, `canEdit`, `canSubmit`, `canApprove`, `canSign`, `canArchive`). Frontend обязан fail closed для неподтверждённых report actions.
6. Нет подтверждённого серверного запрета изменения связей/данных для `SIGNED` (статус отсутствует). UI-скрытие не является защитой.

## P1 — целостность процесса

1. Нет API превышений, корректирующих мероприятий, evidence и истории.
2. Нет endpoint plan/fact и readiness; нельзя подтвердить серверный пересчёт после collector/reconciliation.
3. Нет API ручного связывания протокола с отчётом и повторной проверки `pekLinks`/`reportProtocolSources`.
4. `ReportResponse` не содержит `returnInfo`; controller не содержит return report endpoint. Причина возврата не переживёт reload.
5. Нет истории отчёта.
6. Нет API настроек ПЭК и явного company scope настроек.
7. Нет API управления `pek_company_memberships`. Frontend не должен сохранять назначения локально.

## Frontend risk reduction

- защищённые Blob скачиваются только через общий Axios client;
- отсутствующие document/sign/exceedance endpoints не подменяются mock или локальным success;
- resource actions имеют приоритет над role fallback;
- после поддерживаемых workflow/source mutations выполняется повторный GET;
- при 403 показывается сообщение об отсутствии доступа к компании/операции;
- 409/412 не приводят к автоматической перезаписи серверного состояния;
- данные предыдущей компании не используются как placeholder новой company query.
