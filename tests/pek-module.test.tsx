// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
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
import {
  canArchiveReport,
  canCollectPekReport,
  canCreateProgram,
  canCreateReport,
  canSignReport,
  canSubmitPekReport,
  canTransitionExceedance,
} from '../src/features/pek/permissions/pekAccess';
import { pekKeys } from '../src/features/pek/api/pekQueryKeys';
import { commitPekProgramMutation } from '../src/features/pek/api/pekProgramCache';
import PekReportActions from '../src/features/pek/components/workflow/PekReportActions';

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
  availableActions: { collect: true, submitReview: true },
};
const programResponse = {
  id: 1, version: 8, number: 'PEK-1', name: 'Program', status: 'DRAFT',
  validFrom: '2026-01-01', validUntil: '2026-12-31', availableActions: { edit: true }, readOnly: false,
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
    ifMatch = request.headers.get('If-Match');
    return HttpResponse.json({ data: { id: 31, protocolId: 4, protocolNumber: 'P-4', protocolResultId: 8, matchStatus: 'MANUALLY_MATCHED', manual: true, excluded: false, sourceVersion: 1, version: 3 } });
  }),
  http.post('*/api/pek/reports/:id/return', async ({ request }) => {
    body = await request.json();
    ifMatch = request.headers.get('If-Match');
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
  cleanup();
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
    expect(body).not.toHaveProperty('version');
    expect(ifMatch).toBe('7');
  });

  it('sends empty arrays and version only in If-Match for full PATCH', async () => {
    const request = mapProgramEditFormToRequest({ ...form, controlItems: [], indicators: [], measures: [] });
    await pekApi.updateProgram(1, 12, request);
    expect(body).toMatchObject({ controlItems: [], indicators: [], measures: [] });
    expect(body).not.toHaveProperty('version');
    expect(ifMatch).toBe('12');
  });

  it('keeps return version only in If-Match header', async () => {
    await pekApi.returnProgram(1, 12, 'Исправить период');
    expect(body).toEqual({ reason: 'Исправить период' });
    expect(ifMatch).toBe('12');
  });

  it('uses report availableActions without status or role fallbacks', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain('item.availableActions.manageSources === true');
    expect(source).not.toContain("['DRAFT', 'COLLECTING', 'RETURNED'].includes(item.status)");
  });

  it('uses backend report actions without overriding them from a local role matrix', () => {
    const item = { status: 'COLLECTING', availableActions: { collect: true, submitReview: true } };
    expect(canCollectPekReport({ role: 'LABORATORY' }, item)).toBe(true);
    expect(canSubmitPekReport({ role: 'LABORATORY' }, item)).toBe(true);
    expect(canSubmitPekReport({ role: 'ECOLOGIST' }, item)).toBe(true);
    expect(canCollectPekReport({ role: 'ADMIN' }, { ...item, availableActions: { collect: false } })).toBe(false);
  });

  it('does not invent report actions when backend omits them', () => {
    expect(mapReportResponse({ ...report, availableActions: undefined }).availableActions).toEqual({});
  });

  it('renders report buttons from permissions and valid statuses', () => {
    const callbacks = {
      onCollect: () => undefined,
      onSubmit: () => undefined,
      onReturn: () => undefined,
      onApprove: () => undefined,
      onArchive: () => undefined,
    };
    const enabled = mapReportResponse({ ...report, status: 'DRAFT', availableActions: { collect: true, submitReview: true } });
    const view = render(<PekReportActions report={enabled} isPending={false} {...callbacks} />);
    expect(screen.getByRole('button', { name: 'Повторить сбор' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Отправить на проверку' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Вернуть на доработку' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Утвердить' })).toBeNull();

    view.rerender(<PekReportActions
      report={{ ...enabled, status: 'ARCHIVED', availableActions: {} }}
      isPending={false}
      {...callbacks}
    />);
    expect(screen.queryByRole('button')).toBeNull();

  });

  it('backend action hides source mutations', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain('const canMutateSources = item.availableActions.manageSources === true');
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
    expect(pekKeys.programsRoot()).toEqual(['pek', 'programs']);
    expect(pekKeys.programList({ companyId: 1 })).not.toEqual(pekKeys.programList({ companyId: 2 }));
    expect(pekKeys.programDetail(1, 9)).not.toEqual(pekKeys.programDetail(2, 9));
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
    expect(source).toContain('handleVersionedPekError(error, invalidateReportData)');
  });

  it('RETURNED, STALE, readiness and version conflict have explicit UI states', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    expect(source).toContain("item.status === 'RETURNED'");
    expect(source).toContain('Отчёт возвращён на доработку');
    expect(source).toContain("source.matchStatus === 'STALE' ? 'Устаревшая связь'");
    expect(source).toContain('getReportReadiness(id, signal)');
    expect(source).toContain('Данные были изменены другим пользователем');
  });

  it('does not expose a fake program versions route and uses the real report history endpoint', () => {
    const app = readFileSync(resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(app).not.toContain('/staff/pek/programs/:programId/versions');
    expect(service).toContain('/pek/reports/${id}/history');
  });

  it('maps ProgramResponse action flags without deriving status', () => {
    const program = mapProgramResponse({
      id: 1,
      number: 'PEK-1',
      name: 'Program',
      version: 4,
      status: 'RETURNED',
      validFrom: '2026-01-01',
      validUntil: '2026-12-31',
      responsibleUser: { id: 7, name: 'Ecologist' },
      availableActions: { edit: true, submit: true, clone: true },
      readOnly: false,
    });
    expect(program.responsible?.id).toBe(7);
    expect(program.availableActions).toMatchObject({ edit: true, submit: true, clone: true });
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

  it('uses backend permissions when present and documented legacy role fallbacks otherwise', () => {
    expect(hasPermission({ role: 'ADMIN' }, 'PEK_VIEW')).toBe(true);
    expect(hasPermission({ role: 'ACCOUNTANT' }, 'PEK_VIEW')).toBe(false);
    expect(hasPermission({ role: 'ECOLOGIST' }, 'PEK_PROGRAM_CREATE')).toBe(true);
    expect(hasPermission({ role: 'ECOLOGIST' }, 'PEK_REPORT_CREATE')).toBe(true);
    expect(hasPermission({ role: 'LABORATORY' }, 'PEK_PROGRAM_CREATE')).toBe(false);
    expect(hasPermission({ role: 'LABORATORY' }, 'PEK_REPORT_CREATE')).toBe(false);
    expect(hasPermission({ role: 'ACCOUNTANT' }, 'PEK_REPORT_CREATE')).toBe(false);
    expect(hasPermission({ role: 'ECOLOGIST', permissions: ['PEK_VIEW'] }, 'PEK_VIEW')).toBe(true);
    expect(hasPermission({ role: 'ECOLOGIST', permissions: [] }, 'PEK_PROGRAM_CREATE')).toBe(false);
    expect(hasPermission({ role: 'ADMIN', permissions: [] }, 'PEK_VIEW')).toBe(false);
  });

  it('fails closed for an unknown role and prioritizes resource-level actions', () => {
    const unknown = { role: 'UNKNOWN_ROLE' as never };
    expect(canCreateProgram(unknown)).toBe(false);
    expect(canCreateReport(unknown)).toBe(false);
    expect(canSignReport({ role: 'ADMIN' }, { status: 'SIGNED', availableActions: { sign: false } })).toBe(false);
    expect(canSignReport({ role: 'ECOLOGIST' }, undefined)).toBe(false);
    expect(canSubmitPekReport({ role: 'ECOLOGIST' }, undefined)).toBe(false);
    expect(canSignReport({ role: 'ECOLOGIST', permissions: ['PEK_REPORT_SIGN'] }, { status: 'APPROVED' })).toBe(false);
    expect(canArchiveReport({ role: 'ADMIN' }, { canArchive: false })).toBe(false);
    expect(canTransitionExceedance({ allowedTransitions: ['IN_REVIEW'] }, 'CLOSED')).toBe(false);
    expect(canTransitionExceedance({ allowedTransitions: ['CLOSED'] }, 'CLOSED')).toBe(true);
  });

  it('preserves backend returnInfo through the report mapper', () => {
    const mapped = mapReportResponse({
      ...report,
      status: 'RETURNED',
      returnInfo: {
        reason: 'Исправить расчёт',
        comment: 'Проверить источник',
        returnedAt: '2026-08-10T12:00:00Z',
        returnedBy: { id: 7, name: 'Руководитель' },
      },
    });
    expect(mapped.returnInfo).toEqual({
      reason: 'Исправить расчёт',
      comment: 'Проверить источник',
      returnedAt: '2026-08-10T12:00:00Z',
      returnedBy: { id: 7, name: 'Руководитель' },
    });
  });

  it('does not retain previous company rows while a new company query loads', () => {
    const reportsPage = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportsPage.tsx'), 'utf8');
    const programsPage = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramsPage.tsx'), 'utf8');
    expect(reportsPage).not.toContain('keepPreviousData');
    expect(programsPage).not.toContain('keepPreviousData');
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

  it('collect is synchronous, versioned and returns real protocol numbers', async () => {
    const collected = await pekApi.collectReport(9, 13);
    expect(ifMatch).toBe('13');
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

  it('sends source and report versions only in If-Match', async () => {
    await pekApi.matchReportSource(9, 31, 77, 2);
    expect(body).toEqual({ indicatorId: 77 });
    expect(ifMatch).toBe('2');
    await pekApi.returnReport(9, 13, 'Исправить сопоставление');
    expect(body).toEqual({ reason: 'Исправить сопоставление' });
    expect(ifMatch).toBe('13');
  });

  it('uses the contracted HTTP methods and URLs for report reconciliation', async () => {
    const requests: Array<{ method: string; pathname: string }> = [];
    server.use(
      http.get('*/api/pek/reports/:id/sources', ({ request }) => {
        requests.push({ method: request.method, pathname: new URL(request.url).pathname });
        return HttpResponse.json({ data: [] });
      }),
      http.get('*/api/pek/reports/:id/plan-fact', ({ request }) => {
        requests.push({ method: request.method, pathname: new URL(request.url).pathname });
        return HttpResponse.json({ data: { summary: { planned: 0, completed: 0, missing: 0, completionPercent: 0, exceedances: 0 }, items: [] } });
      }),
      http.get('*/api/pek/reports/:id/readiness', ({ request }) => {
        requests.push({ method: request.method, pathname: new URL(request.url).pathname });
        return HttpResponse.json({ data: { ready: true, progressPercent: 100, summary: {}, issues: [] } });
      }),
      http.post('*/api/pek/reports/:reportId/sources/:sourceId/match', async ({ request }) => {
        requests.push({ method: request.method, pathname: new URL(request.url).pathname });
        return HttpResponse.json({ data: { id: 31, matchStatus: 'MANUAL', version: 3 } });
      }),
    );

    await pekApi.getReportSources(9);
    await pekApi.getReportPlanFact(9);
    await pekApi.getReportReadiness(9);
    await pekApi.matchReportSource(9, 31, 77, 2);

    expect(requests).toEqual([
      { method: 'GET', pathname: '/api/pek/reports/9/sources' },
      { method: 'GET', pathname: '/api/pek/reports/9/plan-fact' },
      { method: 'GET', pathname: '/api/pek/reports/9/readiness' },
      { method: 'POST', pathname: '/api/pek/reports/9/sources/31/match' },
    ]);
  });

  it('updates the exact detail cache and invalidates every program list after workflow', async () => {
    let workflowRequest: { method: string; pathname: string } | undefined;
    server.use(http.post('*/api/pek/programs/:id/approve', ({ request }) => {
      workflowRequest = { method: request.method, pathname: new URL(request.url).pathname };
      return HttpResponse.json({ data: {
        ...programResponse,
        id: 9,
        company: { id: 1, name: 'Company' },
        status: 'APPROVED',
        version: 9,
      } });
    }));
    const queryClient = new QueryClient();
    const firstListKey = pekKeys.programList({ companyId: 1, status: 'DRAFT' });
    const secondListKey = pekKeys.programList({ companyId: 2, search: 'PEK' });
    queryClient.setQueryData(firstListKey, { content: [] });
    queryClient.setQueryData(secondListKey, { content: [] });

    const saved = await pekApi.approveProgram(9, 8);
    await commitPekProgramMutation(queryClient, 1, saved);

    expect(workflowRequest).toEqual({ method: 'POST', pathname: '/api/pek/programs/9/approve' });
    expect(queryClient.getQueryData(pekKeys.programDetail(1, 9))).toEqual(saved);
    expect(queryClient.getQueryState(firstListKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(secondListKey)?.isInvalidated).toBe(true);
  });

  it('loads real PEK settings and capabilities', async () => {
    let getCompanyId = '';
    let putCompanyId = '';
    server.use(
      http.get('*/api/pek/settings', ({ request }) => {
        getCompanyId = new URL(request.url).searchParams.get('companyId') || '';
        return HttpResponse.json({ data: { companyId: 17, defaultResponsibleUserId: null, defaultLaboratoryId: null, defaultReportType: 'QUARTERLY', autoCollectProtocols: false, includeOnlySignedProtocols: true, allowFallbackMatching: true, requireManualAmbiguousConfirmation: true, requireAllPlanFactItems: true, blockSubmitWithUnmatchedResults: true, blockSubmitWithAmbiguousResults: true, blockSubmitWithStaleSources: true, blockSubmitWithOpenExceedances: true, notifyBeforeDeadlineDays: 7, notifyMissingProtocols: true, notifyExceedances: true, notifyReportReturned: true, version: 0, availableActions: { view: true, edit: true }, capabilities: { automaticCollectionSupported: false } } });
      }),
      http.put('*/api/pek/settings', async ({ request }) => {
        putCompanyId = new URL(request.url).searchParams.get('companyId') || '';
        return HttpResponse.json({ data: { ...(await request.json() as object), companyId: 17, availableActions: { edit: true }, capabilities: {} } });
      }),
    );
    const settings = await pekApi.getSettings(17);
    await pekApi.updateSettings(17, 0, {
      defaultResponsibleUserId: null, defaultLaboratoryId: null, defaultReportType: 'QUARTERLY', autoCollectProtocols: false,
      includeOnlySignedProtocols: true, allowFallbackMatching: true, requireManualAmbiguousConfirmation: true,
      requireAllPlanFactItems: true, blockSubmitWithUnmatchedResults: true, blockSubmitWithAmbiguousResults: true,
      blockSubmitWithStaleSources: true, blockSubmitWithOpenExceedances: true, notifyBeforeDeadlineDays: 7,
      notifyMissingProtocols: true, notifyExceedances: true, notifyReportReturned: true,
    });
    expect(settings.defaultReportType).toBe('QUARTERLY');
    expect(settings.availableActions.edit).toBe(true);
    expect(settings.capabilities.automaticCollectionSupported).toBe(false);
    expect(getCompanyId).toBe('17');
    expect(putCompanyId).toBe('17');
  });

  it('uses the report document and exceedance backend endpoints', async () => {
    const calls: string[] = [];
    const exceedance = { id: 4, reportId: 9, version: 2, status: 'OPEN', evidenceFileIds: [], availableActions: { assignResponsible: true } };
    server.use(
      http.post('*/api/pek/reports/9/documents/official/generate/docx', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: { id: 1, reportId: 9, version: 1, documentKind: 'OFFICIAL', regulationVersion: '250', templateVersion: '1', hasDocx: true, hasPdf: false } }); }),
      http.post('*/api/pek/reports/9/documents/internal-analytical/generate/pdf', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: { id: 2, reportId: 9, version: 1, documentKind: 'INTERNAL_ANALYTICAL', regulationVersion: '250', templateVersion: 'crm-1', hasDocx: false, hasPdf: true } }); }),
      http.get('*/api/pek/reports/9/documents/official/versions', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: [] }); }),
      http.post('*/api/pek/reports/9/documents/official/sign', async ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname} ${JSON.stringify(await request.json())}`); return HttpResponse.json({ data: { id: 2, reportId: 9, verified: true } }); }),
      http.get('*/api/pek/reports/9/documents/official/signatures', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: [] }); }),
      http.get('*/api/pek/reports/9/exceedances', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: [exceedance] }); }),
      http.get('*/api/pek/exceedances/4', ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname}`); return HttpResponse.json({ data: exceedance }); }),
      http.post('*/api/pek/exceedances/4/assign', async ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname} ${JSON.stringify(await request.json())}`); return HttpResponse.json({ data: { ...exceedance, version: 3 } }); }),
      http.post('*/api/pek/exceedances/4/evidence', async ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname} ${JSON.stringify(await request.json())}`); return HttpResponse.json({ data: { ...exceedance, version: 3 } }); }),
      http.post('*/api/pek/exceedances/4/transition', async ({ request }) => { calls.push(`${request.method} ${new URL(request.url).pathname} ${JSON.stringify(await request.json())}`); return HttpResponse.json({ data: { ...exceedance, version: 3, status: 'CLOSED' } }); }),
    );
    await pekApi.generateReportDocument(9, 'OFFICIAL', 'docx', 2);
    await pekApi.generateReportDocument(9, 'INTERNAL_ANALYTICAL', 'pdf', 2);
    await pekApi.getReportDocumentVersions(9, 'OFFICIAL');
    await pekApi.signReportDocument(9, 2, 'cms');
    await pekApi.getReportSignatures(9);
    await pekApi.getReportExceedances(9);
    await pekApi.getExceedance(4);
    await pekApi.assignExceedance(4, { version: 2, responsibleUserId: 7, dueDate: '2026-09-01', correctiveAction: 'Фильтр' });
    await pekApi.attachExceedanceEvidence(4, 3, 'file-1');
    await pekApi.transitionExceedance(4, { version: 3, status: 'CLOSED', resolutionComment: 'Устранено' });
    expect(calls).toEqual(expect.arrayContaining([
      'POST /api/pek/reports/9/documents/official/generate/docx', 'POST /api/pek/reports/9/documents/internal-analytical/generate/pdf',
      'GET /api/pek/reports/9/documents/official/versions', 'POST /api/pek/reports/9/documents/official/sign {"cms":"cms"}',
      'GET /api/pek/reports/9/documents/official/signatures', 'GET /api/pek/reports/9/exceedances', 'GET /api/pek/exceedances/4',
      'POST /api/pek/exceedances/4/evidence {"fileId":"file-1"}',
      'POST /api/pek/exceedances/4/transition {"status":"CLOSED","resolutionComment":"Устранено"}',
    ]));
    const serviceSource = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(serviceSource).toContain("/${preview ? 'preview' : 'download'}/${format}");
    expect(serviceSource).toContain('format: PekReportDocumentFormat');
    expect(serviceSource).toContain("responseType: 'blob'");
  });

  it('refreshes PEK server state after document and exceedance mutations', () => {
    const documents = readFileSync(resolve(process.cwd(), 'src/features/pek/components/documents/PekReportDocuments.tsx'), 'utf8');
    const exceedances = readFileSync(resolve(process.cwd(), 'src/features/pek/components/exceedances/PekReportExceedances.tsx'), 'utf8');
    expect(documents).toContain('pekApi.generateReportDocument(report.id, config.kind, format, report.version)');
    expect(documents).toContain('pekApi.signReportDocument(report.id, report.version, cms)');
    expect(documents).toContain('const actual = await pekApi.getReport(report.id)');
    expect(documents).toContain('Скачать {format.toUpperCase()}');
    expect(documents).toContain('getReportDocumentVersions');
    expect(documents).toContain('getReportSignatures');
    expect(documents).toContain("format === 'docx' ? version.hasDocx");
    expect(documents).toContain("format === 'pdf' ? version.hasPdf");
    expect(exceedances).toContain('pekApi.getExceedance(id)');
    expect(exceedances).toContain('pekApi.getReportExceedances(report.id)');
    expect(exceedances).toContain('pekApi.transitionExceedance');
    expect(exceedances).toContain('selected?.allowedTransitions');
    expect(exceedances).not.toContain('closeExceedance');
    expect(exceedances).not.toContain('reopenExceedance');
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

  it('report creation explains an existing non-active program instead of claiming none exist', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportCreatePage.tsx'), 'utf8');
    expect(source).toContain("context.data.programs.length === 0");
    expect(source).toContain("pekApi.getPrograms({ companyId, objectId");
    expect(source).toContain('Программа найдена, но пока не подходит для отчёта');
    expect(source).toContain('Статус: {labelPekStatus(program.status)}');
    expect(source).toContain('to={`/staff/pek/programs/${program.id}?companyId=');
  });

  it('uses backend edit action for autosave', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(source).toContain('program.data.availableActions.edit === true');
    expect(source).not.toContain("['DRAFT', 'RETURNED'].includes(program.data.status)");
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

  it('uses the full permit CRUD API and server-authoritative actions', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    const page = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekPermitsPage.tsx'), 'utf8');
    const programForm = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekProgramCreatePage.tsx'), 'utf8');
    expect(service).toContain("get<PekPermit[]>('/pek/permits', { objectId }, signal)");
    expect(service).toContain("api.post('/pek/permits', body)");
    expect(service).toContain("api.patch(`/pek/permits/${id}`, payload, pekMutationOptions(version))");
    expect(service).toContain("api.post(`/pek/permits/${id}/status`");
    expect(service).toContain("api.delete(`/pek/permits/${id}`, pekMutationOptions(version))");
    expect(service).toContain("get<PekPermitHistoryEntry[]>(`/pek/permits/${id}/history`");
    expect(service).not.toContain('/pek/lookups/objects/${objectId}/permits');
    expect(page).toContain('permit.availableActions?.edit');
    expect(page).toContain('permit.availableActions?.markExpired');
    expect(page).toContain('permit.availableActions?.revoke');
    expect(programForm).toContain('permit.effectivelyActive');
  });

  it('does not expose PEK client-company membership management', () => {
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    const layout = readFileSync(resolve(process.cwd(), 'src/features/pek/routes/PekLayout.tsx'), 'utf8');
    expect(service).toContain("'/pek/lookups/assignees'");
    expect(service).not.toContain('/pek/companies/${companyId}/members');
    expect(layout).not.toContain('/staff/pek/access');
  });

  it('derives company choices from PEK scope and stops retrying forbidden requests', () => {
    const scope = readFileSync(resolve(process.cwd(), 'src/features/pek/hooks/usePekScope.ts'), 'utf8');
    const filters = readFileSync(resolve(process.cwd(), 'src/features/pek/components/common/PekCompanyObjectFilters.tsx'), 'utf8');
    const service = readFileSync(resolve(process.cwd(), 'src/features/pek/api/pekService.ts'), 'utf8');
    expect(scope).toContain('pekApi.getScopeCompanies');
    expect(scope).toContain('pekApi.getScopeCompanyObjects');
    expect(scope).not.toContain('getActiveCompanies');
    expect(scope).not.toContain('getCompanyObjects');
    expect(scope).not.toContain('pekApi.getPrograms');
    expect(scope).toContain('retry: retryPekQuery');
    expect(service).toContain("'/pek/scope/companies'");
    expect(service).toContain('`/pek/scope/companies/${companyId}/objects`');
    expect(filters).toContain('<Autocomplete');
    expect(filters).toContain('options={scope.companies}');
    expect(filters).not.toContain('type="number"');
    expect(filters).not.toContain('<datalist');
  });

  it('renders backend source DTO fields, report history and capability-gated automatic collection', () => {
    const workspace = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekReportWorkspacePage.tsx'), 'utf8');
    const settings = readFileSync(resolve(process.cwd(), 'src/features/pek/pages/PekSettingsPage.tsx'), 'utf8');
    for (const field of ['protocolDate', 'protocolStatus', 'indicatorCode', 'valueText', 'normativeValue', 'comparisonType', 'isExceedance', 'samplingPlace', 'measurementDate', 'methodology', 'laboratoryName', 'controlItemName', 'programIndicatorName']) {
      expect(workspace).toContain(`source.${field}`);
    }
    expect(workspace).toContain('pekApi.getReportHistory');
    expect(settings).toContain('form.autoCollectProtocols');
    expect(settings).toContain('form.autoCollectProtocols');
  });

  it('uploads exceedance evidence before attaching it and has no manual fileId field', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/pek/components/exceedances/PekReportExceedances.tsx'), 'utf8');
    const flow = readFileSync(resolve(process.cwd(), 'src/features/pek/components/exceedances/evidenceFlow.ts'), 'utf8');
    expect(source).toContain('uploadAndAttachExceedanceEvidence');
    expect(flow.indexOf('dependencies.upload')).toBeLessThan(flow.indexOf('dependencies.attach'));
    expect(flow).toContain('uploaded.fileId');
    expect(source).not.toContain('ID файла подтверждения');
    expect(source).toContain('selectedActions.addEvidence === true');
  });
});
