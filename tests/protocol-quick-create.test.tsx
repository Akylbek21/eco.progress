// @vitest-environment jsdom

import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WATER_TYPE_OPTIONS, WATER_USE_CATEGORY_OPTIONS } from '../src/config/protocolWater';
import EnvironmentStep from '../src/features/protocols/components/steps/EnvironmentStep';
import MeasurementDetailsStep from '../src/features/protocols/components/steps/MeasurementDetailsStep';
import ProtocolWizardFooter from '../src/features/protocols/components/ProtocolWizardFooter';
import QuickCreateErrorPanel from '../src/features/protocols/components/components/QuickCreateErrorPanel';
import {
  createWizardDefaults,
  emptyWizardResult,
  normalizeProtocolWizardForm,
  type LaboratoryExecutorOption,
} from '../src/features/protocols/components/wizardTypes';
import {
  buildQuickCreatePayload,
  mapQuickCreateTemplateId,
  normalizeDecimal,
  normalizePositiveId,
  PayloadValidationError,
  requirePositiveIntegerId,
} from '../src/features/protocols/mappers/mapProtocolWizardToRequest';
import {
  acquireQuickCreateLock,
  prepareQuickCreateAttempt,
  releaseQuickCreateLock,
  stableStringify,
} from '../src/features/protocols/utils/quickCreateSubmission';
import {
  buildQuickCreateTechnicalReport,
  resolveQuickCreateApiError,
} from '../src/features/protocols/utils/quickCreateError';
import {
  normalizeQuickCreateFieldPath,
} from '../src/features/protocols/components/CreateProtocolWizardModal';
import { validateDraft, validateForApproval } from '../src/features/protocols/utils/protocolWizardValidation';
import api from '../src/services/api';
import { normalizeApiError } from '../src/services/apiHelpers';
import { quickCreateProtocol } from '../src/services/apiProtocolService';
import type { CompanyObject } from '../src/types/companies';

afterEach(cleanup);

const validForm = () => {
  const form = createWizardDefaults();
  Object.assign(form, {
    templateId: 'water' as const,
    companyId: '1',
    objectId: '2',
    laboratoryId: '4',
    executorId: '10',
    protocolDate: '2026-07-20',
    sampleDate: '2026-07-21',
    measurementDate: '2026-07-22',
    testingStartDate: '2026-07-23',
    testingEndDate: '2026-07-24',
    sourceNumber: 'W-1',
    measurementTime: '12:00',
    measurementPlace: ' Цех ',
    temperature: ' 30,9 ',
    humidity: '29',
    pressure: '94,91',
    windSpeed: '7,5',
    waterType: 'DRINKING_WATER',
    waterUseCategory: 'I',
    testingMethodNd: 'ГОСТ 1',
    samplingMethodNd: 'ГОСТ отбора',
    environmentSource: 'API' as const,
    orderId: 'order-uuid-1',
  });
  form.results = [{
    ...emptyWizardResult(),
    indicatorName: ' Кремний тетрахлорид ',
    pollutantCode: 'SI',
    value: ' 0,2 ',
    unit: 'мг/л',
    normativeValue: '0,2',
    normativeId: '123',
    normativeSource: 'DIRECTORY',
    normativeStatus: 'ACTIVE',
    testingMethodNd: 'Методика строки',
    measurementDeviceId: '8',
    samplingPlace: 'Скважина № 1',
    sampleNumber: 'W-1',
  }];
  return form;
};

const selectedObject: CompanyObject = {
  id: '2',
  companyId: '1',
  persisted: true,
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
  executorId: 10,
  laboratoryEmployeeId: 10,
  userId: 999,
  laboratoryId: 4,
  fullName: 'Исполнитель',
  active: true,
};

const strictContext = {
  selectedObject,
  selectedExecutor,
  validateSelections: true,
  validationMode: 'submit' as const,
};

const FormHarness = ({ step }: { step: 'details' | 'environment' }) => {
  const form = useForm({ defaultValues: validForm() });
  return (
    <FormProvider {...form}>
      {step === 'details'
        ? <MeasurementDetailsStep />
        : <EnvironmentStep weatherLoading={false} weatherMessage="" onRefresh={vi.fn()} waterTypeOptions={WATER_TYPE_OPTIONS} waterUseCategoryOptions={WATER_USE_CATEGORY_OPTIONS} />}
    </FormProvider>
  );
};

