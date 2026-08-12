import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { mapProtocolToWizardForm, mapWizardResultToDraftRequest, mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
import { saveProtocolWizardDraft } from '../src/features/protocols/api/saveProtocolWizardDraft';
import { mapProtocolApiErrorsToForm } from '../src/features/protocols/utils/protocolFormErrors';
import { hasProtocolAction, hasProtocolPermission } from '../src/features/protocols/utils/protocolActions';
import { validateForApproval } from '../src/features/protocols/utils/protocolWizardValidation';
import type { Protocol } from '../src/types/protocols';
import type { ProtocolService } from '../src/services/protocolService';

describe('protocol wizard HTTP boundary', () => {
  it('preserves zero and confirmed type-specific values in a result request', () => {
    const form = createWizardDefaults();
    form.templateId = 'noise_vibration';
    form.workplaceType = 'PERMANENT';
    const row = {
      ...emptyWizardResult(),
      indicatorName: 'Уровень фактора',
      value: '0',
      unit: 'дБ',
      factorType: 'NOISE',
    };

    const request = mapWizardResultToDraftRequest(row, form, 0);

    expect(request.values.resultValue).toBe(0);
    expect(request.values).not.toHaveProperty('value');
    expect(request.values.factorType).toBe('NOISE');
    expect(request.values.workplaceType).toBe('PERMANENT');
  });

  it('creates from PEK with the exact backend pekContext payload', () => {
    const form = createWizardDefaults();
    Object.assign(form, {
      templateId: 'ambient_air',
      companyId: '10',
      objectId: '20',
      orderId: '30',
      orderServiceItemId: '40',
      pekProgramId: '50',
      pekReportId: '51',
      pekControlItemId: '52',
      pekControlEventId: '53',
      monitoringPointId: '54',
      emissionSourceId: '55',
      waterOutletId: '56',
    });

    const request = mapWizardToCreateDraft(form) as unknown as Record<string, unknown>;

    expect(request).toMatchObject({ orderId: '30', orderServiceItemId: '40' });
    expect(request.pekContext).toEqual({
      pekProgramId: 50,
      pekReportId: 51,
      pekControlItemId: 52,
      pekControlEventId: 53,
      monitoringPointId: 54,
      emissionSourceId: 55,
      waterOutletId: 56,
    });
    expect(request).not.toHaveProperty('pekProgramId');
  });

  it('sends null instead of an empty PEK object', () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10' });
    expect(mapWizardToCreateDraft(form).pekContext).toBeNull();
  });

  it('creates a real server draft before any result exists', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10', objectId: '20' });
    const createProtocolDraft = async () => ({ id: 'draft-1', version: 0, status: 'DRAFT', results: [] }) as Protocol;
    const saveProtocolDraftResults = vi.fn(async () => ({ id: 'draft-1', version: 1, status: 'DRAFT', results: [] }) as Protocol);
    const service = { createProtocolDraft, saveProtocolDraftResults } as unknown as ProtocolService;

    const saved = await saveProtocolWizardDraft(form, null, 'protocol-draft-test-key', service);

    expect(saved.protocol).toMatchObject({ id: 'draft-1', version: 1, status: 'DRAFT' });
    expect(saveProtocolDraftResults).toHaveBeenCalledWith('draft-1', { version: 0, results: [] });
    expect([...saved.resultIdsByClientRowId]).toEqual([]);
  });
});

