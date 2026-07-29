import { delay, http, HttpResponse } from 'msw';
import type { PekCollectionRun, PekProgram, PekReport } from '../../api/pekContracts';
import {
  pekProgramFixtures,
  pekReportFixtures,
  programActive,
  programDraft,
  reportDraft,
  reportSigned,
} from '../fixtures';
import type { PekMockScenario } from '../scenarios';

let programs = structuredClone(pekProgramFixtures);
let reports = structuredClone(pekReportFixtures);
let collectionPoll = 0;

const data = <T>(value: T, init?: ResponseInit) => HttpResponse.json({ data: value }, init);
const error = (status: number, code: string, message: string) =>
  HttpResponse.json({ status, code, message, correlationId: `pek-msw-${status}` }, { status });
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const scenario = (request: Request): PekMockScenario =>
  (request.headers.get('x-pek-mock-scenario') || import.meta.env.VITE_PEK_MSW_SCENARIO || 'default') as PekMockScenario;
const maybeGlobalError = (request: Request) => {
  const current = scenario(request);
  if (current === 'forbidden') return error(403, 'PEK_FORBIDDEN', 'Недостаточно прав');
  if (current === 'server-error') return error(500, 'PEK_INTERNAL_ERROR', 'Сервис ПЭК временно недоступен');
  return null;
};
const page = <T>(content: T[], request: Request) => {
  const url = new URL(request.url);
  const pageNumber = Number(url.searchParams.get('page') || 0);
  const size = Number(url.searchParams.get('size') || 20);
  const start = pageNumber * size;
  return {
    content: content.slice(start, start + size),
    page: pageNumber,
    size,
    totalElements: content.length,
    totalPages: Math.ceil(content.length / size),
  };
};
const findProgram = (id: string) => programs.find((item) => item.id === Number(id));
const findReport = (id: string) => reports.find((item) => item.id === Number(id));
const requireVersion = (request: Request) =>
  request.headers.has('If-Match') ? null : error(409, 'VERSION_CONFLICT', 'Данные были изменены другим пользователем');

export const resetPekMockState = () => {
  programs = structuredClone(pekProgramFixtures);
  reports = structuredClone(pekReportFixtures);
  collectionPoll = 0;
};

