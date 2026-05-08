# ECOPROGRESS GROUP

Онлайн-сервис ECOPROGRESS GROUP для экологической компании. Система должна закрывать полный путь клиента: клиент зашел на сайт, выбрал услугу, оставил лид или зарегистрировался, создал заявку, получил договор и счет, подписал документы, оплатил, отслеживал работу и получил итоговые документы в личном кабинете.

Этот README описывает бизнес-логику для реального backend, чтобы backend-разработчик мог понять домен, роли, сущности, статусы, API и основные сценарии.

## 1. Главная бизнес-цель

Сервис нужен, чтобы перевести экологические услуги из переписок и ручного учета в управляемый онлайн-процесс:

1. Клиент быстро понимает, какая экологическая услуга ему нужна.
2. Клиент может оставить заявку без регистрации или создать полноценную заявку в кабинете.
3. Сотрудник видит заявку в CRM и ведет ее по этапам.
4. Договор, счет, оплата, документы и комментарии хранятся в одной карточке заявки.
5. Клиент всегда видит текущий статус, что от него требуется и где скачать результат.
6. Руководитель и сотрудники видят загрузку, статусы, оплату, документы и историю действий.

## 2. Роли пользователей

### Клиент

Клиент может быть:

- физическое лицо;
- ИП;
- юридическое лицо / компания.

Клиент может:

- зарегистрироваться и войти в личный кабинет;
- создать заявку;
- прикрепить исходные документы;
- смотреть статусы заявки;
- читать комментарии сотрудника;
- писать комментарии по заявке;
- подписать договор;
- оплатить счет;
- скачать готовые документы;
- смотреть историю, документы, оплаты и уведомления.

### Менеджер

Менеджер принимает и ведет заявку.

Может:

- смотреть все заявки;
- назначать ответственных;
- менять общий статус заявки;
- писать сообщения клиенту;
- добавлять внутренние заметки;
- отправлять договор и счет;
- загружать документы;
- закрывать заявку после выполнения.

### Бухгалтер

Бухгалтер отвечает за финансовую часть.

Может:

- видеть заявки и клиентов;
- выставлять счет;
- менять статус оплаты;
- фиксировать частичную или полную оплату;
- прикреплять счет, акт, квитанцию;
- видеть финансовую историю заявки.

### Эколог

Эколог отвечает за экологические документы, отчеты, разрешения и заключения.

Может:

- видеть назначенные заявки;
- менять экологический статус;
- запрашивать дополнительные данные;
- загружать результатные документы;
- добавлять внутренние заметки.

### Лаборатория

Лаборатория отвечает за образцы, анализы и протоколы.

Может:

- видеть лабораторные заявки;
- менять лабораторный статус;
- фиксировать получение образцов;
- загружать протоколы и результаты анализов.

### Администратор

Администратор имеет полный доступ.

Может:

- управлять пользователями;
- управлять ролями и правами;
- управлять услугами, тарифами, новостями, сотрудниками и настройками сайта;
- видеть все заявки, документы, клиентов и историю.

## 3. Основные модули backend

Backend должен состоять минимум из таких доменных модулей:

- Auth: регистрация, вход, refresh token, logout, восстановление пароля.
- Users: пользователи, роли, права доступа.
- Clients: физлица, ИП, компании, реквизиты, контактные лица.
- Leads: быстрые заявки без регистрации.
- Services: услуги, категории, лендинги услуг, состав работ.
- Orders: полноценные заявки клиентов.
- Documents: загрузка, хранение, скачивание, типы документов.
- Comments: клиентские сообщения и внутренние заметки.
- Contracts: договоры, статусы подписи, файлы договора.
- Client contracts: долгосрочные договоры сопровождения с компаниями-клиентами на 2-3 года.
- Payments: счета, оплаты, частичные оплаты, квитанции, акты.
- Tasks / Assignments: назначение менеджера, бухгалтера, эколога, лаборатории.
- Notifications: уведомления для клиента и сотрудников.
- Audit log / History: история всех действий по заявке.
- Admin CMS: услуги, новости, сотрудники, FAQ, контакты, настройки сайта.
- Analytics events: отправка лидов, клики WhatsApp, формы, конверсии.

## 3.1. Компании-исполнители внутри ECOPROGRESS GROUP

В системе есть 4 внутренние компании-исполнителя. Это не компании клиентов, а бизнес-единицы группы, между которыми автоматически распределяются заявки.

Компании:

