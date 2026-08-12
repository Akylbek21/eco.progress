# Backend Integration Guide - Employee Management Password Flow

**Для:** Backend разработчик  
**Дата:** 2026-08-12  
**Версия:** 1.0

---

## 🎯 Краткая справка

Frontend переделан на email invitations вместо временных паролей. Нужно реализовать **5 новых endpoints** и **2 изменения в существующих**.

**Новые endpoints:** 8  
**Изменения в существующих:** 1  
**Очередность:** Начни с `/document-flow/members/invite`

---

## 📝 Новые Endpoints

### 1. POST /document-flow/members/invite

**Пригласить сотрудника в организацию по email**

```
Request:
POST /document-flow/members/invite
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "email": "newuser@example.com",
  "role": "VIEWER"
}

Response (200):
{
  "id": 123,
  "organizationId": 456,
  "email": "newuser@example.com",
  "role": "VIEWER",
  "status": "INVITED",
  "userId": null,
  "invitedAt": "2026-08-12T10:30:00Z",
  "invitedBy": {
    "id": 789,
    "name": "Admin Name"
  }
}

Errors:
400 - Email validation failed
  { "code": "INVALID_EMAIL", "message": "Некорректный email адрес" }

400 - Validation error
  { "code": "INVALID_ROLE", "message": "Роль '{role}' не поддерживается" }

409 - Already invited
  { "code": "ALREADY_INVITED", "message": "Пользователь уже приглашен в организацию" }

409 - Already member
  { "code": "ALREADY_MEMBER", "message": "Пользователь уже участник этой организации" }

403 - No permission
  { "code": "FORBIDDEN", "message": "У вас нет прав приглашать сотрудников" }
```

**Реализация:**

```typescript
// Member entity - нужно добавить статусы
enum MemberStatus {
  ACTIVE = "ACTIVE",           // Активный участник
  INACTIVE = "INACTIVE",       // Деактивирован
  INVITED = "INVITED",         // Приглашение отправлено
  PENDING = "PENDING",         // Ожидает принятия
  EXPIRED = "EXPIRED",         // Приглашение истекло
  DECLINED = "DECLINED",       // Приглашение отклонено
}

// Invitation entity (новая)
@Entity()
class Invitation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  organizationId: number;

  @Column()
  email: string;

  @Column()
  role: MembershipRole;

  @Column()
  token: string; // Уникальный токен для setup-password

  @Column()
  status: InvitationStatus; // PENDING, ACCEPTED, DECLINED, EXPIRED

  @Column()
  createdAt: Date;

  @Column()
  expiresAt: Date; // +7 дней

  @Column({ nullable: true })
  acceptedAt: Date;

  @Column({ nullable: true })
  declinedAt: Date;
}

// Service
@Injectable()
export class MemberService {
  async inviteMember(
    organizationId: number,
    email: string,
    role: MembershipRole,
    invitedBy: User,
  ): Promise<DocumentFlowMember> {
    // 1. Валидация email
    if (!this.isValidEmail(email)) throw new BadRequestException('Invalid email');

    // 2. Проверить что текущий пользователь имеет право MANAGE_MEMBERS
    if (!this.canManageMembers(invitedBy, organizationId)) {
      throw new ForbiddenException();
    }

    // 3. Проверить что пользователь не уже участник
    const existing = await this.memberRepository.findOne({
      where: { organizationId, email },
    });
    if (existing) {
      throw new ConflictException('ALREADY_MEMBER');
    }

    // 4. Проверить что нет активного приглашения
    const activeInvite = await this.invitationRepository.findOne({
      where: {
        email,
        organizationId,
        status: 'PENDING',
        expiresAt: MoreThan(new Date()),
      },
    });
    if (activeInvite) {
      throw new ConflictException('ALREADY_INVITED');
    }

    // 5. Создать запись Member со статусом INVITED
    const member = new Member({
      organizationId,
      email,
      role,
      status: 'INVITED',
      userId: null,
    });
    await this.memberRepository.save(member);

    // 6. Создать Invitation с токеном
    const token = this.generateSecureToken(); // 32+ chars
    const invitation = new Invitation({
      organizationId,
      email,
      role,
      token,
      status: 'PENDING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 дней
    });
    await this.invitationRepository.save(invitation);

    // 7. Отправить email
    const setupLink = `https://app.example.com/auth/setup-password/${token}`;
    await this.emailService.sendInvitationEmail({
      to: email,
      organizationName: organization.name,
      link: setupLink,
      expiresIn: '7 days',
    });

    // 8. Залогировать в audit
    await this.auditService.log({
      memberId: member.id,
      eventType: 'INVITED',
      description: `${invitedBy.name} пригласил ${email} как ${role}`,
      actorUserId: invitedBy.id,
    });

    return this.memberToDTO(member);
  }
}
```

**DB migration:**
```sql
-- Добавить столбцы в members table
ALTER TABLE members ADD COLUMN status VARCHAR(20) DEFAULT 'ACTIVE';
ALTER TABLE members ADD COLUMN user_id INT NULL;

