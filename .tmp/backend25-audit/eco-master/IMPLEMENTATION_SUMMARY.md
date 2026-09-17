# Реализация двусторонней связи между протоколами и ПЭК

## Обзор

Реализована полная двусторонняя связь между разделами "Протоколы" и "ПЭК" (производственный экологический контроль) в проекте EcoProgress.

## Измененные файлы

### 1. Миграция БД

**V73__pek_protocol_order_context.sql**
- Добавлены колонки `order_id` (VARCHAR(32)) и `order_service_item_id` (VARCHAR(64)) в таблицу `pek_report_protocol_sources`
- Добавлены индексы для поиска по orderId и контексту заказа
- Следует pattern из Protocol.orderId/orderServiceItemId (мягкие ссылки без FK)

### 2. Entity (JPA)

**PekReportProtocolSource.java**
- Добавлены поля `orderId` и `orderServiceItemId`
- Добавлены getters/setters
- Документация с комментариями об отсутствии FK

### 3. DTO

**PekApiDtos.java**
- **Новые DTO:**
  - `ProtocolPekContextRequest` - контекст ПЭК для создания черновика протокола
  - `CreateProtocolPekLinkRequest` - полный запрос на создание связи с контекстом (протокол → ПЭК)
  - `UpdateProtocolPekLinkRequest` - обновление связи с поддержкой версионирования

- **Расширенные DTO:**
  - `ProtocolLinkResponse` - добавлены orderId, orderServiceItemId, createdAt
  - `CreateProtocolDraftRequest` - добавлено поле pekContext

### 4. Repository

**PekReportProtocolSourceRepository.java**
- Добавлены новые методы поиска:
  - `findByReportIdOrderByCreatedAtAsc(Long reportId)`
  - `findByProgramIdOrderByCreatedAtAsc(Long programId)` - поиск по программе
  - `findByControlItemIdOrderByCreatedAtAsc(Long controlItemId)` - поиск по контрольной позиции

### 5. Service

**PekProtocolLinkService.java**
- **Новые методы:**
  - `createFromPekContext()` - создание связи с полным контекстом ПЭК из протокола
  - `update()` - обновление существующей связи с optimistic locking
  - `listByProgram()` - получить протоколы по программе ПЭК
  - `listByReport()` - получить протоколы по отчету ПЭК
  - `listByControlItem()` - получить протоколы по контрольной позиции

- **Valидация:**
  - Проверка editability протокола (не ARCHIVED/REPLACED/CANCELLED)
  - Проверка company scope - протокол и сущности ПЭК должны быть одной компании
  - Проверка связи сущностей ПЭК (отчет ↔ программа, контрольный элемент ↔ программа)
  - Проверка консистентности контекста заказа (orderServiceItemId требует orderId)
  - Проверка версии при обновлении (optimistic locking)

- **Идемпотентность:**
  - Повторный запрос с тем же reportId + protocolId возвращает существующую связь
  - clientLinkId для future-использования в клиентской идемпотентности

**ProtocolService.java**
- Расширен метод `doCreateDraft()` для обработки `pekContext` из запроса
- При создании черновика вызывается `pekProtocolLinkService.createFromPekContext()` если контекст ПЭК передан
- Ошибки при сохранении контекста ПЭК логируются, но не блокируют создание протокола

### 6. Controller

**ProtocolController.java**
- **Новые endpoints:**
  - `POST /api/protocols/{id}/pek-links` - создание связи
  - `PUT /api/protocols/{id}/pek-links/{linkId}` - обновление связи

- **Существующие endpoints (расширены):**
  - `GET /api/protocols/{id}/pek-links` - получить все связи протокола
  - `DELETE /api/protocols/{id}/pek-links/{linkId}` - удаление связи

**PekController.java**
- **Новые endpoints (двустороннее чтение):**
  - `GET /api/pek/programs/{programId}/protocols` - протоколы для программы
  - `GET /api/pek/reports/{reportId}/protocols` - протоколы для отчета
  - `GET /api/pek/control-items/{controlItemId}/protocols` - протоколы для контрольной позиции

## API Контракты

### Создание связи из контекста ПЭК (в протоколе)

```http
POST /api/protocols/{protocolId}/pek-links
Content-Type: application/json

{
  "pekProgramId": 5,
  "pekReportId": 8,
  "pekControlItemId": 44,
  "pekControlEventId": null,
  "monitoringPointId": 12,
  "emissionSourceId": null,
  "waterOutletId": 3,
  "orderId": "order-123",
  "orderServiceItemId": "service-item-456",
  "clientLinkId": "pek-event-71"
}

Response: 200 OK
{
  "success": true,
  "data": {
    "id": 15,
    "protocolId": 120,
    "reportId": 8,
    "programId": 5,
    "controlItemId": 44,
    "controlEventId": null,
    "monitoringPointId": 12,
    "emissionSourceId": null,
    "waterOutletId": 3,
    "orderId": "order-123",
    "orderServiceItemId": "service-item-456",
    "matchType": "MANUAL",
    "matchStatus": "MATCHED",
    "createdAt": "2026-08-07T12:00:00",
    "version": 0
  },
  "message": "Связь ПЭК создана"
}
```

