// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { PekProgramForm } from '../src/features/pek/api/pekContracts';
import { pekApi } from '../src/features/pek/api/pekService';
import { filenameFromDisposition } from '../src/features/pek/api/pekMappers';
import { mapDashboardResponse, mapProgramResponse, mapReportResponse } from '../src/features/pek/mappers/responseMappers';
import {
  mapProgramAutosaveToRequest,
  mapProgramCreateFormToRequest,
  mapProgramEditFormToRequest,
} from '../src/features/pek/mappers/programMappers';
import {
  getCreationBlockState,
  getReportWorkflowActions,
  mapReportCreateRequest,
} from '../src/features/pek/mappers/reportMappers';
import { labelPekStatus } from '../src/features/pek/utils/pekLabels';
import { pekProgramFormSchema } from '../src/features/pek/validation/programSchema';
import { pekDraftKey } from '../src/features/pek/utils/pekDraftStorage';

let body: unknown;
let ifMatch: string | null;
let programListCalls = 0;
let reportListCalls = 0;
const report = {
  id: 9,
  version: 13,
  status: 'COLLECTING',
  periodType: 'QUARTER',
  year: 2026,
  quarter: 3,
  periodStart: '2026-07-01',
  periodEnd: '2026-09-30',
  linkedProtocolCount: 2,
  linkedProtocolNumbers: ['P-READY', 'P-SIGNED'],
  lastCollectedAt: '2026-07-31T10:00:00Z',
};
const programResponse = {
  id: 1, version: 8, number: 'PEK-1', name: 'Program', status: 'DRAFT',
  validFrom: '2026-01-01', validUntil: '2026-12-31', availableActions: ['EDIT'], readOnly: false,
};
const server = setupServer(
  http.get('*/api/pek/programs', ({ request }) => {
    programListCalls += 1;
    return HttpResponse.json({ data: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 }, search: new URL(request.url).searchParams.get('search') });
  }),
  http.get('*/api/pek/reports', () => {
    reportListCalls += 1;
    return HttpResponse.json({ data: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 } });
  }),
  http.patch('*/api/pek/programs/:id/draft', async ({ request }) => {
    body = await request.json();
    ifMatch = request.headers.get('If-Match');
    return HttpResponse.json({ data: programResponse });
  }),
  http.patch('*/api/pek/programs/:id', async ({ request }) => {
    body = await request.json();
    ifMatch = request.headers.get('If-Match');
    return HttpResponse.json({ data: programResponse });
  }),
  http.post('*/api/pek/programs/:id/return', async ({ request }) => {
    body = await request.json();
    ifMatch = request.headers.get('If-Match');
    return HttpResponse.json({ data: programResponse });
  }),
  http.post('*/api/pek/reports', async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ data: report });
  }),
  http.post('*/api/pek/reports/:id/collect', async ({ request }) => {
    body = {};
    ifMatch = request.headers.get('If-Match');
    return HttpResponse.json({ data: {
      report,
      linkedProtocolCount: 2,
      linkedProtocolNumbers: ['P-READY', 'P-SIGNED'],
    } });
  }),
  http.get('*/api/pek/dashboard', () => HttpResponse.json({ data: {
    totalReportCount: 0,
    readinessPercent: 0,
    criticalIssueCount: 0,
    overdueRiskCount: 0,
    programExecutionPercent: 0,
    openExceedanceCount: 0,
    overdueActionCount: 0,
    missingProtocolCount: 0,
    deadlines: [],
    reports: [],
  } })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  body = undefined;
  ifMatch = null;
  programListCalls = 0;
  reportListCalls = 0;
  server.resetHandlers();
});
afterAll(() => server.close());

const form: PekProgramForm = {
  companyId: 1,
  objectId: 2,
  number: ' PEK-1 ',
  name: ' Program ',
  description: ' Description ',
  validFrom: '2026-01-01',
  validUntil: '2026-12-31',
  responsibleUserId: 7,
  controlItems: [{
    clientId: 'control-a',
    code: 'AIR-1',
    name: 'Air',
    mandatory: true,
    active: true,
    sortOrder: 0,
  }],
  indicators: [{
    clientId: 'indicator-a',
    controlItemClientId: 'control-a',
    indicatorName: 'NO2',
    mandatory: true,
    sortOrder: 0,
  }],
  measures: [{ clientId: 'measure-a', name: 'Filters' }],
};

