# CRM Employee Management - Acceptance Plan & Backend Integration

**Дата:** 2026-08-12  
**Версия:** Final (для deployment)  
**Статус:** Ready for testing

---

## 📋 Задачи для завершения

### Phase 1: Backend Routes Registration ⏳

**Файл:** `src/main.tsx` или `src/router/routes.tsx`

```tsx
// Добавить эти маршруты
<Route path="/auth/setup-password/:token" element={<SetupPasswordPage />} />
<Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />

// И обновить Login Page
<Link to="/forgot-password">Забыли пароль?</Link>
```

**Проверка:** Все 3 страницы доступны через URL в браузере

---

### Phase 2: Backend Endpoints Verification ⏳

| Endpoint | Метод | Статус | Примечание |
|----------|--------|--------|-----------|
| `/document-flow/members/invite` | POST | ❓ | Должен возвращать member с status='INVITED' |
| `/document-flow/members/{id}/resend-invitation` | POST | ❓ | Для переотправки приглашения |
| `/document-flow/members/{id}/audit-log` | GET | ❓ | Пагинированный список AuditEvent |
| `/auth/setup-password` | POST | ❓ | Установка пароля по токену |
| `/auth/reset-password` | POST | ❓ | Восстановление пароля по токену |
| `/auth/forgot-password` | POST | ❓ | Отправка письма восстановления |
| `/auth/validate-setup-token` | POST | ❓ | Проверка валидности токена setup |
| `/auth/validate-reset-token` | POST | ❓ | Проверка валидности токена reset |
| `/admin/users` | GET | ⚠️ | Нужна пагинация вместо полного списка |

**Что проверить:**

```bash
# 1. Проверить /document-flow/members/invite
curl -X POST http://localhost:8080/api/document-flow/members/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@example.com", "role": "VIEWER"}'
# Expected response:
# {
#   "id": 123,
#   "email": "newuser@example.com",
#   "role": "VIEWER",
#   "status": "INVITED",
#   "invitedAt": "2026-08-12T10:00:00Z",
#   "userId": null
# }

# 2. Проверить /admin/users с пагинацией
curl -X GET "http://localhost:8080/api/admin/users?page=0&limit=20&sort=name,asc" \
  -H "Authorization: Bearer $TOKEN"
# Expected response:
# {
#   "items": [...],
#   "page": 0,
#   "limit": 20,
#   "total": 150,
#   "totalPages": 8
# }
```

---

### Phase 3: Frontend Components Testing ⏳

#### MembersPage.tsx

**Scenario 1: Пригласить нового сотрудника**
```
1. Нажать "Пригласить по email"
2. Ввести email: user@example.com
3. Выбрать роль: VIEWER
4. Нажать "Пригласить"
5. ✅ Ожидание: Увидеть "Приглашение отправлено на user@example.com"
6. ✅ Таблица обновится: новый участник появится со статусом "ПРИГЛАШЁН"
```

**Scenario 2: Переотправить приглашение**
```
1. В таблице найти участника со статусом "ПРИГЛАШЁН"
2. Нажать на кнопку "Отправить заново"
3. ✅ Ожидание: Письмо отправлено повторно
```

**Scenario 3: Посмотреть историю действий**
```
1. Нажать на History icon у участника
2. ✅ Ожидание: Откроется dialog с событиями (creation, role change, etc)
3. Пролистать события (если много)
4. ✅ Ожидание: Пагинация работает
```

**Scenario 4: Фильтрация участников**
```
1. Нажать на filter icon
2. Выбрать статус "INVITED"
3. ✅ Ожидание: Таблица покажет только приглашенных
```

---

#### OrganizationMembersDialog.tsx

**Scenario 1: Пригласить по email (tab 1)**
```
1. Открыть dialog "Сотрудники"
2. Убедиться что выбран tab "Пригласить по email"
3. Ввести email
4. Выбрать роль
5. Нажать "Пригласить"
6. ✅ Ожидание: Уведомление об отправке
7. ✅ Ожидание: Участник появится в списке со статусом INVITED
```

**Scenario 2: Добавить существующего (tab 2)**
```
1. Открыть dialog
2. Нажать "Добавить существующего"
3. Выбрать пользователя из Autocomplete
4. Выбрать роль
5. Нажать "Добавить"
6. ✅ Ожидание: Пользователь добавлен в организацию
```

**Проверка:** ❌ Пароля нет нигде!

---

#### SetupPasswordPage.tsx

**Scenario 1: Установить пароль через email ссылку**
```
1. Получить email с приглашением и ссылкой
2. Кликнуть на ссылку: /auth/setup-password/token123
3. ✅ Ожидание: Страница загрузится, токен валидируется
4. Ввести пароль: MyPassword123
5. Ввести подтверждение: MyPassword123
6. Нажать "Установить пароль"
7. ✅ Ожидание: "Пароль установлен успешно"
8. ✅ Ожидание: Redirect на /login через 2 сек
9. Логин с новым паролем
10. ✅ Ожидание: Вход успешен
```

**Scenario 2: Невалидный токен**
```
1. Перейти на /auth/setup-password/invalidtoken
2. ✅ Ожидание: Error alert "Ссылка недействительна или истекла"
3. Кнопка "На страницу входа" доступна
```

