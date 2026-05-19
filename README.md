# ECOPROGRESS GROUP Backend Specification

Этот документ полностью описывает backend-логику сервиса ECOPROGRESS GROUP. Его цель - дать backend-разработчику понятное ТЗ: какие сущности нужны, какие роли есть в системе, как создается заявка, как работает CRM, как вести разовые и годовые договоры, как считать квартальные оплаты, долги, документы, уведомления и историю действий.

Frontend сейчас работает на mock-данных в `src/data/mockData.ts` и сервисах `src/services/*`. Реальный backend должен заменить эти mock-сервисы API без изменения бизнес-смысла.

## 1. Назначение системы

ECOPROGRESS GROUP оказывает экологические услуги для бизнеса:

- экологическое проектирование;
- разрешительные документы;
- лабораторные исследования;
- вывоз отходов;
- утилизация отходов;
- полигон ТБО;
- сопровождение проверок;
- долгосрочное экологическое сопровождение по годовому договору.

Система должна закрывать полный путь клиента:

1. Клиент заходит на сайт.
2. Выбирает услугу или оставляет быстрый лид.
3. Регистрируется или создает заявку в кабинете.
4. Сотрудник принимает заявку в CRM.
5. Менеджер готовит КП, договор и счет.
6. Клиент подписывает договор и оплачивает счет.
7. Эколог, лаборатория или подразделение по отходам выполняет работу.
8. Клиент получает документы и результат в кабинете.
9. Вся история, документы, оплаты, долги и комментарии остаются в карточке заявки.

Для годового договора заявка остается активной весь год и делится на 4 квартала. Клиент и сотрудник должны видеть вкладки:

- `1 квартал`
- `2 квартал`
- `3 квартал`
- `4 квартал`

При нажатии на квартал открываются данные именно этого квартала: период, этап работ, счет, оплата, долг, документы, результаты и комментарии.

## 2. Роли и доступы

### CLIENT

Клиент видит только свои данные:

- свои заявки;
- свои договоры;
- свои документы;
- свои оплаты и задолженности;
- комментарии с видимостью `client`;
- уведомления для клиента.

Клиент может:

- зарегистрироваться;
- создать заявку;
- загрузить исходные документы;
- написать комментарий по заявке;
- подписать договор;
- оплатить счет;
- загрузить данные по конкретному кварталу годового договора;
- скачать готовые документы и результаты.

Клиент не может:

- видеть внутренние заметки сотрудников;
- видеть чужие заявки;
- менять CRM-статусы;
- удалять заявки;
- менять суммы, счета, долги и финансовые статусы.

### MANAGER

Менеджер ведет заявку:

- видит заявки своей компании-исполнителя или все разрешенные заявки;
- назначает ответственных;
- меняет общий статус заявки;
- отправляет клиенту договор и счет, если имеет финансовый доступ или работает вместе с бухгалтером;
- пишет клиенту;
- добавляет внутренние заметки;
- загружает документы;
- ведет годовую заявку по кварталам;
- завершает заявку при выполнении условий.

### ACCOUNTANT

Бухгалтер отвечает за деньги:

- видит финансовые данные;
- создает счет;
- меняет сумму договора/счета;
- фиксирует оплату;
- фиксирует частичную оплату;
- закрывает долг;
- ведет квартальные оплаты;
- видит платежные транзакции;
- видит просрочки и активные долги.

### ECOLOGIST

Эколог отвечает за экологические работы:

- видит назначенные экологические заявки;
- меняет экологический статус;
- запрашивает данные клиента;
- загружает экологические документы и результаты;
- добавляет внутренние заметки;
- ведет кварталы, где `work_stage = project`.

### LABORATORY

Лаборатория отвечает за анализы:

- видит лабораторные заявки;
- фиксирует получение образцов;
- меняет лабораторный статус;
- загружает протоколы;
- ведет кварталы, где `work_stage = laboratory`.

### ADMIN

Администратор имеет полный доступ:

- пользователи;
- роли;
- услуги;
- заявки;
- договоры;
- платежи;
- долги;
- документы;
- настройки сайта;
- аудит.

## 3. Компании-исполнители

В системе есть внутренние компании ECOPROGRESS GROUP. Это не клиенты, а подразделения, которые выполняют работу.

Пример:

- `eco-docs` - экологические документы;
- `eco-lab` - лаборатория;
- `eco-waste` - вывоз и утилизация отходов;
- `eco-poligon` - полигон ТБО.

Каждая услуга должна иметь поле `business_company_id`. При создании заявки backend автоматически определяет компанию-исполнителя по выбранной услуге.

Правило:

```text
service.business_company_id -> orders.business_company_id
```

Frontend и CRM используют это поле для фильтрации заявок по подразделениям.

## 4. Основные backend-модули

Backend должен быть разделен на доменные модули:

- Auth
- Users
- Clients
- Business companies
- Services
- Leads
- Orders
- Annual request quarters
- Contracts
- Client contracts
- Payments
- Debts
- Documents
- Comments
- Notifications
- Audit log
- Admin settings

Рекомендуемый стек:

- PostgreSQL как основная БД;
- S3/MinIO/cloud storage для файлов;
- Redis для refresh/session/queues, если нужен;
- очередь задач для email/SMS/WhatsApp уведомлений;
- REST API для frontend;
- JWT access token + refresh token;
- RBAC через роли и permissions.

## 5. Статусы заявки

Основной workflow заявки:

```text
Консультация
Анализ заявки
КП
Договор
Счет на оплату
Проектирование / Лаборатория / Вывоз / Утилизация
Проверка результата
Готово
Завершено
Отменено
annual_active
```

`annual_active` - специальный статус для годовой заявки. Такая заявка не закрывается после первого результата. Она активна весь срок договора и содержит 4 квартала.

### Нормализация старых статусов

Если в миграции попадут старые статусы:

- `new`
- `in_review`
- `waiting_client_documents`
- `contract_pending`
- `payment_pending`
- `in_work`
- `quality_check`
- `ready`
- `completed`
- `cancelled`

backend должен нормализовать их при чтении:

