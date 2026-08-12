# CRM Аудит: Управление сотрудниками (Employee Management)

**Дата аудита:** 2026-08-12  
**Статус:** КРИТИЧЕСКИЙ - Обнаружены значительные пробелы в documentation и функциональности  
**Приоритет:** P0 - Требует немедленного решения для production-готовности

---

## 1. ОБЗОР МОДУЛЯ

CRM система имеет **два независимых модуля** управления сотрудниками:

### 1.1 Лабораторные сотрудники (Laboratory Employees)
- **Статус:** ✅ Полностью функциональны
- **Область:** Управление сотрудниками лаборатории (исполнители, администраторы, подписанты)
- **Версия:** v2 (с полной CRUD операциями)

### 1.2 Члены документооборота (Document Flow Members)
- **Статус:** ⚠️ Частично функциональны (критические пробелы)
- **Область:** Управление членами организации для документооборота
- **Версия:** v1 (базовая CRUD без приглашений)

### 1.3 Администраторы системы (Admin Users)
- **Статус:** ⚠️ Функциональны, но небезопасны
- **Область:** CRUD пользователей администраторами
- **Версия:** v1 (нет пагинации, нет поиска)

---

## 2. ТЕКУЩЕЕ СОСТОЯНИЕ - BACKEND

### 2.1 API Endpoints - Документооборот

| Метод | Endpoint | Параметры | Возвращает | Статус |
|-------|----------|-----------|-----------|--------|
| GET | `/api/document-flow/members` | org context, pagination | `List<DocumentFlowMemberDto>` | ✅ |
| POST | `/api/document-flow/members` | `{email, role}` | `DocumentFlowMemberDto` | ✅ |
| PATCH | `/api/document-flow/members/{id}` | `{role}` | `DocumentFlowMemberDto` | ✅ |
| POST | `/api/document-flow/members/{id}/activate` | - | `DocumentFlowMemberDto` | ✅ |
| POST | `/api/document-flow/members/{id}/deactivate` | - | `DocumentFlowMemberDto` | ✅ |

**Контрактные документы:**
- [document-flow-access-admin-contract.md](document-flow-access-admin-contract.md) - API контракт для админа
- [document-flow-contract-matrix-v3.md](document-flow-contract-matrix-v3.md) - Матрица интеграции

### 2.2 API Endpoints - Лабораторные сотрудники

| Метод | Endpoint | Параметры | Возвращает | Статус |
|-------|----------|-----------|-----------|--------|
| GET | `/laboratories/{id}/employees` | path id | `List<LaboratoryEmployee>` | ✅ |
| GET | `/laboratories/eligible-employees` | org context | `List<UserDto>` | ✅ |
| POST | `/laboratories/{id}/employees` | `{userId, role, ...}` | `LaboratoryEmployee` | ✅ |
| PATCH | `/laboratories/{id}/employees/{id}` | `{role, ...}` | `LaboratoryEmployee` | ✅ |
| DELETE | `/laboratories/{id}/employees/{id}` | - | - | ✅ |

**Документация:**
- [protocols-api-audit.md](protocols-api-audit.md) - Полный API аудит

### 2.3 API Endpoints - Администраторы

| Метод | Endpoint | Параметры | Возвращает | Статус |
|-------|----------|-----------|-----------|--------|
| GET | `/api/admin/users` | **нет пагинации/фильтра** | `List<AdminUserRecord>` | ❌ |
| POST | `/api/admin/users` | `{name, email, password, role, ...}` | `AdminUserRecord` | ✅ |
| PATCH | `/api/admin/users/{id}` | любые поля | `AdminUserRecord` | ✅ |
| PATCH | `/api/admin/users/{id}/status` | `{status}` | `AdminUserRecord` | ✅ |
| DELETE | `/api/admin/users/{id}` | - | - | ✅ |

---

## 3. ТЕКУЩЕЕ СОСТОЯНИЕ - FRONTEND

### 3.1 Компоненты для документооборота

**Полная страница управления членами:**
- [src/features/document-flow/pages/MembersPage.tsx](../src/features/document-flow/pages/MembersPage.tsx)
  - Список членов с фильтрацией
  - Добавление по email
  - Изменение ролей
  - Активация/деактивация

**Диалоговое окно добавления членов:**
- [src/features/document-flow-admin/components/OrganizationMembersDialog.tsx](../src/features/document-flow-admin/components/OrganizationMembersDialog.tsx)

### 3.2 Компоненты для лабораторных сотрудников

