# ECOPROGRESS GROUP — Backend (`eco`)

Spring Boot REST API для онлайн-сервиса экологического сопровождения. Парный фронт — отдельный репозиторий `eco.progress-main` (React + Vite). Фронт полностью работает через API (mock-данные и `localStorage` удалены).

> Фронт `eco.progress-main` НЕ трогаем. Меняем только бэк.

## Стек

- Java 21 (`pom.xml` → `<java.version>21</java.version>`)
- Spring Boot 4.0.6 (использует Jackson 3 — пакеты `tools.jackson.*` для core/databind, но **аннотации** (`@JsonValue`, `@JsonCreator` и т.д.) по-прежнему в `com.fasterxml.jackson.annotation.*`)
- Spring Web, Spring Data JPA, Spring Data MongoDB, Spring Security, Bean Validation
- Реляционка: **H2** (default, локально без docker) → файловая `./data/ecodb`; **MySQL 8** в profile `docker`
- Файловое хранилище: **MongoDB GridFS** (для документов и фото клиентов/сотрудников)
- JJWT 0.12.6, BCrypt

## Профили Spring

| Профиль        | Когда                              | Реляционка | Mongo                   |
|----------------|------------------------------------|------------|-------------------------|
| _(default)_    | `mvn spring-boot:run` локально     | H2 файл    | `localhost:27017/eco`   |
| `docker`       | `docker compose up`                | MySQL      | `mongo:27017/eco`       |

Активация: `SPRING_PROFILES_ACTIVE=docker` (compose делает это автоматически).

## Запуск локально (без docker)

```bash
./mvnw spring-boot:run        # http://localhost:8080
./mvnw test
./mvnw -DskipTests package
```

H2-консоль: `http://localhost:8080/h2-console` (JDBC URL `jdbc:h2:file:./data/ecodb`, user `sa`, пустой пароль).

⚠ При локальном запуске Mongo пробует `localhost:27017`. Если Mongo не запущен — auth/каталоги работают, но загрузка файлов через GridFS упадёт. Для полноценной разработки удобнее поднять полный compose.

При полном пересоздании H2 схемы — удалить папку `data/`.

## Запуск через Docker Compose

```bash
docker compose up -d --build
docker compose logs -f app
# после старта: docker compose logs app | grep ECO-STARTUP
```

Конфигурация без `.env`: `docker-compose.yml` (MySQL/Mongo/порты) + `src/main/resources/application-docker.properties` (Spring, JWT, почта, GridFS).

Сервисы и порты:

| Сервис         | Хост:порт              | Назначение                                     |
|----------------|------------------------|------------------------------------------------|
| `app`          | `localhost:8080`       | Spring Boot REST API                           |
| `mysql`        | `localhost:3306`       | Основная БД                                    |
| `phpmyadmin`   | `localhost:8081`       | UI для MySQL                                   |
| `mongo`        | `localhost:27017`      | Файлы (GridFS)                                 |
| `mongo-express`| `localhost:8082`       | UI для Mongo (admin/admin по умолчанию)        |

Тома: `mysql-data`, `mongo-data` — данные переживают пересоздание контейнеров.

Healthchecks для `mysql` и `mongo` гарантируют, что `app` стартует только после готовности БД.

Остановить со сбросом данных: `docker compose down -v`.

## Demo-пользователи (засеваются `DataSeeder` при пустой БД)

| Роль    | Email                       | Пароль   |
|---------|-----------------------------|----------|
| CLIENT  | `client@ecoprogress.kz`     | `demo123`|
| MANAGER | `manager@ecoprogress.kz`    | `demo123`|
| ADMIN   | `admin@ecoprogress.kz`      | `admin123`|

## Структура пакетов

```
kz.eco
├── EcoApplication              — main
├── auth                        — login/register, JWT, фильтр, CurrentUser
├── user                        — User entity, UserRole, ClientType
├── services                    — каталог услуг (EcoService, ServiceCategory)
├── news                        — новости
├── employee                    — публичные сотрудники сайта
├── tariff                      — тарифы (TariffMode)
├── order                       — Order, OrderDocument, OrderComment, OrderHistory,
│                                 OrderPrimaryDocument, LaboratoryMeasurementAgreement,
│                                 LaboratoryResultDocument
│                                 enums: OrderStatus, ContractStatus, PaymentStatus,
│                                        DocumentType, CommentVisibility,
│                                        PrimaryDocumentStatus, MeasurementAgreementStatus,
│                                        LabResultDocumentStatus
├── notification                — Notification, NotificationAudience
├── payment                     — Payment (история счетов, долги)
├── client                      — CRM-агрегат для staff (clients summary)
├── storage                     — FileStorageService (GridFS) + FileController
├── config                      — SecurityConfig, DataSeeder
└── common                      — ApiResponse, GlobalExceptionHandler, RuDateFormatter, исключения
```

