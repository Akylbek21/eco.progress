# CRM Employee Management - Developer Quick Reference

**Последнее обновление:** 2026-08-12

---

## 🗺️ Навигация по коду

### Frontend - Document Flow Members Management

```
src/features/document-flow/
├── pages/
│   └── MembersPage.tsx                 # MAIN: Страница управления членами
├── api/
│   └── documentFlowApi.ts              # API client
└── components/
    ├── MembersTable.tsx                # Таблица членов
    ├── MemberDialog.tsx                # Диалог добавления
    └── MemberRoleSelector.tsx          # Выбор роли

src/features/document-flow-admin/
├── components/
│   └── OrganizationMembersDialog.tsx   # Admin диалог добавления
└── pages/
    └── DocumentFlowAccessAdminPage.tsx # Admin page
```

### Frontend - Lab Employees

```
src/features/laboratories/
├── pages/
│   └── LaboratorySettingsPage.tsx      # Settings с сотрудниками
├── components/
│   ├── EmployeesSection.tsx            # CRUD сотрудников
│   └── EmployeeDialog.tsx              # Диалог добавления
└── api/
    └── laboratoryService.ts            # Lab API client
```

### Services

```
src/services/
├── adminUserService.ts                 # Admin CRUD
├── staffOrderService.ts                # Заявки сотрудников
└── staffDocumentRepositoryService.ts   # Документы сотрудников
```

### Types

```
src/types/
├── staff.ts                            # Staff DTOs
├── laboratory.ts                       # Lab DTOs
└── admin.ts                            # Admin DTOs
```

---

## 🔄 API Endpoints

### Document Flow Members

```bash
# Получить всех членов организации
GET /api/document-flow/members
  Query: page=1&limit=20&role=OWNER&status=ACTIVE

# Добавить члена по email (когда он уже пользователь)
POST /api/document-flow/members
  Body: { email: "user@example.com", role: "DOCUMENT_MANAGER" }

# Изменить роль
PATCH /api/document-flow/members/{id}
  Body: { role: "SIGNER" }

# Активировать
POST /api/document-flow/members/{id}/activate

# Деактивировать
POST /api/document-flow/members/{id}/deactivate
```

### Laboratory Employees

```bash
# Список сотрудников лаборатории
GET /api/laboratories/{id}/employees
  Query: page=1&limit=20&active=true

# Добавить сотрудника
POST /api/laboratories/{id}/employees
  Body: { 
    userId: "123", 
    role: "EXECUTOR",
    canExecuteMeasurements: true,
    canSignProtocols: false
  }

# Обновить
PATCH /api/laboratories/{id}/employees/{employeeId}
  Body: { role: "MANAGER" }

# Удалить (soft delete)
DELETE /api/laboratories/{id}/employees/{employeeId}
```

### Admin Users

```bash
# Список пользователей (⚠️ БЕЗ ПАГИНАЦИИ - ПРОБЛЕМА!)
GET /api/admin/users
  # НУЖНО ДОБАВИТЬ: ?page=1&limit=20&search=name&status=ACTIVE

# Создать пользователя (⚠️ НЕБЕЗОПАСНО - пароль видится)
POST /api/admin/users
  Body: {
    name: "John Doe",
    email: "john@example.com",
    password: "temp123",  # ⚠️ НЕБЕЗОПАСНО!
    role: "ADMIN"
  }

# Обновить
PATCH /api/admin/users/{id}
  Body: { status: "INACTIVE" }

# Изменить статус
PATCH /api/admin/users/{id}/status
  Body: { status: "INACTIVE" }

# Удалить
DELETE /api/admin/users/{id}
```

---

## 🎯 Role Mappings

### Document Flow Roles
```typescript
enum MembershipRole {
  OWNER                  // Владелец организации (all permissions)
  DOCUMENT_FLOW_ADMIN    // Администратор документооборота
  DOCUMENT_MANAGER       // Может управлять документами
  SIGNER                 // Может подписывать документы
  ACCOUNTANT             // Может просматривать финансовые данные
  VIEWER                 // Только чтение
  EXTERNAL_SIGNER        // Внешний подписант (without login)
}
```

### Laboratory Roles
```typescript
enum LaboratoryRole {
  ADMIN                  // Полный доступ
  MANAGER                // Управление работами
  EXECUTOR               // Исполнение измерений
  VIEWER                 // Только чтение
}
```

### Admin Roles
```typescript
enum AdminRole {
  SYSTEM_ADMIN          // Full system access
  SUPPORT_ADMIN         // Support только
  // НУЖНО ОПРЕДЕЛИТЬ: другие роли и permissions
}
```

---

## ⚡ Common Tasks

### Добавить нового члена (текущий процесс)
```typescript
// 1. Пользователь должен быть создан отдельно через adminUserService
const newUser = await adminUserService.createUser({
  email: "john@example.com",
  name: "John Doe",
  role: "USER"
  // ⚠️ Пароль показывается администратору - НЕБЕЗОПАСНО
});

// 2. Потом добавить в организацию
const member = await documentFlowApi.addMember({
  email: newUser.email,
  role: "DOCUMENT_MANAGER"
});

// ⚠️ ПРОБЛЕМА: Процесс разбит на 2 шага, нет приглашений по email
```

