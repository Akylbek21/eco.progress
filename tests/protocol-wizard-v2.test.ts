import { describe, expect, it } from 'vitest';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { mapWizardResultToDraftRequest, mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
import { saveProtocolWizardDraft } from '../src/features/protocols/api/saveProtocolWizardDraft';
import { mapProtocolApiErrorsToForm } from '../src/features/protocols/utils/protocolFormErrors';
import { protocolHasAction } from '../src/features/protocols/utils/protocolActions';
import { validateForApproval } from '../src/features/protocols/utils/protocolWizardValidation';
import type { Protocol } from '../src/types/protocols';
import type { ProtocolService } from '../src/services/protocolService';

describe('protocol wizard HTTP boundary', () => {
  it('preserves zero and confirmed type-specific values in a result request', () => {
    const form = createWizardDefaults();
    form.templateId = 'physical_factors';
    form.workplaceType = 'PERMANENT';
    const row = {
      ...emptyWizardResult(),
      indicatorName: 'Уровень фактора',
      value: '0',
      unit: 'дБ',
      factorType: 'NOISE',
    };

    const request = mapWizardResultToDraftRequest(row, form, 0);

    expect(request.values.value).toBe(0);
    expect(request.values.factorType).toBe('NOISE');
    expect(request.values.workplaceType).toBe('PERMANENT');
  });

  it('does not invent unsupported order and PEK fields in CreateProtocolRequest', () => {
    const form = createWizardDefaults();
    Object.assign(form, {
      templateId: 'ambient_air',
      companyId: '10',
      objectId: '20',
      orderId: '30',
      orderServiceItemId: '40',
      pekProgramId: '50',
      pekControlEventId: '60',
    });

    const request = mapWizardToCreateDraft(form) as unknown as Record<string, unknown>;

    expect(request).not.toHaveProperty('orderId');
    expect(request).not.toHaveProperty('orderServiceItemId');
    expect(request).not.toHaveProperty('pekProgramId');
    expect(request).not.toHaveProperty('pekControlEventId');
  });

  it('creates a real server draft before any result exists', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10', objectId: '20' });
    const createProtocol = async () => ({ id: 'draft-1', version: 0, status: 'DRAFT', results: [] }) as Protocol;
    const service = { createProtocol } as unknown as ProtocolService;

    const saved = await saveProtocolWizardDraft(form, null, service);

    expect(saved.protocol).toMatchObject({ id: 'draft-1', version: 0, status: 'DRAFT' });
    expect(saved.resultIds).toEqual([]);
  });
});

describe('protocol wizard validation and backend errors', () => {
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
});

describe('backend availableActions authority', () => {
  const protocol = (status: Protocol['status'], availableActions?: Protocol['availableActions']) => ({
    status,
    availableActions,
  }) as Protocol;

  it('does not infer edit or sign from status', () => {
    expect(protocolHasAction(protocol('DRAFT'), 'EDIT')).toBe(false);
    expect(protocolHasAction(protocol('READY_TO_SIGN'), 'SIGN')).toBe(false);
  });

  it('allows only explicitly returned actions and fails closed for an unknown status', () => {
    expect(protocolHasAction(protocol('DRAFT', ['EDIT']), 'EDIT')).toBe(true);
    expect(protocolHasAction(protocol('DRAFT', ['EDIT']), 'SIGN')).toBe(false);
    expect(protocolHasAction(protocol('UNKNOWN', ['EDIT']), 'EDIT')).toBe(false);
  });
});