describe('quick-create form components', () => {
  it('migrates incomplete drafts without leaving undefined values for wizard validation', () => {
    const form = normalizeProtocolWizardForm({
      measurementPlace: undefined,
      sourceNumber: null,
      testingMethodNd: undefined,
      results: [{ indicatorName: undefined, value: null, unit: undefined }],
    });

    expect(form.measurementPlace).toBe('');
    expect(form.sourceNumber).toBe('');
    expect(form.testingMethodNd).toBe('');
    expect(form.results[0]).toMatchObject({
      indicatorName: '',
      value: '',
      unit: '',
    });
  });

  it('renders the current date fields and water characteristics without losing form state', () => {
    const { rerender } = render(<FormHarness step="details" />);
    expect((screen.getByLabelText(/Дата измерения/) as HTMLInputElement).type).toBe('date');
    expect((screen.getByLabelText(/Номер источника/) as HTMLInputElement).maxLength).toBe(80);
    rerender(<FormHarness step="environment" />);
    expect((screen.getByLabelText(/Тип воды/) as HTMLSelectElement).value).toBe('DRINKING_WATER');
  });

  it('disables creation when submit validation failed', () => {
    const create = vi.fn();
    render(<ProtocolWizardFooter step={4} total={5} submitting={false} canContinue={false} onBack={vi.fn()} onNext={vi.fn()} onCreate={create} onSaveDraft={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Создать протокол' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(create).not.toHaveBeenCalled();
  });

  it('shows safe backend diagnostics and retry actions', () => {
    render(<QuickCreateErrorPanel
      error={{ status: 500, code: 'INTERNAL_ERROR', message: 'Ошибка', errors: [], fieldErrors: {}, requestCode: '2beadd28' }}
      message="Backend не завершил операцию"
      pending={false}
      onRetry={vi.fn()}
      onReview={vi.fn()}
      onCopyCode={vi.fn()}
      onCopyTechnicalInfo={vi.fn()}
    />);
    expect(screen.getByText('Не удалось создать протокол')).toBeTruthy();
    expect(screen.queryByText(/HTTP-статус/)).toBeNull();
    expect(screen.getByText(/2beadd28/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeTruthy();
  });
});

describe('quick-create payload contract', () => {
  it('requires positive integer ids and never returns NaN or zero fallback', () => {
    expect(requirePositiveIntegerId('42', 'objectId')).toBe(42);
    expect(requirePositiveIntegerId(7, 'objectId')).toBe(7);
    for (const value of ['', 0, -1, '1.5', 'abc', Number.NaN]) {
      expect(() => requirePositiveIntegerId(value, 'objectId')).toThrow(PayloadValidationError);
    }
    expect(normalizePositiveId('42')).toBe(42);
    expect(normalizePositiveId(0)).toBeUndefined();
  });

  it('normalizes decimal commas, preserves zero and rejects NaN', () => {
    expect(normalizeDecimal(' 0,25 ')).toBe(0.25);
    expect(normalizeDecimal('0')).toBe(0);
    expect(normalizeDecimal('')).toBeNull();
    expect(() => normalizeDecimal('abc', 'environment.temperature')).toThrow(PayloadValidationError);
  });

  it('builds the canonical OpenAPI DTO with all required dates', () => {
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    expect(payload).toMatchObject({
      templateId: 'water',
      companyId: 1,
      objectId: 2,
      laboratoryId: 4,
      executorId: 10,
      protocolDate: '2026-07-20',
      sampleDate: '2026-07-21',
      measurementDate: '2026-07-22',
      measurementTime: '12:00',
      testingStartDate: '2026-07-23',
      testingEndDate: '2026-07-24',
      sourceNumber: 'W-1',
      measurementPlace: 'Цех',
      conditions: {
        waterType: 'DRINKING_WATER',
        waterUseCategory: 'I',
        sampleNumber: 'W-1',
        samplingPlace: 'Скважина № 1',
        temperature: '30.9',
        humidity: '29',
        pressure: '94.91',
        windSpeed: '7.5',
        weatherSource: 'API',
      },
    });
    expect(payload.measurements[0]).toMatchObject({
      indicatorName: 'Кремний тетрахлорид',
      pollutantCode: 'SI',
      value: 0.2,
      unit: 'мг/дм³',
      normativeId: 123,
      measurementDeviceId: 8,
      testingMethodNd: 'Методика строки',
      samplingMethodNd: 'ГОСТ отбора',
    });
    expect(payload.measurements[0]).not.toHaveProperty('deviceId');
    expect(payload.measurements[0]).not.toHaveProperty('resultValue');
    expect(payload.measurements[0]).not.toHaveProperty('indicatorCode');
    expect(payload.measurements[0]).not.toHaveProperty('normValue');
    expect(payload.measurements[0]).not.toHaveProperty('methodology');
  });

  it('does not pretend unsupported PEK links are accepted by quick-create backend', () => {
    const form = validForm();
    Object.assign(form, {
      pekProgramId: '11', pekReportId: '12', pekControlItemId: '13', pekControlEventId: '14',
      monitoringPointId: '15', emissionSourceId: '16', waterOutletId: '17', orderServiceItemId: '18',
    });
    const payload = buildQuickCreatePayload(form, strictContext);
    expect(payload.orderId).toBe('order-uuid-1');
    for (const unsupported of ['pekProgramId', 'pekReportId', 'pekControlItemId', 'pekControlEventId', 'monitoringPointId', 'emissionSourceId', 'waterOutletId', 'orderServiceItemId']) {
      expect(payload).not.toHaveProperty(unsupported);
    }
  });

  it('allows a manual draft without normativeId but blocks approval', () => {
    const form = validForm();
    form.results[0] = {
      ...form.results[0],
      normativeId: '',
      normativeSource: 'NONE',
      normativeStatus: '',
      normativeValue: '',
    };
    expect(validateDraft(form)).toEqual([]);
    expect(validateForApproval(form)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'results.0.normativeId' }),
    ]));
    expect(buildQuickCreatePayload(form, strictContext).measurements[0].normativeId).toBeUndefined();
  });

  it('preserves manual normative metadata in backend-supported values', () => {
    const form = validForm();
    form.results[0] = {
      ...form.results[0], normativeId: '', normativeSource: 'MANUAL', normativeValue: '0,5',
      normativeMin: '0', normativeMax: '1', comparisonType: 'RANGE', normativeDocument: 'ДСМ-70',
    };
    const measurement = buildQuickCreatePayload(form, strictContext).measurements[0];
    expect(measurement.normativeId).toBeUndefined();
    expect(measurement.normativeValue).toBe(0.5);
    expect(measurement.values).toMatchObject({ normativeSource: 'MANUAL', normativeMin: 0, normativeMax: 1, comparisonType: 'RANGE', normativeDocument: 'ДСМ-70' });
  });

  it('requires factorType for physical results even when factorCode exists', () => {
    const form = validForm();
    form.templateId = 'noise_vibration';
    form.waterType = '';
    form.waterUseCategory = '';
    form.results[0] = { ...form.results[0], pollutantCode: '', factorType: '', factorCode: 'NOISE_1' };
    expect(validateForApproval(form)).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'results.0.factorType' }),
    ]));
    expect(() => buildQuickCreatePayload(form, strictContext)).toThrow(expect.objectContaining({ field: 'results.0.factorType' }));
  });

  it('accepts result 0 but blocks a missing or numeric unit before POST', () => {
    const zero = validForm();
    zero.results[0].value = '0';
    expect(buildQuickCreatePayload(zero, strictContext).measurements[0].value).toBe(0);
    const missing = validForm();
    missing.results[0].unit = '';
    expect(() => buildQuickCreatePayload(missing, strictContext))
      .toThrow(expect.objectContaining({ field: 'results.0.unit' }));
    const numeric = validForm();
    numeric.results[0].unit = '0,2';
    expect(() => buildQuickCreatePayload(numeric, strictContext))
      .toThrow(expect.objectContaining({ field: 'results.0.unit' }));
  });

  it('blocks virtual objects and maps executorId without using userId', () => {
    expect(() => buildQuickCreatePayload(validForm(), {
      ...strictContext,
      selectedObject: { ...selectedObject, isVirtual: true, persisted: false },
    })).toThrow(expect.objectContaining({ field: 'objectId' }));
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    expect(payload.executorId).toBe(10);
    expect(payload.executorId).not.toBe(selectedExecutor.userId);
  });

  it('validates executor membership and active state', () => {
    expect(() => buildQuickCreatePayload(validForm(), {
      ...strictContext,
      selectedExecutor: { ...selectedExecutor, laboratoryId: 5 },
    })).toThrow(expect.objectContaining({ field: 'executorId' }));
    expect(() => buildQuickCreatePayload(validForm(), {
      ...strictContext,
      selectedExecutor: { ...selectedExecutor, active: false },
    })).toThrow(expect.objectContaining({ field: 'executorId' }));
  });

  it('keeps soil sampling fields and omits water fields for soil', () => {
    const soil = validForm();
    soil.templateId = 'soil';
    soil.waterType = '';
    soil.waterUseCategory = '';
    soil.results[0].sampleNumber = 'S-1';
    soil.results[0].samplingDepth = '0,5';
    soil.results[0].samplingPlace = 'Шурф 3';
    const payload = buildQuickCreatePayload(soil, strictContext);
    expect(payload.conditions).toMatchObject({
      sampleNumber: 'S-1',
      samplingDepth: '0,5',
      samplingPlace: 'Шурф 3',
    });
    expect(payload.measurements[0].values).toMatchObject({
      sampleName: 'S-1',
      samplingDepth: '0,5',
      samplingPlace: 'Шурф 3',
      samplingDate: '2026-07-21',
    });
    expect(payload.conditions).not.toHaveProperty('waterType');
  });

  it('requires water characteristics and a concrete physical factor subtype', () => {
    const water = validForm();
    water.waterType = '';
    expect(() => buildQuickCreatePayload(water, strictContext))
      .toThrow(expect.objectContaining({ field: 'waterType' }));
    expect(() => mapQuickCreateTemplateId('physical_factors'))
      .toThrow(expect.objectContaining({ field: 'templateId' }));
    expect(mapQuickCreateTemplateId('microclimate')).toBe('microclimate');
    expect(mapQuickCreateTemplateId('lighting')).toBe('lighting');
    expect(mapQuickCreateTemplateId('noise_vibration')).toBe('noise_vibration');
  });

  it('preserves optional methodology and rejects reversed local dates', () => {
    const method = validForm();
    method.testingMethodNd = '';
    method.results[0].testingMethodNd = '';
    method.results[0].methodDocument = '';
    expect(buildQuickCreatePayload(method, strictContext).measurements[0].testingMethodNd).toBeUndefined();
    const dates = validForm();
    dates.testingStartDate = '2026-07-25';
    expect(() => buildQuickCreatePayload(dates, strictContext))
      .toThrow(expect.objectContaining({ field: 'testingEndDate' }));
  });

  it('reuses the key for the same payload, rotates it after changes and locks double click', () => {
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    const first = prepareQuickCreateAttempt(payload, { idempotencyKey: null, payloadFingerprint: null }, () => 'attempt-1');
    const retry = prepareQuickCreateAttempt(payload, first, () => 'unused');
    expect(retry.idempotencyKey).toBe('attempt-1');
    const changed = prepareQuickCreateAttempt({ ...payload, measurementPlace: 'Другая точка' }, retry, () => 'attempt-2');
    expect(changed.idempotencyKey).toBe('attempt-2');
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    const lock = { current: false };
    expect(acquireQuickCreateLock(lock)).toBe(true);
    expect(acquireQuickCreateLock(lock)).toBe(false);
    releaseQuickCreateLock(lock);
  });

  it('maps nested backend field paths to React Hook Form paths', () => {
    expect(normalizeQuickCreateFieldPath('measurements[0].unit')).toBe('results.0.unit');
    expect(normalizeQuickCreateFieldPath('environment.temperature')).toBe('temperature');
    expect(normalizeQuickCreateFieldPath('conditions.waterType')).toBe('waterType');
    expect(normalizeQuickCreateFieldPath('executorId')).toBe('executorId');
  });
});