export const pekHandlers = [
  http.get('*/api/pek/dashboard', async ({ request }) => {
    await delay(80);
    const failure = maybeGlobalError(request);
    if (failure) return failure;
    return data({
      totalReportCount: reports.length,
      readinessPercent: 74,
      criticalIssueCount: 2,
      overdueRiskCount: 1,
      programExecutionPercent: 81,
      openExceedanceCount: 1,
      overdueActionCount: 1,
      missingProtocolCount: 2,
      deadlines: [{ reportId: reportDraft.id, reportNumber: reportDraft.number, dueDate: '2026-08-15', label: 'Квартальный отчёт' }],
      reports: [{ reportId: reportDraft.id, reportNumber: reportDraft.number, nextAction: 'Проверить готовность', responsible: 'Айгуль Сарсенова' }],
    });
  }),

  http.get('*/api/pek/programs', async ({ request }) => {
    await delay(100);
    const failure = maybeGlobalError(request);
    if (failure) return failure;
    if (scenario(request) === 'empty') return data(page([], request));
    const url = new URL(request.url);
    const search = (url.searchParams.get('search') || '').toLocaleLowerCase('ru');
    const status = url.searchParams.get('status');
    const filtered = programs.filter((item) =>
      (!search || `${item.number} ${item.name}`.toLocaleLowerCase('ru').includes(search))
      && (!status || item.status === status));
    return data(page(filtered, request));
  }),
  http.get('*/api/pek/programs/:id', ({ params, request }) => {
    const failure = maybeGlobalError(request);
    if (failure) return failure;
    if (scenario(request) === 'not-found') return error(404, 'PEK_PROGRAM_NOT_FOUND', 'Программа не найдена');
    const item = findProgram(String(params.id));
    return item ? data(item) : error(404, 'PEK_PROGRAM_NOT_FOUND', 'Программа не найдена');
  }),
  http.post('*/api/pek/programs', async ({ request }) => {
    const body = record(await request.json());
    const created: PekProgram = {
      ...programDraft,
      id: 1101,
      number: String(body.number || 'ПЭК-2026-NEW'),
      name: String(body.name || 'Новая программа ПЭК'),
      version: 1,
      availableActions: [{ code: 'EDIT', label: 'Редактировать', enabled: true }],
    };
    programs = [created, ...programs.filter((item) => item.id !== created.id)];
    return data(created, { status: 201 });
  }),
  http.patch('*/api/pek/programs/:id', async ({ params, request }) => {
    if (scenario(request) === 'version-conflict') return error(409, 'VERSION_CONFLICT', 'Данные были изменены другим пользователем');
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    const current = findProgram(String(params.id));
    if (!current) return error(404, 'PEK_PROGRAM_NOT_FOUND', 'Программа не найдена');
    const body = record(await request.json());
    const updated = { ...current, ...body, id: current.id, version: current.version + 1 } as PekProgram;
    programs = programs.map((item) => item.id === updated.id ? updated : item);
    return data(updated);
  }),
  http.patch('*/api/pek/programs/:id/draft', async ({ params, request }) => {
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    const current = findProgram(String(params.id));
    if (!current) return error(404, 'PEK_PROGRAM_NOT_FOUND', 'Программа не найдена');
    return data({ ...current, version: current.version + 1 });
  }),
  http.post('*/api/pek/programs/:id/:action', ({ params, request }) => {
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    const current = findProgram(String(params.id));
    if (!current) return error(404, 'PEK_PROGRAM_NOT_FOUND', 'Программа не найдена');
    const action = String(params.action);
    const nextStatus = action === 'activate' ? 'ACTIVE' : action === 'archive' ? 'ARCHIVED' : current.status;
    const updated: PekProgram = { ...current, status: nextStatus, version: current.version + 1, readOnly: ['ACTIVE', 'ARCHIVED'].includes(nextStatus) };
    programs = programs.map((item) => item.id === updated.id ? updated : item);
    return data(updated);
  }),
  http.get('*/api/pek/programs/:id/history', () => data([
    { id: 1, occurredAt: '2026-07-29T09:20:00+05:00', user: 'Айгуль Сарсенова', action: 'PROGRAM_CREATED', newStatus: 'DRAFT', comment: 'Создана программа' },
  ])),

  http.get('*/api/pek/reports', async ({ request }) => {
    await delay(100);
    const failure = maybeGlobalError(request);
    if (failure) return failure;
    if (scenario(request) === 'empty') return data(page([], request));
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    return data(page(reports.filter((item) => !status || item.status === status), request));
  }),
  http.get('*/api/pek/reports/creation-context', ({ request }) => {
    const current = scenario(request);
    return data({
      company: programActive.company,
      object: programActive.object,
      periodStart: '2026-04-01',
      periodEnd: '2026-06-30',
      programs: current === 'empty' ? [] : [programActive],
      selectedProgramId: current === 'empty' ? null : programActive.id,
      duplicateReportId: current === 'duplicate-report' ? reportDraft.id : null,
      warnings: [],
      blockingReasons: current === 'empty' ? ['Нет действующей программы для выбранного периода'] : [],
    });
  }),
  http.post('*/api/pek/reports', async ({ request }) => {
    if (scenario(request) === 'duplicate-report') {
      return HttpResponse.json({ code: 'PEK_REPORT_ALREADY_EXISTS', message: 'Отчёт уже существует', resourceId: reportDraft.id }, { status: 409 });
    }
    const body = record(await request.json());
    const created: PekReport = { ...reportDraft, id: 2101, number: 'ПЭК-ОТЧ-2101', year: Number(body.year || 2026), version: 1 };
    reports = [created, ...reports.filter((item) => item.id !== created.id)];
    return data(created, { status: 201 });
  }),
  http.get('*/api/pek/reports/:id', ({ params, request }) => {
    const failure = maybeGlobalError(request);
    if (failure) return failure;
    if (scenario(request) === 'not-found') return error(404, 'PEK_REPORT_NOT_FOUND', 'Отчёт не найден');
    const item = findReport(String(params.id));
    return item ? data(item) : error(404, 'PEK_REPORT_NOT_FOUND', 'Отчёт не найден');
  }),
  http.post('*/api/pek/reports/:id/collect', ({ request }) => {
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    collectionPoll = 0;
    return data<PekCollectionRun>({ id: 9001, status: 'RUNNING', progressPercent: 5, processedRows: 0, foundIssues: 0, startedAt: '2026-07-29T10:00:00+05:00' }, { status: 202 });
  }),
  http.get('*/api/pek/reports/:id/collection-runs/latest', ({ request }) => {
    const current = scenario(request);
    collectionPoll += 1;
    if (current === 'collection-failed') {
      return data<PekCollectionRun>({ id: 9002, status: 'FAILED', progressPercent: 35, processedRows: 4, foundIssues: 1, errors: ['Источник протоколов недоступен'] });
    }
    const progress = Math.min(100, 10 + collectionPoll * 30);
    const terminal = progress >= 100;
    return data<PekCollectionRun>({
      id: 9001,
      status: terminal ? (current === 'collection-warning' ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED') : 'RUNNING',
      progressPercent: progress,
      processedRows: terminal ? 12 : collectionPoll * 3,
      processedProtocols: terminal ? 12 : collectionPoll * 3,
      addedResults: terminal ? 18 : collectionPoll * 4,
      skippedResults: terminal ? 2 : 0,
      foundIssues: current === 'collection-warning' ? 1 : 0,
      warnings: current === 'collection-warning' ? ['Два результата требуют ручной привязки'] : [],
      startedAt: '2026-07-29T10:00:00+05:00',
      finishedAt: terminal ? '2026-07-29T10:00:08+05:00' : null,
    });
  }),
  http.get('*/api/pek/reports/:id/issues', ({ request }) => data(scenario(request) === 'validation-failed' ? [
    { id: 7001, code: 'PEK_REQUIRED_RESULT_MISSING', severity: 'ERROR', blocking: true, sectionCode: 'EMISSIONS', sectionLabel: 'Атмосферный воздух', entityId: 4001, rowKey: '4001', fieldPath: 'result', message: 'Отсутствует результат по диоксиду азота', resolved: false },
  ] : [])),
  http.get('*/api/pek/reports/:id/plan-fact', () => data([
    { id: 'pf-1', controlItem: 'Контроль выбросов котельной', source: 'Источник ИЗА-001', frequency: 'Ежеквартально', plannedEvents: 1, actualEvents: 1, eventCompletionPercent: 100, plannedIndicators: 2, foundIndicators: 2, indicatorCompletenessPercent: 100, status: 'COMPLETED', protocolIds: [31001], issueCount: 0 },
  ])),
  http.get('*/api/pek/reports/:id/sections/:code', ({ params }) => data({
    code: params.code,
    rows: [
      { id: 1, name: 'Диоксид азота', amount: 0, unit: 'мг/м³', statusLabel: 'Соответствует', date: '2026-06-18' },
      { id: 2, name: 'Оксид углерода', amount: -0.2, unit: 'мг/м³', statusLabel: 'Соответствует', date: '2026-06-18' },
    ],
  })),
  http.get('*/api/pek/reports/:id/unmatched-sources', () => data([])),
  http.get('*/api/pek/reports/:id/exceedances', () => data([
    { id: 8001, indicator: 'Диоксид азота', result: '0.24', unit: 'мг/м³', normative: '0.20', multiplicity: 1.2, status: 'ACTION_REQUIRED', possibleCause: 'Нестабильный режим горения' },
  ])),
  http.get('*/api/pek/reports/:id/review-comments', () => data([])),
  http.get('*/api/pek/reports/:id/history', () => data([
    { id: 1, occurredAt: '2026-07-29T10:00:00+05:00', user: 'Айгуль Сарсенова', action: 'REPORT_CREATED', newStatus: 'DRAFT', comment: 'Создан отчёт' },
  ])),
  http.post('*/api/pek/reports/:id/:action', ({ params, request }) => {
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    const current = findReport(String(params.id));
    if (!current) return error(404, 'PEK_REPORT_NOT_FOUND', 'Отчёт не найден');
    const statuses: Record<string, PekReport['status']> = {
      validate: scenario(request) === 'validation-failed' ? 'REQUIRES_CORRECTION' : 'READY_FOR_REVIEW',
      'submit-review': 'UNDER_REVIEW', 'start-review': 'UNDER_REVIEW',
      return: 'RETURNED', 'accept-review': 'READY_FOR_APPROVAL', approve: 'APPROVED',
      archive: 'ARCHIVED', revision: 'DRAFT',
    };
    const status = statuses[String(params.action)] || current.status;
    const updated = { ...current, status, version: current.version + 1, readOnly: ['APPROVED', 'SIGNED', 'ARCHIVED'].includes(status) };
    reports = reports.map((item) => item.id === updated.id ? updated : item);
    return data(updated);
  }),
  http.post('*/api/pek/reports/:id/sign', ({ params, request }) => {
    const versionFailure = requireVersion(request);
    if (versionFailure) return versionFailure;
    const current = findReport(String(params.id)) || reportSigned;
    return data({ ...current, status: scenario(request) === 'partial-signature' ? 'PARTIALLY_SIGNED' : 'SIGNED', readOnly: true });
  }),
  http.post('*/api/pek/reports/:id/submission', ({ params, request }) => {
    const current = findReport(String(params.id)) || reportSigned;
    return data({ ...current, status: scenario(request) === 'submission-rejected' ? 'REJECTED' : 'SUBMITTED', readOnly: true });
  }),
  http.get('*/api/pek/reports/:id/exports/:file', ({ params }) =>
    new HttpResponse(new Blob([`PEK mock document ${String(params.file)}`], { type: 'application/pdf' }), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${String(params.file)}"` },
    })),

  http.get('*/api/pek/lookups/assignees', () => data([
    { id: 301, name: 'Айгуль Сарсенова', role: 'ECOLOGIST' },
    { id: 302, name: 'Марат Ибраев', role: 'REVIEWER' },
  ])),
  http.get('*/api/pek/lookups/objects/:id/permits', () => data([{ id: 601, name: 'Экологическое разрешение №KZ-2026-14', validUntil: '2028-12-31' }])),
  http.get('*/api/pek/settings', () => data({ collectionPollingIntervalMs: 1500, autosaveDebounceMs: 1200, defaultReportPeriodType: 'QUARTER', version: 1 })),
  http.patch('*/api/pek/settings', async ({ request }) => data({ ...record(await request.json()), version: 2 })),
];
