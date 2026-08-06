import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import type { CreateLabJournalEntryRequest } from '../src/types/labJournal';

const origin = 'http://127.0.0.1:43117';
const entry = {
  id: 11,
  version: 1,
  journalType: 'SAMPLE_REGISTRATION',
  laboratoryId: 1,
  entryDate: '2026-07-21',
  registrationDate: '2026-07-21',
  executorName: 'Исполнитель',
  data: { sampleNumber: 'ОБР-11', sampleName: 'Вода' },
  fields: { sampleNumber: 'ОБР-11' },
};
const server = setupServer();
let service: typeof import('../src/features/lab-journals/api/labJournalService');

beforeAll(async () => {
  vi.stubEnv('VITE_API_URL', `${origin}/api`);
  vi.stubGlobal('localStorage', { getItem: () => null, removeItem: () => undefined, setItem: () => undefined });
  server.listen({ onUnhandledRequest: 'error' });
  service = await import('../src/features/lab-journals/api/labJournalService');
});
afterEach(() => server.resetHandlers());
afterAll(() => { server.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('lab journal HTTP contracts', () => {
  it('accepts the production types payload with title and optional required', async () => {
    const productionTypes = [
      {
        code: 'ENVIRONMENT_CONDITIONS',
        title: 'Журнал регистрации условий окружающей среды',
        columns: [
          { key: 'rowNumber', title: '№', type: 'number' },
          { key: 'registrationDate', title: 'Дата регистрации', type: 'date' },
          { key: 'relativeHumidity', title: 'Относительная влажность', type: 'text' },
        ],
      },
      {
        code: 'CHEMICAL_REAGENT_USAGE',
        title: 'Журнал учета поступления и расхода химических веществ',
        columns: [{ key: 'incomingQuantity', title: 'Приход кол-во', type: 'number' }],
      },
      {
        code: 'TEST_RESULTS_REGISTRATION',
        title: 'Журнал регистрации результатов испытаний',
        columns: [{ key: 'protocolRegistrationDate', title: 'Дата регистрации протокола', type: 'date' }],
      },
      {
        code: 'SAMPLE_REGISTRATION',
        title: 'Журнал регистрации проб',
        columns: [
          { key: 'rowNumber', title: '№', type: 'number' },
          { key: 'date', title: 'Дата', type: 'date' },
          { key: 'fullName', title: 'Ф.И.О. инструктируемого', type: 'text' },
        ],
      },
      {
        code: 'SOLUTION_PREPARATION',
        title: 'Журнал приготовления растворов',
        columns: [{ key: 'preparationDate', title: 'Дата приготовления', type: 'date' }],
      },
    ];
    server.use(http.get(`${origin}/api/lab-journals/types`, () =>
      HttpResponse.json({ data: productionTypes, success: true })));

    const result = await service.getJournalTypesResult();
    expect(result).toMatchObject({ schemaSource: 'backend' });
    expect(result.content).toHaveLength(5);
    expect(result.content.find((item) => item.code === 'SAMPLE_REGISTRATION')).toMatchObject({
      name: 'Журнал регистрации проб',
      schemaSource: 'backend',
      columns: [
        { key: 'rowNumber', title: '№', type: 'number', required: false },
        { key: 'date', title: 'Дата', type: 'date', required: false },
        { key: 'fullName', title: 'Ф.И.О. инструктируемого', type: 'text', required: false },
      ],
    });
  });

  it('normalizes GET list arrays and paged responses', async () => {
    server.use(http.get(`${origin}/api/lab-journals/entries`, () => HttpResponse.json([entry])));
    const arrayPage = await service.getEntries({ journalType: 'SAMPLE_REGISTRATION', page: 0, size: 25 });
    expect(arrayPage).toMatchObject({ page: 0, size: 1, totalElements: 1, totalPages: 1 });
    server.resetHandlers();
    server.use(http.get(`${origin}/api/lab-journals/entries`, () => HttpResponse.json({ data: { content: [entry], page: 2, size: 10, totalElements: 21, totalPages: 3 } })));
    expect(await service.getEntries({ page: 2, size: 10 })).toMatchObject({ page: 2, totalElements: 21, totalPages: 3 });
  });

  it('sends POST data and fields without values and exposes backend 400', async () => {
    server.use(http.post(`${origin}/api/lab-journals/entries`, async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('fields');
      expect(body).not.toHaveProperty('values');
      return HttpResponse.json({ data: entry });
    }));
    const payload = { ...entry, note: null } satisfies CreateLabJournalEntryRequest;
    expect((await service.createEntry(payload)).id).toBe(11);
    server.resetHandlers();
    server.use(http.post(`${origin}/api/lab-journals/entries`, () => HttpResponse.json({ message: 'Укажите preparationDate', errors: ['Укажите preparationDate'] }, { status: 400 })));
    await expect(service.createEntry(payload)).rejects.toMatchObject({ response: { status: 400 } });
  });

  it('uses PUT with version and preserves 409 conflicts', async () => {
    server.use(http.put(`${origin}/api/lab-journals/entries/:id`, async ({ request, params }) => {
      expect(params.id).toBe('11');
      expect(await request.json()).toMatchObject({ version: 1 });
      return HttpResponse.json({ data: { ...entry, version: 2 } });
    }));
    expect((await service.updateEntry(11, { ...entry, note: null })).version).toBe(2);
    server.resetHandlers();
    server.use(http.put(`${origin}/api/lab-journals/entries/:id`, () => HttpResponse.json({ message: 'Конфликт версий' }, { status: 409 })));
    await expect(service.updateEntry(11, { ...entry, note: null })).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('deletes through the canonical DELETE endpoint', async () => {
    server.use(http.delete(`${origin}/api/lab-journals/entries/:id`, ({ params }) => {
      expect(params.id).toBe('11');
      return new HttpResponse(null, { status: 204 });
    }));
    await expect(service.deleteJournalEntry(11)).resolves.toBeUndefined();
  });

  it('downloads template/export blobs and rejects JSON Excel errors', async () => {
    const spreadsheet = new Uint8Array([80, 75, 3, 4]);
    server.use(
      http.get(`${origin}/api/lab-journals/entries/export-template`, () => new HttpResponse(spreadsheet, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="template.xlsx"' } })),
      http.get(`${origin}/api/lab-journals/entries/export`, () => new HttpResponse(spreadsheet, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })),
    );
    expect((await service.downloadTemplate('SAMPLE_REGISTRATION')).fileName).toBe('template.xlsx');
    expect((await service.exportJournal({ journalType: 'SAMPLE_REGISTRATION' })).blob).toBeTruthy();
    server.resetHandlers();
    server.use(http.get(`${origin}/api/lab-journals/entries/export`, () => HttpResponse.json({ message: 'Экспорт недоступен' }, { status: 500 })));
    await expect(service.exportJournal({ journalType: 'SAMPLE_REGISTRATION' })).rejects.toThrow();
  });
});