describe('protocol environment mapping', () => {
  it('restores environment.conditions, links and a zero result from GET', () => {
    const protocol = {
      id: '1', templateId: 'water', status: 'DRAFT', version: 2, protocolDate: '2026-08-06',
      environment: { temperature: '0', conditions: { waterType: 'DRINKING', workplaceType: 'PERMANENT' } },
      orderId: 'order-1', orderServiceItemId: 'item-2', results: [{ id: 'r1', values: { indicatorName: 'pH', value: 0, unit: 'ед.' } }],
      laboratory: {}, testing: {},
    } as unknown as Protocol;
    const form = mapProtocolToWizardForm(protocol);
    expect(form).toMatchObject({ temperature: '0', waterType: 'DRINKING', workplaceType: 'PERMANENT', orderId: 'order-1', orderServiceItemId: 'item-2' });
    expect(form.results[0].value).toBe('0');
  });

  it('restores sourceNumber and basis from the authoritative DTO', () => {
    const form = mapProtocolToWizardForm({
      id: '1', templateId: 'ambient_air', status: 'DRAFT', version: 2, protocolDate: '2026-08-06',
      sourceNumber: 'ИЗА-17', organization: { testingBasis: 'Договор №42' }, results: [], laboratory: {}, testing: {},
    } as unknown as Protocol);
    expect(form.sourceNumber).toBe('ИЗА-17');
    expect(form.basis).toBe('Договор №42');
  });

  it('round-trips every extended result field used by autosave and reopening', () => {
    const source = createWizardDefaults();
    source.templateId = 'soil';
    source.measurementPlace = 'Скважина 4';
    const row = {
      ...emptyWizardResult(), indicatorName: 'Свинец', pollutantCode: 'PB', value: '0', textValue: 'следы', unit: 'мг/кг',
      cas: '7439-92-1', formula: 'Pb', samplingPlace: 'Точка S-1', samplingDate: '2026-08-06',
      sampleNumber: 'S-17', samplingDepth: '1,5', samplingSpeed: '2.4', sampleVolume: '3.2', waterType: 'GROUND',
      direction: 'VERTICAL', minimumValue: '0.1', maximumValue: '0.4', averageValue: '0.25', duration: '30',
      measurementDeviceId: '7', normativeId: '9', normativeSource: 'DIRECTORY' as const, normativeStatus: 'ACTIVE' as const,
      normativeValue: '0.5', normativeValueRaw: '≤ 0.5', normativeMin: '0.1', normativeMax: '0.5',
      comparisonType: 'LESS_OR_EQUAL', normativeDocument: 'СанПиН', manualNormativeReason: '', sourceDocumentCode: 'SOIL-01',
      testingMethodNd: 'ГОСТ TEST', samplingMethodNd: 'ГОСТ SAMPLE', methodName: 'ААС', methodDocument: 'МВИ-7', note: 'Комментарий',
    };

    const request = mapWizardResultToDraftRequest(row, source, 0);
    const restored = mapProtocolToWizardForm({
      id: 'p-1', templateId: 'soil', status: 'DRAFT', version: 2, protocolDate: source.protocolDate,
      measurementPlace: source.measurementPlace, laboratory: {}, testing: {}, environment: {},
      results: [{ id: 'r-1', values: request.values, measurementDeviceId: request.measurementDeviceId, normativeReference: { id: 9, active: true } }],
    } as unknown as Protocol);

    expect(request.values).toMatchObject({
      resultValue: 0, cas: '7439-92-1', formula: 'Pb', samplingPlace: 'Точка S-1', sampleNumber: 'S-17',
      samplingDepth: 1.5, samplingSpeed: '2.4', sampleVolume: '3.2', minimumValue: 0.1, maximumValue: 0.4,
      averageValue: 0.25, duration: 30, testingMethodNd: 'ГОСТ TEST', samplingMethodNd: 'ГОСТ SAMPLE',
      methodName: 'ААС', methodDocument: 'МВИ-7', normativeDocument: 'СанПиН', sourceDocumentCode: 'SOIL-01',
    });
    expect(request.values).not.toHaveProperty('sampleName');
    expect(restored.results[0]).toMatchObject({
      value: '0', cas: '7439-92-1', formula: 'Pb', samplingPlace: 'Точка S-1', sampleNumber: 'S-17',
      samplingDepth: '1.5', samplingSpeed: '2.4', sampleVolume: '3.2', minimumValue: '0.1', maximumValue: '0.4',
      averageValue: '0.25', duration: '30', normativeId: '9', normativeSource: 'DIRECTORY', normativeStatus: 'ACTIVE',
      testingMethodNd: 'ГОСТ TEST', samplingMethodNd: 'ГОСТ SAMPLE', methodName: 'ААС', methodDocument: 'МВИ-7',
    });
  });

  it('maps SOIL sample fields to backend conditions as well as atomic result values', () => {
    const form = createWizardDefaults();
    form.templateId = 'soil';
    form.companyId = '10';
    form.measurementPlace = 'Полигон';
    form.results = [{ ...emptyWizardResult(), sampleNumber: 'S-2', samplingDepth: '0.75', samplingPlace: 'Шурф 2' }];
    expect(mapWizardToCreateDraft(form).environment?.conditions).toMatchObject({
      sampleNumber: 'S-2', samplingDepth: '0.75', samplingPlace: 'Шурф 2',
    });
    expect(mapWizardResultToDraftRequest(form.results[0], form, 0).values).toMatchObject({
      sampleNumber: 'S-2', samplingDepth: 0.75, samplingPlace: 'Шурф 2',
    });
  });
});

