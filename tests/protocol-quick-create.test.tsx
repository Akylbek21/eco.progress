// @vitest-environment jsdom

import React from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import api from '../src/services/api';
import { quickCreateProtocol } from '../src/services/apiProtocolService';
import {
  buildQuickCreatePayload,
  QuickCreateValidationError,
} from '../src/features/protocols/mappers/mapProtocolWizardToRequest';
import { createWizardDefaults } from '../src/features/protocols/components/wizardTypes';
import {
  acquireQuickCreateLock,
  prepareQuickCreateAttempt,
  releaseQuickCreateLock,
} from '../src/features/protocols/utils/quickCreateSubmission';
import type { CompanyObject } from '../src/types/companies';
import type { LaboratoryExecutorOption } from '../src/features/protocols/components/wizardTypes';
import MeasurementDetailsStep from '../src/features/protocols/components/steps/MeasurementDetailsStep';
import EnvironmentStep from '../src/features/protocols/components/steps/EnvironmentStep';
import { WATER_TYPE_OPTIONS, WATER_USE_CATEGORY_OPTIONS } from '../src/config/protocolWater';
import { resolveQuickCreateApiError } from '../src/features/protocols/utils/quickCreateError';

afterEach(cleanup);

const validForm = () => {
  const form = createWizardDefaults();
  Object.assign(form, {
    templateId: 'water_wastewater' as const,
    companyId: '1',
    objectId: '2',
    laboratoryId: '4',
    executorId: '10',
    protocolDate: '2026-07-20',
    sampleDate: '2026-07-21',
    measurementDate: '2026-07-22',
    testingStartDate: '2026-07-23',
    testingEndDate: '2026-07-24',
    measurementTime: '12:00',
    measurementPlace: ' цук ',
    sourceNumber: ' Ә-№1 ',
    temperature: ' 30,9 ',
    humidity: '29',
    pressure: '94,91',
    windSpeed: '7,5',
    waterType: 'DRINKING_WATER',
    waterUseCategory: 'I',
    testingMethodNd: 'ГОСТ 1',
  });
  form.results = [{
    ...form.results[0],
    indicatorName: ' Кремний тетрахлорид ',
    pollutantCode: 'SI',
    value: ' 0,2 ',
    unit: 'мг/л',
    normativeValue: '0,2',
    comparisonType: 'LESS_OR_EQUAL',
    measurementDeviceId: '8',
  }];
  return form;
};

const selectedObject: CompanyObject = {
  id: '2',
  companyId: '1',
  name: 'Объект',
  address: '',
  coordinates: '',
  activityType: '',
  sanitaryZone: '',
  notes: '',
  samplingLocation: '',
  status: 'ACTIVE',
};

const selectedExecutor: LaboratoryExecutorOption = {
  laboratoryEmployeeId: 10,
  laboratoryId: 4,
  fullName: 'Исполнитель',
};

const FormHarness = ({ step }: { step: 'details' | 'environment' }) => {
  const form = useForm({ defaultValues: validForm() });
  return (
    <FormProvider {...form}>
      {step === 'details'
        ? <MeasurementDetailsStep />
        : (
          <EnvironmentStep
            weatherLoading={false}
            weatherMessage=""
            waterTypeOptions={WATER_TYPE_OPTIONS}
            waterUseCategoryOptions={WATER_USE_CATEGORY_OPTIONS}
          />
        )}
    </FormProvider>
  );
};

describe('quick-create form components', () => {
  it('renders separate required date inputs and limits sourceNumber to 100 characters', () => {
    render(<FormHarness step="details" />);
    expect((screen.getByLabelText(/Дата протокола/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Дата отбора пробы/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Дата измерения/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Дата начала испытаний/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Дата завершения испытаний/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Номер источника/) as HTMLInputElement).maxLength).toBe(100);
  });

  it('renders both required water selectors with backend enum values', () => {
    render(<FormHarness step="environment" />);
    expect((screen.getByLabelText(/Тип воды/) as HTMLSelectElement).value).toBe('DRINKING_WATER');
    expect((screen.getByLabelText(/Категория водопользования/) as HTMLSelectElement).value).toBe('I');
  });
});