**Управление сотрудниками лаборатории:**
- Полный CRUD интерфейс в settings лаборатории
- Формы добавления/изменения сотрудников
- Таблицы с фильтрацией и сортировкой

### 3.3 Компоненты для администраторов

**Admin user management:**
- [src/services/adminUserService.ts](../src/services/adminUserService.ts)
  - `listUsers()` - получить всех пользователей
  - `createUser(data)` - создать пользователя
  - `updateUser(id, data)` - обновить пользователя
  - `deleteUser(id)` - удалить пользователя

---

## 4. КРИТИЧЕСКИЕ ПРОБЕЛЫ И РИСКИ

### 🔴 P0: Приоритет - Критические пробелы

#### 4.1 Отсутствует система приглашения по email

**Проблема:**
- Членов можно добавить только если у них уже есть userId в системе
- Нет механизма приглашения по email адресу
- Нет email-уведомлений о добавлении в организацию
- Нет системы установки пароля для новых членов

**Документация:** Упомянуто в [document-flow-backend-gaps.md](document-flow-backend-gaps.md) § 2

**Влияние:**
- Невозможно пригласить нового сотрудника, не зная его внутренний ID
- Плохой UX: администратор должен сначала создать пользователя отдельно
- Риск безопасности: временные пароли могут быть показаны на экране

**Требуемая функциональность:**
```typescript
// Нужен POST /api/document-flow/members/invite
interface InviteMemberRequest {
  email: string;
  role: MembershipRole;
  expiresIn?: 'days' | 'weeks'; // TTL приглашения
}

interface InviteMemberResponse {
  invitationToken: string;
  invitationEmail: string;
  expiresAt: DateTime;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'DECLINED';
}
```

---

#### 4.2 Отсутствует управление жизненным циклом пароля

**Проблема:**
- Администратор создает пароль и показывает его на экране
- Нет безопасного способа установки пароля пользователем
- Нет функции "забыл пароль"
- Нет одноразовых ссылок установки пароля
- При деактивации сотрудника сессия не отзывается

**Документация:** [document-flow-backend-gaps.md](document-flow-backend-gaps.md) § 4

**Влияние:**
- Высокий риск безопасности (пароли видны в UI)
- Невозможно безопасно дать новому сотруднику доступ
- Нарушение политики безопасности: обсмотр паролей в логах браузера

**Требуемая функциональность:**
```typescript
// POST /auth/setup-password/{token}
interface SetupPasswordRequest {
  newPassword: string;
  confirmPassword: string;
}

// POST /auth/forgot-password
interface ForgotPasswordRequest {
  email: string;
}

// POST /auth/reset-password/{token}
interface ResetPasswordRequest {
  newPassword: string;
}
```

---

#### 4.3 GET /api/admin/users без пагинации и поиска

**Проблема:**
- Endpoint возвращает ВСЕ пользователей в системе без пагинации
- Нет фильтрации по имени, email или статусу
- Нет сортировки
- При масштабировании (1000+ пользователей) будет перегруз сети и памяти

**Влияние:**
- Плохая масштабируемость
- Потенциальная утечка информации (видны все пользователи)
- Медленная работа интерфейса администратора

**Требуемое:**
```typescript
GET /api/admin/users?page=1&limit=20&search=john&sort=name&order=asc
```

---

#### 4.4 Отсутствует атомарное создание Организации + Подписки + Владельца

**Проблема:**
- Нет единого endpoint для создания организации + назначения владельца + привязки плана
- Риск создания осиротелых подписок без владельца
- Несогласованное состояние между таблицами Organization, Subscription, User

**Документация:** [document-flow-backend-gaps.md](document-flow-backend-gaps.md) § 1

**Требуемая функциональность:**
```typescript
// POST /api/organizations/create-with-subscription
interface CreateOrgWithSubscriptionRequest {
  organizationName: string;
  planCode: string;
  ownerEmail?: string;
  ownerUserId?: string;
  ownerRole: 'OWNER' | 'ADMIN';
}
```

---

### 🟡 P1: Высокий приоритет - Важные пробелы

#### 4.5 Отсутствует система аудита/истории изменений

**Проблема:**
- Нет логирования изменения ролей члена
- Нет истории активации/деактивации
- Нет отслеживания, кто и когда добавил сотрудника
- Нет возможности восстановить старые версии прав доступа

**Влияние:**
- Невозможно аудитировать доступ сотрудников
- Проблемы при разборе инцидентов безопасности
- Несоответствие требованиям compliance

