import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { getWeatherConditions, normalizeWeatherConditions, saveProtocolDraftResults } from '../src/services/apiProtocolService';
import { normalizeApiError } from '../src/services/apiHelpers';
import { searchNormatives } from '../src/services/normativeSearchService';
import {
  canCreateProtocol,
  canViewProtocol,
} from '../src/utils/protocolPermissions';
import { hasProtocolAction } from '../src/features/protocols/utils/protocolActions';
import { createWizardDefaults } from '../src/features/protocols/components/wizardTypes';
import { mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';

const server = setupServer();
const originalBaseUrl = api.defaults.baseURL;

beforeAll(() => {
  vi.stubGlobal('localStorage', {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  });
  api.defaults.baseURL = 'http://localhost/api';
  server.listen({ onUnhandledRequest: 'error' });
});
afterEach(() => server.resetHandlers());
afterAll(() => {
  api.defaults.baseURL = originalBaseUrl;
  server.close();
  vi.unstubAllGlobals();
});

describe('protocol access and draft compatibility', () => {
  it('keeps protocol version zero in the JSON body and does not invent If-Match', async () => {
    let ifMatch = '';
    let requestBody: unknown;
    server.use(
      http.patch('http://localhost/api/protocols/48', async ({ request }) => {
        ifMatch = request.headers.get('If-Match') || '';
        requestBody = await request.json();
        return HttpResponse.json({ data: { id: '48', version: 1 } });
      }),
    );

    await api.patch('/protocols/48', { version: 0, protocolDate: '2026-07-13' });

    expect(ifMatch).toBe('');
    expect(requestBody).toEqual({ version: 0, protocolDate: '2026-07-13' });
  });

  it('uses an explicit backend permission for protocol creation without inferring resource view permission', () => {
    const user = { id: 10, role: 'LABORATORY', permissions: ['create_protocols'] };
    expect(canViewProtocol(user)).toBe(false);
    expect(canCreateProtocol(user)).toBe(true);
    expect(canCreateProtocol({ id: 11, role: 'ADMIN', permissions: [] })).toBe(false);
  });

  it('keeps CLIENT out of the internal editor', () => {
    const client = { id: 11, role: 'CLIENT' };
    expect(canViewProtocol(client)).toBe(false);
    expect(canCreateProtocol(client)).toBe(false);
    expect(hasProtocolAction({ availableActions: {} } as never, 'edit')).toBe(false);
  });

  it('fails closed when a draft has no backend permissions', () => {
    const protocol = { availableActions: {} } as never;
    expect(hasProtocolAction(protocol, 'view')).toBe(false);
    expect(hasProtocolAction(protocol, 'edit')).toBe(false);
    expect(hasProtocolAction(protocol, 'calculate')).toBe(false);
    expect(hasProtocolAction(protocol, 'checkNormatives')).toBe(false);
    expect(hasProtocolAction(protocol, 'sendToApproval')).toBe(false);
  });

  it('creates a draft payload from only template and company, without weather or results', () => {
    const form = createWizardDefaults();
    form.templateId = 'ambient_air';
    form.companyId = '77';
    form.objectId = '';
    form.executorId = '';
    form.laboratoryId = '';
    form.results = [];
    Object.assign(form, { temperature: '', humidity: '', pressure: '', windSpeed: '' });

    const payload = mapWizardToCreateDraft(form);

    expect(payload).toMatchObject({
      templateId: 'AMBIENT_AIR_SZZ',
      companyId: 77,
      objectId: null,
      executorId: null,
      laboratoryId: null,
    });
    expect(payload).not.toHaveProperty('measurements');
    expect(payload).not.toHaveProperty('laboratoryEmployeeId');
  });

  it('does not synthesize correction permission for a signed protocol', () => {
    const protocol = { status: 'SIGNED', availableActions: {} } as never;
    expect(hasProtocolAction(protocol, 'edit')).toBe(false);
    expect(hasProtocolAction(protocol, 'createCorrection')).toBe(false);
  });
});

describe('normative search behavior', () => {
  it.each([
    ['0311', '0311'],
    ['311', '0311'],
    ['азот', '0311'],
  ])('searches %s through the canonical query contract', async (query, expectedCode) => {
    let receivedQuery = '';
    server.use(
      http.get('http://localhost/api/normatives/search', ({ request }) => {
        receivedQuery = new URL(request.url).searchParams.get('query') || '';
        return HttpResponse.json({
          data: {
            items: [{
              id: 311,
              indicatorNameRu: 'Диоксид азота',
              pollutantCode: '0311',
              unit: 'мг/м³',
              normativeValue: '0.2',
              formula: 'NO2',
              cas: '10102-44-0',
            }],
          },
        });
      }),
    );

    const result = await searchNormatives(
      { query, templateId: 'ambient_air', page: 0, size: 50 },
      undefined,
      { bypassCache: true },
    );

    expect(receivedQuery).toBe(query);
    expect(result.items[0]).toMatchObject({
      indicatorName: 'Диоксид азота',
      pollutantCode: expectedCode,
      unit: 'мг/м³',
    });
  });
});

describe('protocol mutation HTTP contracts', () => {
  it('uses only the atomic draft-results endpoint for bulk result changes', async () => {
    const calls: Array<{ method: string; path: string; body: unknown }> = [];
    const draft = { id: '42', templateId: 'ambient_air', status: 'DRAFT', version: 14, results: [
      { id: '1', values: { indicatorName: 'A' }, measurementDeviceId: null },
      { id: '2', values: { indicatorName: 'B' }, measurementDeviceId: null },
    ] };
    const response = { data: { ...draft, version: 15 } };
    server.use(
      http.patch('http://localhost/api/protocols/42/draft-results', async ({ request }) => {
        calls.push({ method: request.method, path: new URL(request.url).pathname, body: await request.json() });
        return HttpResponse.json(response);
      }),
      http.get('http://localhost/api/protocols/42', () => HttpResponse.json({ data: draft })),
    );

    await saveProtocolDraftResults('42', { version: 14, added: [], updated: [{ id: '1', values: { indicatorName: 'A' }, measurementDeviceId: 9, normativeId: null }, { id: '2', values: { indicatorName: 'B' }, measurementDeviceId: 9, normativeId: null }], deletedIds: [] });
    await saveProtocolDraftResults('42', { version: 14, added: [], updated: [{ id: '1', values: { indicatorName: 'A', measurementPlace: 'Точка №1' }, measurementDeviceId: null, normativeId: null }], deletedIds: [] });
    await saveProtocolDraftResults('42', { version: 14, added: [], updated: [], deletedIds: ['2'] });

    expect(calls).toEqual([
      {
        method: 'PATCH',
        path: '/api/protocols/42/draft-results',
        body: expect.objectContaining({ version: 14, added: [], updated: expect.any(Array), deletedIds: [] }),
      },
      {
        method: 'PATCH',
        path: '/api/protocols/42/draft-results',
        body: expect.objectContaining({ version: 14, added: [], updated: expect.any(Array), deletedIds: [] }),
      },
      {
        method: 'PATCH',
        path: '/api/protocols/42/draft-results',
        body: { version: 14, added: [], updated: [], deletedIds: ['2'] },
      },
    ]);
  });

  it('keeps currentVersion from a 409 response for the conflict dialog', () => {
    const parsed = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: 'OPTIMISTIC_LOCK_CONFLICT', currentVersion: 14 },
      },
    });
    expect(parsed).toMatchObject({
      status: 409,
      code: 'OPTIMISTIC_LOCK_CONFLICT',
      currentVersion: 14,
    });
  });
});

describe('weather conditions', () => {
  it('requests weather without object coordinates', async () => {
    let requestUrl: URL | undefined;
    server.use(
      http.get('http://localhost/api/weather/shymkent', ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json({
          data: { temperatureC: 25, humidityPercent: 40, pressureHpa: 950, windSpeedMs: 2 },
        });
      }),
    );

    const weather = await getWeatherConditions({
      objectId: 15,
      date: '2026-07-27',
      time: '12:00',
    });

    expect(requestUrl?.searchParams.get('objectId')).toBe('15');
    expect(requestUrl?.searchParams.has('coordinates')).toBe(false);
    expect(weather).toMatchObject({ available: true, status: 'LOADED', pressureKpa: '95' });
  });

  it('does not mark UNAVAILABLE or an all-empty response as loaded', () => {
    expect(normalizeWeatherConditions({
      source: 'UNAVAILABLE',
      available: false,
      temperature: null,
      humidity: null,
      pressure: null,
      windSpeed: null,
    })).toMatchObject({ available: false, status: 'API_UNAVAILABLE' });
    expect(normalizeWeatherConditions({ data: {} })).toMatchObject({
      available: false,
      status: 'API_UNAVAILABLE',
    });
  });
});