```text
new -> Консультация
in_review -> Анализ заявки
contract_pending -> Договор
payment_pending -> Счет на оплату
in_work -> рабочий этап по услуге
quality_check -> Проверка результата
ready -> Готово
completed -> Завершено
cancelled -> Отменено
```

Если `contract_type = annual_quarterly` и заявка не завершена/не отменена, статус должен быть `annual_active`.

## 6. Типы договоров

### one_time

Разовый договор:

- одна заявка;
- один договор;
- один счет или несколько платежей по одному счету;
- после выполнения результата заявка закрывается.

### annual_quarterly

Годовой договор:

- одна активная заявка на год;
- 4 квартала;
- каждый квартал имеет свой период, счет, сумму, оплату, долг, документы, результат, комментарии;
- заявка закрывается только после завершения всех 4 кварталов.

## 7. Главные сущности БД

Ниже логическая схема. Названия можно адаптировать под ORM, но смысл полей должен сохраниться.

### users

```sql
id uuid primary key
email varchar unique not null
phone varchar
password_hash varchar not null
name varchar not null
role varchar not null -- CLIENT, MANAGER, ADMIN, ACCOUNTANT, ECOLOGIST, LABORATORY
status varchar not null -- active, blocked, invited
created_at timestamptz not null
updated_at timestamptz not null
last_login_at timestamptz
```

### clients

```sql
id uuid primary key
user_id uuid references users(id)
client_type varchar not null -- individual, company
company_name varchar
bin_iin varchar
legal_address text
actual_address text
contact_person varchar
phone varchar
email varchar
created_at timestamptz not null
updated_at timestamptz not null
```

### business_companies

```sql
id varchar primary key
name varchar not null
description text
phone varchar
email varchar
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

### services

```sql
id varchar primary key
business_company_id varchar references business_companies(id)
category varchar not null
name varchar not null
slug varchar unique not null
description text
base_price numeric
duration_days int
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

### leads

Быстрая заявка без регистрации.

```sql
id uuid primary key
name varchar not null
phone varchar not null
email varchar
company_name varchar
service_id varchar references services(id)
message text
source varchar
status varchar not null -- new, contacted, in_progress, closed
assigned_manager_id uuid references users(id)
created_at timestamptz not null
updated_at timestamptz not null
```

### orders

Главная карточка заявки.

```sql
id uuid primary key
order_number varchar unique not null
client_id uuid references clients(id)
created_by_user_id uuid references users(id)
business_company_id varchar references business_companies(id)
service_id varchar references services(id)
service_name varchar not null
contact_person varchar
phone varchar
city varchar
object_address text
comment text
urgency varchar
status varchar not null
contract_type varchar not null default 'one_time' -- one_time, annual_quarterly
contract_id uuid
annual_period_start date
annual_period_end date
payment_status varchar -- not_sent, pending, partial, paid
payment_amount numeric
payment_method varchar
contract_status varchar -- not_sent, sent, signed
crm_contract_status varchar -- not_created, prepared, sent_to_client, waiting_signature, signed, rejected
signature_provider varchar
signed_at timestamptz
manager_id uuid references users(id)
accountant_id uuid references users(id)
ecologist_id uuid references users(id)
laboratory_user_id uuid references users(id)
ecology_status varchar -- not_started, in_progress, waiting_client_data, done
laboratory_status varchar -- not_assigned, waiting_samples, samples_received, analysis_in_progress, result_ready
deadline date
completed_at timestamptz
cancelled_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
```

### order_quarters

Рабочее состояние кварталов годовой заявки.

```sql
id uuid primary key
order_id uuid references orders(id) on delete cascade
contract_id uuid
quarter smallint not null -- 1, 2, 3, 4
quarter_label varchar not null -- 1 квартал
period_start date not null
period_end date not null
service_name varchar not null
work_stage varchar not null -- Проектирование, Лаборатория, Вывоз, Утилизация
work_status varchar not null -- planned, waiting_client_data, ready_to_start, in_progress, completed, waiting_payment, blocked_by_debt
payment_status varchar not null -- unpaid, partial, paid, overdue
planned_amount numeric not null default 0
paid_amount numeric not null default 0
remaining_amount numeric not null default 0
invoice_number varchar
invoice_date date
due_date date
last_payment_date date
responsible_employee_id uuid references users(id)
responsible_employee_name varchar
started_at timestamptz
completed_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
unique(order_id, quarter)
```

### contracts

Договор по заявке или годовой договор.

```sql
id uuid primary key
order_id uuid references orders(id)
client_id uuid references clients(id)
business_company_id varchar references business_companies(id)
contract_number varchar unique not null
contract_type varchar not null -- one_time, annual_quarterly
status varchar not null -- draft, active, completed, terminated
crm_status varchar not null -- not_created, prepared, sent_to_client, waiting_signature, signed, rejected
starts_at date
ends_at date
total_amount numeric not null default 0
paid_amount numeric not null default 0
remaining_amount numeric not null default 0
signature_provider varchar
signed_at timestamptz
responsible_manager_id uuid references users(id)
created_at timestamptz not null
updated_at timestamptz not null
```

### contract_quarters

Финансовый график годового договора. Это источник правды для денег по кварталам.

```sql
id uuid primary key
contract_id uuid references contracts(id) on delete cascade
order_id uuid references orders(id)
quarter smallint not null
quarter_label varchar not null
period_start date not null
period_end date not null
service_name varchar not null
work_stage varchar not null
planned_amount numeric not null
paid_amount numeric not null default 0
remaining_amount numeric not null
payment_status varchar not null -- unpaid, partial, paid, overdue
invoice_number varchar
invoice_date date
due_date date
work_status varchar not null default 'planned'
comment text
last_payment_date date
completed_at timestamptz
created_at timestamptz not null
updated_at timestamptz not null
unique(contract_id, quarter)
```

### payments

Разовые счета и платежные записи.