**Требуемая функциональность:**
```typescript
// GET /api/document-flow/members/{id}/audit-log
interface MemberAuditLog {
  id: string;
  memberId: string;
  action: 'CREATED' | 'UPDATED' | 'ACTIVATED' | 'DEACTIVATED';
  oldValues: Record<string, any>;
  newValues: Record<string, any>;
  changedBy: UserDto;
  changedAt: DateTime;
}
```

---

#### 4.6 Несогласованность между системами

**Проблема:**
- **Два независимых модуля:** Лабораторные сотрудники и Члены документооборота
- **Разные DTOs:** `LaboratoryEmployee` vs `DocumentFlowMember` vs `AdminUserRecord`
- **Разные правила:** Разные роли, разные статусы, разные правила активации
- **Нет синхронизации:** Изменение в одной системе не отражается в другой

**Влияние:**
- Сложность поддержки и разработки
- Риск несогласованности данных
- Трудно расширять функциональность
- Запутанный API для клиентов

**Требуемое:**
- Единая система ролей и статусов
- Единая DTO для всех типов сотрудников
- Синхронизация данных между модулями
- Единая история и аудит

---

#### 4.7 Отсутствует функция поиска по имени/email администратором

**Проблема:**
- Администратор может видеть только полный список пользователей
- Нет поиска по email или имени
- Нет фильтрации по статусу (active/inactive)
- Нет сортировки по полям

**Влияние:**
- Плохой UX для администраторов при поиске пользователя
- Невозможно быстро найти пользователя для добавления его в организацию

---

### 🟠 P2: Средний приоритет - Нежелательные пробелы

#### 4.8 Отсутствует система разрешений (RBAC) для администраторов

**Проблема:**
- Нет четкой разницы между ADMIN и OWNER в контексте tenant
- Нет механизма ограничения прав ADMIN
- Не определены permissions для каждой роли

**Документация:** Упомянуто в [document-flow-access-admin-contract.md](document-flow-access-admin-contract.md)

---

#### 4.9 Нет массовых операций

**Проблема:**
- Нет endpoint для добавления нескольких членов за раз
- Нет bulk-операции для изменения ролей нескольких сотрудников
- Нет bulk-деактивации

**Влияние:**
- Для большой организации (50+ сотрудников) нужно будет 50+ API вызовов

---

#### 4.10 Нет миграции/импорта сотрудников

**Проблема:**
- Невозможно импортировать список сотрудников из CSV/Excel
- Каждого сотрудника нужно добавлять вручную через UI

**Влияние:**
- Плохой UX для миграции существующих организаций в систему

---

## 5. DOCUMENTATION GAPS

### 5.1 Какая документация существует ✅

| Документ | Статус | Полнота |
|----------|--------|---------|
| [document-flow-access-admin-contract.md](document-flow-access-admin-contract.md) | ✅ | 80% - есть API контракт, но нет деталей о жизненном цикле |
| [document-flow-contract-matrix-v3.md](document-flow-contract-matrix-v3.md) | ✅ | 70% - API endpoints, нет примеров и error-handling |
| [protocols-api-audit.md](protocols-api-audit.md) | ✅ | 80% - лабораторные сотрудники задокументированы хорошо |
| [pek-backend-gaps.md](docs/pek-backend-gaps.md) | ✅ | 60% - упоминает пробелы в членстве |

### 5.2 Какая документация отсутствует ❌

| Документ | Необходимость | Содержание |
|----------|---------------|-----------|
| **CRM Employee Roles Specification** | P0 | Полный список ролей, permissions для каждой роли, наследование ролей |
| **Password Management Flow** | P0 | Setup password, forgot password, reset password, session management |
| **Email Invitation System Spec** | P0 | Invitation flow, email templates, expiration, retry logic |
| **Admin User Management API** | P0 | Full API spec с примерами, search/filter/pagination |
| **Organization + Subscription + Owner Creation** | P0 | Процесс создания организации, роли владельца, передача владения |
| **Employee Audit Log Specification** | P1 | Какие действия логируются, структура логов, retention policy |
| **RBAC Model Documentation** | P1 | Модель ролей и разрешений, наследование, ограничения |
| **Staff Management Best Practices** | P2 | Как правильно управлять сотрудниками, примеры workflows |
| **Data Migration Guide** | P2 | Как импортировать сотрудников из других систем |

---

## 6. FRONTEND DOCUMENTATION GAPS

### 6.1 Что есть ✅

