import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { pekApi } from '../src/features/pek/api/pekService';
import { mapProgramResponse } from '../src/features/pek/mappers/responseMappers';
import { handlePekMutationError, PEK_VERSION_CONFLICT_MESSAGE } from '../src/features/pek/utils/pekMutationError';

type CapturedRequest = { method: string; path: string; ifMatch: string | null; body: unknown };
const calls: CapturedRequest[] = [];
const capture = async (request: Request): Promise<CapturedRequest> => {
  const contentType = request.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await request.json() : undefined;
  const entry = {
    method: request.method,
    path: new URL(request.url).pathname,
    ifMatch: request.headers.get('If-Match'),
    body,
  };
  calls.push(entry);
  return entry;
};

const report = {
  id: 9, companyId: 1, objectId: 2, programId: 3, version: 8, status: 'DRAFT',
  periodType: 'QUARTER', reportYear: 2026, reportQuarter: 3,
  periodStart: '2026-07-01', periodEnd: '2026-09-30',
  linkedProtocolCount: 0, linkedProtocolNumbers: [],
};
const source = { id: 31, reportId: 9, version: 4, matchStatus: 'UNMATCHED', excluded: false };
const exceedance = { id: 4, reportId: 9, version: 6, status: 'OPEN', evidenceFileIds: [], availableActions: {} };

