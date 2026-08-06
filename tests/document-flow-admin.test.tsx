// @vitest-environment jsdom

import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import api from '../src/services/api';
import { documentFlowAdminApi } from '../src/features/document-flow-admin/api/documentFlowAdminApi';
import { accessGrantFormSchema } from '../src/features/document-flow-admin/api/documentFlowAdminSchemas';
import { documentFlowAdminKeys } from '../src/features/document-flow-admin/model/queryKeys';
import { canManageDocumentFlowAccess } from '../src/features/document-flow-admin/model/permissions';
import type { User } from '../src/types';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { usageMetricLabels } from '../src/features/document-flow-admin/model/labels';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;

beforeAll(() => {
  api.defaults.baseURL = 'http://localhost/api';
  localStorage.setItem('eco-progress-token', 'token');
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => { api.defaults.baseURL = originalBaseUrl; server.close(); });

const admin = { role: 'ADMIN', permissions: [] } as Pick<User, 'role' | 'permissions'>;
const manager = { role: 'MANAGER', permissions: [] } as Pick<User, 'role' | 'permissions'>;

describe('document flow access administration', () => {
  it('keeps one canonical administration route and removes the legacy implementation', () => {
    const appSource = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const apiSource = readFileSync(resolve(process.cwd(), 'src/features/document-flow/api/documentFlowApi.ts'), 'utf8');

    expect(appSource).toContain('path="/admin/document-flow-access"');
    expect(appSource).not.toContain('path="/admin/document-flow/*"');
    expect(appSource).not.toContain('AdminDocumentFlowRoutes');
    expect(apiSource).not.toContain('adminDocumentFlowApi');
    expect(existsSync(resolve(process.cwd(), 'src/features/document-flow/AdminDocumentFlowRoutes.tsx'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/features/document-flow/pages/AdminPages.tsx'))).toBe(false);
  });

  it('shows subscription limits with Russian labels', () => {
    expect(usageMetricLabels).toEqual({
      ACTIVE_MEMBERS: 'Активные пользователи',
      DOCUMENTS_CREATED: 'Созданные документы',
      STORAGE_BYTES: 'Объём хранилища, байт',
      EXTERNAL_SIGNATURES_CREATED: 'Внешние подписания',
      SIGNATURES_CREATED: 'Подписания',
    });
    const source = readFileSync(resolve(process.cwd(), 'src/features/document-flow-admin/components/EditAccessDialog.tsx'), 'utf8');
    expect(source).not.toContain('Backend предоставляет');
    expect(source).toContain('invalidLimits');
  });

  it('provides organization employee management using confirmed user and member endpoints', () => {
    const page = readFileSync(resolve(process.cwd(), 'src/features/document-flow-admin/pages/DocumentFlowAccessAdminPage.tsx'), 'utf8');
    const dialog = readFileSync(resolve(process.cwd(), 'src/features/document-flow-admin/components/OrganizationMembersDialog.tsx'), 'utf8');
    expect(page).toContain('Сотрудники');
    expect(page).toContain('<OrganizationMembersDialog');
    expect(dialog).toContain("role: 'CLIENT'");
    expect(dialog).toContain("user.status !== 'blocked'");
    expect(dialog).toContain('сотрудника EcoProgress или клиентский аккаунт');
    expect(dialog).toContain('documentFlowApi.createMember');
    expect(dialog).toContain('documentFlowApi.activateMember');
    expect(dialog).toContain('Email для входа');
    expect(dialog).toContain('Временный пароль');
  });

  it('shows the administration link in the staff sidebar only for ADMIN', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/layouts/StaffLayout.tsx'), 'utf8');
    expect(source).toContain("path: '/admin/document-flow-access'");
    expect(source).toContain("label: 'Доступ к документообороту'");
    expect(source).toMatch(/document-flow-access'.*allowedRoles: \['ADMIN'\]/);
  });

  it('allows only the platform admin role or explicit backend permission', () => {
    expect(canManageDocumentFlowAccess(admin)).toBe(true);
    expect(canManageDocumentFlowAccess(manager)).toBe(false);
    expect(canManageDocumentFlowAccess({ ...manager, permissions: ['DOCUMENT_FLOW_ACCESS_MANAGE'] })).toBe(true);
  });

  it('allows null expiry only for INTERNAL', () => {
    const base = { organizationId: 2, startsAt: '2026-08-05T11:00', graceEndsAt: null, paymentMode: 'ADMIN_GRANT', paymentReference: null, reason: 'Внутренний доступ', limits: {} };
    expect(accessGrantFormSchema.safeParse({ ...base, planCode: 'INTERNAL', expiresAt: null }).success).toBe(true);
    expect(accessGrantFormSchema.safeParse({ ...base, planCode: 'BASIC', expiresAt: null }).success).toBe(false);
  });

  it('rejects the obsolete MANUAL payment mode', () => {
    expect(accessGrantFormSchema.safeParse({ organizationId: 2, planCode: 'INTERNAL', startsAt: '2026-08-05T11:00', expiresAt: null, graceEndsAt: null, paymentMode: 'MANUAL', paymentReference: null, reason: 'Внутренний доступ' }).success).toBe(false);
  });

  it('searches organizations on the existing paged backend endpoint', async () => {
    let url = '';
    server.use(http.get('http://localhost/api/companies', ({ request }) => {
      url = request.url;
      return HttpResponse.json({ data: { items: [{ id: 2, name: 'EcoProgress', bin: '123456789012', status: 'ACTIVE' }], page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true, hasNext: false, hasPrevious: false } });
    }));
    const result = await documentFlowAdminApi.searchOrganizations({ query: '123456789012', page: 0, size: 20, sort: 'name,asc' });
    expect(result.items[0]).toMatchObject({ id: '2', bin: '123456789012' });
    expect(new URL(url).searchParams.get('search')).toBe('123456789012');
  });

  it('maps the deployed company page used by organization search', async () => {
    server.use(http.get('http://localhost/api/companies', () => HttpResponse.json({ data: {
      items: [{ id: 2, name: 'Администратор ECOPROGRESS GROUP', bin: 'DF-USER-1', archived: false, objectsCount: 1, activeObjectsCount: 1 }],
      page: 0, size: 20, totalElements: 1, totalPages: 1, first: true, last: true, hasNext: false, hasPrevious: false,
    } })));
    const result = await documentFlowAdminApi.searchOrganizations({ page: 0, size: 20, sort: 'name,asc' });
    expect(result.items[0]).toMatchObject({ id: '2', name: 'Администратор ECOPROGRESS GROUP', bin: 'DF-USER-1', objectCount: 1, status: 'ACTIVE' });
  });

  it('creates one grant with ADMIN_GRANT and the supplied idempotency key', async () => {
    const requests: Array<{ key: string | null; body: Record<string, unknown> }> = [];
    server.use(http.post('http://localhost/api/admin/document-flow/access-grants', async ({ request }) => {
      requests.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() as Record<string, unknown> });
      return HttpResponse.json({ data: { id: 77 } });
    }));
    const result = await documentFlowAdminApi.createAccessGrant({ organizationId: 2, planCode: 'INTERNAL', startsAt: '2026-08-05T11:00', expiresAt: null, graceEndsAt: null, paymentMode: 'ADMIN_GRANT', paymentReference: 'ECOPROGRESS_INTERNAL', reason: 'Бессрочный внутренний доступ' }, 'document-flow-access-2-request');
    expect(result.id).toBe(77);
    expect(requests).toEqual([{ key: 'document-flow-access-2-request', body: { organizationId: 2, planCode: 'INTERNAL', startsAt: '2026-08-05T11:00', expiresAt: null, graceEndsAt: null, paymentMode: 'ADMIN_GRANT', paymentReference: 'ECOPROGRESS_INTERNAL', reason: 'Бессрочный внутренний доступ' } }]);
  });

  it('rechecks organization access through the tenant endpoint', async () => {
    server.use(http.get('http://localhost/api/document-flow/access', ({ request }) => {
      expect(new URL(request.url).searchParams.get('organizationId')).toBe('2');
      return HttpResponse.json({ data: { available: true, readOnly: false, status: 'ACTIVE', reason: null } });
    }));
    await expect(documentFlowAdminApi.organizationAccess(2)).resolves.toMatchObject({ available: true, readOnly: false, status: 'ACTIVE', reason: null });
  });

  it.each([
    ['suspend', 'suspend'], ['restore', 'restore'], ['revoke', 'revoke'],
  ] as const)('uses the confirmed %s subscription action', async (_, path) => {
    let calls = 0;
    server.use(http.post(`http://localhost/api/admin/document-flow/subscriptions/2/${path}`, async ({ request }) => {
      calls += 1;
      expect(await request.json()).toEqual({ reason: 'Причина операции' });
      return HttpResponse.json({ data: {} });
    }));
    await documentFlowAdminApi[path](2, 'Причина операции');
    expect(calls).toBe(1);
  });

  it('isolates admin cache by organization', () => {
    expect(documentFlowAdminKeys.access(2)).not.toEqual(documentFlowAdminKeys.access(3));
    expect(documentFlowAdminKeys.organization(2)).not.toEqual(documentFlowAdminKeys.organization(3));
  });
});