describe('result reconciliation', () => {
  it('saves all rows with one atomic draft-results request and reconciles clientRowId', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10' });
    const first = { ...emptyWizardResult(), clientRowId: 'client-a', indicatorName: 'A', pollutantCode: 'A', value: '1', unit: 'мг' };
    const second = { ...emptyWizardResult(), clientRowId: 'client-b', indicatorName: 'B', pollutantCode: 'B', value: '2', unit: 'мг' };
    form.results = [second, first];
    const saveProtocolDraftResults = vi.fn(async (_id, request: { version: number; results: Array<{ values: Record<string, unknown> }> }) => ({
      id: 'draft-1', version: 2, status: 'DRAFT', results: request.results.map((row) => ({
        id: row.values.clientRowId === 'client-b' ? 'server-b' : 'server-a', values: row.values,
      })),
    }) as Protocol);
    const service = {
      createProtocolDraft: vi.fn(async () => ({ id: 'draft-1', version: 1, status: 'DRAFT', results: [] }) as Protocol),
      saveProtocolDraftResults,
    } as unknown as ProtocolService;

    const saved = await saveProtocolWizardDraft(form, null, 'stable-key', service);

    expect(saveProtocolDraftResults).toHaveBeenCalledTimes(1);
    expect(saveProtocolDraftResults).toHaveBeenCalledWith('draft-1', expect.objectContaining({ version: 1 }));
    expect(saveProtocolDraftResults.mock.calls[0][1].results).toHaveLength(2);
    expect(saved.resultIdsByClientRowId.get('client-a')).toBe('server-a');
    expect(saved.resultIdsByClientRowId.get('client-b')).toBe('server-b');
  });

  it('maps all rows before creating a draft and never falls back to per-row mutations', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10' });
    form.results = [{ ...emptyWizardResult(), indicatorName: 'NO2', value: '1', unit: 'мг/м3', measurementDeviceId: 'invalid-id' }];
    const service = {
      createProtocolDraft: vi.fn(), updateProtocolDraft: vi.fn(), saveProtocolDraftResults: vi.fn(),
      addProtocolResult: vi.fn(), updateProtocolResult: vi.fn(), deleteProtocolResult: vi.fn(),
    } as unknown as ProtocolService;

    await expect(saveProtocolWizardDraft(form, null, 'stable-key', service)).rejects.toThrow();
    expect(service.createProtocolDraft).not.toHaveBeenCalled();
    expect(service.saveProtocolDraftResults).not.toHaveBeenCalled();
    expect(service.addProtocolResult).not.toHaveBeenCalled();
    expect(service.updateProtocolResult).not.toHaveBeenCalled();
    expect(service.deleteProtocolResult).not.toHaveBeenCalled();
  });

  it.each([400, 409])('keeps an atomic save failure (%s) intact and never retries rows separately', async (status) => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10' });
    form.results = [{ ...emptyWizardResult(), clientRowId: 'stable-row', indicatorName: 'NO2', pollutantCode: 'NO2', value: '1', unit: 'мг/м3' }];
    const failure = Object.assign(new Error(status === 409 ? 'Конфликт версии' : 'Ошибка валидации'), { response: { status } });
    const saveProtocolDraftResults = vi.fn(async () => { throw failure; });
    const service = {
      createProtocolDraft: vi.fn(async () => ({ id: 'draft-1', version: 3, status: 'DRAFT', results: [] }) as Protocol),
      saveProtocolDraftResults,
      addProtocolResult: vi.fn(), updateProtocolResult: vi.fn(), deleteProtocolResult: vi.fn(),
    } as unknown as ProtocolService;

    await expect(saveProtocolWizardDraft(form, null, 'same-idempotency-key', service)).rejects.toBe(failure);
    expect(saveProtocolDraftResults).toHaveBeenCalledTimes(1);
    expect(saveProtocolDraftResults).toHaveBeenCalledWith('draft-1', expect.objectContaining({
      version: 3,
      results: [expect.objectContaining({ values: expect.objectContaining({ clientRowId: 'stable-row', resultValue: 1 }) })],
    }));
    expect(service.addProtocolResult).not.toHaveBeenCalled();
    expect(service.updateProtocolResult).not.toHaveBeenCalled();
    expect(service.deleteProtocolResult).not.toHaveBeenCalled();
  });
});

