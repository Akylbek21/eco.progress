import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { pekApi } from '../src/features/pek/api/pekService';
import { labelPekStatus } from '../src/features/pek/utils/pekLabels';
import api from '../src/services/api';

const calls: string[] = [];
api.defaults.baseURL = 'http://localhost/api';
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: () => null },
});
const server = setupServer(
  http.get('*/api/pek/access-context', ({ request }) => {
    const companyId = Number(new URL(request.url).searchParams.get('companyId'));
    calls.push(`access:${companyId}`);
    return HttpResponse.json({ data: {
      companyId,
      membership: { id: companyId, companyId, userId: 7, userFullName: 'Эколог', userEmail: 'e@test.kz', roleCode: companyId === 1 ? 'ECOLOGIST' : 'VIEWER', status: 'ACTIVE', createdAt: null, updatedAt: null },
      permissions: companyId === 1 ? ['PEK_PROGRAM_CREATE'] : ['PEK_VIEW'],
      availableActions: companyId === 1 ? { createProgram: true } : {},
    } });
  }),
  http.get('*/api/pek/reports', ({ request }) => {
    const url = new URL(request.url);
    calls.push(`reports:${url.searchParams.get('status')}:${url.searchParams.get('issue')}`);
    return HttpResponse.json({ data: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 } });
  }),
  http.get('*/api/pek/permits/context', ({ request }) => {
    const companyId = Number(new URL(request.url).searchParams.get('companyId'));
    return HttpResponse.json({ data: { companyId, programs: [{ id: 11, number: 'P-11', name: 'ПЭК 2026', status: 'ACTIVE' }], files: [{ id: 'f-1', name: 'Разрешение.pdf' }] } });
  }),
  http.get('*/api/pek/reports/9/document/versions/4/download/:format', ({ params }) => {
    calls.push(`version:4:${params.format}`);
    return new HttpResponse(new Uint8Array([1, 2, 3]).buffer, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="report.${params.format}"` } });
  }),
  http.get('*/api/pek/reports/9/document/signatures/8/cms', () => {
    calls.push('cms:8');
    return new HttpResponse(new Uint8Array([4, 5, 6]).buffer, { headers: { 'Content-Type': 'application/pkcs7-signature', 'Content-Disposition': 'attachment; filename="signature.cms"' } });
  }),
  http.get('*/api/pek/settings/automation/status', () => HttpResponse.json({ data: { lastRunAt: null, status: 'IDLE', processed: 10, succeeded: 9, failed: 1, nextRunAt: '2026-08-18T00:00:00Z', availableActions: { runNow: true } } })),
  http.get('*/api/pek/settings/automation/history', () => HttpResponse.json({ data: [{ id: 3, lastRunAt: '2026-08-17T10:00:00Z', status: 'SUCCESS', processed: 4, succeeded: 4, failed: 0, nextRunAt: null, availableActions: {} }] })),
  http.post('*/api/pek/settings/automation/run', ({ request }) => {
    calls.push(`scheduler:${new URL(request.url).searchParams.get('companyId')}`);
    return HttpResponse.json({ data: { id: 4, lastRunAt: '2026-08-17T11:00:00Z', status: 'SUCCESS', processed: 2, succeeded: 2, failed: 0, nextRunAt: null, availableActions: { runNow: true } } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('PEK contracts 7-15', () => {
  it('reloads membership access for each company and preserves roleCode', async () => {
    const first = await pekApi.getAccessContext(1);
    const second = await pekApi.getAccessContext(2);
    expect(first.membership?.roleCode).toBe('ECOLOGIST');
    expect(second.membership?.roleCode).toBe('VIEWER');
    expect(calls).toEqual(expect.arrayContaining(['access:1', 'access:2']));
    const programs = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramsPage.tsx'), 'utf8');
    expect(programs).toContain('access.data?.availableActions.createProgram === true');
    expect(programs).not.toContain("role === 'ECOLOGIST'");
  });

  it('clears stale program selection and validates it against available programs', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportCreatePage.tsx'), 'utf8');
    expect(source).toContain('setProgramId(null)');
    expect(source).toContain('availablePrograms.some((program) => program.id === selectedProgramId)');
    expect(source).toContain('[companyId, objectId, year, periodType, quarter]');
  });

  it('uses the opened program version for workflow and handles stale versions', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramDetailsPage.tsx'), 'utf8');
    expect(source).toContain('const version = program.data!.version');
    expect(source).not.toContain('const fresh = await pekApi.getProgram(id)');
    expect(source).toContain("mapped.status === 409 || mapped.status === 412 || mapped.code === 'PEK_VERSION_CONFLICT'");
    expect(source).toContain('Программа была изменена другим пользователем. Обновите данные.');
  });

  it('supports SIGNED and sends dashboard drill-down filters to report query', async () => {
    expect(labelPekStatus('SIGNED')).toBe('Подписан');
    await pekApi.getReports({ companyId: 1, objectId: 2, status: 'SIGNED', issue: 'OPEN_EXCEEDANCE' });
    expect(calls).toContain('reports:SIGNED:OPEN_EXCEEDANCE');
    const dashboard = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekDashboardPage.tsx'), 'utf8');
    expect(dashboard).toContain("{ status: 'SIGNED' }");
    expect(dashboard).toContain("{ issue: 'OPEN_EXCEEDANCE' }");
    expect(dashboard).toContain('...drillDown');
  });

  it('loads permit program/file picker context for the selected company', async () => {
    const context = await pekApi.getPermitContext(1);
    expect(context.programs[0].id).toBe(11);
    expect(context.files[0].id).toBe('f-1');
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekPermitsPage.tsx'), 'utf8');
    expect(source).toContain('Очистить программу');
    expect(source).toContain('Удалить файл');
    expect(source).not.toContain('ID программы ПЭК');
    expect(source).not.toContain('ID файла');
  });

  it('downloads historical DOCX/PDF by versionId and CMS through authenticated API', async () => {
    const docx = await pekApi.downloadReportDocumentVersion(9, 4, 'docx');
    const pdf = await pekApi.downloadReportDocumentVersion(9, 4, 'pdf');
    const cms = await pekApi.downloadReportSignatureCms(9, 8);
    expect([docx.filename, pdf.filename, cms.filename]).toEqual(['report.docx', 'report.pdf', 'signature.cms']);
    expect(calls).toEqual(expect.arrayContaining(['version:4:docx', 'version:4:pdf', 'cms:8']));
  });

  it('does not expose a fake program versions tab without snapshot API', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramDetailsPage.tsx'), 'utf8');
    expect(source).not.toContain("'Версии'");
    expect(source).toContain("'История изменений'");
  });

  it('loads scheduler status/history and runs it only through the backend command', async () => {
    const [status, history, run] = await Promise.all([pekApi.getSchedulerStatus(1), pekApi.getSchedulerHistory(1), pekApi.runSchedulerNow(1)]);
    expect(status.availableActions.runNow).toBe(true);
    expect(history[0].id).toBe(3);
    expect(run.id).toBe(4);
    expect(calls).toContain('scheduler:1');
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekSettingsPage.tsx'), 'utf8');
    expect(source).toContain('schedulerStatus.data?.availableActions.runNow === true');
    expect(source).toContain('disabled={runScheduler.isPending}');
    expect(source).toContain('schedulerStatus.refetch()');
    expect(source).toContain('schedulerHistory.refetch()');
  });
});
