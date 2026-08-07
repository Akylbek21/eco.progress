# State machine создания документа

`LOCAL_DRAFT → CREATING_DOCUMENT → DOCUMENT_CREATED → REQUISITES_UPDATED → MAIN_FILE_UPLOADED → ATTACHMENTS_UPLOADED → ROUTE_CREATED → PREPARING_FOR_SIGNING → PREPARED_FOR_SIGNING → SENDING → SENT → COMPLETED`.

Checkpoint хранится под `document-flow:create-checkpoint:<userId>:<organizationId>` и содержит documentId, backendVersion, routeId, завершённый этап, загруженные attachments и стабильный idempotency key. После сбоя выполняется reconciliation: GET документа, проверка currentVersion, attachments и signing route. Уже завершённые операции не повторяются. После отправки GET обязан подтвердить `SENT_FOR_SIGNING`, `PARTIALLY_SIGNED` или `SIGNED`.

POST создания и подписи не имеют автоматического retry. Идентификаторы idempotency/clientRequest сохраняются до подтверждённого ответа.
