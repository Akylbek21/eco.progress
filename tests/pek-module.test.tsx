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
  mapReportCreateRequest,
} from '../src/features/pek/mappers/reportMappers';
import { labelPekStatus } from '../src/features/pek/utils/pekLabels';
import { pekProgramFormSchema } from '../src/features/pek/validation/programSchema';
import { migrateLegacyDraft, pekDraftKey } from '../src/features/pek/utils/pekDraftStorage';
import { currentQuarter } from '../src/features/pek/utils/pekPeriod';
import { hasPermission } from '../src/config/permissions';
import { comparisonTypeLabels, migrateComparisonType } from '../src/features/pek/model/pekDictionaries';
import { canCollectPekReport, canSubmitPekReport } from '../src/features/pek/permissions/pekAccess';
import { pekKeys } from '../src/features/pek/api/pekQueryKeys';

let body: unknown;
let ifMatch: string | null;
let programListCalls = 0;
let reportListCalls = 0;
const report = {
  id: 9,
  companyId: 1,
  objectId: 2,
  programId: 10,
  version: 13,
  status: 'COLLECTING',
  periodType: 'QUARTER',
  reportYear: 2026,
  reportQuarter: 3,
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
  http.get('*/api/pek/reports', ({ request }) => {
    reportListCalls += 1;
    const params = new URL(request.url).searchParams;
    return HttpResponse.json({ data: { content: [], number: 0, size: 20, totalElements: 0, totalPages: 0 }, companyId: params.get('companyId'), objectId: params.get('objectId') });
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
      protocolResultCount: 5,
      matchedCount: 3,
      unmatchedCount: 1,
      ambiguousCount: 1,
      removedStaleSourceCount: 2,
      updatedSourceCount: 4,
      warnings: ['Проверьте ручную связь'],
    } });
  }),
  http.get('*/api/pek/reports/:id/sources', () => HttpResponse.json({ data: [{ id: 31, protocolId: 4, protocolNumber: 'P-4', protocolResultId: 8, matchStatus: 'UNMATCHED', manual: false, excluded: false, sourceVersion: 1, version: 2 }] })),
  http.get('*/api/pek/reports/:id/sources/summary', () => HttpResponse.json({ data: { linkedProtocolCount: 1, linkedResultCount: 1, unmatchedResultCount: 1, ambiguousResultCount: 0, staleResultCount: 0, excludedResultCount: 0 } })),
  http.get('*/api/pek/reports/:id/plan-fact', () => HttpResponse.json({ data: { summary: { planned: 1, completed: 0, missing: 1, completionPercent: 0, exceedances: 0 }, items: [] } })),
  http.get('*/api/pek/reports/:id/readiness', () => HttpResponse.json({ data: { ready: false, progressPercent: 0, summary: { planned: 1, completed: 0, missing: 1, unmatched: 1, ambiguous: 0, stale: 0, openExceedances: 0, overdueActions: 0 }, issues: [{ code: 'UNMATCHED_SOURCES', section: 'SOURCES', severity: 'ERROR', message: 'Есть несопоставленные результаты: 1', blocking: true }] } })),
  http.post('*/api/pek/reports/:reportId/sources/:sourceId/match', async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ data: { id: 31, protocolId: 4, protocolNumber: 'P-4', protocolResultId: 8, matchStatus: 'MANUALLY_MATCHED', manual: true, excluded: false, sourceVersion: 1, version: 3 } });
  }),
  http.post('*/api/pek/reports/:id/return', async ({ request }) => {
    body = await request.json();
    return HttpResponse.json({ data: { ...report, status: 'RETURNED', version: 14 } });
  }),
  http.get('*/api/pek/settings', () => HttpResponse.json({ data: { companyId: 1, defaultResponsibleUserId: null, defaultLaboratoryId: null, defaultReportType: 'QUARTERLY', autoCollectProtocols: false, includeOnlySignedProtocols: true, allowFallbackMatching: true, requireManualAmbiguousConfirmation: true, requireAllPlanFactItems: true, blockSubmitWithUnmatchedResults: true, blockSubmitWithAmbiguousResults: true, blockSubmitWithStaleSources: true, blockSubmitWithOpenExceedances: true, notifyBeforeDeadlineDays: 7, notifyMissingProtocols: true, notifyExceedances: true, notifyReportReturned: true, version: 0, availableActions: { view: true, edit: true }, capabilities: { automaticCollectionSupported: false } } })),
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
    controlType: 'EMISSION',
    frequencyType: 'QUARTERLY',
    mandatory: true,
    active: true,
    sortOrder: 0,
  }],
  indicators: [{
    clientId: 'indicator-a',
    controlItemClientId: 'control-a',
    indicatorName: 'NO2',
    unit: 'mg/m3',
    comparisonType: 'LESS_OR_EQUAL',
    normativeValue: 10,
    mandatory: true,
    sortOrder: 0,
  }],
  measures: [{ clientId: 'measure-a', code: 'M-1', name: 'Filters', responsibleUserId: 7, plannedEndDate: '2026-10-01' }],
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

  it('uses report availableActions together with permissions and status', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain('availableActions');
    expect(source).toContain('canMutateSources');
    expect(source).toContain('actions.matchSources === true');
  });

  it('uses backend report actions without overriding them from a local role matrix', () => {
    const item = { status: 'COLLECTING', availableActions: { collect: true, submitReview: true } };
    expect(canCollectPekReport({ role: 'LABORATORY' }, item)).toBe(true);
    expect(canSubmitPekReport({ role: 'LABORATORY' }, item)).toBe(true);
    expect(canSubmitPekReport({ role: 'ECOLOGIST' }, item)).toBe(true);
    expect(canCollectPekReport({ role: 'ADMIN' }, { ...item, availableActions: { collect: false } })).toBe(false);
  });

  it('closed report and false availableActions hide source mutations', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain("const canMutateSources = actions.matchSources === true");
    expect(source).toContain("source.matchStatus !== 'STALE'");
    expect(source).not.toContain('actions.matchSources ||');
  });

  it('settings handles query errors before the empty-form state and supports read-only mode', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekSettingsPage.tsx'), 'utf8');
    expect(source.indexOf('if (settings.isError)')).toBeLessThan(source.indexOf('if (!settings.data || !form)'));
    expect(source).toContain('Настройки доступны только для просмотра');
    expect(source).toContain('{editable &&');
  });

  it('company id is part of PEK query keys', () => {
    expect(pekKeys.settings(1)).not.toEqual(pekKeys.settings(2));
    expect(pekKeys.report(9, 1)).not.toEqual(pekKeys.report(9, 2));
    expect(pekKeys.dashboard({ companyId: 1 })).not.toEqual(pekKeys.dashboard({ companyId: 2 }));
    expect(pekKeys.report(9, 1, 'user-1')).not.toEqual(pekKeys.report(9, 1, 'user-2'));
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekQueryKeys.ts'), 'utf8');
    expect(source).not.toContain('localStorage');
  });

  it('clears PEK cache on login, logout and explicit user replacement', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/contexts/AuthContext.tsx'), 'utf8');
    expect(source.match(/removeQueries\(\{ queryKey: \['pek'\] \}\)/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('missing dashboard KPI stays absent and renders as a dash', () => {
    const mapped = mapDashboardResponse({ deadlines: [], reports: [] });
    expect(mapped.returnedReportCount).toBeUndefined();
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekDashboardPage.tsx'), 'utf8');
    expect(source).toContain("dashboard.data[key] == null");
    expect(source).not.toContain('currentlyUnsupportedZeroMetrics');
  });

  it('confirms collection, blocks double submit and reconciles all report caches', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain('collectConfirmOpen');
    expect(source).toContain("collect.isPending ? 'Сбор…'");
    expect(source).toContain('pekKeys.reportSourcesRoot');
    expect(source).toContain('pekKeys.planFact');
    expect(source).toContain('pekKeys.readiness');
    expect(source).toContain('mapped.status === 409');
  });

  it('RETURNED, STALE, readiness and version conflict have explicit UI states', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain("item.status === 'RETURNED'");
    expect(source).toContain('Отчёт возвращён на доработку');
    expect(source).toContain('Устаревшая связь · системно исключён');
    expect(source).toContain('getReportReadiness(id)');
    expect(source).toContain('Данные были изменены другим пользователем');
  });

  it('does not expose a fake program versions route or report history endpoint', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(app).not.toContain('/staff/pek/programs/:programId/versions');
    expect(service).not.toContain('/pek/reports/${id}/history');
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
    expect(mapReportResponse(report).year).toBe(2026);
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

  it('calculates the current quarter from the supplied date', () => {
    expect(currentQuarter(new Date('2026-01-15T00:00:00Z'))).toBe(1);
    expect(currentQuarter(new Date('2026-08-05T00:00:00Z'))).toBe(3);
    expect(currentQuarter(new Date('2026-12-31T00:00:00Z'))).toBe(4);
  });

  it('requires control type and PER_EVENT planned count', () => {
    const missingType = pekProgramFormSchema.safeParse({ ...form, controlItems: [{ ...form.controlItems[0], controlType: '' }] });
    const missingCount = pekProgramFormSchema.safeParse({ ...form, controlItems: [{ ...form.controlItems[0], frequencyType: 'PER_EVENT', plannedCount: null }] });
    expect(missingType.success).toBe(false);
    expect(missingCount.success).toBe(false);
  });

  it('validates RANGE values and preserves numeric zero', () => {
    const invalid = pekProgramFormSchema.safeParse({ ...form, indicators: [{ ...form.indicators[0], comparisonType: 'RANGE', minValue: 5, maxValue: 4 }] });
    const valid = pekProgramFormSchema.safeParse({ ...form, indicators: [{ ...form.indicators[0], comparisonType: 'RANGE', minValue: 0, maxValue: 0 }] });
    expect(invalid.success).toBe(false);
    expect(valid.success).toBe(true);
  });

  it('requires backend auth permissions for PEK operations', () => {
    expect(hasPermission({ role: 'ADMIN' }, 'PEK_VIEW')).toBe(false);
    expect(hasPermission({ role: 'ACCOUNTANT' }, 'PEK_VIEW')).toBe(false);
    expect(hasPermission({ role: 'ECOLOGIST', permissions: ['PEK_VIEW'] }, 'PEK_VIEW')).toBe(true);
    expect(hasPermission({ role: 'ECOLOGIST', permissions: [] }, 'PEK_PROGRAM_CREATE')).toBe(false);
  });

  it('maps only backend comparison enums and migrates an old draft', () => {
    expect(migrateComparisonType('MAX')).toBe('LESS_OR_EQUAL');
    expect(migrateComparisonType('MIN')).toBe('GREATER_OR_EQUAL');
    expect(migrateComparisonType('INFORMATIONAL')).toBe('INFO');
    expect(comparisonTypeLabels.LESS_OR_EQUAL).toBe('Не более');
    const migrated = migrateLegacyDraft({
      key: 'legacy', contractVersion: 1, backendVersion: 'new', savedAt: '2026-08-06T00:00:00Z',
      form: { indicators: [{ comparisonType: 'MAX' }] },
    });
    expect(migrated?.form.indicators[0].comparisonType).toBe('LESS_OR_EQUAL');
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
    expect(collected).toMatchObject({ matchedCount: 3, unmatchedCount: 1, ambiguousCount: 1, removedStaleSourceCount: 2 });
    expect(collected.warnings).toEqual(['Проверьте ручную связь']);
  });

  it('loads sources, plan/fact and backend readiness without local calculation', async () => {
    const [sources, summary, planFact, readiness] = await Promise.all([
      pekApi.getReportSources(9), pekApi.getReportSourcesSummary(9), pekApi.getReportPlanFact(9), pekApi.getReportReadiness(9),
    ]);
    expect(sources[0]).toMatchObject({ id: 31, matchStatus: 'UNMATCHED', version: 2 });
    expect(summary.unmatchedResultCount).toBe(1);
    expect(planFact.summary.missing).toBe(1);
    expect(readiness.ready).toBe(false);
    expect(readiness.issues[0]).toMatchObject({ section: 'SOURCES', blocking: true });
  });

  it('sends source and report versions in the body where backend requires them', async () => {
    await pekApi.matchReportSource(9, 31, 77, 2);
    expect(body).toEqual({ indicatorId: 77, version: 2 });
    await pekApi.returnReport(9, 13, 'Исправить сопоставление');
    expect(body).toEqual({ version: 13, reason: 'Исправить сопоставление' });
  });

  it('loads real PEK settings and capabilities', async () => {
    const settings = await pekApi.getSettings();
    expect(settings.defaultReportType).toBe('QUARTERLY');
    expect(settings.availableActions.edit).toBe(true);
    expect(settings.capabilities.automaticCollectionSupported).toBe(false);
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

  it('report list waits for required company and object filters', async () => {
    await pekApi.getReports({ companyId: 1, objectId: 2, page: 0, size: 20 });
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportsPage.tsx'), 'utf8');
    expect(source).toContain('pekApi.getReports(filters, signal)');
    expect(source).toContain('enabled: Boolean(companyId && objectId)');
    expect(source).toContain('Выберите компанию и объект');
    expect(reportListCalls).toBe(1);
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
    expect(source).toContain('Для объекта нет действующих разрешительных документов');
  });
});