const server = setupServer(
  http.get('*/api/pek/programs/:id/monitoring', () => HttpResponse.json({ data: {
    programId: 3,
    items: [{ id: 11, programId: 3, version: 2, monitoringType: 'SOIL', name: 'Почва', frequencyType: 'ANNUAL', plannedCount: 1, controlItemIds: [], protocolTypes: ['SOIL'], active: true, availableActions: { edit: true } }],
    availableActions: { create: true },
  } })),
  http.put('*/api/pek/settings', async ({ request }) => {
    await capture(request);
    return HttpResponse.json({ data: { companyId: 17, version: 13, defaultReportType: 'YEARLY' } });
  }),
  http.post('*/api/pek/reports/9/return', async ({ request }) => { await capture(request); return HttpResponse.json({ data: { ...report, status: 'RETURNED', version: 9 } }); }),
  http.post('*/api/pek/reports/9/sources/31/match', async ({ request }) => { await capture(request); return HttpResponse.json({ data: source }); }),
  http.post('*/api/pek/reports/9/sources/31/exclude', async ({ request }) => { await capture(request); return HttpResponse.json({ data: source }); }),
  http.post('*/api/pek/reports/9/sources/31/restore', async ({ request }) => { await capture(request); return HttpResponse.json({ data: source }); }),
  http.post('*/api/pek/exceedances/4/assign', async ({ request }) => { await capture(request); return HttpResponse.json({ data: exceedance }); }),
  http.post('*/api/pek/exceedances/4/evidence', async ({ request }) => { await capture(request); return HttpResponse.json({ data: exceedance }); }),
  http.post('*/api/pek/exceedances/4/transition', async ({ request }) => { await capture(request); return HttpResponse.json({ data: exceedance }); }),
  http.post('*/api/pek/exceedances/4/corrective-actions', async ({ request }) => { await capture(request); return HttpResponse.json({ data: { id: 2, exceedanceId: 4, description: 'Фильтр', status: 'OPEN', version: 1, availableActions: {} } }); }),
  http.put('*/api/pek/exceedances/4/corrective-actions/2', async ({ request }) => { await capture(request); return HttpResponse.json({ data: { id: 2, exceedanceId: 4, description: 'Новый фильтр', status: 'OPEN', version: 3, availableActions: {} } }); }),
  http.delete('*/api/pek/exceedances/4/corrective-actions/2', async ({ request }) => { await capture(request); return new HttpResponse(null, { status: 204 }); }),
  http.post('*/api/pek/exceedances/4/corrective-actions/2/transition', async ({ request }) => { await capture(request); return HttpResponse.json({ data: { id: 2, exceedanceId: 4, description: 'Фильтр', status: 'DONE', version: 4, availableActions: {} } }); }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { calls.length = 0; server.resetHandlers(); });
afterAll(() => server.close());

const expectVersioned = (call: CapturedRequest, version: number, body: unknown) => {
  expect(call.ifMatch).toBe(String(version));
  expect(call.body).toEqual(body);
  expect(call.body).not.toHaveProperty('version');
};

describe('PEK P0 If-Match contracts', () => {
  it('maps monitoring inside the program aggregate', () => {
    const result = mapProgramResponse({
      id: 3, version: 7, contentRevision: 11, regulationVersion: '250/2026', templateVersion: 'program-v2',
      number: 'PEK-3', name: 'Program', status: 'DRAFT', validFrom: '2026-01-01', validUntil: '2026-12-31',
      monitoring: { items: [{ id: 11, programId: 3, monitoringType: 'SOIL', name: 'Почва', frequencyType: 'ANNUAL', plannedCount: 1, controlItemIds: [], protocolTypes: ['SOIL'], active: true, availableActions: { edit: true } }], availableActions: { create: true } },
    });
    expect(result.monitoring?.programId).toBe(3);
    expect(result.monitoring?.programVersion).toBe(7);
    expect(result.monitoring?.contentRevision).toBe(11);
    expect(result.monitoring?.items).toHaveLength(1);
    expect(result.monitoring?.items[0].name).toBe('Почва');
    expect(result.monitoring?.availableActions.create).toBe(true);
  });

  it('updates settings with PUT, companyId query and no version in body', async () => {
    await pekApi.updateSettings(17, 12, { defaultReportType: 'YEARLY' } as never);
    expectVersioned(calls[0], 12, { defaultReportType: 'YEARLY' });
    expect(calls[0]).toMatchObject({ method: 'PUT', path: '/api/pek/settings' });
  });

  it('returns report with reason only in JSON', async () => {
    await pekApi.returnReport(9, 8, 'Исправить расчёты');
    expectVersioned(calls[0], 8, { reason: 'Исправить расчёты' });
  });

  it('matches, excludes and restores sources without version in body', async () => {
    await pekApi.matchReportSource(9, 31, 15, 4);
    await pekApi.excludeReportSource(9, 31, 'Не относится к периоду', 5);
    await pekApi.restoreReportSource(9, 31, 6, 'Проверено');
    expectVersioned(calls[0], 4, { indicatorId: 15 });
    expectVersioned(calls[1], 5, { reason: 'Не относится к периоду' });
    expectVersioned(calls[2], 6, { reason: 'Проверено' });
  });

  it('versions every exceedance and corrective-action mutation via If-Match', async () => {
    await pekApi.assignExceedance(4, { version: 6, responsibleUserId: 3, dueDate: '2026-09-01', correctiveAction: 'Фильтр' });
    await pekApi.attachExceedanceEvidence(4, 7, 'file-1');
    await pekApi.transitionExceedance(4, { version: 8, status: 'IN_PROGRESS', comment: 'Начато' });
    await pekApi.transitionExceedance(4, { version: 9, status: 'CLOSED', resolutionComment: 'Устранено' });
    await pekApi.transitionExceedance(4, { version: 10, status: 'OPEN', comment: 'Повторное превышение' });
    await pekApi.createCorrectiveAction(4, 11, { description: 'Фильтр', responsibleUserId: 3, dueDate: '2026-09-01' });
    await pekApi.updateCorrectiveAction(4, 2, { version: 2, description: 'Новый фильтр' });
    await pekApi.deleteCorrectiveAction(4, 2, 3);
    await pekApi.transitionCorrectiveAction(4, 2, { version: 4, status: 'DONE', comment: 'Готово' });

    expectVersioned(calls[0], 6, { responsibleUserId: 3, dueDate: '2026-09-01', correctiveAction: 'Фильтр' });
    expectVersioned(calls[1], 7, { fileId: 'file-1' });
    expectVersioned(calls[2], 8, { status: 'IN_PROGRESS', comment: 'Начато' });
    expectVersioned(calls[3], 9, { status: 'CLOSED', resolutionComment: 'Устранено' });
    expectVersioned(calls[4], 10, { status: 'OPEN', comment: 'Повторное превышение' });
    expectVersioned(calls[5], 11, { description: 'Фильтр', responsibleUserId: 3, dueDate: '2026-09-01' });
    expectVersioned(calls[6], 2, { description: 'Новый фильтр' });
    expect(calls[7].ifMatch).toBe('3');
    expect(calls[7].body).toBeUndefined();
    expectVersioned(calls[8], 4, { status: 'DONE', comment: 'Готово' });
  });

  it('downloads CMS by signature.id', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    const component = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportDocuments.tsx'), 'utf8');
    expect(service).toContain("${reportDocumentPath(reportId)}/signatures/${signatureId}/download");
    expect(component).toContain('downloadCms.mutate(signature.id)');
    expect(service).not.toContain('signatureFileId');
    expect(component).not.toContain('signatureFileId');
  });

  it('handles VERSION_CONFLICT once and refetches without retrying mutation', async () => {
    const refresh = vi.fn(async () => undefined);
    const mapped = await handlePekMutationError({ isAxiosError: true, response: { status: 409, data: { code: 'VERSION_CONFLICT' } } }, refresh);
    expect(mapped.message).toBe(PEK_VERSION_CONFLICT_MESSAGE);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