- [src/features/document-flow/pages/MembersPage.tsx](../src/features/document-flow/pages/MembersPage.tsx) - Полная реализация UI
- [src/features/document-flow-admin/components/OrganizationMembersDialog.tsx](../src/features/document-flow-admin/components/OrganizationMembersDialog.tsx) - Диалог добавления

### 6.2 Что отсутствует ❌

| Функция | Необходимость | Статус |
|---------|---------------|--------|
| UI для установки пароля | P0 | ❌ Не реализовано |
| UI для "забыл пароль" | P0 | ❌ Не реализовано |
| UI для приглашения по email | P0 | ❌ Не реализовано |
| History/Audit log UI | P1 | ❌ Не реализовано |
| Bulk import (CSV/Excel) | P2 | ❌ Не реализовано |
| Admin user search page | P1 | ❌ Нет фильтрации |
| Member activity log | P1 | ❌ Не реализовано |

---

## 7. ТИПЫ ДАННЫХ И КОНТРАКТЫ

### 7.1 Document Flow Member DTO

```typescript
interface DocumentFlowMemberDto {
  id: string;
  organizationId: string;
  userId: string;
  fullName: string;
  email: string;
  role: MembershipRole; // OWNER | DOCUMENT_FLOW_ADMIN | DOCUMENT_MANAGER | SIGNER | ACCOUNTANT | VIEWER | EXTERNAL_SIGNER
  status: MembershipStatus; // ACTIVE | INACTIVE | PENDING | EXPIRED | DECLINED
  membershipStatus: string;
  createdAt: DateTime;
  createdBy?: string;
  updatedAt?: DateTime;
  updatedBy?: string;
  deactivatedAt?: DateTime;
}

enum MembershipRole {
  OWNER = 'OWNER',
  DOCUMENT_FLOW_ADMIN = 'DOCUMENT_FLOW_ADMIN',
  DOCUMENT_MANAGER = 'DOCUMENT_MANAGER',
  SIGNER = 'SIGNER',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER',
  EXTERNAL_SIGNER = 'EXTERNAL_SIGNER'
}

enum MembershipStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',          // После приглашения, до принятия
  EXPIRED = 'EXPIRED',          // Приглашение истекло
  DECLINED = 'DECLINED'         // Пользователь отклонил приглашение
}
```

### 7.2 Laboratory Employee DTO

```typescript
interface LaboratoryEmployeeDto {
  id: string;
  version: number;
  laboratoryId: string;
  userId: string;
  fullName: string;
  position?: string;
  email: string;
  phone?: string;
  employeeNumber?: string;
  qualification?: string;
  role: LaboratoryRole; // ADMIN | MANAGER | EXECUTOR | VIEWER
  canExecuteMeasurements: boolean;
  canApproveProtocols: boolean;
  canSignProtocols: boolean;
  active: boolean;
  deactivatedAt?: DateTime;
}

enum LaboratoryRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  EXECUTOR = 'EXECUTOR',
  VIEWER = 'VIEWER'
}
```

### 7.3 Admin User Record DTO

```typescript
interface AdminUserRecordDto {
  id: string;
  role: AdminRole;
  type: UserType; // INDIVIDUAL | ORGANIZATION
  email: string;
  name: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  iin?: string;              // ИНН физ. лица
  city?: string;
  companyName?: string;
  bin?: string;              // БИН компании
  organizationType?: string;
  legalAddress?: string;
  position?: string;
  status: UserStatus;        // ACTIVE | INACTIVE | PENDING | DELETED
  lastLoginAt?: DateTime;
  createdAt: DateTime;
  updatedAt?: DateTime;
}

enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',       // Ожидает принятия приглашения
  DELETED = 'DELETED'        // Помечен на удаление (soft delete)
}
```

---

## 8. РИСК-АНАЛИЗ

### 8.1 Риски безопасности 🔐

| Риск | Серьезность | Воздействие | Решение |
|------|-------------|-------------|---------|
| Пароли видны в UI | 🔴 Критичный | Утечка паролей, доступ к аккаунтам | Безопасная система setup password |
| Полный список пользователей доступен | 🟡 Высокий | Утечка информации, социальная инженерия | Пагинация + аутентификация |
| Нет логирования действий | 🟡 Высокий | Невозможно отследить кто изменил доступ | Система audit log |
| Сессии не отзываются при деактивации | 🔴 Критичный | Деактивированный сотрудник сохраняет доступ | Immediate session revocation |

### 8.2 Риски функциональности 📊

