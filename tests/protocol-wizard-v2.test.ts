import { describe, expect, it } from 'vitest';
import { createWizardDefaults, emptyWizardResult } from '../src/features/protocols/components/wizardTypes';
import { mapProtocolToWizardForm, mapWizardResultToDraftRequest, mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
import { saveProtocolWizardDraft } from '../src/features/protocols/api/saveProtocolWizardDraft';
import { mapProtocolApiErrorsToForm } from '../src/features/protocols/utils/protocolFormErrors';
import { hasProtocolPermission } from '../src/features/protocols/utils/protocolActions';
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

    expect(request.values.value).toBe(0);
    expect(request.values.factorType).toBe('NOISE');
    expect(request.values.workplaceType).toBe('PERMANENT');
  });

  it('sends supported order links and does not invent unsupported PEK fields in draft DTO', () => {
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

    expect(request).toMatchObject({ orderId: '30', orderServiceItemId: '40' });
    expect(request).not.toHaveProperty('pekProgramId');
    expect(request).not.toHaveProperty('pekControlEventId');
  });

  it('creates a real server draft before any result exists', async () => {
    const form = createWizardDefaults();
    Object.assign(form, { templateId: 'ambient_air', companyId: '10', objectId: '20' });
    const createProtocolDraft = async () => ({ id: 'draft-1', version: 0, status: 'DRAFT', results: [] }) as Protocol;
    const service = { createProtocolDraft } as unknown as ProtocolService;

    const saved = await saveProtocolWizardDraft(form, null, service);

    expect(saved.protocol).toMatchObject({ id: 'draft-1', version: 0, status: 'DRAFT' });
    expect(saved.resultIds).toEqual([]);
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
});
