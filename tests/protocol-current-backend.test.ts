import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { mapProtocolPermissions } from '../src/features/protocols/mappers/protocolPermissionMapper';
import { mapFormToCreateProtocolRequest } from '../src/features/protocols/mappers/mapFormToCreateProtocolRequest';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { buildQuickCreatePayload } from '../src/features/protocols/mappers/mapProtocolWizardToRequest';
import { normalizeProtocolStatus } from '../src/config/protocolStatus';
import { getProtocolPermissions } from '../src/utils/protocolPermissions';
import { addProtocolResult, importExcel, normalizeProtocol, readyForApproval, removeProtocolMeasurementDevice, returnForRevision, returnToDraft, saveProtocolDraftResults, signProtocol } from '../src/services/apiProtocolService';
import { normalizeApiError } from '../src/services/apiHelpers';

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
  permissions: { canView: true, canEdit: true, canSendToApproval: true },
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
  it('maps only the exact real backend permission fields', () => {
    const mapped = mapProtocolPermissions({
      canView: true,
      canEdit: false,
      canSendToApproval: true,
      canCreateCorrection: false,
      canDownload: true,
    });
    expect(mapped.canSendToApproval).toBe(true);
    expect(mapped.canCreateCorrection).toBe(false);
    expect(mapped.canEdit).toBe(false);
    expect(mapped).not.toHaveProperty('canReadyForApproval');
    expect(mapped).not.toHaveProperty('canReplace');
    expect(mapped).not.toHaveProperty('canDownload');
  });

  it('uses canSendToApproval as the backend authority for protocol submission', () => {
    expect(getProtocolPermissions({
      status: 'CALCULATED',
      permissions: { canSendToApproval: true },
      availableActions: { sendToApproval: true },
    }, 'LABORATORY').canReadyForApproval).toBe(true);
    expect(getProtocolPermissions({
      status: 'CALCULATED',
      permissions: { canSendToApproval: false },
      availableActions: { sendToApproval: false },
    }, 'LABORATORY').canReadyForApproval).toBe(false);
  });

  it('keeps unknown status read-only', () => {
    expect(normalizeProtocolStatus('FUTURE_STATUS')).toBe('UNKNOWN');
    expect(getProtocolPermissions({
      status: 'UNKNOWN',
      permissions: { canView: true, canEdit: true, canSendToApproval: true },
    }, 'ADMIN')).toMatchObject({ canView: true, canEdit: false, canReadyForApproval: false });
  });

  it('uses availableActions only when the backend DTO contains them', () => {
    expect(normalizeProtocol({ ...protocol, availableActions: { sign: true, approve: false } }).availableActions).toEqual({ sign: true, approve: false });
    expect(normalizeProtocol({ ...protocol, availableActions: ['SIGN'] }).availableActions).toEqual({});
    expect(normalizeProtocol(protocol).availableActions).toEqual({});
  });

  it('preserves zero as a string in quick-create conditions and never sends clientRowId', () => {
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
    const request = buildQuickCreatePayload(form);
    expect(request.executorId).toBe(4);
    expect(request).not.toHaveProperty('laboratoryEmployeeId');
    expect(request.conditions).toMatchObject({ temperature: '0', humidity: '0', windSpeed: '0' });
    expect(request.measurements[0].value).toBe(0);
    expect(request.measurements[0]).not.toHaveProperty('clientRowId');
  });

  it('keeps full-create environment separate from quick-create conditions', () => {
    const request = mapFormToCreateProtocolRequest({
      companyId: 1,
      objectId: 2,
      templateId: 'water',
      protocolDate: '2026-07-31',
      environment: { temperature: '0', pressureHpa: '1013', source: 'MANUAL' },
    });
    expect(request.environment).toMatchObject({ temperatureC: 0, pressureHpa: 1013, source: 'MANUAL' });
    expect(request).not.toHaveProperty('conditions');
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

  it('returns a protocol for revision with a reason and reloads the authoritative version', async () => {
    let body: unknown;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/return-for-revision', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, status: 'NEEDS_REVISION', version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: { ...protocol, status: 'NEEDS_REVISION', version: 9, availableActions: { edit: true, sendToApproval: true } } });
      }),
    );
    const revised = await returnForRevision('42', { version: 8, reason: 'Исправить результаты' });
    expect(body).toEqual({ version: 8, reason: 'Исправить результаты' });
    expect(getCount).toBe(1);
    expect(revised).toMatchObject({ status: 'NEEDS_REVISION', version: 9, availableActions: { edit: true, sendToApproval: true } });
  });

  it('returns an approved protocol to draft with the edited version and reason', async () => {
    let body: unknown;
    server.use(
      http.post('http://localhost/api/protocols/42/return-to-draft', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...protocol, status: 'DRAFT', version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: { ...protocol, status: 'DRAFT', version: 9 } })),
    );
    const revised = await returnToDraft('42', { version: 8, reason: 'Исправить документ' });
    expect(body).toEqual({ version: 8, reason: 'Исправить документ' });
    expect(revised).toMatchObject({ status: 'DRAFT', version: 9 });
  });

  it('imports xls/xlsx with file and version and reloads protocol results', async () => {
    let form: FormData | null = null;
    let getCount = 0;
    server.use(
      http.post('http://localhost/api/protocols/42/import-excel', async ({ request }) => {
        form = await request.formData();
        return HttpResponse.json({ data: { ...protocol, version: 9 } });
      }),
      http.get('http://localhost/api/protocols/42', () => {
        getCount += 1;
        return HttpResponse.json({ data: { ...protocol, version: 9, results: [{ id: 'excel-1', values: { resultValue: 1 } }] } });
      }),
    );
    const imported = await importExcel('42', new File(['sheet'], 'results.xls', { type: 'application/vnd.ms-excel' }), 8);
    expect(form?.get('version')).toBe('8');
    expect((form?.get('file') as File).name).toBe('results.xls');
    expect(getCount).toBe(1);
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
    const saved = await addProtocolResult('42', { values: { resultValue: 0 }, measurementDeviceId: 7 }, 8);
    expect(saved.values.resultValue).toBe(0);
    expect(idempotencyKey).toMatch(/^[\w-]+$/);
    expect(body).toMatchObject({
      version: 8,
      added: [{ clientRowId: expect.any(String), values: { resultValue: 0 }, measurementDeviceId: 7, normativeId: null }],
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
});
