// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { mapProgramResponse } from '../src/features/pek/mappers/responseMappers';
import { pekApi } from '../src/features/pek/api/pekService';
import { pekKeys } from '../src/features/pek/api/pekQueryKeys';
import { mapPekError } from '../src/features/pek/utils/pekErrorMapper';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const requests: Request[] = [];
const report = {
  id: 9, companyId: 17, objectId: 2, programId: 3, version: 8, status: 'SIGNED',
  periodType: 'QUARTER', reportYear: 2026, reportQuarter: 3,
  periodStart: '2026-07-01', periodEnd: '2026-09-30', linkedProtocolCount: 0,
  availableActions: { collect: true, archive: true },
};

const server = setupServer(
  http.get('*/api/pek/reports', ({ request }) => {
    requests.push(request);
    return HttpResponse.json({ data: { content: [], page: 2, size: 20, totalElements: 42, totalPages: 3 } });
  }),
  http.post('*/api/pek/scheduler/run', ({ request }) => {
    requests.push(request);
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/pek/reports/9/collect', ({ request }) => {
    requests.push(request);
    return HttpResponse.json({ data: {
      report, linkedProtocolCount: 0, linkedProtocolNumbers: [], protocolResultCount: 0,
      matchedCount: 0, unmatchedCount: 0, ambiguousCount: 0, removedStaleSourceCount: 0,
      updatedSourceCount: 0, warnings: [],
    } });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { requests.length = 0; });
afterAll(() => server.close());

describe('PEK P1 backend-authoritative frontend logic', () => {
  it('maps program buttons only from backend availableActions', () => {
    const program = mapProgramResponse({
      id: 1, version: 2, number: 'PEK-1', name: 'Program', status: 'ACTIVE',
      validFrom: '2026-01-01', validUntil: '2026-12-31',
      availableActions: { edit: false, submit: true, archive: true, uploadDocument: false },
    });
    expect(program.availableActions).toMatchObject({ edit: false, submit: true, archive: true, uploadDocument: false });
    const details = source('src/features/pek/pages/PekProgramDetailsPage.tsx');
    expect(details).toContain('item.availableActions.archive');
    expect(details).not.toMatch(/status\s*===\s*['"]APPROVED['"]/);
  });

  it('shows Archive for SIGNED only when backend archive=true', () => {
    const actions = source('src/features/pek/components/workflow/PekReportActions.tsx');
    expect(actions).toContain('report.availableActions.archive === true');
    expect(actions).toContain('Архивировать');
    expect(actions).not.toContain("status === 'APPROVED'");
  });

  it('uses backend stale and hides forbidden document actions', () => {
    const documents = source('src/features/pek/components/documents/PekReportDocuments.tsx');
    expect(documents).toContain('latest?.stale');
    expect(documents).toContain('Документ устарел');
    expect(documents).not.toContain("status === 'STALE'");
    expect(documents).toContain('report.availableActions.signOfficialDocument === true');
    expect(documents).toContain('report.availableActions[config.downloadAction] === true');
  });

  it('sends filters to API and preserves server pagination', async () => {
    const page = await pekApi.getReports({ companyId: 17, objectId: 2, programId: 3, status: 'SIGNED', issue: 'OPEN_EXCEEDANCE', page: 2, size: 20, sort: 'periodStart,desc' });
    const url = new URL(requests[0].url);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ companyId: '17', objectId: '2', programId: '3', status: 'SIGNED', issue: 'OPEN_EXCEEDANCE', page: '2', size: '20', sort: 'periodStart,desc' });
    expect(page).toMatchObject({ totalElements: 42, totalPages: 3, page: 2 });
    expect(pekKeys.reports({ companyId: 17, objectId: 2, status: 'SIGNED', page: 0 })).not.toEqual(pekKeys.reports({ companyId: 17, objectId: 2, status: 'ARCHIVED', page: 0 }));
    expect(source('src/features/pek/pages/PekReportsPage.tsx')).toContain("if (key !== 'page') next.set('page', '0')");
  });

  it('runs scheduler for selectedCompanyId only', async () => {
    await pekApi.runSchedulerNow(17, 4);
    expect(new URL(requests[0].url).searchParams.get('companyId')).toBe('17');
    expect(requests[0].headers.get('If-Match')).toBe('4');
    const settings = source('src/features/pek/pages/PekSettingsPage.tsx');
    expect(settings).toContain('Запустить для выбранной компании');
    expect(settings).not.toContain('Запустить для всех компаний');
  });

  it('collect sends If-Match and never retries a conflict', async () => {
    await pekApi.collectReport(9, 8);
    expect(requests[0].headers.get('If-Match')).toBe('8');
    const workspace = source('src/features/pek/pages/PekReportWorkspacePage.tsx');
    expect(workspace).toContain('pekApi.collectReport(id, report.data!.version)');
    expect(workspace).toContain('Отчёт был изменён другим пользователем. Данные обновлены.');
    expect(workspace).toMatch(/const collect = useMutation\([\s\S]*?retry: false/);
  });

  it('renders readiness errors and maps maker-checker violation', () => {
    const details = source('src/features/pek/pages/PekProgramDetailsPage.tsx');
    expect(details).toContain('mapped.issues.map((issue) => issue.message)');
    expect(details).toContain('<PekReadinessPanel readiness={item.readiness}');
    expect(mapPekError({ isAxiosError: true, response: { status: 409, data: { code: 'MAKER_CHECKER_VIOLATION' } } }).message).toBe('Автор записи не может самостоятельно её согласовать.');
  });

  it('uses only internal assignee lookups and has no PEK membership management', () => {
    const service = source('src/features/pek/api/pekService.ts');
    const layout = source('src/features/pek/routes/PekLayout.tsx');
    expect(service).toContain("'/pek/lookups/assignees'");
    expect(service).not.toContain('/pek/companies/${companyId}/members');
    expect(layout).not.toContain('Сотрудники / Доступ ПЭК');
  });
});