describe('PEK backend contract', () => {
  it('maps program creation and uses controlItemIndex for new rows', () => {
    const request = mapProgramCreateFormToRequest(form);
    expect(request).toMatchObject({ companyId: 1, objectId: 2, number: 'PEK-1', name: 'Program' });
    expect(request.controlItems[0]).not.toHaveProperty('clientId');
    expect(request.indicators[0]).toMatchObject({ controlItemIndex: 0, indicatorName: 'NO2' });
    expect(request.indicators[0]).not.toHaveProperty('controlItemClientId');
  });

  it('maps edits and intentionally preserves empty arrays as clear commands', () => {
    const request = mapProgramEditFormToRequest({ ...form, controlItems: [], indicators: [], measures: [] });
    expect(request.controlItems).toEqual([]);
    expect(request.indicators).toEqual([]);
    expect(request.measures).toEqual([]);
  });

  it('autosave never sends program collections', async () => {
    const request = mapProgramAutosaveToRequest(form);
    expect(request.controlItems).toBeUndefined();
    expect(request.indicators).toBeUndefined();
    expect(request.measures).toBeUndefined();
    await pekApi.saveProgramDraft(1, 7, request);
    expect(body).not.toHaveProperty('controlItems');
    expect(body).not.toHaveProperty('indicators');
    expect(body).not.toHaveProperty('measures');
    expect(body).toHaveProperty('version', 7);
    expect(ifMatch).toBeNull();
  });

  it('sends empty arrays and version in the full PATCH body', async () => {
    const request = mapProgramEditFormToRequest({ ...form, controlItems: [], indicators: [], measures: [] });
    await pekApi.updateProgram(1, 12, request);
    expect(body).toMatchObject({ controlItems: [], indicators: [], measures: [] });
    expect(body).toHaveProperty('version', 12);
    expect(ifMatch).toBeNull();
  });

  it('keeps return version in body and If-Match header', async () => {
    await pekApi.returnProgram(1, { version: 12, reason: 'Исправить период' });
    expect(body).toEqual({ reason: 'Исправить период' });
    expect(ifMatch).toBe('12');
  });

  it('centralizes only implemented report workflow actions', () => {
    expect(getReportWorkflowActions('DRAFT')).toEqual(['COLLECT']);
    expect(getReportWorkflowActions('COLLECTING')).toEqual(['COLLECT', 'SUBMIT_REVIEW']);
    expect(getReportWorkflowActions('READY_FOR_REVIEW')).toEqual(['APPROVE']);
    expect(getReportWorkflowActions('APPROVED')).toEqual(['ARCHIVE']);
    expect(getReportWorkflowActions('SIGNED')).toEqual([]);
  });

  it('maps Java ProgramResponse string actions without deriving status', () => {
    const program = mapProgramResponse({
      id: 1,
      number: 'PEK-1',
      name: 'Program',
      version: 4,
      status: 'RETURNED',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      responsibleUser: { id: 7, name: 'Ecologist' },
      availableActions: ['EDIT', 'SUBMIT_REVIEW', 'CLONE'],
      readOnly: false,
    });
    expect(program.responsible?.id).toBe(7);
    expect(program.availableActions.map((item) => item.code)).toEqual(['EDIT', 'SUBMIT_REVIEW', 'CLONE']);
  });

  it('maps Java reportYear/reportQuarter and dashboard deadline fields exactly', () => {
    expect(mapReportResponse({ ...report, reportYear: 2026, reportQuarter: 3, year: undefined, quarter: undefined }).year).toBe(2026);
    expect(mapDashboardResponse({
      totalReportCount: 0,
      readinessPercent: 0,
      deadlines: [{ id: 10, type: 'PROGRAM_VALID_UNTIL', date: '2026-12-31', description: 'Program deadline' }],
      reports: [],
    }).deadlines[0]).toEqual({ id: 10, type: 'PROGRAM_VALID_UNTIL', date: '2026-12-31', description: 'Program deadline' });
  });

  it('creates quarterly reports with quarter', async () => {
    const request = mapReportCreateRequest({ companyId: 1, objectId: 2, periodType: 'QUARTER', year: 2026, quarter: 3 }, 10, true);
    await pekApi.createReport(request);
    expect(body).toEqual({ companyId: 1, objectId: 2, periodType: 'QUARTER', year: 2026, quarter: 3, programId: 10, collectImmediately: true });
  });

  it('creates annual reports without quarter', () => {
    const request = mapReportCreateRequest({ companyId: 1, objectId: 2, periodType: 'YEAR', year: 2026, quarter: 4 }, 10, false);
    expect(request).not.toHaveProperty('quarter');
  });

  it('blocks duplicate reports and backend blocking reasons', () => {
    const base = { periodStart: '2026-01-01', periodEnd: '2026-12-31', programs: [form as never], selectedProgramId: 1, warnings: [] };
    expect(getCreationBlockState({ ...base, duplicateReportId: 55, blockingReasons: [] }).duplicateReportId).toBe(55);
    expect(getCreationBlockState({ ...base, duplicateReportId: null, blockingReasons: ['No active program'] })).toMatchObject({ blocked: true, blockingReasons: ['No active program'] });
  });

  it('preserves backend zero values and unknown statuses', async () => {
    const dashboard = await pekApi.getDashboard({});
    expect(dashboard.totalReportCount).toBe(0);
    expect(dashboard.readinessPercent).toBe(0);
    expect(labelPekStatus('NEW_BACKEND_STATUS')).toBe('NEW_BACKEND_STATUS');
  });

  it('preserves zero normative values and validates program dates', () => {
    const valid = pekProgramFormSchema.safeParse({
      ...form,
      indicators: [{ ...form.indicators[0], normativeValue: 0 }],
      measures: [{ ...form.measures[0], completionPercent: 0, plannedBudget: 0 }],
    });
    expect(valid.success).toBe(true);
    const invalid = pekProgramFormSchema.safeParse({ ...form, validFrom: '2026-12-31', validUntil: '2026-01-01' });
    expect(invalid.success).toBe(false);
  });

  it('scopes local draft keys by user, entity, company and server version', () => {
    expect(pekDraftKey('program', 7, 10, 4, 22)).toBe('pek-program-draft:7:10:22:4');
  });

  it('rejects malformed critical backend contracts instead of creating id zero', () => {
    expect(() => mapProgramResponse({ id: 0, version: 1, status: 'DRAFT' })).toThrow(/контракт/);
    expect(() => mapReportResponse({ id: 0, version: 1, status: 'DRAFT' })).toThrow(/контракт/);
  });

  it('collect is synchronous, unversioned and returns real protocol numbers', async () => {
    const collected = await pekApi.collectReport(9);
    expect(ifMatch).toBeNull();
    expect(body).toEqual({});
    expect(collected.linkedProtocolNumbers).toEqual(['P-READY', 'P-SIGNED']);
    expect(collected.linkedProtocolNumbers).not.toContain('P-DRAFT');
  });

  it('downloads a program document through the authorized PEK API client', () => {
    expect(filenameFromDisposition("attachment; filename*=UTF-8''protocol%20scan.pdf", 'fallback')).toBe('protocol scan.pdf');
    const serviceSource = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(serviceSource).toContain('pekApiClient as api');
    expect(serviceSource).toContain('responseType:');
    expect(serviceSource).toContain("response.headers['content-disposition']");
    expect(serviceSource).not.toContain('GridFS');
  });

  it('program list can be requested without companyId', async () => {
    await pekApi.getPrograms({ page: 0, size: 20 });
    expect(programListCalls).toBe(1);
  });

  it('report list supports an unfiltered server page', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportsPage.tsx'), 'utf8');
    expect(source).toContain('pekApi.getReports(filters, signal)');
    expect(source).toContain('По выбранным фильтрам отчётов нет');
    expect(reportListCalls).toBe(0);
  });

  it('uses backend readOnly and editable statuses for autosave', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(source).toContain("['DRAFT', 'RETURNED'].includes(program.data.status)");
    expect(source).toContain('program.data?.readOnly');
    expect(source).toContain('mapProgramAutosaveToRequest');
  });

  it('shows a version conflict dialog and never retries mutations automatically', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(source).toContain('Программа изменена другим пользователем');
    expect(source).toContain('retry: false');
  });

  it('treats empty permits as a valid state', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(source).toContain('Для объекта нет доступных разрешительных документов');
  });
});