describe('quick-create payload contract', () => {
  it('normalizes IDs, decimals, text and keeps all dates separate', () => {
    const payload = buildQuickCreatePayload(validForm(), {
      selectedObject,
      selectedExecutor,
      validateSelections: true,
    });

    expect(payload).toMatchObject({
      templateId: 'water',
      companyId: 1,
      objectId: 2,
      laboratoryId: 4,
      executorId: 10,
      protocolDate: '2026-07-20',
      sampleDate: '2026-07-21',
      measurementDate: '2026-07-22',
      testingStartDate: '2026-07-23',
      testingEndDate: '2026-07-24',
      measurementPlace: 'цук',
      sourceNumber: 'Ә-№1',
      conditions: { pressure: '94.91' },
      environment: { pressureKpa: '94.91' },
    });
    expect(payload.measurements[0]).toMatchObject({
      indicatorName: 'Кремний тетрахлорид',
      value: '0.2',
      unit: 'мг/л',
      normativeValue: '0.2',
      comparisonType: 'LE',
      measurementDeviceId: 8,
    });
  });

  it('turns an empty source number into null and preserves Kazakh text', () => {
    const empty = validForm();
    empty.sourceNumber = '   ';
    expect(buildQuickCreatePayload(empty).sourceNumber).toBeNull();

    const kazakh = validForm();
    kazakh.sourceNumber = 'қазақша ӘӨҮҰҚ';
    expect(buildQuickCreatePayload(kazakh).sourceNumber).toBe('қазақша ӘӨҮҰҚ');
  });

  it('blocks reversed test dates and virtual company objects', () => {
    const reversed = validForm();
    reversed.testingStartDate = '2026-07-25';
    expect(() => buildQuickCreatePayload(reversed)).toThrowError(
      expect.objectContaining<Partial<QuickCreateValidationError>>({ field: 'testingEndDate' }),
    );

    expect(() => buildQuickCreatePayload(validForm(), {
      selectedObject: { ...selectedObject, virtual: true },
      selectedExecutor,
      validateSelections: true,
    })).toThrowError(expect.objectContaining<Partial<QuickCreateValidationError>>({ field: 'objectId' }));
  });

  it('blocks an executor from another laboratory and a numeric unit', () => {
    expect(() => buildQuickCreatePayload(validForm(), {
      selectedObject,
      selectedExecutor: { ...selectedExecutor, laboratoryId: 5 },
      validateSelections: true,
    })).toThrowError(expect.objectContaining<Partial<QuickCreateValidationError>>({ field: 'executorId' }));

    const invalidUnit = validForm();
    invalidUnit.results[0].unit = '0,2';
    expect(() => buildQuickCreatePayload(invalidUnit)).toThrowError(
      expect.objectContaining<Partial<QuickCreateValidationError>>({ field: 'results.0.unit' }),
    );
  });

  it('reuses a key after timeout, creates a new key after payload change, and locks double click', () => {
    const payload = buildQuickCreatePayload(validForm());
    const first = prepareQuickCreateAttempt(payload, {
      idempotencyKey: null,
      payloadFingerprint: null,
    }, () => 'attempt-1');
    const retry = prepareQuickCreateAttempt(payload, first, () => 'must-not-be-used');
    expect(retry.idempotencyKey).toBe('attempt-1');

    const changed = { ...payload, measurementPlace: 'другая точка' };
    const next = prepareQuickCreateAttempt(changed, retry, () => 'attempt-2');
    expect(next.idempotencyKey).toBe('attempt-2');

    const lock = { current: false };
    expect(acquireQuickCreateLock(lock)).toBe(true);
    expect(acquireQuickCreateLock(lock)).toBe(false);
    releaseQuickCreateLock(lock);
    expect(acquireQuickCreateLock(lock)).toBe(true);
  });
});

describe('quick-create backend errors', () => {
  it('maps object and executor conflicts to their form fields', () => {
    expect(resolveQuickCreateApiError({
      code: 'OBJECT_NOT_FOUND',
      message: 'Объект не найден',
      errors: [],
      fieldErrors: {},
    })).toMatchObject({ field: 'objectId', resetIdempotencyKey: false });
    expect(resolveQuickCreateApiError({
      code: 'EXECUTOR_LABORATORY_MISMATCH',
      message: 'Исполнитель другой лаборатории',
      errors: [],
      fieldErrors: {},
    })).toMatchObject({ field: 'executorId', resetIdempotencyKey: false });
  });

  it('resets a reused key only for the dedicated backend code', () => {
    expect(resolveQuickCreateApiError({
      status: 409,
      code: 'IDEMPOTENCY_KEY_REUSED',
      message: 'conflict',
      errors: [],
      fieldErrors: {},
    })).toMatchObject({
      message: 'Запрос уже был отправлен с другими данными. Повторите операцию.',
      resetIdempotencyKey: true,
    });
  });
});

describe('quick-create API request', () => {
  let requestCount = 0;
  let requestBody: unknown;
  let idempotencyKey = '';
  const server = setupServer(
    http.post('http://localhost/api/protocols/quick-create', async ({ request }) => {
      requestCount += 1;
      requestBody = await request.json();
      idempotencyKey = request.headers.get('Idempotency-Key') || '';
      return HttpResponse.json({ data: { id: '77', templateId: 'water', status: 'DRAFT', results: [] } });
    }),
    http.get('http://localhost/api/protocols/77', () =>
      HttpResponse.json({ data: { id: '77', templateId: 'water', status: 'DRAFT', results: [], testing: {}, conditions: {} } })),
  );

  beforeAll(() => {
    vi.stubGlobal('localStorage', { getItem: () => null });
    api.defaults.baseURL = 'http://localhost/api';
    server.listen({ onUnhandledRequest: 'error' });
  });
  afterEach(() => {
    requestCount = 0;
    requestBody = undefined;
    idempotencyKey = '';
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
    vi.unstubAllGlobals();
  });

  it('sends the strict payload once and keeps the supplied Idempotency-Key', async () => {
    const payload = buildQuickCreatePayload(validForm());
    const protocol = await quickCreateProtocol(payload, 'same-attempt-key');
    expect(protocol.id).toBe('77');
    expect(requestCount).toBe(1);
    expect(idempotencyKey).toBe('same-attempt-key');
    expect(requestBody).toEqual(payload);
  });
});