### Обновление связи

```http
PUT /api/protocols/{protocolId}/pek-links/{linkId}
Content-Type: application/json

{
  "pekControlItemId": 45,
  "pekControlEventId": null,
  "monitoringPointId": 13,
  "emissionSourceId": null,
  "waterOutletId": 3,
  "orderId": "order-456",
  "orderServiceItemId": "service-item-789",
  "version": 0
}

Response: 200 OK
{...}
```

### Создание черновика с контекстом ПЭК

```http
POST /api/protocols/drafts
Content-Type: application/json

{
  "templateId": "water_test",
  "companyId": 10,
  "orderId": "order-123",
  "orderServiceItemId": "service-item-456",
  "pekContext": {
    "pekProgramId": 5,
    "pekReportId": 8,
    "pekControlItemId": 44,
    "pekControlEventId": 71,
    "monitoringPointId": 12,
    "emissionSourceId": null,
    "waterOutletId": 3,
    "clientLinkId": "pek-event-71"
  }
}

Response: 201 Created
{
  "success": true,
  "data": {...protocol data...},
  "message": "Черновик создан"
}
```

### Чтение протоколов по ПЭК контексту

```http
GET /api/pek/programs/{programId}/protocols
GET /api/pek/reports/{reportId}/protocols
GET /api/pek/control-items/{controlItemId}/protocols

Response: 200 OK
{
  "success": true,
  "data": [
    {
      "id": 15,
      "protocolId": 120,
      "reportId": 8,
      "programId": 5,
      "controlItemId": 44,
      ...
      "orderId": "order-123",
      "orderServiceItemId": "service-item-456",
      "createdAt": "2026-08-07T12:00:00",
      "version": 0
    }
  ]
}
```

## Коды ошибок

- **PEK_CONTEXT_EMPTY** - не указан ни один идентификатор ПЭК
- **PROTOCOL_NOT_FOUND** - протокол не найден
- **PEK_PROGRAM_NOT_FOUND** - программа ПЭК не найдена
- **PEK_REPORT_NOT_FOUND** - отчет ПЭК не найден
- **PEK_CONTROL_ITEM_NOT_FOUND** - контрольная позиция не найдена
- **PEK_COMPANY_SCOPE_MISMATCH** - протокол и ПЭК сущность разных компаний
- **PEK_REPORT_PROGRAM_MISMATCH** - отчет не принадлежит программе
- **PEK_CONTROL_ITEM_PROGRAM_MISMATCH** - контрольная позиция не принадлежит программе
- **PROTOCOL_NOT_EDITABLE** - протокол завершен (ARCHIVED/REPLACED/CANCELLED)
- **VERSION_CONFLICT** - конфликт версии при обновлении
- **ORDER_CONTEXT_INVALID** - orderServiceItemId без orderId
- **PEK_LINK_NOT_FOUND** - связь не найдена

## Валидация

### На уровне DTO
- Все поля optional (кроме version при обновлении)
- clientLinkId для future-use клиентской идемпотентности

### На уровне сервиса (серверная валидация)
1. **Существование сущностей:**
   - Протокол существует и принадлежит текущему пользователю
   - Программа, отчет, контрольный элемент существуют

2. **Consistency:**
   - Если указан контрольный элемент - он принадлежит программе
   - Если указан отчет и программа - отчет принадлежит программе
   - Если отчет не указан, а программа указана - программа ID берется из сущности

3. **Company scope:**
   - Протокол и все сущности ПЭК должны быть одной компании
   - Компания ID не принимается от frontend, берется из entity

4. **Status:**
   - Протокол не должен быть ARCHIVED/REPLACED/CANCELLED
   - Статус DRAFT/CALCULATED/APPROVED/SIGNED - приемлем

5. **Order context:**
   - orderServiceItemId может быть указан только вместе с orderId
   - Оба поля optional, но их связь проверяется

6. **Optimistic locking:**
   - При обновлении версия должна совпадать с текущей версией записи в БД
   - Конфликт версии -> 409 Conflict

## Архитектурные решения

### 1. Выбор таблицы-связи
**Решение:** Расширение существующей `pek_report_protocol_sources` вместо создания новой таблицы.