-- Создать invitations table
CREATE TABLE invitations (
  id SERIAL PRIMARY KEY,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP NULL,
  declined_at TIMESTAMP NULL,
  FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email_org ON invitations(email, organization_id);
```

---

### 2. POST /document-flow/members/{id}/resend-invitation

**Переотправить приглашение члену со статусом INVITED**

```
Request:
POST /document-flow/members/{memberId}/resend-invitation
Authorization: Bearer {jwt_token}

Response (200):
{
  "invitationSent": true,
  "email": "user@example.com",
  "expiresAt": "2026-08-19T10:30:00Z"
}

Errors:
404 - Not found
  { "code": "MEMBER_NOT_FOUND" }

400 - Not invited status
  { "code": "INVALID_STATE", "message": "Приглашение можно переотправить только для статуса INVITED" }

403 - No permission
```

**Реализация:**

```typescript
async resendInvitation(memberId: number, userId: number): Promise<{ invitationSent: boolean }> {
  const member = await this.memberRepository.findById(memberId);
  if (!member) throw new NotFoundException();

  if (member.status !== 'INVITED') {
    throw new BadRequestException('INVALID_STATE');
  }

  // Проверить права
  if (!this.canManageMembers(userId, member.organizationId)) {
    throw new ForbiddenException();
  }

  // Найти Invitation record
  const invitation = await this.invitationRepository.findOne({
    where: { memberId, status: 'PENDING' },
  });
  if (!invitation) throw new NotFoundException();

  // Обновить expiry (еще +7 дней)
  invitation.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await this.invitationRepository.save(invitation);

  // Переотправить email
  const setupLink = `https://app.example.com/auth/setup-password/${invitation.token}`;
  await this.emailService.sendInvitationEmail({
    to: member.email,
    organizationName: member.organization.name,
    link: setupLink,
  });

  // Audit log
  await this.auditService.log({
    memberId,
    eventType: 'INVITATION_RESENT',
    description: `Приглашение переотправлено на ${member.email}`,
    actorUserId: userId,
  });

  return { invitationSent: true };
}
```

---

### 3. POST /auth/setup-password

**Установить пароль для нового пользователя (из приглашения)**

```
Request:
POST /auth/setup-password
Content-Type: application/json
No Authorization required

{
  "token": "secure_token_from_email",
  "password": "MyPassword123"
}

Response (200):
{
  "success": true,
  "message": "Пароль установлен успешно"
}

Errors:
400 - Invalid/expired token
  { "code": "INVALID_TOKEN", "message": "Токен недействителен или истек" }

400 - Password validation
  { "code": "WEAK_PASSWORD", "message": "Пароль должен содержать минимум 8 символов, буквы и цифры" }

410 - Token expired
  { "code": "TOKEN_EXPIRED", "message": "Ссылка устарела. Попросите отправить заново." }
```

**Реализация:**

```typescript
@Post('setup-password')
async setupPassword(@Body() dto: { token: string; password: string }) {
  // 1. Валидация пароля
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(dto.password)) {
    throw new BadRequestException('WEAK_PASSWORD');
  }

  // 2. Найти invitation по токену
  const invitation = await this.invitationRepository.findOne({
    where: { token: dto.token },
  });
  if (!invitation) throw new BadRequestException('INVALID_TOKEN');

  // 3. Проверить expiry
  if (invitation.expiresAt < new Date()) {
    throw new HttpException(
      { code: 'TOKEN_EXPIRED', message: 'Ссылка устарела' },
      HttpStatus.GONE, // 410
    );
  }

  // 4. Найти или создать User
  let user = await this.userRepository.findByEmail(invitation.email);
  if (!user) {
    user = new User({
      email: invitation.email,
      password: await this.hashPassword(dto.password),
      status: 'active',
      emailVerified: true,
    });
    await this.userRepository.save(user);
  } else {
    // Пользователь уже существует - просто обновить пароль
    user.password = await this.hashPassword(dto.password);
    await this.userRepository.save(user);
  }

  // 5. Обновить Member с userId и статусом ACTIVE
  const member = await this.memberRepository.findById(invitation.memberId);
  member.userId = user.id;
  member.status = 'ACTIVE';
  await this.memberRepository.save(member);

  // 6. Обновить Invitation статус
  invitation.status = 'ACCEPTED';
  invitation.acceptedAt = new Date();
  await this.invitationRepository.save(invitation);

  // 7. Audit log
  await this.auditService.log({
    memberId: member.id,
    eventType: 'PASSWORD_SET',
    description: `Пароль установлен пользователем через email ссылку`,
    actorUserId: user.id,
  });

  return { success: true };
}
```

---

### 4. POST /auth/validate-setup-token

**Проверить что токен setup-password валиден (для UI)**

```
Request:
POST /auth/validate-setup-token
Content-Type: application/json