- `eco-docs` - `ECOPROGRESS Documents`: экологическое проектирование, разрешения, отчетность, сопровождение предприятий.
- `eco-lab` - `ECOPROGRESS Laboratory`: лабораторные исследования, замеры, протоколы, образцы.
- `eco-waste` - `ECOPROGRESS Waste`: сбор, вывоз, транспортировка, переработка и утилизация отходов.
- `eco-poligon` - `ECOPROGRESS Poligon`: прием, размещение и захоронение отходов на полигоне.

Каждая услуга должна иметь поле `business_company_id`. Когда клиент выбирает услугу и отправляет заявку, backend не должен просить сотрудника вручную искать нужную компанию. Backend сам определяет компанию-исполнителя по выбранной услуге и записывает ее в заявку.

Правило:

```text
service.business_company_id -> orders.business_company_id
```

Пример:

- клиент выбрал лабораторные исследования;
- услуга имеет `business_company_id = eco-lab`;
- backend создает заявку с `orders.business_company_id = eco-lab`;
- в CRM сотрудник нажимает `ECOPROGRESS Laboratory` и видит только заявки этой компании.

В CRM раздел `Заявки` должен поддерживать фильтр:

```http
GET /api/staff/orders?businessCompanyId=eco-lab
```

Также можно сделать прямой маршрут на frontend:

```text
/staff/orders/company/:businessCompanyId
```

Так сотрудник открывает заявки конкретной компании без поиска по общему списку.

## 4. Основные сущности базы данных

Названия таблиц примерные. Backend может адаптировать их под свою архитектуру.

### users

Пользователи системы.

Поля:

- `id`;
- `role`: `CLIENT`, `MANAGER`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`, `ADMIN`;
- `email`;
- `phone`;
- `password_hash`;
- `name`;
- `status`: `active`, `blocked`, `deleted`;
- `created_at`;
- `updated_at`;
- `last_login_at`.

### clients

Профиль клиента.

Поля:

- `id`;
- `user_id`;
- `type`: `individual`, `ip`, `company`;
- `name`;
- `city`;
- `phone`;
- `email`;
- `created_at`;
- `updated_at`.

### companies

Реквизиты компании или ИП.

Поля:

- `id`;
- `client_id`;
- `company_name`;
- `bin`;
- `organization_type`: `TOO`, `IP`, `AO`, `other`;
- `legal_address`;
- `actual_address`;
- `contact_person`;
- `contact_position`;
- `phone`;
- `email`;
- `created_at`;
- `updated_at`.

### leads

Быстрые заявки с публичного сайта без регистрации.

Поля:

- `id`;
- `name`;
- `phone`;
- `city`;
- `service_type`;
- `comment`;
- `source`: `hero_quick_form`, `free_document_check`, `homepage_lead_form`, `service_page`, `contacts_page`;
- `status`: `new`, `contacted`, `qualified`, `converted_to_order`, `closed`, `spam`;
- `assigned_manager_id`;
- `created_at`;
- `updated_at`;
- `converted_order_id`.

### service_categories

Категории услуг.

Поля:

- `id`;
- `title`;
- `slug`;
- `description`;
- `sort_order`;
- `is_active`.

### business_companies

Внутренние компании-исполнители ECOPROGRESS GROUP.

Поля:

- `id`;
- `name`;
- `short_name`;
- `description`;
- `is_active`;
- `created_at`;
- `updated_at`.

### services

Услуги компании.

Поля:

- `id`;
- `business_company_id`;
- `category_id`;
- `slug`;
- `title`;
- `short_description`;
- `description`;
- `for_whom`;
- `result`;
- `duration`;
- `base_price`;
- `is_active`;
- `sort_order`;
- `created_at`;
- `updated_at`.

### service_items

Конкретные работы внутри услуги, которые клиент может отметить при создании заявки.

Поля:

- `id`;
- `service_id`;
- `title`;
- `description`;
- `sort_order`;
- `is_active`.

### orders

Главная сущность заявки.

Поля:

- `id`;
- `order_number`: например `ORD-1001`;
- `business_company_id`;
- `client_id`;
- `company_id`;
- `client_type`: `individual`, `ip`, `company`;
- `contact_person`;
- `phone`;
- `email`;
- `city`;
- `service_id`;
- `service_title_snapshot`;
- `urgency`: `standard`, `urgent`, `not_urgent`;
- `comment`;
- `status`;
- `manager_id`;
- `accountant_id`;
- `ecologist_id`;
- `laboratory_id`;
- `contract_status`;
- `payment_status`;
- `ecology_status`;
- `laboratory_status`;
- `deadline_at`;
- `created_at`;
- `updated_at`;
- `completed_at`;
- `cancelled_at`.

### order_items

Выбранные работы внутри заявки.

Поля:

- `id`;
- `order_id`;
- `service_item_id`;
- `title_snapshot`;
- `created_at`.

### documents

Документы по заявкам.

Поля:

- `id`;
- `order_id`;
- `uploaded_by_user_id`;
- `type`: `client`, `result`, `invoice`, `contract`, `act`, `internal`;
- `name`;
- `file_url`;
- `file_size`;
- `mime_type`;
- `status`: `uploaded`, `accepted`, `rejected`, `waiting_signature`, `signed`, `ready`;
- `visibility`: `client`, `staff`, `internal`;
- `created_at`;
- `updated_at`.

### comments

Комментарии и сообщения в заявке.

Поля:

- `id`;
- `order_id`;
- `author_id`;
- `text`;
- `visibility`: `client`, `internal`;
- `created_at`;
- `updated_at`.

### contracts

Договоры по заявкам.

Поля:

- `id`;
- `order_id`;
- `contract_number`;
- `status`: `not_created`, `prepared`, `sent_to_client`, `waiting_signature`, `signed`, `rejected`, `cancelled`;
- `signature_provider`: `NCALayer`, `manual`, `other`;
- `document_id`;
- `signed_document_id`;
- `sent_at`;
- `signed_at`;
- `created_at`;
- `updated_at`.

### client_contracts

Долгосрочные договоры сопровождения между ECOPROGRESS GROUP и компанией-клиентом. Такой договор может действовать 2-3 года и покрывать несколько заявок по одному направлению или компании-исполнителю.

Поля:

- `id`;
- `client_id`;
- `company_id`;
- `business_company_id`;
- `number`;
- `title`;
- `started_at`;
- `ends_at`;
- `status`: `draft`, `active`, `expiring`, `expired`, `terminated`;
- `responsible_manager_id`;
- `created_at`;
- `updated_at`.

Backend должен отдавать количество дней до окончания договора:

```text
days_left = ends_at - current_date
```

Правила отображения:

- если `days_left > 90` - договор активен;
- если `0 <= days_left <= 90` - договор скоро истекает;
- если `days_left < 0` - договор истек.

Эти данные должны видеть обе стороны:

- клиент в личном кабинете и в данных компании;
- сотрудники в CRM, карточке клиента, карточке заявки и списке ближайших окончаний договоров.

Рекомендуемые endpoints:

```http
GET /api/client/contracts
GET /api/staff/client-contracts
GET /api/staff/client-contracts?companyId=:companyId
POST /api/staff/client-contracts
PATCH /api/staff/client-contracts/:id
```

Backend должен создавать уведомления:

- за 90 дней до окончания;
- за 30 дней до окончания;
- за 7 дней до окончания;
- в день окончания договора.

### invoices

Счета на оплату.

Поля:

- `id`;
- `order_id`;
- `invoice_number`;
- `amount`;
- `currency`: `KZT`;
- `status`: `draft`, `sent`, `pending`, `partial`, `paid`, `cancelled`, `overdue`;
- `payment_method`: `bank_card`, `bank_transfer`, `kaspi`, `manual`;
- `payment_url`;
- `document_id`;
- `due_at`;
- `paid_at`;
- `created_at`;
- `updated_at`.

### payments

Факты оплат.

Поля:

- `id`;
- `invoice_id`;
- `order_id`;
- `amount`;
- `currency`;
- `method`;
- `provider`;
- `provider_payment_id`;
- `status`: `pending`, `succeeded`, `failed`, `refunded`;
- `paid_at`;
- `created_at`.

### notifications

Уведомления.

Поля:

- `id`;
- `user_id`;
- `order_id`;
- `type`;
- `title`;
- `message`;
- `is_read`;
- `created_at`;
- `read_at`.

### order_history

История действий по заявке. Это обязательная сущность для прозрачности.

Поля:

- `id`;
- `order_id`;
- `actor_id`;
- `actor_role`;
- `action_type`;
- `old_value`;
- `new_value`;
- `comment`;
- `created_at`.

Примеры `action_type`:

- `order_created`;
- `status_changed`;
- `manager_assigned`;
- `client_message_added`;
- `internal_note_added`;
- `document_uploaded`;
- `contract_sent`;
- `contract_signed`;
- `invoice_sent`;
- `payment_changed`;
- `payment_succeeded`;
- `ecology_status_changed`;
- `laboratory_status_changed`;
- `order_completed`;
- `order_cancelled`.

## 5. Статусы заявки

### order.status

Основной статус заявки:

- `new` - новая заявка, еще не обработана;
- `in_review` - менеджер проверяет данные;
- `waiting_client_documents` - нужны документы или уточнение от клиента;
- `contract_pending` - готовится или отправлен договор;
- `payment_pending` - ожидается оплата;
- `in_work` - работа выполняется;
- `quality_check` - результат на внутренней проверке;
- `ready` - результат готов и доступен клиенту;
- `completed` - заявка полностью завершена;
- `cancelled` - заявка отменена.

На frontend эти статусы можно отображать по-русски:

- `new` -> `Новая`;
- `in_review` -> `В обработке`;
- `waiting_client_documents` -> `Ожидает документы`;
- `contract_pending` -> `Договор`;
- `payment_pending` -> `Ожидает оплату`;
- `in_work` -> `В работе`;
- `quality_check` -> `На проверке`;
- `ready` -> `Готово`;
- `completed` -> `Завершено`;
- `cancelled` -> `Отменено`.

### contract.status

- `not_created` - договор не создан;
- `prepared` - договор подготовлен;
- `sent_to_client` - договор отправлен клиенту;
- `waiting_signature` - ожидается подпись;
- `signed` - подписан;
- `rejected` - клиент отклонил;
- `cancelled` - договор отменен.

### invoice.status / payment_status

- `not_sent` - счет не выставлен;
- `pending` - счет выставлен, ожидается оплата;
- `partial` - частичная оплата;
- `paid` - оплачено;
- `cancelled` - счет отменен;
- `overdue` - срок оплаты прошел.

### ecology_status

- `not_started` - экологическая часть не начата;
- `in_progress` - эколог работает;
- `waiting_client_data` - нужны данные от клиента;
- `done` - экологическая часть готова.

### laboratory_status

- `not_assigned` - лаборатория не назначена;
- `waiting_samples` - ожидаются образцы;
- `samples_received` - образцы получены;
- `analysis_in_progress` - анализ выполняется;
- `result_ready` - результат готов.

## 6. Полный сценарий клиента

### Шаг 1. Клиент заходит на сайт

Клиент открывает `/` и видит:

- описание экологических услуг;
- быстрый выбор направления;
- кнопки консультации, заявки и WhatsApp;
- список услуг;
- блок "как это работает";
- формы заявки без регистрации.

Backend на этом шаге нужен для:

- отдачи списка услуг;
- отдачи публичного контента;
- приема лидов;
- записи аналитических событий.

### Шаг 2. Клиент оставляет быстрый лид без регистрации

Клиент заполняет форму:

- имя;
- телефон / WhatsApp;
- город;
- нужная услуга;
- комментарий.

Backend должен:

1. Создать запись в `leads`.
2. Присвоить статус `new`.
3. Зафиксировать источник формы.
4. Назначить менеджера автоматически или оставить без назначения.
5. Создать уведомление менеджеру.
6. Вернуть frontend сообщение об успешной отправке.

Endpoint:

```http
POST /api/leads
```

Тело:

```json
{
  "name": "Иван",
  "phone": "+7 777 000 00 00",
  "city": "Астана",
  "serviceType": "Экологические документы",
  "comment": "Нужна консультация по отчетности",
  "source": "homepage_lead_form"
}
```

### Шаг 3. Клиент регистрируется

Клиент выбирает тип:

- физическое лицо;
- ИП;
- компания.

Backend должен:

1. Проверить уникальность email и телефона.
2. Создать `users` с ролью `CLIENT`.
3. Создать `clients`.
4. Для ИП/компании создать `companies`.
5. Вернуть access token, refresh token и профиль клиента.

Endpoint:

```http
POST /api/auth/register
```

### Шаг 4. Клиент входит

Backend должен:

1. Проверить email и пароль.
2. Вернуть токены.
3. Вернуть профиль, роль и права.
4. Записать `last_login_at`.

Endpoint:

```http
POST /api/auth/login
```

### Шаг 5. Клиент создает полноценную заявку

Клиент в `/cabinet/orders/new` указывает:

- тип клиента;
- услугу;
- выбранные работы внутри услуги;
- контактное лицо;
- телефон;
- WhatsApp;
- email;
- компанию;
- БИН/ИИН;
- город;
- срочность;
- комментарий;
- файлы.

Backend должен:

1. Создать `orders` со статусом `new`.
2. Создать `order_items` для выбранных работ.
3. Сохранить файлы в `documents` с типом `client`.
4. Автоматически назначить менеджера, если есть правило назначения.
5. Создать запись в `order_history`: `order_created`.
6. Создать уведомление менеджеру.
7. Вернуть созданную заявку.

Endpoint:

```http
POST /api/orders
```

Тело может быть `multipart/form-data`, если сразу загружаются файлы.

### Шаг 6. Клиент отслеживает заявку

Клиент видит:

- статус;
- текущий этап;
- комментарии сотрудника;
- документы;
- договор;
- счет;
- оплату;
- историю.

Endpoint:

```http
GET /api/client/orders
GET /api/client/orders/:id
```

Важно: клиент должен видеть только свои заявки.

### Шаг 7. Клиент загружает документы

Клиент может добавить файл в заявку, если менеджер запросил данные.

Backend должен:

1. Проверить, что заявка принадлежит клиенту.
2. Сохранить файл.
3. Создать `documents` с типом `client`.
4. Добавить историю `document_uploaded`.
5. Уведомить менеджера.

Endpoint:

```http
POST /api/client/orders/:id/documents
```

### Шаг 8. Клиент пишет комментарий

Backend должен:

1. Проверить доступ клиента к заявке.
2. Создать комментарий с `visibility = client`.
3. Добавить историю `client_message_added`.
4. Уведомить ответственного сотрудника.

Endpoint:

```http
POST /api/client/orders/:id/comments
```

### Шаг 9. Клиент подписывает договор

Когда сотрудник отправил договор, клиент видит кнопку подписи.

Backend должен:

1. Проверить, что договор в статусе `sent_to_client` или `waiting_signature`.
2. Выполнить интеграцию с ЭЦП-провайдером или принять результат подписи.
3. Сохранить подписанный файл.
4. Обновить `contracts.status = signed`.
5. Обновить `orders.contract_status = signed`.
6. Добавить историю `contract_signed`.
7. Уведомить менеджера и бухгалтера.

Endpoint:

```http
POST /api/client/orders/:id/contract/sign
```

### Шаг 10. Клиент оплачивает счет

Когда счет выставлен, клиент видит кнопку оплаты.

Backend должен:

1. Создать платежную сессию у платежного провайдера.
2. Вернуть frontend ссылку на оплату.
3. Принять webhook от платежного провайдера.
4. Обновить `payments`.
5. Обновить `invoices.status`.
6. Обновить `orders.payment_status`.
7. Добавить историю `payment_succeeded`.
8. Уведомить бухгалтера и менеджера.

Endpoints:

```http
POST /api/client/orders/:id/payments/init
POST /api/webhooks/payments
```

## 7. Полный сценарий сотрудника

### Шаг 1. Сотрудник входит в CRM

Endpoint:

```http
POST /api/auth/staff/login
```

Backend возвращает:

- пользователя;
- роль;
- права;
- токены;
- рабочую статистику.

### Шаг 2. Сотрудник видит рабочий дашборд

CRM должна показывать:

- новые заявки;
- заявки в работе;
- заявки, где нужна оплата;
- заявки, где нужны документы от клиента;
- задачи эколога;
- задачи лаборатории;
- последние действия;
- уведомления.

Endpoint:

```http
GET /api/staff/dashboard
```

### Шаг 3. Менеджер открывает заявку

Endpoint:

```http
GET /api/staff/orders/:id
```

Backend возвращает полную карточку:

- данные клиента;
- компания;
- услуга;
- выбранные работы;
- статусы;
- ответственные;
- договор;
- счет;
- оплаты;
- документы;
- комментарии;
- внутренние заметки;
- история.

### Шаг 4. Менеджер назначает ответственных

Endpoint:

```http
PATCH /api/staff/orders/:id/assignments
```

Пример:

```json
{
  "managerId": "user-1",
  "accountantId": "user-2",
  "ecologistId": "user-3",
  "laboratoryId": "user-4"
}
```

Backend должен:

1. Проверить право `edit_order`.
2. Обновить ответственных.
3. Записать историю `manager_assigned` или `assignment_changed`.
4. Уведомить назначенных сотрудников.

### Шаг 5. Менеджер меняет статус заявки

Endpoint:

```http
PATCH /api/staff/orders/:id/status
```

Пример:

```json
{
  "status": "waiting_client_documents",
  "comment": "Нужно загрузить схему площадки и список отходов"
}
```

Backend должен:

1. Проверить допустимость перехода статуса.
2. Обновить `orders.status`.
3. Добавить историю `status_changed`.
4. Если статус требует действия клиента, создать уведомление клиенту.

### Шаг 6. Менеджер отправляет комментарий клиенту

Endpoint:

```http
POST /api/staff/orders/:id/comments
```

Тело:

```json
{
  "text": "Пожалуйста, загрузите реквизиты компании и схему объекта",
  "visibility": "client"
}
```

Если `visibility = client`, клиент видит комментарий.

Если `visibility = internal`, комментарий видят только сотрудники.

### Шаг 7. Сотрудник отправляет договор и счет

Endpoint:

```http
POST /api/staff/orders/:id/contract-and-invoice
```

Тело:

```json
{
  "amount": 150000,
  "currency": "KZT",
  "paymentMethod": "bank_card",
  "signatureProvider": "NCALayer",
  "contractDocumentId": "doc-1",
  "invoiceDocumentId": "doc-2"
}
```

Backend должен:

1. Создать или обновить `contracts`.
2. Создать `invoices`.
3. Привязать документы договора и счета.
4. Поставить `contract.status = sent_to_client`.
5. Поставить `invoice.status = pending`.
6. Поставить `orders.contract_status = sent_to_client`.
7. Поставить `orders.payment_status = pending`.
8. Добавить историю `contract_sent` и `invoice_sent`.
9. Уведомить клиента.

### Шаг 8. Бухгалтер меняет оплату вручную

Endpoint:

```http
PATCH /api/staff/orders/:id/payment-status
```

Тело:

```json
{
  "status": "partial",
  "amount": 75000,
  "comment": "Получена предоплата 50%",
  "invoiceNumber": "INV-2026-001",
  "actNumber": "ACT-2026-001"
}
```

Backend должен:

1. Проверить право `edit_payment`.
2. Обновить счет и оплату.
3. Добавить историю `payment_changed`.
4. Уведомить менеджера и клиента, если нужно.

### Шаг 9. Эколог ведет свою часть

Endpoint:

```http
PATCH /api/staff/orders/:id/ecology-status
```

Тело:

```json
{
  "status": "waiting_client_data",
  "comment": "Нужны исходные данные по выбросам"
}
```

Backend должен:

1. Проверить право `edit_ecology`.
2. Обновить `orders.ecology_status`.
3. Добавить историю `ecology_status_changed`.
4. Если нужны данные клиента, создать уведомление клиенту.

### Шаг 10. Лаборатория ведет свою часть

Endpoint:

```http
PATCH /api/staff/orders/:id/laboratory-status
```

Тело:

```json
{
  "status": "analysis_in_progress",
  "comment": "Образцы получены, анализ начат"
}
```

Backend должен:

1. Проверить право `edit_laboratory`.
2. Обновить `orders.laboratory_status`.
3. Добавить историю `laboratory_status_changed`.
4. Уведомить менеджера при готовности результата.

### Шаг 11. Сотрудник загружает результат

Endpoint:

```http
POST /api/staff/orders/:id/documents
```

Документ может быть:

- результатный экологический документ;
- протокол лаборатории;
- акт;
- внутренний файл;
- финальный архив.

Backend должен:

1. Сохранить файл.
2. Создать `documents`.
3. Определить видимость документа.
4. Добавить историю `document_uploaded` или `document_ready`.
5. Если документ виден клиенту, отправить уведомление клиенту.

### Шаг 12. Заявка завершается

Когда все работы выполнены:

1. Все обязательные документы загружены.
2. Договор подписан или отмечен как не требуется.
3. Оплата получена или отмечено другое условие.
4. Менеджер меняет статус на `ready` или `completed`.
5. Клиент получает уведомление.
6. Заявка остается в истории клиента и CRM.

Endpoint:

```http
PATCH /api/staff/orders/:id/status
```

Тело:

```json
{
  "status": "completed",
  "comment": "Работа завершена, документы доступны клиенту"
}
```

## 8. Правила переходов статусов

Backend должен контролировать переходы, чтобы не было хаоса в CRM.

Рекомендуемый путь:

```text
new
-> in_review
-> waiting_client_documents
-> in_review
-> contract_pending
-> payment_pending
-> in_work
-> quality_check
-> ready
-> completed
```

Допустимые быстрые переходы:

- `new -> cancelled`;
- `in_review -> cancelled`;
- `waiting_client_documents -> cancelled`;
- `ready -> completed`;
- любой активный статус -> `cancelled`, если есть право `edit_order`.

Нельзя без специального права:

- переводить `completed` обратно в работу;
- удалять заявку;
- менять оплату без роли бухгалтера или администратора;
- менять лабораторный статус без роли лаборатории или администратора;
- менять экологический статус без роли эколога или администратора.

## 9. Права доступа

Минимальный набор permission:

- `view_orders`;
- `create_order`;
- `edit_order`;
- `delete_orders`;
- `view_companies`;
- `view_documents`;
- `edit_documents`;
- `view_payment`;
- `edit_payment`;
- `view_ecology`;
- `edit_ecology`;
- `view_laboratory`;
- `edit_laboratory`;
- `view_messages`;
- `send_messages`;
- `view_internal_notes`;
- `add_internal_notes`;
- `view_action_history`;
- `manage_employees`;
- `manage_roles`;
- `manage_settings`;
- `manage_content`.

Роли:

- `CLIENT` - только свои данные, свои заявки и свои документы.
- `MANAGER` - заявки, клиенты, сообщения, документы, статусы.
- `ACCOUNTANT` - финансовые поля, счета, оплаты, акты.
- `ECOLOGIST` - экологические задачи и документы.
- `LABORATORY` - лабораторные задачи и протоколы.
- `ADMIN` - полный доступ.

## 10. API для frontend

### Public

```http
GET /api/public/services
GET /api/public/services/:slug
GET /api/public/service-categories
GET /api/public/tariffs
GET /api/public/news
GET /api/public/news/:slug
GET /api/public/employees
GET /api/public/faq
GET /api/public/settings
POST /api/leads
POST /api/analytics/events
```

### Auth

```http
POST /api/auth/register
POST /api/auth/login
POST /api/auth/staff/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET /api/auth/me
```

### Client cabinet

```http
GET /api/client/profile
PATCH /api/client/profile
GET /api/client/orders
POST /api/client/orders
GET /api/client/orders/:id
POST /api/client/orders/:id/documents
POST /api/client/orders/:id/comments
POST /api/client/orders/:id/contract/sign
POST /api/client/orders/:id/payments/init
GET /api/client/documents
GET /api/client/payments
GET /api/client/notifications
PATCH /api/client/notifications/:id/read
```

### Staff CRM

```http
GET /api/staff/dashboard
GET /api/staff/orders
GET /api/staff/orders/:id
PATCH /api/staff/orders/:id/status
PATCH /api/staff/orders/:id/assignments
POST /api/staff/orders/:id/comments
POST /api/staff/orders/:id/documents
POST /api/staff/orders/:id/contract-and-invoice
PATCH /api/staff/orders/:id/contract-status
PATCH /api/staff/orders/:id/payment-status
PATCH /api/staff/orders/:id/ecology-status
PATCH /api/staff/orders/:id/laboratory-status
GET /api/staff/clients
GET /api/staff/clients/:id
GET /api/staff/documents
GET /api/staff/notifications
PATCH /api/staff/notifications/:id/read
```

### Admin

```http
GET /api/admin/users
POST /api/admin/users
PATCH /api/admin/users/:id
GET /api/admin/roles
PATCH /api/admin/roles/:id/permissions
GET /api/admin/services
POST /api/admin/services
PATCH /api/admin/services/:id
DELETE /api/admin/services/:id
GET /api/admin/news
POST /api/admin/news
PATCH /api/admin/news/:id
DELETE /api/admin/news/:id
GET /api/admin/settings
PATCH /api/admin/settings
```

### Webhooks

```http
POST /api/webhooks/payments
POST /api/webhooks/signature
```

## 11. Ответ карточки заявки

Frontend удобнее получать карточку заявки одним агрегированным ответом.

Пример:

```json
{
  "id": "order-id",
  "orderNumber": "ORD-1001",
  "status": "in_work",
  "client": {
    "id": "client-id",
    "type": "company",
    "name": "ТОО Клиент Eco",
    "contactPerson": "Иван Иванов",
    "phone": "+7 777 000 00 00",
    "email": "client@example.com"
  },
  "service": {
    "id": "service-id",
    "title": "Экологическая отчетность"
  },
  "items": [
    {
      "id": "item-id",
      "title": "Подготовка отчета"
    }
  ],
  "contract": {
    "status": "sent_to_client",
    "documentId": "doc-contract"
  },
  "invoice": {
    "status": "pending",
    "amount": 150000,
    "currency": "KZT",
    "paymentUrl": "https://pay.example/invoice/123"
  },
  "statuses": {
    "payment": "pending",
    "ecology": "in_progress",
    "laboratory": "not_assigned"
  },
  "assignees": {
    "manager": { "id": "user-1", "name": "Менеджер" },
    "accountant": { "id": "user-2", "name": "Бухгалтер" },
    "ecologist": { "id": "user-3", "name": "Эколог" },
    "laboratory": { "id": "user-4", "name": "Лаборатория" }
  },
  "documents": [],
  "comments": [],
  "history": []
}
```

## 12. Уведомления

Backend должен создавать уведомления при событиях:

- создан лид;
- создана заявка;
- клиент загрузил документ;
- клиент написал комментарий;
- сотрудник запросил документы;
- сотрудник отправил договор;
- сотрудник выставил счет;
- клиент подписал договор;
- клиент оплатил счет;
- эколог запросил данные;
- лаборатория загрузила результат;
- готов итоговый документ;
- заявка завершена.

Каналы уведомлений:

- внутри сайта;
- email;
- WhatsApp / SMS в будущем.

На первом этапе достаточно внутренних уведомлений и email-заглушки.

## 13. Файлы и документы

Файлы должны храниться не в базе, а в объектном хранилище или файловом storage.

Backend хранит в `documents` только metadata:

- имя;
- URL;
- размер;
- MIME type;
- тип документа;
- видимость;
- кто загрузил;
- дата загрузки.

Правила доступа:

- клиент видит только документы своих заявок с `visibility = client`;
- сотрудники видят документы по правам;
- внутренние документы клиенту не возвращаются;
- результатные документы становятся видны клиенту только после готовности или ручной публикации.

## 14. Безопасность

Backend должен реализовать:

- хеширование паролей;
- JWT access token + refresh token;
- RBAC по ролям и permissions;
- проверку владельца заявки для клиента;
- проверку MIME type и размера файлов;
- антивирусную проверку файлов, если возможно;
- rate limit для публичных форм;
- защиту от спама в лидах;
- audit log для всех важных действий;
- запрет удаления заявок без admin-доступа.

## 15. Интеграции

Минимальные реальные интеграции:

- email-сервис для уведомлений;
- платежный провайдер;
- ЭЦП / NCALayer или другой провайдер подписи;
- файловое хранилище.

Будущие интеграции:

- WhatsApp Business API;
- SMS;
- 1C / бухгалтерия;
- CRM-аналитика;
- карты / 2GIS;
- госинтеграции, если потребуется для экологических документов.

## 16. Что frontend уже ожидает

Текущий frontend уже имеет маршруты:

Публичный сайт:

- `/`;
- `/about`;
- `/services`;
- `/services/:id`;
- `/services/ecological-documents`;
- `/services/waste-transportation`;
- `/services/waste-recycling`;
- `/services/laboratory-tests`;
- `/services/poligon-tbo`;
- `/services/environmental-audit`;
- `/tariffs`;
- `/employees`;
- `/news`;
- `/news/:id`;
- `/faq`;
- `/contacts`.

Клиент:

- `/register`;
- `/login`;
- `/cabinet`;
- `/cabinet/orders`;
- `/cabinet/orders/new`;
- `/cabinet/orders/:id`;
- `/cabinet/documents`;
- `/cabinet/payments`;
- `/cabinet/company`;
- `/cabinet/notifications`.

Сотрудник:

- `/staff/login`;
- `/staff`;
- `/staff/orders`;
- `/staff/orders/:id`;
- `/staff/clients`;
- `/staff/clients/:companyKey`;
- `/staff/documents`;
- `/staff/documents/:orderId`;
- `/staff/notifications`;
- `/staff/profile`.

Админ:

- `/admin`.

## 17. Текущая mock-реализация frontend

Пока backend не подключен, frontend использует:

- `src/data/mockData.ts` - исходные данные;
- `localStorage` - хранение сессии, лидов и заявок;
- `src/services/authService.ts` - mock-авторизация;
- `src/services/leadService.ts` - mock-лиды;
- `src/services/orderService.ts` - mock-заявки, договор, оплата, документы;
- `src/services/staffOrderService.ts` - действия CRM сотрудника.

Ключи `localStorage`:

- `eco-progress-token`;
- `eco-progress-user`;
- `eco-progress-orders`;
- `eco-progress-leads`.

При подключении реального backend эти сервисы нужно заменить на HTTP-клиент к `/api`.

## 18. Запуск frontend

```bash
npm install
npm run dev
npm run build
```
