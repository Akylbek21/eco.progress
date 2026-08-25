import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { mapWizardResultToDraftRequest, mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
import { normalizeProtocolStatus } from '../src/config/protocolStatus';
import { hasProtocolAction, normalizeProtocolAvailableActions } from '../src/features/protocols/utils/protocolActions';
import { calculateResult, createCorrection, getProtocol, importExcel, normalizeProtocol, readyForApproval, removeProtocolMeasurementDevice, returnForRevision, returnToDraft, saveProtocolDraftResults, saveRawMeasurements, signProtocol } from '../src/services/apiProtocolService';
import { normalizeApiError } from '../src/services/apiHelpers';
import { isProtocolVersionConflict } from '../src/features/protocols/utils/protocolVersionConflict';
import { protocolAccessErrorMessage } from '../src/utils/protocolError';
import ProtocolList from '../src/components/protocols/ProtocolList';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;
const protocol = {
  id: '42',
  protocolNumber: 'P-42',
  templateId: 'water',
  status: 'DRAFT',
  version: 8,
  testing: {},
  results: [],
  availableActions: { view: true, edit: true, sendToApproval: true },
};

beforeAll(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  api.defaults.baseURL = 'http://localhost/api';
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  server.close();
  api.defaults.baseURL = originalBaseUrl;
  vi.unstubAllGlobals();
});