describe('quick-create backend errors', () => {
  it('preserves a 500 attempt and reads requestCode safely', () => {
    const apiError = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 500,
        data: { message: 'failed', code: 'INTERNAL_ERROR', requestCode: '2beadd28' },
        headers: {},
      },
    });
    expect(apiError).toMatchObject({ status: 500, code: 'INTERNAL_ERROR', requestCode: '2beadd28' });
    expect(resolveQuickCreateApiError(apiError)).toMatchObject({
      serverFailure: true,
      resetIdempotencyKey: false,
    });
  });

  it('identifies backend schema failure and keeps the same idempotency attempt', () => {
    const apiError = normalizeApiError({
      isAxiosError: true,
      response: {
        status: 500,
        data: {
          message: 'Сервис временно недоступен из-за внутренней ошибки схемы данных',
          code: 'INTERNAL_SCHEMA_ERROR',
          traceId: 'd9a512f2',
        },
        headers: {},
      },
    });

    expect(resolveQuickCreateApiError(apiError)).toMatchObject({
      serverFailure: true,
      resetIdempotencyKey: false,
    });
    expect(resolveQuickCreateApiError(apiError).message).toContain('схемы данных');
  });

  it('builds a safe technical report without measurement values or personal text', () => {
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    const report = buildQuickCreateTechnicalReport(
      {
        message: 'schema failure',
        status: 500,
        code: 'INTERNAL_SCHEMA_ERROR',
        traceId: 'd9a512f2',
        fieldErrors: {},
      },
      payload,
      'same-attempt-key',
    );
    const serialized = JSON.stringify(report);

    expect(report).toMatchObject({
      status: 500,
      code: 'INTERNAL_SCHEMA_ERROR',
      traceId: 'd9a512f2',
      idempotencyKeyPrefix: 'same-att…',
      payloadShape: {
        templateId: 'water',
        measurementCount: 1,
        requiredDatesPresent: {
          protocolDate: true,
          sampleDate: true,
          measurementDate: true,
          testingStartDate: true,
          testingEndDate: true,
        },
      },
    });
    expect(serialized).not.toContain(payload.measurements[0].indicatorName);
    expect(serialized).not.toContain(String(payload.measurements[0].value));
    expect(serialized).not.toContain(payload.measurementPlace);
  });

  it('normalizes timeout and network errors without exposing Axios config', () => {
    expect(normalizeApiError({ isAxiosError: true, code: 'ETIMEDOUT' }).message).toContain('не ответил вовремя');
    expect(normalizeApiError({ isAxiosError: true }).message).toContain('Нет соединения');
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
      return HttpResponse.json({ data: { id: '77', templateId: 'water', status: 'DRAFT', version: 1, results: [] } });
    }),
    http.get('http://localhost/api/protocols/77', () => {
      const payload = requestBody as Record<string, unknown>;
      return HttpResponse.json({ data: {
        id: '77',
        ...payload,
        templateId: 'water',
        status: 'DRAFT',
        version: 1,
        results: [],
        testing: {
          samplingDate: payload.sampleDate,
          testingStartDate: payload.testingStartDate,
          testingEndDate: payload.testingEndDate,
        },
      } });
    }),
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

  it('sends exactly one POST with the supplied Idempotency-Key', async () => {
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    const protocol = await quickCreateProtocol({ payload, idempotencyKey: 'same-attempt-key' });
    expect(protocol.id).toBe('77');
    expect(requestCount).toBe(1);
    expect(idempotencyKey).toBe('same-attempt-key');
    expect(requestBody).toEqual(payload);
  });

  it('preserves canonical fields and strips only legacy aliases at the HTTP boundary', async () => {
    const payload = buildQuickCreatePayload(validForm(), strictContext);
    const expanded = {
      ...payload,
      deviceId: 9,
      measurements: payload.measurements.map((measurement) => ({
        ...measurement,
        resultValue: 999,
        indicatorCode: 'legacy',
        deviceId: 8,
      })),
    } as typeof payload;
    await quickCreateProtocol({ payload: expanded, idempotencyKey: 'strict-boundary-key' });
    const sent = requestBody as Record<string, unknown>;
    expect(sent).toHaveProperty('sampleDate', payload.sampleDate);
    expect(sent).toHaveProperty('protocolDate', payload.protocolDate);
    expect(sent).toHaveProperty('testingStartDate', payload.testingStartDate);
    expect(sent).toHaveProperty('testingEndDate', payload.testingEndDate);
    expect(sent).toHaveProperty('sourceNumber', payload.sourceNumber);
    expect(sent).not.toHaveProperty('deviceId');
    const [measurement] = sent.measurements as Array<Record<string, unknown>>;
    expect(measurement).toHaveProperty('value', 0.2);
    expect(measurement).not.toHaveProperty('deviceId');
    expect(measurement).not.toHaveProperty('resultValue');
    expect(measurement).not.toHaveProperty('indicatorCode');
  });

  it('does not retry a failed POST automatically', async () => {
    server.use(http.post('http://localhost/api/protocols/quick-create', () => {
      requestCount += 1;
      return HttpResponse.json({ message: 'failed', requestCode: '2beadd28' }, { status: 500 });
    }));
    await expect(quickCreateProtocol({
      payload: buildQuickCreatePayload(validForm(), strictContext),
      idempotencyKey: 'failed-attempt',
    })).rejects.toBeDefined();
    expect(requestCount).toBe(1);
  });

  it('keeps POST success when the post-create GET contract check mismatches', async () => {
    server.use(http.get('http://localhost/api/protocols/77', () => HttpResponse.json({ data: {
      id: '77', templateId: 'water', status: 'DRAFT', version: 1, protocolDate: '2000-01-01', results: [],
    } })));
    const protocol = await quickCreateProtocol({
      payload: buildQuickCreatePayload(validForm(), strictContext),
      idempotencyKey: 'post-check-warning',
    });
    expect(protocol.id).toBe('77');
    expect(protocol.syncWarning).toBe('Протокол создан, но часть полей требует повторной синхронизации.');
    expect(requestCount).toBe(1);
  });
});
