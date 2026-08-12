// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import CompanyForm from '../src/components/companies/CompanyForm';
import { clearCompanyQueries } from '../src/features/companies/companyCache';
import { canOpenCompanyEditor, hasCompanyPermission } from '../src/features/companies/companyPermissions';
import api from '../src/services/api';
import { createCompany, getCompanyObjects, restoreCompanyObject } from '../src/services/companyService';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;

beforeAll(() => {
  api.defaults.baseURL = 'http://localhost/api';
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => {
  api.defaults.baseURL = originalBaseUrl;
  server.close();
});

describe('companies frontend contract', () => {
  it('uses only permissions returned by auth/me and never grants access by role', () => {
    expect(hasCompanyPermission({ permissions: undefined }, 'read')).toBe(false);
    expect(hasCompanyPermission({ permissions: [] }, 'read')).toBe(false);
    expect(hasCompanyPermission({ permissions: ['view_companies'] }, 'read')).toBe(true);
    expect(hasCompanyPermission({ permissions: ['COMPANY_EDIT'] }, 'edit')).toBe(true);
    expect(hasCompanyPermission({ permissions: ['COMPANY_EDIT'] }, 'archive')).toBe(false);

    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const config = readFileSync(resolve(process.cwd(), 'src/config/permissions.ts'), 'utf8');
    expect(app).toContain('<CompanyPermissionAccess permission="read">');
    expect(app).toContain('<CompanyPermissionAccess permission="edit">');
    expect(config).not.toContain('companyRoleMatrix');
  });

  it('clears every company cache namespace without touching unrelated data', () => {
    const client = new QueryClient();
    client.setQueryData(['companies', { page: 0 }], ['company-list']);
    client.setQueryData(['company', '7'], { id: 7 });
    client.setQueryData(['company-objects', '7', true], [{ id: 3 }]);
    client.setQueryData(['pek', 'dashboard'], { ok: true });

    clearCompanyQueries(client);

    expect(client.getQueryData(['companies', { page: 0 }])).toBeUndefined();
    expect(client.getQueryData(['company', '7'])).toBeUndefined();
    expect(client.getQueryData(['company-objects', '7', true])).toBeUndefined();
    expect(client.getQueryData(['pek', 'dashboard'])).toEqual({ ok: true });

    const auth = readFileSync(resolve(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf8');
    expect(auth.match(/clearCompanyQueries\(queryClient\)/g)?.length).toBeGreaterThanOrEqual(4);
    expect(auth).toContain('userIdRef.current !== newUser.id');
  });

  it('blocks the editor for an archived company even with edit permission', () => {
    const editor = { permissions: ['COMPANY_EDIT'] };
    expect(canOpenCompanyEditor(editor, 'ACTIVE')).toBe(true);
    expect(canOpenCompanyEditor(editor, 'ARCHIVED')).toBe(false);

    const page = readFileSync(resolve(process.cwd(), 'src/pages/CompaniesPage.tsx'), 'utf8');
    expect(page).toContain('Архивную компанию нельзя редактировать');
    expect(page).toContain('canOpenCompanyEditor(user, companyQuery.data.status)');
  });

  it('requests archived objects and restores one through the canonical endpoint', async () => {
    let includeArchivedObjects = '';
    let restoreCalls = 0;
    server.use(
      http.get('http://localhost/api/companies/7/objects', ({ request }) => {
        includeArchivedObjects = new URL(request.url).searchParams.get('includeArchivedObjects') || '';
        return HttpResponse.json({ data: { items: [{ id: 3, companyId: 7, name: 'Архивный объект', address: 'Адрес', status: 'ARCHIVED' }] } });
      }),
      http.post('http://localhost/api/companies/7/objects/3/restore', () => {
        restoreCalls += 1;
        return HttpResponse.json({ data: { id: 3, companyId: 7, name: 'Объект', address: 'Адрес', status: 'ACTIVE' } });
      }),
    );

    const objects = await getCompanyObjects('7', true);
    const restored = await restoreCompanyObject('7', '3');

    expect(includeArchivedObjects).toBe('true');
    expect(objects[0].status).toBe('ARCHIVED');
    expect(restoreCalls).toBe(1);
    expect(restored.status).toBe('ACTIVE');

    const page = readFileSync(resolve(process.cwd(), 'src/pages/CompaniesPage.tsx'), 'utf8');
    expect(page).toContain('getCompanyObjects(companyId, true, signal)');
    expect(page).toContain('Восстановить объект ${object.name}');
  });

  it('renders backend field errors beside the matching canonical field', async () => {
    server.use(http.post('http://localhost/api/companies', () => HttpResponse.json({
      message: 'Validation failed',
      errors: [{ field: 'directorName', message: 'Укажите руководителя' }],
    }, { status: 422 })));

    render(<CompanyForm onSubmit={(payload) => createCompany(payload).then(() => undefined)} />);
    fireEvent.change(screen.getByLabelText('Наименование *'), { target: { value: 'ТОО Тест' } });
    fireEvent.change(screen.getByLabelText('БИН *'), { target: { value: '123456789012' } });
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    expect(await screen.findByText('Укажите руководителя')).toBeTruthy();
    expect(screen.getByRole('textbox', { name: /Руководитель/ }).getAttribute('aria-invalid')).toBe('true');
  });
});