{
  "token": "secure_token_from_url"
}

Response (200):
{
  "valid": true,
  "email": "user@example.com",
  "expiresAt": "2026-08-19T10:30:00Z"
}

Errors:
400 - Invalid token
  { "code": "INVALID_TOKEN" }

410 - Expired token
  { "code": "TOKEN_EXPIRED" }
```

**Реализация:**

```typescript
@Post('validate-setup-token')
async validateSetupToken(@Body() dto: { token: string }) {
  const invitation = await this.invitationRepository.findOne({
    where: { token: dto.token },
  });

  if (!invitation) {
    throw new BadRequestException('INVALID_TOKEN');
  }

  if (invitation.expiresAt < new Date()) {
    throw new HttpException(
      'TOKEN_EXPIRED',
      HttpStatus.GONE, // 410
    );
  }

  if (invitation.status !== 'PENDING') {
    throw new BadRequestException('INVALID_TOKEN');
  }

  return {
    valid: true,
    email: invitation.email,
    expiresAt: invitation.expiresAt,
  };
}
```

---

### 5. POST /auth/forgot-password

**Отправить email для восстановления пароля**

```
Request:
POST /auth/forgot-password
Content-Type: application/json
No Authorization required

{
  "email": "user@example.com"
}

Response (200):
{
  "success": true,
  "message": "Письмо отправлено"
}

Errors:
400 - Invalid email
  { "code": "INVALID_EMAIL" }

404 - User not found (может быть скрыта из соображений безопасности)
  { "code": "USER_NOT_FOUND" } или просто 200 с "Если аккаунт существует..."
```

**Реализация:**

```typescript
@Post('forgot-password')
async forgotPassword(@Body() dto: { email: string }) {
  const user = await this.userRepository.findByEmail(dto.email);

  // Важно: Не сообщать есть ли пользователь для security
  if (!user) {
    return { success: true, message: 'Письмо отправлено если аккаунт существует' };
  }

  // Создать reset token (24 часа)
  const resetToken = this.generateSecureToken();
  const resetRecord = new PasswordReset({
    userId: user.id,
    token: resetToken,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // +24 часа
  });
  await this.passwordResetRepository.save(resetRecord);

  // Отправить email
  const resetLink = `https://app.example.com/auth/reset-password/${resetToken}`;
  await this.emailService.sendPasswordResetEmail({
    to: user.email,
    link: resetLink,
    expiresIn: '24 hours',
  });

  // Audit log (не содержащий sensitive info)
  await this.auditService.log({
    eventType: 'PASSWORD_RESET_REQUESTED',
    description: `Запрос восстановления пароля для ${user.email}`,
    userId: null, // Не залогирован еще
  });

  return { success: true };
}
```

---

### 6. POST /auth/reset-password

**Установить новый пароль по токену восстановления**

```
Request:
POST /auth/reset-password
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "password": "NewPassword123"
}

Response (200):
{
  "success": true
}