| Риск | Серьезность | Воздействие | Решение |
|------|-------------|-------------|---------|
| Нет приглашений по email | 🔴 Критичный | Невозможно пригласить сотрудника | Email invitation system |
| Несогласованность ролей между модулями | 🟡 Высокий | Путаница с правами доступа | Единая система ролей |
| Отсутствует пароль для новых пользователей | 🔴 Критичный | Новые пользователи не могут войти | Password setup flow |
| Нет массовых операций | 🟠 Средний | Долгая работа при миграции | Bulk endpoints |

### 8.3 Риски масштабируемости 📈

| Риск | Серьезность | При скольких пользователях проявляется | Решение |
|------|-------------|----------------------------------------|---------|
| GET /admin/users без пагинации | 🟡 Высокий | 100+ пользователей | Добавить pagination |
| Нет кеша для списка членов | 🟠 Средний | 1000+ членов | Добавить кеширование |
| Нет индексов на email | 🟠 Средний | 10000+ пользователей | Создать индекс |

---

## 9. РЕКОМЕНДАЦИИ И ПЛАН ДЕЙСТВИЙ

### 9.1 НЕМЕДЛЕННЫЕ ДЕЙСТВИЯ (Sprint 1-2)

**КРИТИЧЕСКИЕ (Blocking production):**

1. **Внедрить безопасное управление паролями**
   - Создать endpoint для setup password
   - Удалить показ паролей в UI
   - Время: 3-5 дней
   - Документ: Password Management Flow.md

2. **Внедрить систему приглашений по email**
   - POST `/api/document-flow/members/invite`
   - Email templates
   - Token management (TTL, хранение)
   - Время: 5-7 дней
   - Документ: Email Invitation System.md

3. **Добавить пагинацию к GET /admin/users**
   - Query parameters: page, limit, search, sort
   - Базовая фильтрация по email/name/status
   - Время: 1-2 дня
   - Документ: Admin API Specification.md

4. **Создать документацию по ролям и разрешениям**
   - Полный список всех ролей (Document Flow, Lab, Admin)
   - Матрица разрешений
   - Правила наследования ролей
   - Время: 1 день
   - Документ: CRM Roles and Permissions.md

---

### 9.2 ВЫСОКИЙ ПРИОРИТЕТ (Sprint 3-4)

**ВАЖНЫЕ (Улучшают функциональность и UX):**

1. **Внедрить систему аудита**
   - Логирование всех изменений членства
   - GET `/api/document-flow/members/{id}/audit-log`
   - UI для просмотра истории
   - Время: 3-4 дня
   - Документ: Audit Log Specification.md

2. **Унифицировать системы управления сотрудниками**
   - Выбрать единую DTO для всех типов сотрудников
   - Унифицировать ролей и статусы
   - Создать общий API
   - Время: 5-7 дней
   - Документ: Unified Employee Management.md

3. **Создать документацию по существующему состоянию**
   - API Reference для Document Flow Members
   - API Reference для Lab Employees
   - Frontend Documentation
   - Примеры использования
   - Время: 3-5 дней
   - Документы: API_Reference_*.md

4. **Внедрить логирование действий администратора**
   - Логирование создания/удаления пользователей
   - Логирование изменения ролей
   - Время: 2-3 дня

---

### 9.3 СРЕДНИЙ ПРИОРИТЕТ (Sprint 5+)

**НЕЖЕЛАТЕЛЬНЫЕ (Улучшают UX и масштабируемость):**

1. **Внедрить массовые операции**
   - Bulk invite members
   - Bulk update roles
   - Bulk deactivate
   - Время: 3-4 дня
   - Документ: Bulk Operations API.md

2. **Внедрить импорт из CSV**
   - Frontend UI для загрузки CSV
   - Backend обработка CSV
   - Валидация и error handling
   - Время: 4-5 дней

3. **Создать RBAC модель**
   - Define permissions для каждой роли
   - Permission checking в endpoints
   - Role inheritance rules
   - Время: 5-7 дней
   - Документ: RBAC Model.md

4. **Улучшить UX админ-панели**
   - Поиск по имени/email
   - Фильтрация по статусу
   - Сортировка
   - Время: 2-3 дня

---

## 10. CHECKLIST ДОКУМЕНТАЦИИ

**Нужно создать следующие документы:**

