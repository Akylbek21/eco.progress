import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { LaboratoryFormValues } from '../src/types/laboratories';

const origin = 'http://127.0.0.1:43118';
const laboratory = { id: 1, version: 1, name: 'Лаборатория', address: 'Адрес', active: true, isDefault: false };
const form: LaboratoryFormValues = { version: 1, name: 'Лаборатория', shortName: '', legalName: '', bin: '', address: 'Адрес', city: '', phone: '', email: '', website: '', accreditationNumber: '', accreditationIssuedAt: '', accreditationValidUntil: '', accreditationIssuedBy: '', directorId: null, laboratoryHeadId: null, standardNote: '', logoUrl: '', isDefault: false, active: true };
const server = setupServer();
let service: typeof import('../src/features/laboratories/api/laboratoryService');

beforeAll(async () => {
  vi.stubEnv('VITE_BACKEND_URL', origin);
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
  server.listen({ onUnhandledRequest: 'error' });
  service = await import('../src/features/laboratories/api/laboratoryService');
});
afterEach(() => server.resetHandlers());
afterAll(() => { server.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('laboratory HTTP contracts', () => {
  it('loads the full array without ignored query params and paginates locally', async () => {
    server.use(http.get(`${origin}/api/laboratories`, ({ request }) => {
      expect(new URL(request.url).search).toBe('');
      return HttpResponse.json([laboratory, { ...laboratory, id: 2, name: 'Вторая' }]);
    }));
    const page = await service.getLaboratories({ page: 0, size: 1, status: 'ACTIVE', sort: 'name,asc' });
    expect(page).toMatchObject({ size: 1, totalElements: 2, totalPages: 2 });
  });

  it('normalizes a paged list shape and loads laboratory details', async () => {
    server.use(
      http.get(`${origin}/api/laboratories`, () => HttpResponse.json({ data: { content: [laboratory] } })),
      http.get(`${origin}/api/settings/laboratories/:id`, ({ params }) => { expect(params.id).toBe('1'); return HttpResponse.json({ data: laboratory }); }),
    );
    expect((await service.getLaboratories({ page: 0, size: 20 })).content).toHaveLength(1);
    expect((await service.getLaboratory(1)).name).toBe('Лаборатория');
  });

  it('returns null from the one default endpoint on 404 without fallback requests', async () => {
    let requests = 0;
    server.use(http.get(`${origin}/api/settings/laboratories/default`, () => { requests += 1; return HttpResponse.json({}, { status: 404 }); }));
    await expect(service.getDefaultLaboratory()).resolves.toBeNull();
    expect(requests).toBe(1);
  });

  it('creates with POST and maps empty UI strings to null', async () => {
    server.use(http.post(`${origin}/api/laboratories`, async ({ request }) => {
      expect(await request.json()).toMatchObject({ name: 'Лаборатория', shortName: null, address: 'Адрес', active: true, isDefault: false });
      return HttpResponse.json({ data: laboratory });
    }));
    expect((await service.createLaboratory(form)).id).toBe(1);
  });

  it('updates through PATCH with version and preserves 409', async () => {
    server.use(http.patch(`${origin}/api/laboratories/:id`, async ({ request }) => {
      expect(await request.json()).toMatchObject({ version: 1 });
      return HttpResponse.json({ data: { ...laboratory, version: 2 } });
    }));
    expect((await service.updateLaboratory(1, form)).version).toBe(2);
    server.resetHandlers();
    server.use(http.patch(`${origin}/api/laboratories/:id`, () => HttpResponse.json({ message: 'Конфликт версий' }, { status: 409 })));
    await expect(service.updateLaboratory(1, form)).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('sets default/active by PATCH and removes employees by DELETE', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(`${origin}/api/laboratories/:id`, async ({ request }) => { bodies.push(await request.json()); return new HttpResponse(null, { status: 204 }); }),
      http.delete(`${origin}/api/laboratories/:id/employees/:employeeId`, ({ params }) => { expect(params.employeeId).toBe('9'); return new HttpResponse(null, { status: 204 }); }),
    );
    await service.setDefaultLaboratory(1);
    await service.deactivateLaboratory(1);
    await service.activateLaboratory(1);
    await service.deactivateLaboratoryEmployee(1, 9);
    expect(bodies).toEqual([{ isDefault: true }, { active: false }, { active: true }]);
  });

  it('preserves backend 500 errors and uploads a logo as multipart data', async () => {
    server.use(http.get(`${origin}/api/settings/laboratories/:id`, () => HttpResponse.json({ message: 'Ошибка сервера' }, { status: 500 })));
    await expect(service.getLaboratory(1)).rejects.toMatchObject({ response: { status: 500 } });
    server.resetHandlers();
    server.use(http.post(`${origin}/api/settings/laboratories/:id/logo`, async ({ request }) => {
      const body = await request.formData();
      expect(body.get('file')).toBeInstanceOf(File);
      return HttpResponse.json({ data: laboratory });
    }));
    expect((await service.uploadLaboratoryLogo(1, new File(['logo'], 'logo.png', { type: 'image/png' }))).id).toBe(1);
  });
});