### Изменить роль члена
```typescript
await documentFlowApi.updateMemberRole(memberId, {
  role: "SIGNER"
});

// ✅ РАБОТАЕТ, но нет аудита кто и когда это сделал
```

### Получить всех админов
```typescript
const admins = await adminUserService.listUsers();
// ⚠️ ПРОБЛЕМА: Возвращает ВСЕ пользователей, нет пагинации!

// НУЖНО:
// const admins = await adminUserService.listUsers({
//   page: 1,
//   limit: 20,
//   role: "ADMIN",
//   status: "ACTIVE"
// });
```

---

## 🚨 Known Issues & TODOs

### Backend Issues

| Issue | Location | Priority | Status |
|-------|----------|----------|--------|
| No email invitations | `documentFlowApi.ts` | 🔴 P0 | ❌ Not implemented |
| Password visible in UI | `adminUserService.ts` | 🔴 P0 | ❌ Not fixed |
| No pagination on /admin/users | Backend | 🔴 P0 | ❌ Not implemented |
| No audit logging | All endpoints | 🟡 P1 | ❌ Not implemented |
| Duplicate role systems | Lab vs DocFlow | 🟡 P1 | ⚠️ Design issue |
| No RBAC model | All services | 🟡 P1 | ❌ Not designed |

### Frontend Issues

| Issue | Component | Priority |
|-------|-----------|----------|
| No password setup UI | N/A | 🔴 P0 |
| No email invite UI | MembersPage | 🔴 P0 |
| No audit history UI | MembersPage | 🟡 P1 |
| No bulk operations | MembersPage | 🟠 P2 |
| No user search | AdminUserPage | 🟡 P1 |

---

## 🔐 Security Checklist

- [ ] ❌ Пароли НЕ должны видеться в UI
- [ ] ❌ Нет валидации permissions на frontend
- [ ] ❌ Нет защиты от CSRF (если нет CSRF tokens)
- [ ] ❌ Нет rate limiting на endpoints
- [ ] ❌ Нет логирования sensitive действий
- [ ] ❌ Нет encryption паролей в логах

**TODO:** Заполнить эту форму после внедрения fixes

---

## 📝 Existing Documentation

**✅ Уже есть:**
- [docs/document-flow-access-admin-contract.md](../docs/document-flow-access-admin-contract.md) - API контракт
- [docs/protocols-api-audit.md](../docs/protocols-api-audit.md) - Lab API
- [README.md](../README.md) - Общая архитектура

**❌ НЕ хватает:**
- Password Management Flow
- Email Invitation System
- Admin API Reference
- RBAC Model
- Audit Log Specification
- Employee Management Best Practices

---

## 🛠️ Development Setup

### для работы на документооборотом
```bash
cd eco.progress
npm install

# Запустить app
npm run dev

# Перейти на Document Flow
# Маршрут: /document-flow/members (для членов)
# Маршрут: /document-flow-admin (для админа)
```

### Локальное тестирование
```bash
# В mockData.ts уже есть пример членов:
src/data/mockData.ts

# Mock API:
src/services/documentFlowApi.ts (uses mockData)
```

---

## 📚 Key Files to Know

| File | Purpose | Status |
|------|---------|--------|
| `src/features/document-flow/pages/MembersPage.tsx` | Main UI for member management | ✅ Works |
| `src/services/adminUserService.ts` | Admin CRUD | ⚠️ Missing features |
| `docs/document-flow-access-admin-contract.md` | API spec | ✅ Documented |
| `src/types/staff.ts` | TypeScript interfaces | ✅ Defined |

---

## 🔗 Related Modules

Employee Management связана с:
- **Document Flow** - Members of organization
- **Laboratories** - Lab employees & technicians
- **Admin Panel** - User & access management
- **Authentication** - Password setup & login
- **Notifications** - Email invitations & alerts
- **Audit Log** - Track who changed what

---

## 💡 Tips for Developers

### When adding new feature:
1. Check if it should work for Lab employees too
2. Consider RBAC permissions
3. Add audit logging
4. Document the API endpoint
5. Consider email notifications

### Before committing:
1. Check typescript compilation
2. Run tests (if any)
3. Update documentation
4. Verify API contract matches frontend

### Common Gotchas:
- ⚠️ Lab and DocFlow use different role systems
- ⚠️ Admin endpoints don't have pagination
- ⚠️ No email invitations - must create user first
- ⚠️ Passwords are exposed in admin creation flow
- ⚠️ No audit logging of who changed what

---

## 📞 Contacts & Escalation

**For questions about:**
- **Staff/Employee Management:** Team Lead (Backend)
- **Frontend Components:** Frontend Lead
- **API Contract:** Backend Architect
- **Documentation:** Tech Writer

---

**Last Updated:** 2026-08-12  
**Version:** 1.0  
**Full Audit Report:** [crm-employee-management-audit.md](crm-employee-management-audit.md)