```sql
id uuid primary key
order_id uuid references orders(id)
contract_id uuid references contracts(id)
invoice_number varchar
service_name varchar
total_amount numeric not null
paid_amount numeric not null default 0
remaining_amount numeric not null
payment_status varchar not null -- unpaid, partial, paid, overdue
payment_method varchar -- bank_transfer, cash, card, other
invoice_date date
due_date date
last_payment_date date
comment text
created_at timestamptz not null
updated_at timestamptz not null
```

### payment_transactions

История фактических оплат.

```sql
id uuid primary key
payment_id uuid references payments(id)
contract_id uuid references contracts(id)
contract_quarter_id uuid references contract_quarters(id)
order_quarter_id uuid references order_quarters(id)
amount numeric not null
method varchar not null -- bank_transfer, cash, card, other
paid_at date not null
comment text
created_by_user_id uuid references users(id)
created_by_name varchar
created_at timestamptz not null
```

### debts

Активные долги. Для квартального договора должен быть максимум один активный долг на один квартал.

```sql
id uuid primary key
order_id uuid references orders(id)
contract_id uuid references contracts(id)
contract_quarter_id uuid references contract_quarters(id)
order_quarter_id uuid references order_quarters(id)
invoice_number varchar
quarter_label varchar
amount numeric not null
paid_amount numeric not null default 0
remaining_amount numeric not null
status varchar not null -- active, partial, closed, overdue
reason varchar not null -- quarter_payment, invoice_unpaid, partial_payment, overdue_payment
due_date date
comment text
created_at timestamptz not null
updated_at timestamptz not null
closed_at timestamptz
```

Уникальность для активного долга:

```text
contract_id + contract_quarter_id
```

Если `contract_quarter_id` нет, использовать:

```text
contract_id + invoice_number
```

### documents

Общие документы заявки.

```sql
id uuid primary key
order_id uuid references orders(id)
contract_id uuid references contracts(id)
uploaded_by_user_id uuid references users(id)
uploaded_by_role varchar
name varchar not null
file_name varchar not null
file_url text not null
mime_type varchar
file_size bigint
type varchar not null -- client, result, invoice, contract, act, internal
visibility varchar not null -- client, staff, internal
status varchar
created_at timestamptz not null
updated_at timestamptz not null
```

### quarter_documents

Документы конкретного квартала.

```sql
id uuid primary key
order_id uuid references orders(id)
order_quarter_id uuid references order_quarters(id)
contract_id uuid references contracts(id)
contract_quarter_id uuid references contract_quarters(id)
uploaded_by_user_id uuid references users(id)
uploaded_by_role varchar -- client, manager, accountant, ecologist, laboratory, admin
uploaded_by_name varchar
name varchar not null
file_name varchar not null
file_url text not null
mime_type varchar
file_size bigint
document_type varchar not null -- client_data, invoice, act, protocol, report, result, other
visibility varchar not null -- client, staff, internal
created_at timestamptz not null
```

### quarter_results

Результат работы по кварталу.

```sql
id uuid primary key
order_id uuid references orders(id)
order_quarter_id uuid references order_quarters(id)
contract_id uuid references contracts(id)
title varchar not null
description text
result_type varchar -- project_document, laboratory_protocol, waste_removal_act, utilization_act, other
created_by_user_id uuid references users(id)
created_by_name varchar
created_at timestamptz not null
```

### comments

Комментарии по заявке.

```sql
id uuid primary key
order_id uuid references orders(id)
order_quarter_id uuid references order_quarters(id)
author_user_id uuid references users(id)
author_name varchar not null
author_role varchar not null
text text not null
visibility varchar not null -- client, internal
created_at timestamptz not null
```

Если `order_quarter_id` заполнен, комментарий относится к конкретному кварталу.

### notifications

```sql
id uuid primary key
user_id uuid references users(id)
role varchar -- CLIENT, MANAGER, ACCOUNTANT, ECOLOGIST, LABORATORY, ADMIN, ALL
order_id uuid references orders(id)
title varchar not null
message text not null
type varchar -- info, success, warning, error
is_read boolean not null default false
created_at timestamptz not null
```

### audit_log

Любое важное действие должно попадать в аудит.

```sql
id uuid primary key
entity_type varchar not null -- order, contract, payment, debt, document, user
entity_id uuid not null
order_id uuid
actor_user_id uuid references users(id)
actor_role varchar
action_type varchar not null
old_value jsonb
new_value jsonb
comment text
created_at timestamptz not null
```

## 8. Создание заявки

### Входные данные

Клиент отправляет:

- `service_id`
- `contact_person`
- `phone`
- `city`
- `object_address`
- `comment`
- `urgency`
- `files[]`
- `contract_type`, если выбирает годовое обслуживание

### Backend-логика

1. Проверить авторизацию клиента.
2. Найти услугу.
3. Определить `business_company_id` из услуги.
4. Создать `orders`.
5. Если есть файлы - сохранить в storage и создать `documents`.
6. Если `contract_type = one_time`:
   - статус `Консультация` или первый рабочий статус по настройке;
   - `payment_status = not_sent`;
   - кварталы не создаются.
7. Если `contract_type = annual_quarterly`:
   - статус `annual_active`;
   - создать `contracts`;
   - создать 4 записи `contract_quarters`;
   - создать 4 записи `order_quarters`;
   - синхронизировать суммы из `contract_quarters` в `order_quarters`.
8. Добавить запись в `audit_log`.
9. Создать уведомление менеджеру.
10. Вернуть агрегированную карточку заявки.

## 9. Автоматическое создание 4 кварталов

Если годовой договор начинается `2026-01-01`, календарные кварталы:

```text
1 квартал: 2026-01-01 - 2026-03-31
2 квартал: 2026-04-01 - 2026-06-30
3 квартал: 2026-07-01 - 2026-09-30
4 квартал: 2026-10-01 - 2026-12-31
```

Если договор начинается не с 1 января, можно использовать договорные кварталы:

```text
1 квартал: start + 0 months -> start + 3 months - 1 day
2 квартал: start + 3 months -> start + 6 months - 1 day
3 квартал: start + 6 months -> start + 9 months - 1 day
4 квартал: start + 9 months -> end
```

Backend должен поддерживать поле:

```text
quarter_schedule_type = calendar_quarters | contract_quarters
```

На frontend всегда отдавать массив из 4 кварталов, отсортированный по `quarter`.

## 10. Правила квартальной заявки

Каждый квартал должен открываться отдельно.

Frontend ожидает:

```json
{
  "quarters": [
    { "quarter": 1, "quarterLabel": "1 квартал" },
    { "quarter": 2, "quarterLabel": "2 квартал" },
    { "quarter": 3, "quarterLabel": "3 квартал" },
    { "quarter": 4, "quarterLabel": "4 квартал" }
  ]
}
```

Правила:

- backend всегда возвращает все 4 квартала для годовой заявки;
- 4 квартал не должен быть единственным открытым кварталом;
- при запросе конкретного квартала backend возвращает данные только этого квартала;
- документы квартала не смешиваются с документами другой заявки или другого квартала;
- платежи квартала не смешиваются с разовыми платежами;
- результат квартала прикрепляется к выбранному кварталу;
- комментарий квартала прикрепляется к выбранному кварталу.

## 11. Статусы квартала

`work_status`:

```text
planned              -- запланирован
waiting_client_data  -- нужны данные от клиента
waiting_payment      -- ждем оплату
ready_to_start       -- готов к старту
in_progress          -- в работе
blocked_by_debt      -- заблокирован долгом
completed            -- выполнен
```

Правила:

- если квартал просрочен по оплате и остаток больше 0, статус может стать `blocked_by_debt`;
- сотрудник может поставить `waiting_client_data`, `in_progress`, `completed`;
- бухгалтер может менять финансовые поля;
- клиент может только загрузить документы и написать комментарий;
- завершенный квартал не закрывает всю годовую заявку автоматически.

## 12. Расчет оплаты

### Универсальная формула

```text
remaining_amount = max(planned_amount - paid_amount, 0)
```

### Статус оплаты

```text
paid     -- paid_amount >= planned_amount
partial  -- paid_amount > 0 и paid_amount < planned_amount
overdue  -- remaining_amount > 0 и due_date < today
unpaid   -- paid_amount = 0 и срок не просрочен
```

Порядок проверки:

1. Если оплачено полностью -> `paid`.
2. Иначе если срок оплаты прошел -> `overdue`.
3. Иначе если есть частичная оплата -> `partial`.
4. Иначе -> `unpaid`.

## 13. Квартальные платежи

Когда бухгалтер добавляет оплату за квартал:

1. Найти `contract_quarters.id`.
2. Создать `payment_transactions`.
3. Увеличить `contract_quarters.paid_amount`.
4. Пересчитать `contract_quarters.remaining_amount`.
5. Пересчитать `contract_quarters.payment_status`.
6. Синхронизировать соответствующий `order_quarters`.
7. Пересчитать `contracts.paid_amount` и `contracts.remaining_amount`.
8. Пересчитать/закрыть долг в `debts`.
9. Добавить `audit_log`.
10. Уведомить клиента, если оплата принята.

Важно:

- финансовый источник правды для годового договора - `contract_quarters`;
- `order_quarters` хранит рабочее состояние и копию финансовых полей для удобного ответа карточки;
- синхронизация должна быть атомарной в транзакции БД.

## 14. Долги

Долг создается, если:

- счет не оплачен;
- квартал оплачен частично;
- срок оплаты прошел;
- вручную создан долг бухгалтером.

Для годового договора:

- один квартал = максимум один активный долг;
- долг привязан к `contract_quarter_id`;
- при полной оплате долг закрывается;
- при частичной оплате долг обновляется.

Статусы долга:

```text
active
partial
overdue
closed
```

Нельзя показывать клиенту чужие долги.

## 15. Завершение годовой заявки

Годовую заявку можно закрыть только если:

1. Есть 4 квартала.
2. Все кварталы имеют `work_status = completed`.
3. У каждого квартала есть хотя бы один результат.
4. Все `remaining_amount <= 0`.
5. Нет активных долгов по договору.

Если условия выполнены:

```text
orders.status = Завершено
contracts.status = completed
orders.completed_at = now()
```

Если условия не выполнены, backend должен вернуть понятную ошибку:

```json
{
  "error": "annual_request_not_ready",
  "message": "Нельзя завершить годовую заявку: есть незавершенные кварталы или долги",
  "details": {
    "unfinishedQuarters": [2, 3],
    "quartersWithoutResults": [3],
    "debtAmount": 150000
  }
}
```

## 16. Документы

Типы общих документов:

```text
client
result
invoice
contract
act
internal
```

Типы документов квартала:

```text
client_data
invoice
act
protocol
report
result
other
```

Правила:

- клиент видит только документы с `visibility = client`;
- внутренние документы видит только staff;
- файл хранится в storage, в БД хранится metadata;
- удаление файла должно быть soft-delete или через статус;
- скачивание идет через signed URL или backend proxy;
- каждый upload должен попасть в `audit_log`.

## 17. Комментарии

Комментарии бывают:

- `client` - видны клиенту и сотрудникам;
- `internal` - видны только сотрудникам.

Комментарии могут быть:

- по заявке целиком;
- по конкретному кварталу.

При добавлении клиентского комментария backend создает уведомление сотруднику. При ответе сотрудника с `visibility = client` backend создает уведомление клиенту.

## 18. Договор и подпись

CRM-статусы договора:

```text
not_created
prepared
sent_to_client
waiting_signature
signed
rejected
```

Поток:

1. Менеджер или бухгалтер создает договор.
2. Backend сохраняет файл договора.
3. Статус становится `prepared`.
4. Сотрудник отправляет договор клиенту.
5. Статус становится `sent_to_client`.
6. Клиент подписывает через выбранный провайдер.
7. Backend проверяет подпись или сохраняет факт подписи.
8. Статус становится `signed`.
9. `orders.contract_status = signed`.
10. Создается запись истории.

Провайдеры подписи:

- `NCALayer / ЭЦП`;
- `Kaspi ID`;
- `SMS-подтверждение`;
- ручная загрузка подписанного договора.