**Scenario 3: Несовпадающие пароли**
```
1. Ввести пароль: MyPassword123
2. Ввести подтверждение: OtherPassword123
3. Нажать "Установить пароль"
4. ✅ Ожидание: Error "Пароли не совпадают"
5. Кнопка остается disabled
```

---

#### ForgotPasswordPage.tsx

**Scenario 1: Восстановление пароля**
```
1. Перейти на /forgot-password
2. Ввести email: user@example.com
3. Нажать "Отправить письмо"
4. ✅ Ожидание: Success alert "Письмо отправлено на user@example.com"
5. ✅ Ожидание: Показано "Проверьте почту"
6. Кнопка "На страницу входа"
```

**Scenario 2: Неправильный email**
```
1. Ввести email: notanemail
2. ✅ Ожидание: Кнопка disabled (validation)
3. ✅ Ожидание: Помощь "Укажите корректный email"
```

**Scenario 3: Попробовать другой email**
```
1. После отправки, нажать "Попробовать другой email"
2. ✅ Ожидание: Форма очистится, ready для нового email
```

---

#### ResetPasswordPage.tsx

**Scenario: Восстановить пароль**
```
1. Кликнуть на ссылку из письма восстановления: /auth/reset-password/token456
2. ✅ Ожидание: Форма загрузится, токен валидируется
3. Ввести новый пароль: NewPassword456
4. Ввести подтверждение: NewPassword456
5. Нажать "Изменить пароль"
6. ✅ Ожидание: Success "Пароль изменен успешно"
7. ✅ Ожидание: Redirect на /login через 2 сек
8. Логин с новым паролем
9. ✅ Ожидание: Вход успешен
```

---

### Phase 4: Integration Testing with Backend ⏳

#### Email Notifications

**Проверить что пользователь получает письма:**

1. ✅ Invitation email (при invite)
   - Subject: "Приглашение в организацию XYZ"
   - Body: Contains setup link /auth/setup-password/:token
   - Link действует 7 дней

2. ✅ Password reset email (при forgot)
   - Subject: "Восстановление пароля"
   - Body: Contains reset link /auth/reset-password/:token
   - Link действует 24 часа

3. ✅ Audit emails (опционально)
   - Email при добавлении в организацию
   - Email при смене роли

#### Error Scenarios

```
Scenario: Двойное приглашение
1. Пригласить user@example.com
2. Пригласить user@example.com еще раз
3. ✅ Expected: 409 Conflict "Пользователь уже приглашен"

Scenario: Приглашение существующего
1. Пригласить user@example.com (создана учетка)
2. ✅ Expected: 400 "Пользователь уже в организации" или просто добавить

Scenario: Требуемая роль не доступна
1. Пригласить с role='OWNER' (если текущий пользователь не OWNER)
2. ✅ Expected: 403 "Недостаточно прав"

Scenario: Истекшее приглашение
1. Получить ссылку setup-password/token
2. Ждать 7 дней
3. Кликнуть ссылку
4. ✅ Expected: "Ссылка истекла, попросите отправить заново"
```

---

### Phase 5: Production Checklist ✅

- [ ] Все 3 новых компонента интегрированы в router
- [ ] Backend endpoints реализованы и протестированы
- [ ] Email templates готовы и настроены
- [ ] HTTPS включен для /auth endpoints
- [ ] Rate limiting настроен на /forgot-password
- [ ] Audit logging работает для member actions
- [ ] Tests написаны (unit + E2E)
- [ ] Documentation обновлена
- [ ] Backward compatibility проверена (старые user flow работают)
- [ ] Performance тесты пройдены

---

## 🔍 Known Issues & Limitations

### Current Limitations

1. ❌ **Bulk invite** - Нет CSV import для добавления нескольких сотрудников сразу
   - Workaround: Делать one-by-one через UI
   - Todo: Добавить bulk import позже

2. ❌ **Acceptance/Decline** - Нет UI для принятия/отклонения приглашения
   - Workaround: Статус меняется автоматически при первом входе
   - Todo: Добавить email-based accept/decline buttons

3. ❌ **Invitation expiry** - Пока нет auto-expiry логики
   - Current: Ссылка работает 7 дней
   - Todo: Добавить cron job для очистки expired приглашений

4. ⚠️ **Email delivery** - Не гарантирован при spam filters
   - Workaround: Показать "Отправить заново" кнопку
   - Todo: Реализовать webhook для tracking доставки

---

## 📞 Support

**Если при тестировании встречаются ошибки:**

1. Проверить browser console для ошибок
2. Проверить Network tab в DevTools:
   - POST /document-flow/members/invite → 200?
   - GET /admin/users → 200 with pagination?
3. Проверить backend logs для ошибок
4. Проверить что JWT token содержит необходимые permissions

**Контакты:**
- Frontend: Akylbek (текущий)
- Backend: [Assign backend developer]
- QA: [Assign QA engineer]

---

## ✅ Sign-off Checklist

- [ ] Frontend: Все компоненты работают без ошибок
- [ ] Backend: Все endpoints реализованы
- [ ] QA: Все scenarios пройдены
- [ ] Product: Все requirements выполнены
- [ ] Security: Пароли не хранятся в UI

**Date:** ________  
**Frontend Lead:** ________  
**Backend Lead:** ________  
**QA Lead:** ________  
**Product Manager:** ________

---