describe('protocol wizard validation and backend errors', () => {
  it('keeps Continue enabled on results so validation details open on the Review step', () => {
    const wizard = readFileSync(resolve(process.cwd(), 'src/features/protocols/components/CreateProtocolWizardModalV2.tsx'), 'utf8');
    const results = readFileSync(resolve(process.cwd(), 'src/features/protocols/components/steps/ResultsStep.tsx'), 'utf8');
    const table = readFileSync(resolve(process.cwd(), 'src/features/protocols/components/components/ProtocolResultTable.tsx'), 'utf8');

    expect(wizard).toContain('canContinue={step === 2 ||');
    expect(wizard).toContain('if (step === 2)');
    expect(wizard).toContain('setStep(3)');
    expect(results).toContain('Для завершения заполните:');
    expect(table).toContain("rowIssue ? 'Нужно заполнить' : 'Заполнено'");
  });

  it('keeps additional result fields editable through autosave rerenders', () => {
    const details = readFileSync(resolve(process.cwd(), 'src/features/protocols/components/components/ProtocolResultDetails.tsx'), 'utf8');

    expect(details).toContain('register: registerField');
    expect(details).toContain("value: String(watch(field) ?? '')");
    expect(details).not.toMatch(/disabled=|readOnly/);
    for (const field of ['testingMethodNd', 'methodName', 'cas', 'formula', 'samplingSpeed', 'sampleVolume', 'sampleNumber', 'samplingDepth', 'samplingDate']) {
      expect(details).toContain(`results.\${index}.${field}`);
    }
  });

  it('maps a conditions error and a result row error to their actual steps and fields', () => {
    expect(mapProtocolApiErrorsToForm([
      { field: 'conditions.workplaceType', step: 'CONDITIONS', message: 'Укажите тип рабочего места' },
      { field: 'value', rowIndex: 2, step: 'RESULTS', message: 'Укажите результат' },
    ])).toEqual([
      expect.objectContaining({ field: 'workplaceType', step: 1 }),
      expect.objectContaining({ field: 'results.2.value', step: 2, rowIndex: 2 }),
    ]);
  });

  it('requires a soil sample number and a valid depth before review', () => {
    const form = createWizardDefaults();
    Object.assign(form, {
      templateId: 'soil', companyId: '1', objectId: '2', laboratoryId: '3', executorId: '4', measurementPlace: 'Точка 1',
    });
    form.results = [{ ...emptyWizardResult(), indicatorName: 'Свинец', value: '1', unit: 'мг/кг' }];

    const fields = validateForApproval(form).map((issue) => issue.field);

    expect(fields).toContain('results.0.sampleNumber');
    expect(fields).toContain('results.0.samplingDepth');
  });

  it('accepts row-level devices without a default device and keeps warnings non-blocking', () => {
    const form = createWizardDefaults();
    Object.assign(form, {
      templateId: 'ambient_air', companyId: '1', objectId: '2', laboratoryId: '3', executorId: '4', measurementPlace: 'Пост 1',
    });
    form.results = [{
      ...emptyWizardResult(), indicatorName: 'NO2', pollutantCode: 'NO2', value: '0.1', unit: 'мг/м3',
      measurementDeviceId: 'device-1', normativeSource: 'MANUAL', normativeValue: '0.2', manualNormativeReason: 'Нет норматива в справочнике',
    }];
    const issues = validateForApproval(form);
    expect(issues).not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'DEVICE_REQUIRED' })]));
    expect(issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'ENVIRONMENT_EMPTY', severity: 'WARNING' })]));
    expect(issues.filter((item) => item.severity === 'ERROR')).toEqual([]);
  });

  it.each(['ambient_air', 'workplace_air', 'soil', 'microclimate', 'lighting', 'noise_vibration', 'water', 'uv_emf_laser'] as const)(
    'allows completion of a backend-valid %s protocol',
    (templateId) => {
      const form = createWizardDefaults();
      Object.assign(form, {
        templateId, companyId: '1', objectId: '2', laboratoryId: '3', executorId: '4', measurementPlace: 'Точка 1',
      });
      if (templateId === 'water') Object.assign(form, { waterType: 'DRINKING_WATER', waterUseCategory: 'I' });
      const chemical = ['ambient_air', 'workplace_air', 'soil', 'water'].includes(templateId);
      form.results = [{
        ...emptyWizardResult(), indicatorName: 'Показатель', pollutantCode: chemical ? 'CODE' : '', factorType: chemical ? '' : 'FACTOR',
        value: '0', unit: 'ед.', measurementDeviceId: '7', normativeId: '9', normativeSource: 'DIRECTORY', normativeStatus: 'ACTIVE',
        sampleNumber: templateId === 'soil' || templateId === 'water' ? 'S-1' : '',
        samplingDepth: templateId === 'soil' ? '0.5' : '', samplingPlace: templateId === 'soil' || templateId === 'water' ? 'Точка 1' : '',
      }];
      expect(validateForApproval(form).filter((item) => item.severity === 'ERROR')).toEqual([]);
    },
  );

  it('blocks a manual normative without a reason', () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '1', objectId: '2', laboratoryId: '3', executorId: '4' });
    form.results = [{
      ...emptyWizardResult(), indicatorName: 'NO2', pollutantCode: 'NO2', value: '0.1', unit: 'мг/м3',
      measurementDeviceId: 'device-1', normativeSource: 'MANUAL', normativeValue: '0.2', manualNormativeReason: '',
    }];
    expect(validateForApproval(form)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'MANUAL_NORMATIVE_REASON_REQUIRED', field: 'results.0.manualNormativeReason' }),
    ]));
  });
});

describe('backend permissions authority', () => {
  const protocol = (permissions?: Protocol['permissions']) => ({ permissions }) as Protocol;

  it('does not infer edit or sign from status', () => {
    expect(hasProtocolPermission(protocol(), 'canEdit')).toBe(false);
    expect(hasProtocolPermission(protocol(), 'canSign')).toBe(false);
  });

  it('allows only explicitly returned actions and fails closed for an unknown status', () => {
    expect(hasProtocolPermission(protocol({ canEdit: true }), 'canEdit')).toBe(true);
    expect(hasProtocolPermission(protocol({ canEdit: true }), 'canSign')).toBe(false);
  });

  it('uses availableActions for completion, signing and download', () => {
    const item = { availableActions: ['COMPLETE', 'SIGN', 'DOWNLOAD_PDF'] } as Protocol;
    expect(hasProtocolAction(item, 'COMPLETE')).toBe(true);
    expect(hasProtocolAction(item, 'SIGN')).toBe(true);
    expect(hasProtocolAction(item, 'DOWNLOAD_PDF')).toBe(true);
    expect(hasProtocolAction({ availableActions: [] } as Protocol, 'SIGN')).toBe(false);
  });
});