## 19. API: Auth

### POST /api/auth/register

Создать клиента.

Request:

```json
{
  "name": "Иван",
  "email": "client@example.com",
  "phone": "+77000000000",
  "password": "secret",
  "clientType": "company",
  "companyName": "ТОО Green Market",
  "binIin": "123456789012"
}
```

Response:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "role": "CLIENT",
    "name": "Иван"
  }
}
```

### POST /api/auth/login

### POST /api/auth/refresh

### POST /api/auth/logout

### GET /api/auth/me

## 20. API: Leads

### POST /api/leads

Публичная быстрая заявка.

### GET /api/staff/leads

Только staff.

### PATCH /api/staff/leads/:id

Изменить статус или назначить менеджера.

## 21. API: Orders client

### GET /api/client/orders

Возвращает только заявки текущего клиента.

### POST /api/client/orders

Создать заявку.

### GET /api/client/orders/:id

Вернуть агрегированную карточку заявки.

### POST /api/client/orders/:id/comments

Добавить клиентский комментарий.

### POST /api/client/orders/:id/documents

Загрузить общий документ клиента.

### POST /api/client/orders/:id/contract/sign

Подписать договор.

### POST /api/client/orders/:id/pay

Онлайн-оплата разового счета.

### GET /api/client/payments

Оплаты клиента: разовые и квартальные.

### GET /api/client/debts

Открытые долги клиента.

## 22. API: Annual quarters client

### GET /api/client/orders/:orderId/quarters

Вернуть 4 квартала годовой заявки.

### GET /api/client/orders/:orderId/quarters/:quarterId

Вернуть данные выбранного квартала.

### POST /api/client/orders/:orderId/quarters/:quarterId/documents

Клиент загружает данные именно в выбранный квартал.

### POST /api/client/orders/:orderId/quarters/:quarterId/comments

Клиент пишет комментарий по выбранному кварталу.

## 23. API: Orders staff

### GET /api/staff/orders

Фильтры:

```text
q
businessCompanyId
status
paymentStatus
contractType
quarter
managerId
stage
dateFrom
dateTo
onlyMyTasks
```

### GET /api/staff/orders/:id

Агрегированная карточка заявки.

### PATCH /api/staff/orders/:id/status

Сменить статус заявки.

### PATCH /api/staff/orders/:id/assign

Назначить ответственного.

### POST /api/staff/orders/:id/comments

Комментарий клиенту или внутренняя заметка.

### POST /api/staff/orders/:id/documents

Загрузить документ.

### POST /api/staff/orders/:id/contract-and-invoice

Отправить договор и счет.

### PATCH /api/staff/orders/:id/contract-status

Изменить статус договора.

## 24. API: Annual quarters staff

### PATCH /api/staff/orders/:orderId/quarters/:quarterId/work-status

Request:

```json
{
  "workStatus": "in_progress",
  "comment": "Начали работу по 1 кварталу"
}
```

### POST /api/staff/orders/:orderId/quarters/:quarterId/documents

Загрузить документ квартала.

### POST /api/staff/orders/:orderId/quarters/:quarterId/results

Добавить результат квартала.

### POST /api/staff/orders/:orderId/quarters/:quarterId/comments

Добавить комментарий квартала.

### POST /api/staff/orders/:orderId/quarters/:quarterId/payments

Добавить оплату квартала. Только `ACCOUNTANT` или `ADMIN`.

### POST /api/staff/orders/:orderId/complete-annual

Попытка завершить годовую заявку.

## 25. API: Payments

### GET /api/staff/payments

Возвращает:

- разовые счета;
- квартальные счета;
- долги;
- транзакции.

Фильтры:

```text
type=all|one_time|quarterly|debts
contractType=one_time|annual_quarterly
quarter=1|2|3|4
status=paid|partial|unpaid|overdue
businessCompanyId
clientId
dateFrom
dateTo
q
```

### POST /api/staff/payments/:paymentId/partial

Добавить частичную оплату разового счета.

### POST /api/staff/payments/:paymentId/mark-paid

Закрыть разовый счет полной оплатой.

### PATCH /api/staff/payments/:paymentId

Изменить детали счета.

### POST /api/staff/contracts/:contractId/quarters/:quarterId/payments

Добавить квартальную оплату.

### POST /api/staff/contracts/:contractId/quarters/:quarterId/mark-paid

Полностью оплатить квартал.

### PATCH /api/staff/contracts/:contractId/quarters/:quarterId

Изменить срок, комментарий, рабочий статус квартала.

## 26. API: Debts

### GET /api/staff/debts

### PATCH /api/staff/debts/:id/comment

### POST /api/staff/debts/:id/close

Закрытие долга должно синхронизировать оплату квартала, если долг квартальный.

## 27. Агрегированный ответ карточки заявки

Frontend удобнее получать один объект.

```json
{
  "id": "ORD-2001",
  "status": "annual_active",
  "contractType": "annual_quarterly",
  "businessCompanyId": "eco-docs",
  "service": "Годовое экологическое сопровождение",
  "client": {
    "id": "uuid",
    "companyName": "ТОО Green Market",
    "contactPerson": "Алия"
  },
  "contract": {
    "id": "uuid",
    "number": "EPG-GM-2026-Q",
    "status": "active",
    "crmStatus": "signed",
    "startsAt": "2026-01-01",
    "endsAt": "2026-12-31"
  },
  "quarters": [
    {
      "id": "uuid",
      "quarter": 1,
      "quarterLabel": "1 квартал",
      "periodStart": "2026-01-01",
      "periodEnd": "2026-03-31",
      "workStage": "Проектирование",
      "workStatus": "completed",
      "paymentStatus": "paid",
      "plannedAmount": 300000,
      "paidAmount": 300000,
      "remainingAmount": 0,
      "documents": [],
      "results": [],
      "comments": []
    }
  ],
  "documents": [],
  "resultDocuments": [],
  "comments": [],
  "history": []
}
```

Для клиента backend должен удалить или скрыть:

- внутренние комментарии;
- внутренние документы;
- финансовые поля, если они не должны показываться роли;
- чужие заявки.

## 28. RBAC и безопасность

Все endpoint должны проверять:

1. Пользователь авторизован.
2. Роль имеет доступ к действию.
3. Пользователь имеет доступ к конкретной записи.
4. Клиент является владельцем заявки.
5. Staff имеет доступ по роли/подразделению/назначению.

Запрещено:

- доверять `client_id` из request body;
- давать клиенту менять status/payment/debt;
- отдавать внутренние заметки клиенту;
- скачивать чужие файлы;
- закрывать годовую заявку без проверок;
- создавать второй активный долг для того же квартала.

## 29. Валидация

Общие правила:

- `quarter` только 1, 2, 3, 4;
- годовая заявка всегда имеет 4 квартала;
- сумма оплаты не может быть меньше или равна 0;
- сумма оплаты не должна превышать остаток, кроме ручной корректировки админом;
- дата окончания договора должна быть позже даты начала;
- `due_date` должен попадать в разумный период договора;
- файл должен иметь разрешенный mime type и лимит размера;
- комментарий не может быть пустым;
- статус должен быть из enum.

## 30. Уведомления

Создавать уведомления:

- создана новая заявка;
- клиент загрузил документ;
- сотрудник запросил данные;
- договор отправлен клиенту;
- договор подписан;
- счет выставлен;
- оплата получена;
- есть просрочка;
- квартал начался;
- квартал скоро заканчивается;
- результат загружен;
- заявка завершена.

Каналы:

- in-app;
- email;
- SMS/WhatsApp, если подключено.

## 31. Audit log

Писать в `audit_log`:

- создание заявки;
- смену статуса;
- назначение ответственного;
- загрузку документа;
- удаление/архивирование документа;
- отправку договора;
- подпись договора;
- создание счета;
- оплату;
- частичную оплату;
- закрытие долга;
- изменение квартала;
- завершение заявки;
- отмену заявки.

Audit log не должен удаляться обычными пользователями.

## 32. Транзакции БД

В одной транзакции должны выполняться:

- создание годовой заявки + договор + 4 квартала;
- добавление квартальной оплаты + пересчет квартала + пересчет договора + долг + audit;
- закрытие долга + платеж + пересчет квартала;
- завершение годовой заявки;
- отправка договора и счета.

Если один шаг падает, вся операция откатывается.

## 33. Индексы

Нужные индексы:

```sql
orders(client_id)
orders(status)
orders(contract_type)
orders(business_company_id)
orders(manager_id)
orders(created_at)
order_quarters(order_id, quarter)
contract_quarters(contract_id, quarter)
documents(order_id)
quarter_documents(order_quarter_id)
comments(order_id)
comments(order_quarter_id)
payments(order_id)
payments(payment_status)
debts(status)
debts(contract_id, contract_quarter_id)
audit_log(entity_type, entity_id)
notifications(user_id, is_read)
```

## 34. Ошибки API

Единый формат:

```json
{
  "error": "forbidden",
  "message": "Нет доступа к заявке",
  "details": {}
}
```

Типовые коды:

```text
validation_error
unauthorized
forbidden
not_found
conflict
annual_request_not_ready
payment_amount_invalid
quarter_not_found
contract_not_found
document_upload_failed
```

## 35. Миграция с mock frontend

Frontend сейчас использует mock-сервисы:

- `orderService.ts`
- `staffOrderService.ts`
- `paymentService.ts`
- `leadService.ts`
- `authService.ts`

При подключении backend нужно:

1. Сохранить shape ответов API максимально близким к текущим типам.
2. Заменить localStorage на HTTP-запросы.
3. Не менять названия кварталов: `1 квартал`, `2 квартал`, `3 квартал`, `4 квартал`.
4. Для годовой заявки всегда отдавать `contractType = annual_quarterly`.
5. Для активной годовой заявки отдавать `status = annual_active`.
6. Всегда возвращать `quarters[]` из 4 элементов.
7. Скрывать поля по роли на backend, а не только на frontend.

## 36. Минимальный backend MVP

Для первого релиза достаточно реализовать:

1. Auth: регистрация, логин, текущий пользователь.
2. Services: список услуг.
3. Leads: создание лида.
4. Orders: создание, список, карточка.
5. Staff orders: список, карточка, смена статуса.
6. Documents: upload metadata + download URL.
7. Comments: клиентские и внутренние.
8. Contracts: отправка/подпись.
9. Payments: разовые платежи.
10. Annual quarterly: 4 квартала, документы, результаты, оплаты, долги.
11. Notifications: in-app.
12. Audit log.

## 37. Главные бизнес-правила, которые нельзя ломать

1. Клиент видит только свои заявки.
2. Staff не должен видеть финансовые суммы без права `view_finance`.
3. Годовая заявка всегда имеет 4 квартала.
4. При открытии годовой заявки доступны все вкладки кварталов.
5. Данные выбранного квартала открываются отдельно.
6. 4 квартал не должен открываться вместо всех кварталов.
7. Финансы годового договора считаются по кварталам.
8. Один квартал не может иметь два активных долга.
9. Годовая заявка не закрывается, пока не выполнены все кварталы, не загружены результаты и не закрыты долги.
10. Любое важное действие пишется в историю.
11. Внутренние заметки никогда не отдаются клиенту.
12. Backend является источником прав доступа и валидации.

## 38. Проверочный сценарий для годового договора

1. Клиент создает годовую заявку.
2. Backend создает заявку со статусом `annual_active`.
3. Backend создает договор `annual_quarterly`.
4. Backend создает 4 `contract_quarters`.
5. Backend создает 4 `order_quarters`.
6. Клиент открывает заявку.
7. Backend возвращает вкладки `1 квартал`, `2 квартал`, `3 квартал`, `4 квартал`.
8. Клиент нажимает `1 квартал`.
9. Backend возвращает данные 1 квартала.
10. Клиент загружает файл в 1 квартал.
11. Сотрудник видит файл только в 1 квартале.
12. Бухгалтер добавляет оплату за 1 квартал.
13. Backend пересчитывает 1 квартал, договор и долги.
14. Сотрудник добавляет результат 1 квартала.
15. 1 квартал становится выполненным.
16. Остальные кварталы остаются доступными и отдельными.

Это обязательное поведение для backend и frontend.
## 39. Текущая финальная mock/demo-логика frontend

Этот раздел описывает текущий локальный demo-сценарий frontend. Он нужен, чтобы можно было проверить весь путь клиента и сотрудников без backend API.

### Демо-вход

Локальный вход работает через `src/contexts/AuthContext.tsx`.

Клиент:

- URL: `/login`
- email: `client@ecoprogress.kz`
- пароль: любой непустой, по умолчанию в форме стоит `demo`
- после входа открывается `/cabinet`

Сотрудники:

- URL: `/staff/login`
- пароль: любой непустой, по умолчанию в форме стоит `demo`

Доступные staff email:

- `manager@ecoprogress.kz` - менеджер
- `accountant@ecoprogress.kz` - бухгалтер
- `ecologist@ecoprogress.kz` - эколог
- `laboratory@ecoprogress.kz` - лаборатория
- `admin@ecoprogress.kz` - администратор

В локальном staff-кабинете есть переключатель роли в верхней панели. Он меняет текущего пользователя без повторного логина.

### Одна финальная заявка

Все старые mock-заявки удалены. Сейчас основной сценарий построен вокруг одной заявки:

```text
ORD-DEMO-FULL
```

Заявка находится в `src/data/mockData.ts` и содержит полный набор данных: клиент, компания, договор, счет, оплата, остаток, задолженность, документы, лаборатория, кварталы, комментарии, история и уведомления.

Связанные финансовые mock-данные также привязаны только к `ORD-DEMO-FULL`: payments, contract, debt, transaction, notifications и clients.

### Локальная логика действий

Для demo-режима используется `src/services/mockOrderStore.ts`. Он хранит заявку в памяти браузерной сессии и обновляет ее без backend.

Локально работают: смена статуса заявки, назначение ответственных, комментарии клиенту, внутренние заметки, загрузка документов, договор, счет, оплата, экология, лаборатория, первичные документы, согласование замера, лабораторные результаты, отправка документов клиенту, архив и кварталы годового договора.

Сервисы с local fallback:

- `src/services/orderService.ts`
- `src/services/staffOrderService.ts`
- `src/services/paymentService.ts`
- `src/services/serviceService.ts`

Это сделано, чтобы в demo-режиме не было 500 ошибок от `/api`, когда backend не запущен.

### Доступы ролей

`ADMIN` имеет полный доступ ко всем разделам заявки: обзор, оплата, договор, документы, экология, лаборатория, первичные документы, согласование замера, протокол, 870 форма, база отчет, квартальный отчет, годовой отчет, полугодовой отчет, архив отчет, сообщения, заметки и история.

Менеджер видит менеджерские этапы, документы, договор, сообщения, заметки и историю.

Бухгалтер видит оплату, договор, документы и историю.

Эколог видит экологический блок, документы, сообщения и заметки.

Лаборатория видит лабораторный блок, документы, сообщения и заметки.

Клиент видит только свой кабинет и клиентские данные: заявку, документы, договор, счет, оплату, кварталы, комментарии с видимостью `client` и опубликованные результаты.

### Лабораторный блок

В CRM лабораторный блок содержит вкладки:

- `Первичные документы`
- `Согласование`
- `Протокол`
- `870 форма`
- `База отчёт`
- `Квартальный отчёт`
- `Годовой отчёт`
- `Полугодовой отчёт`
- `Архив отчёт`

В этих вкладках можно сохранить и отправить согласование клиенту, отметить замер, загрузить документы, выбрать статус `Готов к отправке` или `Сразу отправить клиенту`, отправить документ клиенту, перенести документ в архив, добавить комментарий клиенту и добавить внутреннюю заметку.

Квартальный отчет отдельно поддерживает выбор квартала. Документы кварталов не смешиваются между собой.

### Что должен повторить backend

Когда backend будет подключен, он должен повторить эту же логику через API:

1. Возвращать агрегированную заявку `Order` с тем же shape.
2. Разделять видимость документов и комментариев по роли.
3. Давать `ADMIN` полный доступ.
4. Поддерживать все лабораторные вкладки и статусы документов.
5. Поддерживать отправку документа клиенту через статус `published_to_client`.
6. Писать каждое действие в историю.
7. Возвращать клиенту только его заявки и клиентские данные.
8. Возвращать staff-ролям только доступные им действия.

## 40. Актуальная логика CRM для backend: заявки, экология, лаборатория и согласование

Этот раздел является актуальным ТЗ для backend и имеет приоритет над устаревшими demo-описаниями выше.

### Демо-роли для проверки frontend

В текущем frontend есть demo-вход без backend:

- клиент: `client@demo.kz` / `demo`
- менеджер: `manager@demo.kz` / `demo`
- эколог: `ecologist@demo.kz` / `demo`
- лаборатория: `laboratory@demo.kz` / `demo`
- бухгалтер: `accountant@demo.kz` / `demo`
- админ: `admin@demo.kz` / `demo`

Demo-заявки:

- `REQ-DESIGN-001` - заявка на проектирование.
- `REQ-LAB-001` - заявка на лабораторию.

Backend должен потом заменить demo/localStorage на реальные API, сохранив такую же бизнес-логику.

### Общая логика заявки по ролям

У каждой заявки есть направление работы:

- `Проектирование`
- `Лаборатория`
- другие направления CRM

Нельзя смешивать направления внутри одной заявки:

- если заявка на `Проектирование`, в ней не должно быть рабочего пункта `Лаборатория`;
- если заявка на `Лаборатория`, в ней не должно быть пунктов `Проектирование` и `Разрешение`.

### Роль ADMIN

Админ видит полную карточку заявки.

Для заявки на проектирование админ видит вкладки:

- `Обзор`
- `Оплата`
- `Договор`
- `Документы`
- `Проектирование`
- `Разрешение`
- `Сообщения`
- `Заметки`
- `История`

Для лабораторной заявки админ видит вкладки:

- `Обзор`
- `Оплата`
- `Договор`
- `Документы`
- `Лаборатория`
- `Сообщения`
- `Заметки`
- `История`

### Роль ECOLOGIST

Эколог должен иметь доступ к общим разделам заявки, но без оплаты.

Для заявки на проектирование эколог видит:

- `Обзор`
- `Договор`
- `Документы`
- `Проектирование`
- `Разрешение`
- `Сообщения`
- `Заметки`
- `История`

Эколог не должен видеть:

- `Оплата`
- `Лаборатория` в проектной заявке
- `Роли пользователей`

### Роль LABORATORY

Лаборатория должна видеть заявку в такой структуре:

- `Обзор`
- `Оплата`
- `Договор`
- `Лаборатория`
- `Сообщения`
- `Заметки`
- `История`

Вкладка `Лаборатория` содержит форму `Документы клиенту`:

- название документа;
- загрузка одного или нескольких файлов;
- комментарий;
- dropdown `Тип документа`;
- кнопка `Отправить`.

Типы лабораторных документов:

- `Согласование`
- `Протокол`
- `870 форма`
- `База отчёт`
- `Квартальный отчёт`
- `Годовой отчёт`
- `Полугодовой отчёт`
- `Архив отчёт`

Лаборатория не должна видеть:

- `Проектирование`
- `Разрешение`
- `Роли пользователей`

### Вкладка Проектирование

В заявке на проектирование вкладка `Проектирование` содержит форму загрузки проектного документа:

- `documentType`
- `file`
- `comment`
- кнопка загрузки

Типы документов:

1. `Бланк инвентаризация`
2. `Согласование предварительных материалов`
3. `Скрининг`
4. `Согласование о проведении организации общественных слушаний`
5. `ОВОС отчет`
6. `ОВОС`
7. `Согласование ОС`

Статусы проектного документа:

- `Черновик`
- `На проверке`
- `Требует исправления`
- `Согласовано`
- `Готово`

### Вкладка Разрешение

В заявке на проектирование вкладка `Разрешение` содержит отдельную форму:

- название документа;
- файл;
- комментарий;
- кнопка загрузки.

Статусы документа разрешения:

- `Подготовка`
- `На проверке`
- `Отправлено`
- `Принято`
- `Требует исправления`
- `Завершено`

### Документы сотрудника для клиента

Когда эколог, лаборатория или другой сотрудник отправляет документ клиенту, backend должен создавать запись документа, доступную клиенту в заявке.

Рекомендуемая структура:

```ts
type StaffDocumentForClient = {
  id: string;
  requestId: string;
  section: 'projecting' | 'permit' | 'laboratory' | 'contract' | 'result' | 'other';
  documentType?: string;
  title: string;
  fileName: string;
  fileUrl?: string;
  comment?: string;
  status: string;
  uploadedBy: string;
  uploadedAt: string;
  visibleToClient: boolean;
};
```

### Клиентская вкладка Согласование

В каждой клиентской заявке должна быть вкладка `Согласование`.

Клиент в этой вкладке должен:

- видеть документы, которые сотрудник отправил на ознакомление;
- скачать или открыть документ;
- загрузить ответный документ;
- написать комментарий;
- нажать `Подписать и отправить`;
- нажать `Отправить без подписи`;
- нажать `Отправить на исправление`.

Backend должен хранить ответ клиента по согласованию отдельно.

Рекомендуемая структура:

```ts
type ClientAgreementResponse = {
  id: string;
  requestId: string;
  sourceDocumentId: string;
  sourceDocumentTitle: string;
  fileName?: string;
  fileUrl?: string;
  comment?: string;
  action: 'signed' | 'sent_without_signature' | 'revision_requested';
  signed: boolean;
  signedAt?: string;
  sentAt: string;
  createdBy: string;
};
```

Если клиент нажал `Отправить на исправление`, backend должен:

1. сохранить `action = 'revision_requested'`;
2. сохранить комментарий клиента;
3. сохранить файл, если он был загружен;
4. уведомить ответственного сотрудника;
5. добавить запись в историю заявки.

### История действий

Каждое действие должно попадать в историю заявки:

```ts
type RequestAction = {
  id: string;
  requestId: string;
  action: string;
  comment?: string;
  createdBy: string;
  createdAt: string;
  actorRole: 'CLIENT' | 'MANAGER' | 'ADMIN' | 'ACCOUNTANT' | 'ECOLOGIST' | 'LABORATORY';
};
```

В историю обязательно писать:

- загрузку документа сотрудником;
- отправку документа клиенту;
- подписание клиентом;
- отправку без подписи;
- отправку на исправление;
- смену статуса документа;
- комментарии клиента и сотрудников.

### Минимальные API для backend

```http
GET    /api/staff/orders
GET    /api/staff/orders/:id
PATCH  /api/staff/orders/:id/status

POST   /api/staff/orders/:id/documents/client
PATCH  /api/staff/orders/:id/documents/:documentId/status

POST   /api/staff/orders/:id/projecting/documents
PATCH  /api/staff/orders/:id/projecting/documents/:documentId/status

POST   /api/staff/orders/:id/permit/documents
PATCH  /api/staff/orders/:id/permit/documents/:documentId/status

POST   /api/staff/orders/:id/laboratory/documents
PATCH  /api/staff/orders/:id/laboratory/documents/:documentId/status

GET    /api/client/orders
GET    /api/client/orders/:id
GET    /api/client/orders/:id/agreement-documents
POST   /api/client/orders/:id/agreement-responses
```

`POST /api/client/orders/:id/agreement-responses` должен принимать:

- `sourceDocumentId`
- `file`
- `comment`
- `action`

Где `action`:

- `signed`
- `sent_without_signature`
- `revision_requested`

### Главное правило

Клиент работает через заявку.
Эколог работает через заявку.
Лаборатория работает через заявку.
Админ контролирует все через заявку.

Нельзя делать отдельные глобальные рабочие процессы, которые обходят карточку конкретной заявки.