В каждом доменном пакете: `Entity`, `Repository` (`JpaRepository`), `Service` (`@Service`+`@Transactional`), `Controller` (`@RestController`), и подпакет `dto` с records.

## Архитектура и соглашения

- **Контроллеры всегда возвращают `ApiResponse<T>`** (`{ data, message }`), потому что фронтовский `services/api.ts` ждёт именно такой формат.
- **DTO — Java records** (request/response). Сущности — обычные классы с геттерами/сеттерами (нужно JPA).
- **Даты в DTO форматируются на русском** через `kz.eco.common.util.RuDateFormatter` (`d MMMM yyyy`, `d MMMM yyyy, HH:mm`) — фронт ожидает строки вида `12 апреля 2026, 16:20`.
- **ID каталогов (`services`, `news`, `employees`, `tariffs`)** — slug-строки (`eco-design`, `permits`, `chief`...), как в моке.
- **ID заявок** — формат `ORD-XXXX`, генерируется в `OrderService.generateOrderId()`.
- **Авторизация** — JWT в заголовке `Authorization: Bearer <token>`. Фильтр — `kz.eco.auth.JwtAuthenticationFilter`. Получение текущего пользователя — `CurrentUser.get()` / `CurrentUser.getOrNull()`.
- **Ошибки** — кидать `NotFoundException`, `BadRequestException`, `ConflictException`, `UnauthorizedException` из `kz.eco.common.exception`. `GlobalExceptionHandler` маппит их в `ApiResponse` с нужным HTTP-кодом.
- **Доступ**: GET-эндпоинты каталогов и `/api/auth/**` — публичные; остальные `/api/**` требуют JWT; `/api/staff/**`, `/api/admin/**`, `/api/clients`, отдельные методы заявок — `hasAnyRole('MANAGER','ADMIN')` через `@PreAuthorize`.

### Хранение файлов (MongoDB GridFS)

- `OrderDocument.storedPath` хранит **GridFS ObjectId** (hex-строку), если файл реально загружен; для legacy-записей из сидера он `null` (есть только имя файла).
- Загрузка: `POST /api/orders/{id}/files` (multipart/form-data, поле `file`, опционально `type`).
- Скачивание: `GET /api/files/documents/{documentId}` — отдаёт поток с `Content-Disposition: attachment` (auth, проверка владения).
- Сервис: `kz.eco.storage.FileStorageService` — обёртка над `GridFsTemplate`. Метаданные в GridFS включают `orderId`, `uploadedBy`, `originalName`.

### MongoDB (Spring Boot 4)

Подключение задаётся **`spring.mongodb.uri`** в `application-docker.properties` (не `spring.data.mongodb.uri` — в Boot 4 драйвер иначе уходит на `localhost:27017`). GridFS-настройки по-прежнему в `spring.data.mongodb.*` (например `auto-index-creation`).

### H2 / MySQL нюансы

- `value` — зарезервированное слово в H2 (и иногда в MySQL), поэтому `@ElementCollection` колонки названы `item_value`. Не возвращайте имя `value`.
- В `@Entity Order` имя таблицы — `orders`, чтобы не конфликтовать с SQL `ORDER`.
- При смене схемы и `ddl-auto=update` — Hibernate доливает столбцы, но не дропает старые. Для чистого старта в docker: `docker compose down -v`.

## API (под `/api`)