describe('current protocol backend contract', () => {
  it('normalizes only canonical backend availableActions', () => {
    const mapped = normalizeProtocolAvailableActions({
      view: true,
      edit: false,
      sendToApproval: true,
      generateDocuments: true,
      canDownload: true,
    });
    expect(mapped.sendToApproval).toBe(true);
    expect(mapped.edit).toBe(false);
    expect(mapped.generateDocx).toBe(false);
    expect(mapped.generatePdf).toBe(false);
    expect(mapped).not.toHaveProperty('generateDocuments');
    expect(mapped).not.toHaveProperty('canDownload');
  });

  it('uses canSendToApproval as the backend authority for protocol submission', () => {
    expect(hasProtocolAction({ availableActions: { sendToApproval: true } } as never, 'sendToApproval')).toBe(true);
    expect(hasProtocolAction({ availableActions: { sendToApproval: false } } as never, 'sendToApproval')).toBe(false);
  });

  it('keeps unknown status read-only', () => {
    expect(normalizeProtocolStatus('FUTURE_STATUS')).toBe('UNKNOWN');
    expect(hasProtocolAction({ status: 'UNKNOWN', availableActions: {} } as never, 'edit')).toBe(false);
  });

  it('uses availableActions only when the backend DTO contains them', () => {
    expect(normalizeProtocol({ ...protocol, availableActions: { sign: true, approve: false } }).availableActions).toMatchObject({ sign: true, approve: false, edit: false });
    expect(Object.values(normalizeProtocol({ ...protocol, availableActions: ['SIGN'] }).availableActions).some(Boolean)).toBe(false);
    expect(normalizeProtocol(protocol).availableActions).toMatchObject({ view: true, edit: true, sendToApproval: true });
  });

  it('maps document-version fields without deciding PDF freshness on the client', () => {
    expect(normalizeProtocol({
      ...protocol,
      contentVersion: 14,
      pdfSourceContentVersion: 13,
      pdfHash: 'pdf-hash',
      approvedPdfHash: 'approved-hash',
      approvedContentVersion: 12,
    })).toMatchObject({
      contentVersion: 14,
      pdfSourceContentVersion: 13,
      pdfHash: 'pdf-hash',
      approvedPdfHash: 'approved-hash',
      approvedContentVersion: 12,
    });
  });

  it('preserves zero values in the V2 draft and result requests', () => {
    const form = createWizardDefaults();
    Object.assign(form, {
      templateId: 'water',
      companyId: '1',
      objectId: '2',
      laboratoryId: '3',
      executorId: '4',
      measurementPlace: 'Точка',
      sourceNumber: 'W-1',
      temperature: '0',
      humidity: '0',
      pressure: '100',
      windSpeed: '0',
      waterType: 'DRINKING_WATER',
      waterUseCategory: 'I',
    });
    form.results = [{ ...emptyWizardResult(), indicatorName: 'pH', pollutantCode: 'PH', value: '0', unit: 'ед.', measurementDeviceId: '5', samplingPlace: 'Точка' }];
    const draft = mapWizardToCreateDraft(form);
    const result = mapWizardResultToDraftRequest(form.results[0], form, 0);
    expect(draft.executorId).toBe(4);
    expect(draft).not.toHaveProperty('laboratoryEmployeeId');
    expect(draft.environment).toMatchObject({ temperatureC: 0, humidityPercent: 0, windSpeedMs: 0 });
    expect(result.values.resultValue).toBe(0);
    expect(result).not.toHaveProperty('clientRowId');
  });

  it('sends workflow version in JSON body without If-Match', async () => {
    let body: unknown;
    let ifMatch: string | null = null;
    server.use(
      http.post('http://localhost/api/protocols/42/ready-for-approval', async ({ request }) => {
        body = await request.json();
        ifMatch = request.headers.get('If-Match');
        return HttpResponse.json({ data: { ...protocol, status: 'READY_FOR_APPROVAL', version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, status: 'READY_FOR_APPROVAL', version: 9 } })),
    );
    await readyForApproval('42', { version: 8 });
    expect(body).toEqual({ version: 8 });
    expect(ifMatch).toBeNull();
  });

  it('allows the ready-for-approval workflow more time than the global API timeout', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue({ data: { data: { ...protocol, status: 'READY_FOR_APPROVAL', version: 9 } } });
    const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: { ...protocol, status: 'READY_FOR_APPROVAL', version: 9 } } });

    await readyForApproval('42', { version: 8 });

    expect(post).toHaveBeenCalledWith('/protocols/42/ready-for-approval', { version: 8 }, { timeout: 60_000 });
    post.mockRestore();
    get.mockRestore();
  });

  it('sends detach version as a query parameter and not a DELETE body', async () => {
    let version = '';
    let body = '';
    server.use(
      http.delete('http://localhost/api/protocols/42/measurement-devices/7', async ({ request }) => {
        version = new URL(request.url).searchParams.get('version') || '';
        body = await request.text();
        return HttpResponse.json({ data: { ...protocol, version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, version: 9 } })),
    );
    await removeProtocolMeasurementDevice('42', '7', 8);
    expect(version).toBe('8');
    expect(body).toBe('');
  });

  it('uses the authoritative mutation response for revision without fetching a fresh version', async () => {
    let body: unknown;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/return-for-revision', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, status: 'NEEDS_REVISION', version: 9, availableActions: { edit: true, sendToApproval: true } } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: { ...protocol, status: 'NEEDS_REVISION', version: 9, availableActions: { edit: true, sendToApproval: true } } });
      }),
    );
    const revised = await returnForRevision('42', { version: 8, reason: 'Исправить результаты' });
    expect(body).toEqual({ version: 8, reason: 'Исправить результаты' });
    expect(getCount).toBe(0);
    expect(revised).toMatchObject({ status: 'NEEDS_REVISION', version: 9, availableActions: { edit: true, sendToApproval: true } });
  });

  it('returns an approved protocol to draft with the edited version and reason', async () => {
    let body: unknown;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/return-to-draft', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, status: 'DRAFT', version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: { ...protocol, status: 'DRAFT', version: 10 } });
      }),
    );
    const revised = await returnToDraft('42', { version: 8, reason: '  Исправить документ  ' });
    expect(body).toEqual({ version: 8, reason: 'Исправить документ' });
    expect(revised).toMatchObject({ status: 'DRAFT', version: 9 });
    expect(getCount).toBe(0);
    await expect(returnToDraft('42', { version: 9, reason: '   ' })).rejects.toThrow('Причина');
  });

  it('uses the backend correction id and does not fetch or clone the original on the client', async () => {
    let body: unknown;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/corrections', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, id: '99', status: 'DRAFT', version: 1, replacesProtocolId: '42' } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: protocol });
      }),
    );

    const correction = await createCorrection('42', { version: 8, reason: '  Исправить измерения  ' });

    expect(body).toEqual({ version: 8, reason: 'Исправить измерения' });
    expect(correction).toMatchObject({ id: '99', status: 'DRAFT', replacesProtocolId: '42' });
    expect(getCount).toBe(0);
  });

  it('imports xls/xlsx with file and version and uses returned protocol results', async () => {
    let form: FormData | null = null;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/import-excel', async ({ request }) => {
        form = await request.formData();
        return HttpResponse.json({ data: { ...protocol, version: 9, results: [{ id: 'excel-1', values: { resultValue: 1 } }] } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: { ...protocol, version: 9, results: [{ id: 'excel-1', values: { resultValue: 1 } }] } });
      }),
    );
    const imported = await importExcel('42', new File(['sheet'], 'results.xls', { type: 'application/vnd.ms-excel' }), 8);
    expect(form?.get('version')).toBe('8');
    expect((form?.get('file') as File).name).toBe('results.xls');
    expect(getCount).toBe(0);
    expect(imported).toMatchObject({ version: 9, results: [{ id: 'excel-1' }] });
    await expect(importExcel('42', new File(['bad'], 'results.csv'), 9)).rejects.toThrow('.xls');
  });

  it('uses the single backend sign contract', async () => {
    let body: unknown;
    server.use(
      http.post('http://localhost/api/protocols/42/sign', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, status: 'SIGNED', version: 10 } });
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, status: 'SIGNED', version: 10 } })),
    );
    const signed = await signProtocol('42', { cmsSignatureBase64: 'cms', version: 8 });
    expect(signed.status).toBe('SIGNED');
    expect(body).toEqual({ cmsSignatureBase64: 'cms', version: 8 });
  });

  it('adds draft results with the backend delta contract and preserves zero', async () => {
    let body: unknown;
    let idempotencyKey = '';
    let savedResults: Array<Record<string, unknown>> = [];
    server.use(
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, version: savedResults.length ? 9 : 8, results: savedResults } })),
      http.patch('http://localhost/api/protocols/42/draft-results', async ({ request }) => {
        idempotencyKey = request.headers.get('Idempotency-Key') || '';
        body = await request.json();
        const requestBody = body as { added: Array<Record<string, unknown>> };
        savedResults = requestBody.added.map((row) => ({
          ...row,
          id: '5',
          values: { ...(row.values as Record<string, unknown>), clientRowId: row.clientRowId },
        }));
        return HttpResponse.json({ data: { ...protocol, version: 9, results: savedResults } });
      }),
    );
    const clientRowId = globalThis.crypto.randomUUID();
    const saved = await saveProtocolDraftResults('42', {
      version: 8,
      added: [{ clientRowId, values: { resultValue: 0 }, measurementDeviceId: 7, normativeId: null }],
      updated: [],
      deletedIds: [],
    });
    expect(saved.results[0].values.resultValue).toBe(0);
    expect(idempotencyKey).toMatch(/^[\w-]+$/);
    expect(body).toMatchObject({
      version: 8,
      added: [{ clientRowId, values: { resultValue: 0 }, measurementDeviceId: 7, normativeId: null }],
      updated: [],
      deletedIds: [],
    });
  });

  it('strips legacy results from the runtime draft-results payload', async () => {
    let body: unknown;
    server.use(
      http.patch('http://localhost/api/protocols/42/draft-results', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, version: 9, results: [] } });
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, version: 9, results: [] } })),
    );
    await saveProtocolDraftResults('42', {
      version: 8, added: [], updated: [], deletedIds: [],
      ...({ results: [{ id: 'legacy' }] } as object),
    });
    expect(body).toEqual({ version: 8, added: [], updated: [], deletedIds: [] });
  });

  it('keeps backend 409 details from atomic result saving', async () => {
    server.use(
      http.patch('http://localhost/api/protocols/42/draft-results', () => HttpResponse.json({
        code: 'OPTIMISTIC_LOCK_CONFLICT', message: 'Протокол уже изменён', currentVersion: 9,
      }, { status: 409 })),
    );
    const error = await saveProtocolDraftResults('42', {
      version: 8, added: [], updated: [], deletedIds: [],
    }).catch((value: unknown) => value);
    expect(normalizeApiError(error)).toMatchObject({ status: 409, code: 'OPTIMISTIC_LOCK_CONFLICT', currentVersion: 9 });
  });

  it('uses raw measurements response.version for the following calculation without a GET', async () => {
    let calculationBody: unknown;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/results/7/raw-measurements', () => HttpResponse.json({
        data: { version: 9, row: { id: '7', protocolId: '42', values: { result: 1 } } },
      })),
      http.post('http://localhost/api/protocols/42/results/7/calculate', async ({ request }) => {
        calculationBody = await request.json();
        return HttpResponse.json({ data: { version: 10, row: { id: '7', protocolId: '42', values: { result: 2 } } } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: protocol });
      }),
    );

    const saved = await saveRawMeasurements('42', '7', [{ variableKey: 'x', variableValue: 1 }], 'method-1', 8);
    const calculated = await calculateResult('42', '7', saved.version);

    expect(saved.version).toBe(9);
    expect(calculationBody).toEqual({ version: 9 });
    expect(calculated.version).toBe(10);
    expect(getCount).toBe(0);
  });

  it('rejects legacy protocolVersion and preserves a raw measurements VERSION_CONFLICT', async () => {
    server.use(http.post('http://localhost/api/protocols/42/results/7/raw-measurements', () => HttpResponse.json({
      data: { protocolVersion: 9, row: { id: '7', values: {} } },
    })));
    await expect(saveRawMeasurements('42', '7', [], 'method-1', 8)).rejects.toThrow('response.version');

    server.resetHandlers();
    server.use(http.post('http://localhost/api/protocols/42/results/7/raw-measurements', () => HttpResponse.json({
      code: 'VERSION_CONFLICT', message: 'Protocol was changed', currentVersion: 9,
    }, { status: 409 })));
    const error = await saveRawMeasurements('42', '7', [], 'method-1', 8).catch((value: unknown) => value);
    expect(isProtocolVersionConflict(error)).toBe(true);
    expect(normalizeApiError(error)).toMatchObject({ status: 409, code: 'VERSION_CONFLICT', currentVersion: 9 });
  });

  it('maps a foreign protocol 403 to the protocol access message', async () => {
    server.use(http.get('http://localhost/api/protocols/foreign', () => HttpResponse.json({ code: 'FORBIDDEN' }, { status: 403 })));
    const error = await getProtocol('foreign').catch((value: unknown) => value);
    expect(protocolAccessErrorMessage(error)).toBe('Нет доступа к протоколу');
  });

  it('hides detail, history and downloads when backend actions are absent', () => {
    const item = normalizeProtocol({
      ...protocol,
      availableActions: { view: false, viewAudit: false, downloadPdf: false, downloadDocx: false },
    });
    const noop = vi.fn();
    const markup = renderToStaticMarkup(createElement(ProtocolList, {
      protocols: [item], onOpen: noop, onHistory: noop, onSign: noop, onEdit: noop,
      onDelete: noop, onArchive: noop, onReplace: noop, onDownload: noop,
    }));
    expect(markup).not.toContain('Открыть');
    expect(markup).not.toContain('История');
    expect(markup).not.toContain('Скачать PDF');
    expect(markup).not.toContain('Скачать DOCX');
    expect(markup).not.toContain('role="link"');
  });
});