Errors:
400 - Invalid token
400 - Weak password
410 - Token expired
```

**Реализация:** (аналогично `/auth/setup-password` но с таблицей `password_resets` вместо `invitations`)

```typescript
@Post('reset-password')
async resetPassword(@Body() dto: { token: string; password: string }) {
  // Валидировать пароль
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(dto.password)) {
    throw new BadRequestException('WEAK_PASSWORD');
  }

  // Найти reset record
  const resetRecord = await this.passwordResetRepository.findOne({
    where: { token: dto.token },
  });
  if (!resetRecord) throw new BadRequestException('INVALID_TOKEN');

  // Проверить expiry
  if (resetRecord.expiresAt < new Date()) {
    throw new HttpException('TOKEN_EXPIRED', HttpStatus.GONE);
  }

  // Обновить пароль пользователя
  const user = await this.userRepository.findById(resetRecord.userId);
  user.password = await this.hashPassword(dto.password);
  await this.userRepository.save(user);

  // Отметить reset как использованный
  resetRecord.usedAt = new Date();
  await this.passwordResetRepository.save(resetRecord);

  // Audit log
  await this.auditService.log({
    eventType: 'PASSWORD_RESET',
    description: 'Пароль изменен через ссылку восстановления',
    userId: user.id,
  });

  return { success: true };
}
```

---

### 7. POST /auth/validate-reset-token

```typescript
@Post('validate-reset-token')
async validateResetToken(@Body() dto: { token: string }) {
  const record = await this.passwordResetRepository.findOne({
    where: { token: dto.token },
  });

  if (!record) throw new BadRequestException('INVALID_TOKEN');
  if (record.expiresAt < new Date()) {
    throw new HttpException('TOKEN_EXPIRED', HttpStatus.GONE);
  }

  return { valid: true };
}
```

---

### 8. GET /document-flow/members/{id}/audit-log

**Получить audit log для члена организации (с пагинацией)**

```
Request:
GET /document-flow/members/{memberId}/audit-log?page=0&size=10
Authorization: Bearer {jwt_token}

Response (200):
{
  "items": [
    {
      "id": 1001,
      "memberId": 123,
      "eventType": "INVITED",
      "description": "Admin Name пригласил user@example.com как VIEWER",
      "actorUserId": 789,
      "actorName": "Admin Name",
      "createdAt": "2026-08-12T10:30:00Z"
    },
    {
      "id": 1002,
      "memberId": 123,
      "eventType": "PASSWORD_SET",
      "description": "Пароль установлен пользователем через email ссылку",
      "actorUserId": null,
      "actorName": "система",
      "createdAt": "2026-08-12T11:30:00Z"
    },
    {
      "id": 1003,
      "memberId": 123,
      "eventType": "ROLE_CHANGED",
      "description": "Роль изменена с VIEWER на DOCUMENT_MANAGER",
      "actorUserId": 789,
      "actorName": "Admin Name",
      "createdAt": "2026-08-12T12:00:00Z"
    }
  ],
  "page": 0,
  "size": 10,
  "total": 3,
  "totalPages": 1
}

Errors:
404 - Not found
403 - No permission
```

**Реализация:**

```typescript
@Get('members/:memberId/audit-log')
async getMemberAuditLog(
  @Param('memberId') memberId: number,
  @Query('page') page = 0,
  @Query('size') size = 10,
  @CurrentUser() user: User,
) {
  const member = await this.memberRepository.findById(memberId);
  if (!member) throw new NotFoundException();

  // Проверить права (должен быть участником или админом организации)
  if (!this.canViewMember(user, member.organizationId)) {
    throw new ForbiddenException();
  }

  const [items, total] = await this.auditRepository.findAndCount({
    where: { memberId },
    skip: page * size,
    take: size,
    order: { createdAt: 'DESC' },
  });

  return {
    items: items.map((audit) => ({
      id: audit.id,
      memberId: audit.memberId,
      eventType: audit.eventType,
      description: audit.description,
      actorUserId: audit.actorUserId,
      actorName: audit.actorName || 'система',
      createdAt: audit.createdAt,
    })),
    page,
    size,
    total,
    totalPages: Math.ceil(total / size),
  };
}
```

---

## 🔄 Изменения в существующих endpoints

### Измени GET /admin/users

**Было:**
```
GET /admin/users
Response: AdminUserRecord[]

Response (200):
[
  { id: 1, name: "User 1", email: "user1@example.com", ... },
  { id: 2, name: "User 2", email: "user2@example.com", ... },
  ...
]
```

**Стало:**
```
GET /admin/users?page=0&limit=20&search=John&status=active&role=CLIENT&sort=name,asc