- [ ] `CRM_Employee_Roles_and_Permissions.md` - Полная спецификация ролей
- [ ] `Password_Management_Flow.md` - Setup, reset, forgot password
- [ ] `Email_Invitation_System.md` - Invitation flow, templates, expiration
- [ ] `Admin_API_Specification.md` - Full API reference с pagination
- [ ] `Audit_Log_Specification.md` - What to log, structure, retention
- [ ] `Unified_Employee_Management.md` - Plan унификации
- [ ] `API_Reference_DocumentFlow_Members.md` - Полный API reference
- [ ] `API_Reference_Laboratory_Employees.md` - Полный API reference
- [ ] `Frontend_Employee_Management_Guide.md` - Frontend documentation
- [ ] `RBAC_Model_Documentation.md` - Roles and permissions matrix
- [ ] `Bulk_Operations_API.md` - Bulk operations specification
- [ ] `CSV_Import_Specification.md` - CSV import flow

---

## 11. ТАБЛИЦА КОМПЕТЕНТНОСТИ

| Аспект | Документировано | Протестировано | Production-ready |
|--------|-----------------|-----------------|------------------|
| Basic CRUD членов | ✅ 70% | ✅ | ✅ |
| Basic CRUD лаб. сотр. | ✅ 80% | ✅ | ✅ |
| Admin user management | ⚠️ 50% | ⚠️ | ❌ |
| Email invitations | ❌ 0% | ❌ | ❌ |
| Password management | ❌ 0% | ❌ | ❌ |
| Audit logging | ❌ 0% | ❌ | ❌ |
| RBAC model | ❌ 0% | ❌ | ❌ |
| Search & filtering | ⚠️ 40% | ⚠️ | ❌ |
| Bulk operations | ❌ 0% | ❌ | ❌ |
| Error handling | ⚠️ 50% | ⚠️ | ⚠️ |

---

## 12. SUMMARY И ВЫВОДЫ

### 12.1 Текущее состояние

✅ **Что работает:**
- Basic CRUD для Document Flow Members
- Полный функционал лабораторных сотрудников
- Базовое администрирование пользователей

❌ **Что критически не работает:**
- Email приглашения (0% готовности)
- Управление паролями (0% готовности)
- Поиск и фильтрация админ-пользователей (40% готовности)
- Аудит и логирование (0% готовности)

### 12.2 Производственная готовность

🔴 **КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ:** Система НЕ ГОТОВА к production без решения 4 критических пробелов:

1. Нет безопасного управления паролями → **РИСК БЕЗОПАСНОСТИ**
2. Нет email приглашений → **НЕРАБОТАЮЩИЙ UX**
3. Нет аудита → **НАРУШЕНИЕ COMPLIANCE**
4. Несогласованность между модулями → **ТЕХДОЛГ**

### 12.3 Время для production-готовности

- **Минимум:** 2-3 недели (только критические пробелы)
- **Рекомендуемо:** 4-6 недель (+ высокий приоритет)
- **Полная готовность:** 2-3 месяца (+ средний приоритет)

### 12.4 Ресурсы

- **Backend разработчик:** 6-8 недель
- **Frontend разработчик:** 4-5 недель
- **QA тестер:** 3-4 недели
- **Technical Writer:** 2 недели

---

## 13. МЕТРИКИ ПРОГРЕССА

После внедрения можно отслеживать:

| Метрика | Текущее | Целевое |
|---------|---------|---------|
| Документированные API endpoints | 70% | 100% |
| Code coverage для staff module | ? | 80%+ |
| Email invitation success rate | N/A | 98%+ |
| Password reset time (среднее) | N/A | < 5 min |
| Audit log entries сохраняются | 0% | 100% |
| User search response time | N/A | < 500ms |

---

## Приложение А: Файлы, задействованные в аудите

### Документация
- docs/document-flow-backend-gaps.md
- docs/document-flow-access-admin-contract.md
- docs/document-flow-contract-matrix-v3.md
- docs/document-flow-full-logic.md
- docs/protocols-api-audit.md
- docs/pek-backend-gaps.md

### Frontend компоненты
- src/features/document-flow/pages/MembersPage.tsx
- src/features/document-flow-admin/components/OrganizationMembersDialog.tsx
- src/services/adminUserService.ts
- src/services/staffOrderService.ts

### Backend контракты (предположительно)
- /api/document-flow/members (CRUD)
- /api/laboratories/{id}/employees (CRUD)
- /api/admin/users (CRUD)

---

**Аудит завершен:** 2026-08-12  
**Версия отчета:** 1.0  
**Рекомендуемое действие:** Созвать встречу team lead + backend architect для планирования Sprint 1-2