```
POST   /auth/login                   email+password           → token + UserResponse
POST   /auth/staff/login             email+password           → token (только MANAGER/ADMIN)
POST   /auth/register                RegisterRequest          → token
POST   /auth/logout                                           → message
GET    /auth/me                                               → UserResponse  (требует JWT)

GET    /services                | /services/{id}              public
GET    /news                    | /news/{id}                  public
GET    /employees               | /employees/{id}             public
GET    /tariffs                 | /tariffs/{id}               public

GET    /orders                                                client → свои; staff → все
GET    /orders/{id}                                           проверка владения
POST   /orders                       CreateOrderRequest       только клиент
PATCH  /orders/{id}/status           UpdateStatusRequest      staff
PATCH  /orders/{id}/manager          AssignManagerRequest     staff
POST   /orders/{id}/comments         AddCommentRequest        client/staff (internal — staff)
POST   /orders/{id}/documents        UploadDocumentRequest    JSON с именем файла
POST   /orders/{id}/files            multipart: file, type    реальная загрузка → MongoDB GridFS
POST   /orders/{id}/contract         SendContractRequest      staff
POST   /orders/{id}/sign             SignContractRequest      client
POST   /orders/{id}/pay              PayOrderRequest          client

── Primary documents (staff) ──
POST   /staff/orders/{id}/primary-documents            запросить документ у клиента
PATCH  /staff/orders/{id}/primary-documents/{docId}    утвердить/отклонить/запросить исправление

── Primary documents (client) ──
POST   /client/orders/{id}/primary-documents/{docId}        загрузить запрошенный документ
DELETE /client/orders/{id}/primary-documents/{docId}/file   удалить загруженный файл
POST   /client/orders/{id}/primary-documents/review         отправить все на проверку

── Laboratory primary documents (staff) ──
POST   /staff/orders/{id}/laboratory/primary-documents       запросить лаб. документ
PATCH  /staff/orders/{id}/laboratory/primary-documents/{docId}  обновить статус

── Laboratory primary documents (client) ──
POST   /client/orders/{id}/laboratory/primary-documents/{docId}  загрузить лаб. документ

── Measurement agreement (staff) ──
PATCH  /staff/orders/{id}/laboratory/measurement              сохранить черновик
POST   /staff/orders/{id}/laboratory/measurement/send         отправить клиенту
PATCH  /staff/orders/{id}/laboratory/measurement/status       обновить статус

── Measurement agreement (client) ──
POST   /client/orders/{id}/laboratory/measurement/respond     принять/перенести

── Laboratory results (staff) ──
POST   /staff/orders/{id}/laboratory/results                  загрузить результат
PATCH  /staff/orders/{id}/laboratory/results/{docId}          обновить статус результата

── Payment ──
PATCH  /staff/payments/{id}                                   обновить детали платежа

GET    /files/documents/{docId}                               скачать файл (только владелец/staff)

GET    /documents                                             client → свои; staff → все
GET    /notifications                                         фильтр по audience+role
GET    /payments                                              client → свои; staff → все
GET    /clients                                               staff → CRM-список
```

## Бизнес-процесс заявки

1. Клиент `POST /orders` — статус `Новая`, `contractStatus=not_sent`, `paymentStatus=not_sent`.
2. Сотрудник запрашивает первичные документы: `POST /staff/orders/{id}/primary-documents`.
3. Клиент загружает документы: `POST /client/orders/{id}/primary-documents/{docId}`, затем отправляет на проверку: `POST .../review`.
4. Сотрудник проверяет: `PATCH /staff/orders/{id}/primary-documents/{docId}` (approve/reject/needs_fix).
5. Сотрудник `POST /orders/{id}/contract` — `contractStatus=sent`, `paymentStatus=pending`.
6. Клиент `POST /orders/{id}/sign` — `contractStatus=signed`.
7. Клиент `POST /orders/{id}/pay` — `paymentStatus=paid`.
8. Сотрудник через `PATCH /orders/{id}/status` ведёт статусы: `Новая → В обработке → В работе → На проверке → Готово → Завершено`.

### Лабораторный подпроцесс (для заявок с serviceId=laboratory)

1. Сотрудник запрашивает лаб. документы: `POST /staff/orders/{id}/laboratory/primary-documents`.
2. Клиент загружает: `POST /client/orders/{id}/laboratory/primary-documents/{docId}`.
3. Сотрудник создает согласование замера: `PATCH .../laboratory/measurement` → `POST .../send`.
4. Клиент принимает/переносит: `POST /client/orders/{id}/laboratory/measurement/respond`.
5. Сотрудник загружает результаты: `POST .../laboratory/results`.

`OrderStatus.fromLabel(...)` принимает русские лейблы (например, `"В работе"`); `OrderStatus.valueOf(...)` — enum-имена (`AT_WORK`).

## CORS

Разрешены origin'ы `http://localhost:5173,4173,3000` через свойство `eco.cors.allowed-origins` в `application.properties`. При деплое — обновить.

## Чего сейчас нет (если потребуется добавлять)

- CRUD-эндпоинты для админки (`AdminPage` фронта пока только перечисляет).
- Refresh-токены / logout с blacklist.
- Полный текстовый поиск по заявкам.
- Превью изображений / thumbnail-сервис поверх GridFS.
- Резервное копирование MySQL и Mongo томов.
- Серверное хранение рабочих документов эколога (проектирование/разрешение) — пока хранятся в памяти сессии компонента, не персистятся.
