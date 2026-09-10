# ECOPROGRESS GROUP — Backend API Reference

> **Для фронтенд-разработчика**: полное описание REST API бэкенда.
> Все эндпоинты, форматы запросов/ответов, авторизация, бизнес-логика.

---

## Оглавление

1. [Общие принципы](#1-общие-принципы)
2. [Авторизация (JWT)](#2-авторизация-jwt)
3. [Auth API — Аутентификация](#3-auth-api)
4. [Публичные каталоги](#4-публичные-каталоги)
5. [Лиды (заявки с сайта)](#5-лиды)
6. [Уведомления](#6-уведомления)
7. [Client API — Кабинет клиента](#7-client-api)
8. [Staff API — CRM сотрудника](#8-staff-api)
9. [Файлы (скачивание)](#9-файлы)
10. [Финансы — Оплаты и задолженности](#10-финансы)
11. [Договоры](#11-договоры)
12. [Задачи и календарь (CRM)](#12-задачи-и-календарь)
13. [Клиенты (CRM-список)](#13-клиенты-crm)
14. [Enum-справочники](#14-enum-справочники)
15. [Бизнес-процесс заявки](#15-бизнес-процесс-заявки)
16. [Demo-пользователи](#16-demo-пользователи)
17. [Запуск бэкенда](#17-запуск)

---

## 1. Общие принципы

### Base URL

```
http://localhost:8080
```

Фронт dev-сервер (Vite) проксирует `/api` → `http://localhost:8080`.

### Формат ответа

**Все** JSON-эндпоинты оборачивают данные в единый формат:

```json
{
  "data": <T>,
  "message": "строка или null"
}
```

Тип: `ApiResponse<T>` → поле `data` содержит полезные данные, `message` — текст для toast/уведомления.

**Исключение:** `GET /api/files/documents/{fileId}` — возвращает бинарный файл, не JSON.

### Ошибки

| HTTP код | Значение | Тело |
|----------|----------|------|
| 400 | Ошибка валидации | `{ "data": null, "message": "описание" }` |
| 401 | Не авторизован | `{ "data": null, "message": "Требуется авторизация" }` |
| 403 | Доступ запрещён | `{ "data": null, "message": "Доступ запрещен" }` |
| 404 | Не найдено | `{ "data": null, "message": "описание" }` |
| 409 | Конфликт | `{ "data": null, "message": "описание" }` |

### Даты

Даты в ответах форматируются **на русском**: `"12 мая 2026, 16:20"` (через `RuDateFormatter`).
В запросах принимаются ISO-строки: `"2026-05-12"`, `"2026-05-12T16:20:00"`.

### Content-Type

- JSON-запросы: `application/json`
- Загрузка файлов: `multipart/form-data`

---

## 2. Авторизация (JWT)

Токен передаётся в заголовке:

```
Authorization: Bearer <token>
```

Токен выдаётся при `POST /api/auth/login` или `/api/auth/register`.
Срок жизни: **24 часа** (настраивается через `ECO_JWT_TTL_HOURS`).

### Матрица доступа

| Путь | Доступ |
|------|--------|
| `POST /api/auth/**` | Публичный |
| `GET /api/services/**`, `/api/news/**`, `/api/employees/**`, `/api/tariffs/**` | Публичный |
| `POST /api/leads` | Публичный |
| `/api/client/**` | `CLIENT`, `MANAGER`, `ADMIN` |
| `/api/staff/**` | `MANAGER`, `ADMIN`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY` |
| `/api/files/**` | Любой авторизованный |
| `/api/notifications` | Любой авторизованный |

Методы контроллеров дополнительно ограничены `@PreAuthorize`.

### Роли пользователей (`UserRole`)

| Роль | Описание |
|------|----------|
| `CLIENT` | Клиент — создаёт заявки, загружает документы |
| `MANAGER` | Менеджер — ведёт заявки, назначает сотрудников |
| `ADMIN` | Администратор — полный доступ |
| `ACCOUNTANT` | Бухгалтер — оплаты, счета, задолженности |
| `ECOLOGIST` | Эколог — проектирование, экологические статусы |
| `LABORATORY` | Лаборатория — анализы, замеры, протоколы |

---

## 3. Auth API

### `POST /api/auth/login`

Вход клиента.

**Request:**
```json
{
  "email": "client@ecoprogress.kz",
  "password": "demo123"
}
```

**Response** (`ApiResponse<AuthResponse>`):
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "user": {
      "id": 1,
      "role": "CLIENT",
      "type": "company",
      "email": "client@ecoprogress.kz",
      "name": "Иванов Иван",
      "phone": "+7 777 123 4567",
      "city": "Алматы",
      "companyName": "ТОО \"Пример\"",
      "bin": "123456789012",
      "organizationType": "ТОО",
      "legalAddress": "ул. Примерная, 1",
      "position": null,
      "status": "active"
    }
  },
  "message": null
}
```

### `POST /api/auth/staff/login`

Вход сотрудника. Те же поля. Возвращает ошибку если роль = `CLIENT`.

### `POST /api/auth/register`

Регистрация нового клиента.

**Request (физлицо):**
```json
{
  "type": "individual",
  "name": "Иванов Иван",
  "phone": "+7 777 000 0000",
  "email": "ivan@example.com",
  "city": "Алматы",
  "password": "mypassword"
}
```

**Request (юрлицо):**
```json
{
  "type": "company",
  "companyName": "ТОО \"Пример\"",
  "bin": "123456789012",
  "organizationType": "ТОО",
  "legalAddress": "ул. Примерная, 1",
  "city": "Алматы",
  "contactPerson": "Иванов Иван",
  "position": "Директор",
  "phone": "+7 777 000 0000",
  "email": "company@example.com",
  "password": "mypassword"
}
```

**Response:** как у `login` — `{ token, user }`.

### `POST /api/auth/logout`

Просто отвечает `{ "data": null, "message": "..." }`. Клиент сам удаляет токен из localStorage.

### `GET /api/auth/me`

Текущий пользователь по JWT.

**Response** (`ApiResponse<UserResponse>`):
```json
{
  "data": {
    "id": 1,
    "role": "CLIENT",
    "type": "company",
    "email": "client@ecoprogress.kz",
    "name": "Иванов Иван",
    "phone": "+7 777 123 4567",
    "city": "Алматы",
    "companyName": "ТОО \"Пример\"",
    "bin": "123456789012",
    "organizationType": "ТОО",
    "legalAddress": "ул. Примерная, 1",
    "position": null,
    "status": "active"
  },
  "message": null
}
```

---

## 4. Публичные каталоги

### Услуги

#### `GET /api/services`

**Response** (`ApiResponse<List<EcoServiceResponse>>`):
```json
{
  "data": [
    {
      "id": "eco-design",
      "title": "Экологическое проектирование",
      "category": "Проектирование",
      "description": "...",
      "forWhom": "Для предприятий, которым нужна...",
      "result": "Готовый пакет документов",
      "includes": ["ОВОС", "ПДВ", "Паспорт отходов"],
      "documents": ["Устав", "Справка о гос.регистрации"],
      "workflow": ["Анализ", "Проектирование", "Экспертиза"],
      "duration": "от 15 рабочих дней",
      "icon": "FileCheck"
    }
  ],
  "message": null
}
```

#### `GET /api/services/{id}`

Одна услуга по slug-ID (например `eco-design`).

### Новости

#### `GET /api/news`

**Response** (`ApiResponse<List<NewsResponse>>`):
```json
{
  "data": [
    {
      "id": "news-1",
      "title": "Изменения в экологическом законодательстве",
      "excerpt": "Краткое описание...",
      "category": "Законодательство",
      "date": "15 мая 2026",
      "image": "/pexels-jan-van.jpg",
      "content": ["Абзац 1...", "Абзац 2..."]
    }
  ],
  "message": null
}
```

#### `GET /api/news/{id}`

Одна новость.

### Сотрудники

#### `GET /api/employees`

**Response** (`ApiResponse<List<EmployeeResponse>>`):
```json
{
  "data": [
    {
      "id": "chief",
      "name": "Иванова Анна",
      "position": "Главный эколог",
      "experience": "15 лет",
      "specialty": "Экологическое проектирование",
      "summary": "Специалист в области...",
      "avatar": "/pexels-avatar.jpg"
    }
  ],
  "message": null
}
```

#### `GET /api/employees/{id}`

Один сотрудник.

### Тарифы

#### `GET /api/tariffs`

**Response** (`ApiResponse<List<TariffResponse>>`):
```json
{
  "data": [
    {
      "id": "basic",
      "name": "Базовый",
      "price": "от 150 000 ₸",
      "description": "Разовая экологическая задача",
      "features": ["Консультация", "Анализ", "Документы"],
      "cta": "Оставить заявку",
      "mode": "Разовая задача",
      "popular": false
    }
  ],
  "message": null
}
```

#### `GET /api/tariffs/{id}`

Один тариф.

---

## 5. Лиды

### `POST /api/leads` (публичный)

Заявка с сайта (форма "Получить консультацию").

**Request:**
```json
{
  "name": "Иван Иванов",
  "phone": "+7 777 000 0000",
  "city": "Алматы",
  "serviceType": "Экологическое проектирование",
  "comment": "Нужна консультация",
  "source": "contacts_page",
  "email": "ivan@example.com",
  "companyName": "ТОО Пример",
  "serviceId": "eco-design",
  "message": "Доп. информация"
}
```

**Response** (`ApiResponse<LeadResponse>`):
```json
{
  "data": {
    "id": 1,
    "name": "Иван Иванов",
    "phone": "+7 777 000 0000",
    "city": "Алматы",
    "serviceType": "Экологическое проектирование",
    "comment": "Нужна консультация",
    "source": "contacts_page",
    "status": "new",
    "assignedManagerName": null,
    "createdAt": "15 мая 2026, 14:30"
  },
  "message": "Заявка отправлена"
}
```

### `GET /api/staff/leads` (staff)

Список всех лидов для CRM.

### `PATCH /api/staff/leads/{id}` (staff)

Обновить статус лида.

**Request:**
```json
{
  "status": "contacted",
  "assignedManagerId": 2
}
```

**LeadStatus enum:** `new`, `contacted`, `in_progress`, `closed`

---

## 6. Уведомления

### `GET /api/notifications` (авторизованный)

**Response** (`ApiResponse<List<NotificationResponse>>`):
```json
{
  "data": [
    {
      "id": 1,
      "userId": 5,
      "role": "CLIENT",
      "orderId": "ORD-1012",
      "title": "Статус заявки изменен",
      "message": "Ваша заявка перешла в статус 'Анализ'",
      "type": "status_change",
      "isRead": false,
      "createdAt": "15 мая 2026, 14:30"
    }
  ],
  "message": null
}
```

### `PATCH /api/notifications/{id}/read` (авторизованный)

Отметить уведомление прочитанным.

---

## 7. Client API — Кабинет клиента

**Базовый путь:** `/api/client`
**Доступ:** `CLIENT` (+ `MANAGER`, `ADMIN`)

### 7.1. Заявки клиента

#### `GET /api/client/orders`

Список заявок текущего клиента.

**Response** (`ApiResponse<List<OrderResponse>>`): см. [OrderResponse](#orderresponse).

#### `POST /api/client/orders`

Создать заявку.

**Request (`CreateOrderRequest`):**
```json
{
  "serviceId": "eco-design",
  "contactPerson": "Иванов Иван",
  "phone": "+7 777 000 0000",
  "email": "ivan@example.com",
  "companyName": "ТОО Пример",
  "bin": "123456789012",
  "city": "Алматы",
  "objectAddress": "ул. Объектная, 5",
  "comment": "Нужно подготовить ОВОС",
  "urgency": "Стандартная",
  "contractType": "one_time",
  "signatureProvider": "NCALayer",
  "paymentMethod": "bank_transfer",
  "fileName": "техзадание.pdf"
}
```

#### `GET /api/client/orders/{id}`

Одна заявка с документами, комментариями, историей.

### 7.2. Комментарии

#### `POST /api/client/orders/{id}/comments`

**Request:**
```json
{
  "text": "Загрузил документы, просьба проверить",
  "visibility": "client"
}
```

**Response** (`ApiResponse<CommentResponse>`):
```json
{
  "data": {
    "id": 15,
    "authorName": "Иванов Иван",
    "authorRole": "CLIENT",
    "text": "Загрузил документы, просьба проверить",
    "visibility": "client",
    "quarterId": null,
    "createdAt": "15 мая 2026, 14:30"
  },
  "message": "Комментарий добавлен"
}
```

### 7.3. Документы (загрузка)

#### `POST /api/client/orders/{id}/documents` (multipart)

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `file` | File | Да | Файл (до 20MB) |
| `type` | String | Нет | `client` / `result` / `internal` |

**Response** (`ApiResponse<DocumentResponse>`):
```json
{
  "data": {
    "id": 42,
    "name": "устав.pdf",
    "fileName": "устав.pdf",
    "fileUrl": "/api/files/documents/665a1b2c3d4e5f6a7b8c9d0e",
    "mimeType": "application/pdf",
    "fileSize": 1234567,
    "type": "client",
    "visibility": "client",
    "status": "uploaded",
    "uploadedByRole": "CLIENT",
    "uploadedAt": "15 мая 2026, 14:30",
    "sentToClient": false,
    "needsSignature": false,
    "needsClientResponse": false,
    "clientResponseStatus": null,
    "staffComment": null,
    "clientComment": null,
    "dueDate": null
  },
  "message": "Документ загружен"
}
```

### 7.4. Подписание договора

#### `POST /api/client/orders/{id}/contract/sign`

**Request:**
```json
{
  "signatureProvider": "NCALayer",
  "signedCms": "base64-encoded-cms-data",
  "signerSubject": "CN=Иванов Иван, ...",
  "documentId": 42,
  "signedAt": "2026-05-15T14:30:00"
}
```

### 7.5. Оплата

#### `POST /api/client/orders/{id}/pay`

**Request:**
```json
{
  "paymentMethod": "bank_transfer"
}
```

### 7.6. Первичные документы клиента

#### `POST /api/client/orders/{id}/primary-documents/{docId}`

Загрузить данные первичного документа (JSON).

**Request:**
```json
{
  "fileName": "карточка_компании.pdf",
  "clientComment": "Актуальная карточка"
}
```

#### `POST /api/client/orders/{id}/primary-documents/{docId}/upload` (multipart)

Загрузить файл первичного документа.

| Поле | Тип | Описание |
|------|-----|----------|
| `file` | File | Файл |
| `comment` | String | Комментарий клиента |

#### `DELETE /api/client/orders/{id}/primary-documents/{docId}/file`

Удалить загруженный файл первичного документа.

#### `POST /api/client/orders/{id}/primary-documents/review`

Отправить все первичные документы на проверку.

**Request:**
```json
{
  "clientComment": "Все документы загружены, прошу проверить"
}
```

### 7.7. Лаборатория (клиентская часть)

#### `POST /api/client/orders/{id}/laboratory/primary-documents/{docId}`

Загрузить лабораторный первичный документ.

#### `POST /api/client/orders/{id}/laboratory/measurement/respond`

Ответить на согласование замеров.

**Request:**
```json
{
  "status": "accepted",
  "comment": "Всё подходит"
}
```

или

```json
{
  "status": "rescheduled",
  "comment": "Нужно перенести",
  "rescheduleDate": "2026-05-20",
  "rescheduleTime": "10:00",
  "rescheduleAddress": "ул. Новая, 5"
}
```

### 7.8. Кварталы (годовое сопровождение)

#### `GET /api/client/orders/{orderId}/quarters`

Список кварталов заявки.

#### `GET /api/client/orders/{orderId}/quarters/{quarterId}`

Детали одного квартала.

#### `POST /api/client/orders/{orderId}/quarters/{quarterId}/documents` (multipart)

Загрузить документ в квартал.

#### `POST /api/client/orders/{orderId}/quarters/{quarterId}/comments`

Добавить комментарий к кварталу.

### 7.9. Финансы клиента

#### `GET /api/client/payments`

Оплаты клиента. **Response:** `ApiResponse<List<PaymentResponse>>` — см. [PaymentResponse](#paymentresponse).

#### `GET /api/client/debts`

Задолженности клиента. **Response:** `ApiResponse<List<DebtResponse>>` — см. [DebtResponse](#debtresponse).

#### `GET /api/client/contracts`

Договоры клиента. **Response:** `ApiResponse<List<ContractResponse>>` — см. [ContractResponse](#contractresponse).

---

## 8. Staff API — CRM сотрудника

**Базовый путь:** `/api/staff`
**Доступ:** `MANAGER`, `ADMIN`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`

### 8.1. Заявки (staff)

#### `GET /api/staff/orders`

Список всех заявок. Поддерживает фильтры:

| Query param | Тип | Описание |
|-------------|-----|----------|
| `q` | String | Поиск по номеру, компании, клиенту, услуге |
| `businessCompanyId` | String | Фильтр по бизнес-компании (`eco-docs`, `eco-lab`, `eco-waste`) |
| `status` | String | Фильтр по статусу заявки |
| `paymentStatus` | String | Фильтр по статусу оплаты |
| `contractType` | String | `one_time` или `annual_quarterly` |
| `managerId` | String | ID менеджера |
| `dateFrom` | String | Дата от (ISO) |
| `dateTo` | String | Дата до (ISO) |

#### `POST /api/staff/orders` (MANAGER, ADMIN)

Создать заявку от имени клиента.

**Request (`StaffCreateOrderRequest`):**
```json
{
  "clientId": 1,
  "serviceId": "eco-design",
  "serviceName": "Экологическое проектирование",
  "businessCompanyId": "eco-docs",
  "contractType": "one_time",
  "urgency": "Стандартная",
  "comment": "Заявка от имени клиента",
  "contactPerson": "Иванов Иван",
  "phone": "+7 777 000 0000",
  "city": "Алматы"
}
```

#### `GET /api/staff/orders/{id}`

Полная заявка со всеми данными.

#### `PATCH /api/staff/orders/{id}/status`

Изменить статус заявки.

**Request:**
```json
{
  "status": "ANALYSIS"
}
```

Значения `OrderStatus` enum: `CONSULTATION`, `ANALYSIS`, `COMMERCIAL_PROPOSAL`, `CONTRACT`, `INVOICE`, `DESIGN`, `LABORATORY`, `WASTE_REMOVAL`, `UTILIZATION`, `QUALITY_CHECK`, `READY`, `COMPLETED`, `CANCELLED`, `ANNUAL_ACTIVE`.

#### `PATCH /api/staff/orders/{id}/assign`

Назначить сотрудника.

**Request:**
```json
{
  "role": "ECOLOGIST",
  "userId": 5
}
```

### 8.2. Комментарии (staff)

#### `POST /api/staff/orders/{id}/comments`

**Request:**
```json
{
  "text": "Принято в работу",
  "visibility": "internal"
}
```

`visibility`: `client` (видит клиент) или `internal` (только для сотрудников).

### 8.3. Документы (staff)

#### `POST /api/staff/orders/{id}/documents` (multipart)

| Поле | Тип | Описание |
|------|-----|----------|
| `file` | File | Файл |
| `type` | String | Тип документа |
| `sendToClient` | Boolean | Отправить клиенту |
| `needsSignature` | Boolean | Нужна подпись клиента |
| `needsClientResponse` | Boolean | Нужен ответ клиента |
| `comment` | String | Комментарий сотрудника |
| `dueDate` | String | Срок ответа (ISO дата) |

#### `POST /api/staff/orders/{id}/documents/{documentId}/send-to-client`

Отправить существующий документ клиенту.

**Request:**
```json
{
  "needsSignature": true,
  "needsClientResponse": false,
  "staffComment": "Подпишите договор",
  "dueDate": "2026-05-20"
}
```

### 8.4. Договор и счёт

#### `POST /api/staff/orders/{id}/contract-and-invoice`

Отправить договор и счёт клиенту.

**Request:**
```json
{
  "amount": 500000,
  "paymentMethod": "bank_transfer",
  "signatureProvider": "NCALayer",
  "contractFileName": "Договор №123.pdf"
}
```

#### `PATCH /api/staff/orders/{id}/contract-status`

Обновить CRM-статус договора.

**Request:**
```json
{
  "crmContractStatus": "sent_to_client"
}
```

`CrmContractStatus` enum: `not_created`, `prepared`, `sent_to_client`, `waiting_signature`, `signed`, `rejected`.

### 8.5. Оплата заявки (staff)

#### `PATCH /api/staff/orders/{id}/payment` (ACCOUNTANT, ADMIN, MANAGER)

**Request:**
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "bank_transfer"
}
```

### 8.6. Первичные документы (staff)

#### `POST /api/staff/orders/{id}/primary-documents`

Запросить первичный документ от клиента.

**Request:**
```json
{
  "name": "Карточка компании",
  "required": true,
  "comment": "Нужна актуальная версия"
}
```

#### `POST /api/staff/orders/{id}/primary-documents/batch`

Запросить несколько документов одним запросом.

**Request:**
```json
{
  "documents": [
    { "name": "Карточка компании", "required": true, "comment": "" },
    { "name": "БИН / ИИН", "required": true, "comment": "" }
  ]
}
```

#### `PATCH /api/staff/orders/{id}/primary-documents/{docId}`

Обновить статус первичного документа.

**Request:**
```json
{
  "status": "approved",
  "comment": "Документ принят"
}
```

`PrimaryDocumentStatus` enum: `need_upload`, `uploaded`, `in_review`, `approved`, `rejected`, `needs_fix`.

### 8.7. Лаборатория (staff)

#### `POST /api/staff/orders/{id}/laboratory/primary-documents`

Запросить лабораторный первичный документ.

#### `PATCH /api/staff/orders/{id}/laboratory/primary-documents/{docId}`

Обновить статус лабораторного первичного документа.

#### `PATCH /api/staff/orders/{id}/laboratory/measurement`

Сохранить данные согласования замеров.

**Request:**
```json
{
  "date": "2026-05-20",
  "time": "10:00",
  "address": "ул. Объектная, 5",
  "company": "ТОО Пример",
  "contact": "Иванов Иван",
  "scope": "Замеры воздуха, воды, почвы"
}
```

#### `POST /api/staff/orders/{id}/laboratory/measurement/send`

Отправить согласование замеров клиенту.

#### `PATCH /api/staff/orders/{id}/laboratory/measurement/status`

Обновить статус согласования.

**Request:**
```json
{
  "status": "confirmed",
  "comment": "Подтверждено"
}
```

`MeasurementAgreementStatus`: `draft`, `sent`, `accepted`, `rejected`, `rescheduled`, `confirmed`, `completed`.

#### `POST /api/staff/orders/{id}/laboratory/results`

Загрузить лабораторный результат.

**Request:**
```json
{
  "name": "Протокол анализа воды",
  "section": "protocol",
  "quarter": "1",
  "fileName": "protocol_water.pdf"
}
```

#### `PATCH /api/staff/orders/{id}/laboratory/results/{docId}`

Обновить статус результата.

**Request:**
```json
{
  "status": "approved",
  "comment": "Результат принят"
}
```

`LabResultDocumentStatus`: `pending`, `uploaded`, `under_review`, `approved`, `rejected`.

### 8.8. Кварталы (staff)

#### `PATCH /api/staff/orders/{orderId}/quarters/{quarterId}/work-status`

**Request:**
```json
{
  "workStatus": "in_progress",
  "comment": "Начали работу"
}
```

`WorkStatus`: `planned`, `waiting_client_data`, `waiting_payment`, `ready_to_start`, `in_progress`, `blocked_by_debt`, `completed`.

#### `POST /api/staff/orders/{orderId}/quarters/{quarterId}/documents` (multipart)

Загрузить документ в квартал.

#### `POST /api/staff/orders/{orderId}/quarters/{quarterId}/results`

Добавить результат квартала.

**Request:**
```json
{
  "title": "Отчёт за Q1",
  "description": "Квартальный экологический отчёт",
  "resultType": "report"
}
```

#### `POST /api/staff/orders/{orderId}/quarters/{quarterId}/comments`

Комментарий к кварталу.

#### `POST /api/staff/orders/{orderId}/quarters/{quarterId}/payments` (ACCOUNTANT, ADMIN)

Зафиксировать оплату по кварталу.

**Request:**
```json
{
  "amount": 125000,
  "method": "bank_transfer",
  "comment": "Оплата за 1 квартал"
}
```

#### `POST /api/staff/orders/{orderId}/complete-annual`

Завершить годовую заявку.

---

## 9. Файлы

### `GET /api/files/documents/{fileId}`

**Скачивание файла** из MongoDB GridFS.

- `fileId` — hex-строка ObjectId MongoDB (например: `665a1b2c3d4e5f6a7b8c9d0e`)
- Возвращает бинарный файл с заголовками:
  - `Content-Type: application/pdf` (или реальный MIME-тип)
  - `Content-Disposition: attachment; filename="original_name.pdf"`
- **НЕ** обёрнут в `ApiResponse` — прямой бинарный поток
- Доступ: любой авторизованный пользователь

Все `fileUrl` в `DocumentResponse`, `PrimaryDocumentResponse`, `LabResultDocumentResponse` указывают на этот эндпоинт в формате `/api/files/documents/{fileId}`.

---

## 10. Финансы

### Staff — Оплаты

#### `GET /api/staff/payments`

Все оплаты. **Response:** `ApiResponse<List<PaymentResponse>>`.

#### `POST /api/staff/payments/{paymentId}/mark-paid` (ACCOUNTANT, ADMIN)

Отметить оплату как полностью оплаченную.

#### `POST /api/staff/payments/{paymentId}/partial` (ACCOUNTANT, ADMIN)

Зафиксировать частичную оплату.

**Request:**
```json
{
  "amount": 250000,
  "method": "bank_transfer",
  "comment": "Первый транш"
}
```

#### `PATCH /api/staff/payments/{paymentId}` (ACCOUNTANT, ADMIN, MANAGER)

Обновить реквизиты оплаты.

**Request:**
```json
{
  "invoiceNumber": "СЧ-2026-0001",
  "serviceName": "Экологическое проектирование",
  "totalAmount": 500000,
  "paymentMethod": "bank_transfer",
  "paymentStatus": "pending",
  "invoiceDate": "2026-05-15",
  "dueDate": "2026-06-15",
  "comment": "Первоочередная оплата"
}
```

### Staff — Задолженности

#### `GET /api/staff/debts`

Все задолженности.

#### `PATCH /api/staff/debts/{id}/comment` (MANAGER, ADMIN, ACCOUNTANT)

Обновить комментарий задолженности.

#### `POST /api/staff/debts/{id}/close` (ACCOUNTANT, ADMIN)

Закрыть задолженность.

---

## 11. Договоры

### `GET /api/staff/contracts` (staff)

Все договоры.

### `GET /api/client/contracts` (CLIENT)

Договоры текущего клиента.

<a id="contractresponse"></a>

**ContractResponse:**
```json
{
  "id": 1,
  "contractNumber": "ЭКО-2026-001",
  "orderId": "ORD-1012",
  "clientCompanyName": "ТОО Пример",
  "clientBin": "123456789012",
  "ourCompanyId": "eco-docs",
  "ourCompanyName": "ECOPROGRESS Documents",
  "contractType": "annual_quarterly",
  "status": "active",
  "startDate": "2026-01-01",
  "endDate": "2026-12-31",
  "totalAmount": 500000,
  "paidAmount": 125000,
  "remainingAmount": 375000,
  "serviceName": "Экологическое проектирование",
  "responsibleManager": "Менеджер Иванов",
  "quarterlySchedule": [
    {
      "id": 1,
      "contractId": 1,
      "orderId": "ORD-1012",
      "quarter": 1,
      "quarterLabel": "1 квартал",
      "periodStart": "2026-01-01",
      "periodEnd": "2026-03-31",
      "serviceName": "Экологическое проектирование",
      "workStage": "Проектирование",
      "plannedAmount": 125000,
      "paidAmount": 125000,
      "remainingAmount": 0,
      "paymentStatus": "paid",
      "invoiceNumber": "СЧ-Q1-001",
      "invoiceDate": "2026-01-15",
      "dueDate": "2026-02-15",
      "workStatus": "completed",
      "comment": null,
      "lastPaymentDate": "2026-02-01",
      "completedAt": "2026-03-28T16:00:00"
    }
  ],
  "createdAt": "2026-01-01T10:00:00",
  "updatedAt": "2026-05-15T14:30:00"
}
```

---

## 12. Задачи и календарь

### `GET /api/staff/tasks`

Все задачи CRM.

**Response** (`ApiResponse<List<TaskResponse>>`):
```json
{
  "data": [
    {
      "id": 1,
      "title": "Проверить документы",
      "description": "Проверить ОВОС клиента",
      "orderId": "ORD-1012",
      "assigneeId": 5,
      "assigneeName": "Эколог Петров",
      "dueDate": "2026-05-20",
      "status": "open",
      "createdAt": "15 мая 2026, 10:00",
      "updatedAt": "15 мая 2026, 10:00"
    }
  ],
  "message": null
}
```

`TaskStatus`: `open`, `in_progress`, `done`, `cancelled`.

### `POST /api/staff/tasks`

Создать задачу.

### `PATCH /api/staff/tasks/{id}`

Обновить задачу.

### `GET /api/staff/calendar`

Календарные события.

---

## 13. Клиенты (CRM-список)

### `GET /api/clients` (staff)

Список клиентов для CRM.

**Response** (`ApiResponse<List<ClientSummary>>`):
```json
{
  "data": [
    {
      "id": "1",
      "name": "ТОО Пример",
      "contact": "Иванов Иван, +7 777 000 0000",
      "orders": 3,
      "status": "active"
    }
  ],
  "message": null
}
```

### `POST /api/staff/clients` (MANAGER, ADMIN)

Создать нового клиента.

**Request:**
```json
{
  "companyName": "ТОО Новый клиент",
  "binIin": "987654321098",
  "email": "new@example.com",
  "phone": "+7 777 111 2222",
  "contactPerson": "Петров Петр",
  "legalAddress": "ул. Новая, 10",
  "clientType": "company"
}
```

**Response:** возвращает `CreateClientResponse` с `tempPassword` (временный пароль для клиента).

---

## 14. Enum-справочники

### OrderStatus (статусы заявки)

| Enum | Лейбл (русский) |
|------|-----------------|
| `CONSULTATION` | Консультация |
| `ANALYSIS` | Анализ |
| `COMMERCIAL_PROPOSAL` | КП |
| `CONTRACT` | Договор |
| `INVOICE` | Счет на оплату |
| `DESIGN` | Проектирование |
| `LABORATORY` | Лаборатория |
| `WASTE_REMOVAL` | Вывоз |
| `UTILIZATION` | Утилизация |
| `QUALITY_CHECK` | Проверка результата |
| `READY` | Готово |
| `COMPLETED` | Завершено |
| `CANCELLED` | Отменено |
| `ANNUAL_ACTIVE` | Активна по годовому договору |

### PaymentStatus

`not_sent`, `unpaid`, `pending`, `partial`, `paid`, `overdue`

### ContractStatus (клиентский)

`not_sent`, `sent`, `signed`

### CrmContractStatus (внутренний CRM)

`not_created`, `prepared`, `sent_to_client`, `waiting_signature`, `signed`, `rejected`

### EcologyStatus

`not_started`, `in_progress`, `waiting_client_data`, `done`

### LaboratoryStatus

`not_assigned`, `waiting_samples`, `samples_received`, `analysis_in_progress`, `done`

### DocumentType

`client`, `result`, `invoice`, `contract`, `act`, `internal`

### DocumentVisibility

`client`, `staff`, `internal`

### CommentVisibility

`client`, `internal`

### ContractType

`one_time`, `annual_quarterly`

### WorkStatus (кварталы)

`planned`, `waiting_client_data`, `waiting_payment`, `ready_to_start`, `in_progress`, `blocked_by_debt`, `completed`

### PrimaryDocumentStatus

`need_upload`, `uploaded`, `in_review`, `approved`, `rejected`, `needs_fix`

### MeasurementAgreementStatus

`draft`, `sent`, `accepted`, `rejected`, `rescheduled`, `confirmed`, `completed`

### LabResultDocumentStatus

`pending`, `uploaded`, `under_review`, `approved`, `rejected`

### DebtStatus

`active`, `partial`, `overdue`, `closed`

### LeadStatus

`new`, `contacted`, `in_progress`, `closed`

### TaskStatus

`open`, `in_progress`, `done`, `cancelled`

### UserRole

`CLIENT`, `MANAGER`, `ADMIN`, `ACCOUNTANT`, `ECOLOGIST`, `LABORATORY`

---

## 15. Бизнес-процесс заявки

```
1. Клиент POST /api/client/orders → статус CONSULTATION
2. Staff PATCH status → ANALYSIS → COMMERCIAL_PROPOSAL → CONTRACT → INVOICE
3. Staff POST contract-and-invoice → клиент получает договор и счёт
4. Клиент POST contract/sign → contractStatus: signed
5. Клиент POST pay → paymentStatus: paid
6. Staff PATCH status → DESIGN / LABORATORY / WASTE_REMOVAL / UTILIZATION
   (или ANNUAL_ACTIVE для годового договора)
7. Staff ведёт работу: экология, лаборатория, кварталы
8. Staff PATCH status → QUALITY_CHECK → READY → COMPLETED
```

Для годового договора (`annual_quarterly`):
- Статус `ANNUAL_ACTIVE` с квартальными периодами
- Каждый квартал: документы, результаты, оплаты, комментарии
- `POST /api/staff/orders/{id}/complete-annual` → статус `COMPLETED`

---

## 16. Demo-пользователи

Засеваются `DataSeeder` при пустой БД:

| Роль | Email | Пароль |
|------|-------|--------|
| CLIENT | `client@ecoprogress.kz` | `demo123` |
| MANAGER | `manager@ecoprogress.kz` | `demo123` |
| ADMIN | `admin@ecoprogress.kz` | `admin123` |
| ACCOUNTANT | `accountant@ecoprogress.kz` | `demo123` |
| ECOLOGIST | `ecologist@ecoprogress.kz` | `demo123` |
| LABORATORY | `laboratory@ecoprogress.kz` | `demo123` |

---

## 17. Запуск

### Локально (H2 + Mongo)

```bash
./mvnw spring-boot:run        # http://localhost:8080
```

H2-консоль: `http://localhost:8080/h2-console` (JDBC: `jdbc:h2:file:./data/ecodb`, user: `sa`, пароль пуст).

### Docker Compose (MySQL + Mongo)

```bash
docker compose up -d --build
```

| Сервис | Порт | Назначение |
|--------|------|-----------|
| `app` | 8080 | Spring Boot API |
| `mysql` | 3306 | Основная БД |
| `phpmyadmin` | 8083 | UI для MySQL |
| `mongo` | 27017 | Файлы (GridFS) |
| `mongo-express` | 8082 | UI для Mongo |

---

<a id="orderresponse"></a>

## Приложение: OrderResponse (полная структура)

```typescript
type OrderResponse = {
  id: string;                            // "ORD-1012"
  status: string;                        // enum name: "CONSULTATION"
  statusLabel: string;                   // русский: "Консультация"
  contractType: "one_time" | "annual_quarterly" | null;
  businessCompanyId: string | null;      // "eco-docs"
  serviceName: string;                   // "Экологическое проектирование"
  serviceId: string;
  contactPerson: string;
  phone: string;
  city: string | null;
  objectAddress: string | null;
  comment: string | null;
  urgency: string | null;

  clientInfo: {                          // null если нет клиента
    id: number;
    companyName: string;
    contactPerson: string;
    binIin: string;
    email: string;
    phone: string;
  } | null;

  contractInfo: {                        // null если нет договора
    id: number;
    number: string;                      // "ЭКО-2026-001"
    status: string;
    crmStatus: string;                   // CrmContractStatus enum
    startsAt: string | null;             // ISO date
    endsAt: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
  } | null;

  managerName: string | null;
  accountantName: string | null;
  ecologistName: string | null;
  laboratoryUserName: string | null;

  ecologyStatus: string | null;          // EcologyStatus enum
  laboratoryStatus: string | null;       // LaboratoryStatus enum
  contractStatus: string | null;         // ContractStatus enum
  paymentStatus: string | null;          // PaymentStatus enum
  paymentAmount: number | null;
  paymentMethod: string | null;
  signatureProvider: string | null;
  signedAt: string | null;              // "12 мая 2026, 16:20"
  paidAt: string | null;
  crmContractStatus: string | null;     // CrmContractStatus enum
  deadline: string | null;              // ISO date
  completedAt: string | null;
  cancelledAt: string | null;

  quarters: QuarterResponse[];
  documents: DocumentResponse[];         // не result, не agreement
  agreementDocuments: DocumentResponse[]; // sentToClient / needsSignature / needsClientResponse
  resultDocuments: DocumentResponse[];    // type == "result"
  comments: CommentResponse[];
  history: HistoryResponse[];

  createdAt: string;                    // "12 мая 2026, 16:20"
  updatedAt: string;
};
```

<a id="paymentresponse"></a>

## Приложение: PaymentResponse

```typescript
type PaymentResponse = {
  id: number;
  orderId: string;
  contractId: number | null;
  invoiceNumber: string;
  serviceName: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;      // PaymentStatus enum
  paymentMethod: string | null;
  invoiceDate: string | null;  // ISO date
  dueDate: string | null;
  lastPaymentDate: string | null;
  comment: string | null;
  clientEmail: string;
};
```

<a id="debtresponse"></a>

## Приложение: DebtResponse

```typescript
type DebtResponse = {
  id: number;
  orderId: string;
  contractId: number | null;
  contractQuarterId: number | null;
  orderQuarterId: number | null;
  invoiceNumber: string | null;
  quarterLabel: string | null;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;              // DebtStatus enum
  reason: string;
  dueDate: string | null;      // ISO date
  comment: string | null;
  clientEmail: string;
};
```

---

*Документ сгенерирован автоматически на основе исходного кода бэкенда.*
*Версия: Spring Boot 4.0.6, Java 21.*
*Дата: 30 мая 2026.*