Response (200):
{
  "items": [
    { id: 1, name: "John Doe", email: "john@example.com", ... },
    { id: 2, name: "John Smith", email: "smith@example.com", ... },
  ],
  "page": 0,
  "limit": 20,
  "total": 125,
  "totalPages": 7
}
```

**Реализация:**

```typescript
@Get('/admin/users')
async getUsers(
  @Query('page') page = 0,
  @Query('limit') limit = 20,
  @Query('search') search?: string,
  @Query('status') status?: string,
  @Query('role') role?: string,
  @Query('sort') sort = 'name,asc',
) {
  const query = this.userRepository.createQueryBuilder('u');

  if (search) {
    query.where('LOWER(u.name) LIKE :search OR LOWER(u.email) LIKE :search', {
      search: `%${search.toLowerCase()}%`,
    });
  }
  if (status) query.andWhere('u.status = :status', { status });
  if (role) query.andWhere('u.role = :role', { role });

  const [data, total] = await query
    .orderBy(this.parseSortParam(sort))
    .skip(page * limit)
    .take(limit)
    .getManyAndCount();

  return {
    items: data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}

private parseSortParam(sort: string): { [key: string]: 'ASC' | 'DESC' } {
  const [field, direction] = sort.split(',');
  return { [`u.${field}`]: direction === 'desc' ? 'DESC' : 'ASC' };
}
```

---

## 📋 Implementation Checklist

**Шаг 1: Database migrations**
- [ ] ALTER TABLE members (добавить status, user_id)
- [ ] CREATE TABLE invitations
- [ ] CREATE TABLE password_resets
- [ ] CREATE TABLE audit_events
- [ ] CREATE INDEX на invitations.token
- [ ] CREATE INDEX на password_resets.token

**Шаг 2: Entities & DTOs**
- [ ] MemberStatus enum (6 статусов)
- [ ] Invitation entity
- [ ] PasswordReset entity
- [ ] AuditEvent entity
- [ ] DocumentFlowMemberDTO (с status полем)

**Шаг 3: Services**
- [ ] MemberService.inviteMember()
- [ ] MemberService.resendInvitation()
- [ ] AuthService.setupPassword()
- [ ] AuthService.forgotPassword()
- [ ] AuthService.resetPassword()
- [ ] AuthService.validateSetupToken()
- [ ] AuthService.validateResetToken()
- [ ] AuditService.log()

**Шаг 4: Controllers**
- [ ] DocumentFlowController.postMembersInvite()
- [ ] DocumentFlowController.postMembersResend()
- [ ] DocumentFlowController.getMembersAuditLog()
- [ ] AuthController.setupPassword()
- [ ] AuthController.forgotPassword()
- [ ] AuthController.resetPassword()
- [ ] AuthController.validateSetupToken()
- [ ] AuthController.validateResetToken()
- [ ] AdminController.getUsers() (MODIFY для pagination)

**Шаг 5: Email templates**
- [ ] InvitationEmail template
- [ ] PasswordResetEmail template

**Шаг 6: Tests**
- [ ] Unit tests для Service methods
- [ ] E2E tests для всех endpoints
- [ ] Error scenario tests

**Шаг 7: Documentation**
- [ ] API docs (Swagger/OpenAPI)
- [ ] Email template docs
- [ ] Database schema docs

---

## ✅ Testing Checklist (перед merge)

```bash
# 1. Database OK?
./migrate up

# 2. API endpoints work?
curl -X POST http://localhost:8080/api/document-flow/members/invite ...

# 3. Email sent correctly?
# Check email service logs

# 4. Tokens generated secure?
# Verify tokens length >= 32, random

# 5. All statuses working?
# Test ACTIVE, INVITED, PENDING, INACTIVE, EXPIRED, DECLINED

# 6. Backward compatibility?
# Old user creation flow still works? (if still needed)

# 7. Audit logging?
# All operations logged?

# 8. Security
# No token leaks in logs?
# No SQL injection?
# JWT validation on all endpoints?
```

---

## 🚨 Production Deployment Checklist

- [ ] All migrations applied
- [ ] Email service configured (SMTP settings)
- [ ] Email domain verified (SPF, DKIM, DMARC)
- [ ] HTTPS enabled
- [ ] Rate limiting on `/forgot-password` (max 5/hour per IP)
- [ ] Token invalidation on password reset (revoke all sessions)
- [ ] Monitoring for failed login attempts
- [ ] Backup & recovery plan tested
- [ ] Rollback plan documented

---

**Вопросы?** Контактируй frontend разработчика для уточнений.