**Обоснование:**
- Таблица уже содержит все необходимые PEK поля
- Добавляет только 2 новых колонки (orderId, orderServiceItemId)
- Избегает дублирования и путаницы между несколькими таблицами связей
- Единая таблица для всех типов связей protocol ↔ PEK

### 2. Идемпотентность
**Решение:** Проверка перед insert + уникальный индекс на (report_id, protocol_id, protocol_result_key)

**Обоснование:**
- Существующий механизм V56 уже обеспечивает DB-level защиту от дублей
- Для целевого use case (создание из протокола без reportId) используется check перед insert
- clientLinkId зарезервирован для future использования, если потребуется более сложная идемпотентность

### 3. Валидация компаний
**Решение:** Company ID не принимается от frontend, берется только из entities

**Обоснование:**
- Безопасность: нельзя допустить cross-tenant нарушения
- Консистентность: protocol и PEK сущности должны быть одной компании
- Проверяется на уровне сервиса, не надеясь на frontend

### 4. Оптимистичная блокировка
**Решение:** Версия передается в request, проверяется при update

**Обоснование:**
- Следует pattern оптимистичной блокировки в проекте (как в Protocol)
- Безопасность при параллельных изменениях
- Version управляется Hibernate @Version

### 5. Двустороннее чтение
**Решение:** Отдельные endpoints в PekController для поиска протоколов по программе/отчету/контрольному элементу

**Обоснование:**
- Следует RESTful архитектуре
- Позволяет frontend отображать связанные протоколы на странице ПЭК
- Пересечение с методами list по протоколам (реверс)

## Обратная совместимость

✅ **Сохранена:**
- Существующие endpoints для чтения и удаления связей
- quick-create и createDraft без PEK контекста работают как раньше
- Protocol без ПЭК связей остаются поддерживаемыми
- Документооборот и workflow статусов не изменились
- Flyway миграция добавляет только новые колонки (backward compatible)

❌ **Потенциальные breaking changes:**
- ProtocolLinkResponse теперь содержит orderId, orderServiceItemId, createdAt (новые поля в response)
- Frontend может не передавать эти поля при использовании старого кода
- Поля optional в request, но обязательны в response (требует обновления клиента)

## Тестирование

**Созданы интеграционные тесты:**
- `PekProtocolLinkIntegrationTest.java`

**Покрытие:**
1. ✅ Создание связи с полным контекстом ПЭК
2. ✅ Идемпотентность создания
3. ✅ Обновление связи с версионированием
4. ✅ Конфликт версии
5. ✅ Чтение по программе
6. ✅ Чтение по отчету
7. ✅ Чтение по контрольной позиции
8. ✅ Валидация пустого контекста
9. ✅ Валидация company scope mismatch
10. ✅ Удаление связи

**Требуемые тесты (предложены):**
- Создание черновика с PEK контекстом (требует полной интеграции ProtocolService)
- Двусторонний workflow: программа → протокол → отчет
- N+1 тест (убедиться что queries оптимальны)
- Параллельные запросы на создание одной связи

## Оставшиеся задачи

1. **Интеграция с план/фактом ПЭК** (задача 8)
   - Подписанный протокол должен учитываться в фактическом выполнении
   - Требуется добавить logic в `PekPlanFactService`
   - Статусы: DRAFT → не учитывается, APPROVED/SIGNED → учитывается

2. **Аудит действий** (задача 10)
   - Добавить запись в audit log при создании/обновлении/удалении связей
   - Использовать `PekReportWorkflowHistory`

3. **Проверка permissions** 
   - Добавить @PreAuthorize в new endpoints если требуется
   - Соответствие PekSecurityExpressions и SecurityExpressions

4. **Front-end интеграция**
   - Обновление клиента для передачи pekContext при создании черновика
   - Обновление ProtocolLinkResponse parsing
   - Интеграция double-чтения (программа показывает связанные протоколы)

## Строительные блоки реализованы ✅

- [x] Миграция БД (V73)
- [x] Entity PekReportProtocolSource расширена
- [x] DTO для создания/обновления
- [x] Repository методы
- [x] Service методы (create, update, list)
- [x] Controller endpoints (create, update, delete)
- [x] Двустороннее чтение endpoints
- [x] Валидация и error handling
- [x] Optimistic locking
- [x] Интеграционные тесты
- [x] Документация API

## Следующие шаги

1. Запустить тесты: `mvn test -Dtest=PekProtocolLinkIntegrationTest`
2. Запустить full build: `mvn clean install`
3. Развернуть миграцию БД (V73)
4. Обновить frontend для использования new endpoints
5. Добавить integration с план/фактом
6. Добавить аудит действий
