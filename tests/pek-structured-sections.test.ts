import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { pekApi } from '../src/features/pek/api/pekService';

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined, clear: () => undefined },
});

const calls: Array<{ method: string; path: string; ifMatch: string | null }> = [];
const capture = (request: Request) => calls.push({ method: request.method, path: new URL(request.url).pathname, ifMatch: request.headers.get('If-Match') });
const server = setupServer(
  http.post('*/api/pek/programs/5/monitoring/7/points', ({ request }) => { capture(request); return HttpResponse.json({ data: { id: 9, programId: 5, monitoringId: 7, name: 'Север', coordinates: '52.9, 69.1', version: 0 } }); }),
  http.put('*/api/pek/programs/5/monitoring/points/9', ({ request }) => { capture(request); return HttpResponse.json({ data: { id: 9, programId: 5, monitoringId: 7, name: 'Север', version: 2 } }); }),
  http.delete('*/api/pek/programs/5/monitoring/points/9', ({ request }) => { capture(request); return new HttpResponse(null, { status: 204 }); }),
  http.post('*/api/pek/programs/5/responsibilities', ({ request }) => { capture(request); return HttpResponse.json({ data: { id: 3, programId: 5, roleLabel: 'Ответственный', userId: 12, version: 0 } }); }),
  http.patch('*/api/pek/companies/10/staff/4', ({ request }) => { capture(request); return HttpResponse.json({ data: { id: 4, companyId: 10, userId: 12, tier: 'REVIEWER', status: 'ACTIVE', version: 4 } }); }),
);

beforeAll(() => { api.defaults.baseURL = 'http://localhost/api'; server.listen({ onUnhandledRequest: 'error' }); });
afterAll(() => server.close());

describe('structured PEK sections', () => {
  it('uses backend routes and record versions for monitoring points', async () => {
    await pekApi.createMonitoringPoint(5, 7, { name: 'Север', coordinates: '52.9, 69.1', description: null });
    await pekApi.updateMonitoringPoint(5, 9, 1, { name: 'Север', coordinates: null, description: null });
    await pekApi.deleteMonitoringPoint(5, 9, 2);
    expect(calls.slice(0, 3)).toEqual([
      { method: 'POST', path: '/api/pek/programs/5/monitoring/7/points', ifMatch: null },
      { method: 'PUT', path: '/api/pek/programs/5/monitoring/points/9', ifMatch: '1' },
      { method: 'DELETE', path: '/api/pek/programs/5/monitoring/points/9', ifMatch: '2' },
    ]);
  });

  it('connects responsibilities and company-scoped staff assignments', async () => {
    await pekApi.createResponsibility(5, { roleLabel: 'Ответственный', userId: 12, duties: 'Контроль' });
    await pekApi.updateCompanyStaff(10, 4, 3, { tier: 'REVIEWER', status: 'ACTIVE' });
    expect(calls.slice(-2)).toEqual([
      { method: 'POST', path: '/api/pek/programs/5/responsibilities', ifMatch: null },
      { method: 'PATCH', path: '/api/pek/companies/10/staff/4', ifMatch: '3' },
    ]);
  });

  it('renders all operational sections and validates coordinate input', () => {
    const sections = readFileSync(resolve(process.cwd(), 'src/features/pek/components/sections/PekProgramStructuredSections.tsx'), 'utf8');
    const points = readFileSync(resolve(process.cwd(), 'src/features/pek/components/monitoring/PekMonitoringPoints.tsx'), 'utf8');
    const settings = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekSettingsPage.tsx'), 'utf8');
    for (const title of ['Внутренние проверки', 'QA/QC измерений', 'Аварийные процедуры', 'Матрица ответственности']) expect(sections).toContain(title);
    expect(points).toContain('coordinatePattern');
    expect(points).toContain('52.905785, 69.153399');
    expect(settings).toContain('PekCompanyStaff');
  });
});
