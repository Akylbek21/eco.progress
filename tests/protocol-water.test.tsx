import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import EnvironmentStep from '../src/features/protocols/components/steps/EnvironmentStep';
import {
  backendWizardIssues,
  resolveWizardStepByField,
  WATER_CONDITIONS_STEP_INDEX,
} from '../src/features/protocols/components/CreateProtocolWizardModal';
import { createWizardDefaults, type ProtocolWizardForm } from '../src/features/protocols/components/wizardTypes';
import { mapConditions } from '../src/features/protocols/mappers/mapProtocolWizardToRequest';
import { mapProtocolFormToUpdateRequest } from '../src/features/protocols/api/protocolMappers';
import { normalizeProtocol } from '../src/services/apiProtocolService';
import { getWaterTypeLabel, WATER_TYPE_OPTIONS, WATER_USE_CATEGORY_OPTIONS } from '../src/config/protocolWater';

const EnvironmentHarness = ({ templateId }: { templateId: ProtocolWizardForm['templateId'] }) => {
  const form = useForm<ProtocolWizardForm>({ defaultValues: { ...createWizardDefaults(), templateId } });
  return (
    <FormProvider {...form}>
      <EnvironmentStep weatherLoading={false} weatherMessage="" waterTypeOptions={WATER_TYPE_OPTIONS} waterUseCategoryOptions={WATER_USE_CATEGORY_OPTIONS} />
    </FormProvider>
  );
};

describe('water protocol wizard and editor contract', () => {
  it('shows two required water selectors only for a water protocol', () => {
    const water = renderToStaticMarkup(<EnvironmentHarness templateId="water_wastewater" />);
    expect(water).toContain('Характеристики воды');
    expect(water).toContain('Выберите тип воды');
    expect(water).toContain('Выберите категорию водопользования');
    expect(water).toContain('required=""');
    const air = renderToStaticMarkup(<EnvironmentHarness templateId="ambient_air" />);
    expect(air).not.toContain('Характеристики воды');
    expect(air).not.toContain('water-type-select');
  });

  it('keeps both values in defaults and a session draft round-trip', () => {
    const form = createWizardDefaults();
    expect(form.waterType).toBe('');
    expect(form.waterUseCategory).toBe('');
    form.waterType = 'DRINKING_WATER';
    form.waterUseCategory = 'I';
    const restored = JSON.parse(JSON.stringify({ step: 4, form })) as { form: ProtocolWizardForm };
    expect(restored.form).toMatchObject({ waterType: 'DRINKING_WATER', waterUseCategory: 'I' });
  });

  it('puts water characteristics in quick-create conditions and omits them for air', () => {
    const water = createWizardDefaults();
    water.templateId = 'water_wastewater';
    water.waterType = 'DRINKING_WATER';
    water.waterUseCategory = 'I';
    expect(mapConditions(water)).toMatchObject({ waterType: 'DRINKING_WATER', waterUseCategory: 'I' });
    const air = createWizardDefaults();
    air.templateId = 'ambient_air';
    expect(mapConditions(air).waterType).toBeUndefined();
    expect(mapConditions(air).waterUseCategory).toBeUndefined();
  });

  it('routes all backend water paths to conditions and hides raw keys', () => {
    for (const path of ['header.conditions.waterType', 'conditions.waterUseCategory', 'waterType', 'waterUseCategory']) {
      expect(resolveWizardStepByField(path)).toBe(WATER_CONDITIONS_STEP_INDEX);
    }
    const issues = backendWizardIssues({
      'header.conditions.waterType': 'Укажите тип воды (waterType)',
      'conditions.waterUseCategory': 'Укажите категорию (waterUseCategory)',
    });
    expect(issues.map((issue) => issue.message)).toEqual(['Выберите тип воды', 'Выберите категорию водопользования']);
    expect(issues.map((issue) => issue.field)).toEqual(['waterType', 'waterUseCategory']);
  });

  it('hydrates canonical GET conditions and maps the same PATCH path', () => {
    const normalized = normalizeProtocol({
      id: 1,
      templateId: 'water',
      conditions: { waterType: 'SURFACE_WATER', waterUseCategory: 'II' },
      testing: {},
      results: [],
    });
    expect(normalized).toMatchObject({
      templateId: 'water_wastewater',
      waterType: 'SURFACE_WATER',
      waterUseCategory: 'II',
      conditions: { waterType: 'SURFACE_WATER', waterUseCategory: 'II' },
    });
    const request = mapProtocolFormToUpdateRequest({
      version: 1,
      number: 'P-1',
      protocolDate: '2026-07-24',
      executor: '',
      approver: '',
      organization: { organizationName: '', organizationAddress: '', objectName: '', productName: '', testingBasis: '' },
      testing: { productNormativeDocument: '', samplingMethodDocument: '', testingMethodDocument: '', samplingDate: '', testingStartDate: '', testingEndDate: '', testingDate: '', testingPurpose: '', environmentConditions: '' },
      conditions: { waterType: 'SURFACE_WATER', waterUseCategory: 'II' },
    });
    expect(request.conditions).toEqual({ waterType: 'SURFACE_WATER', waterUseCategory: 'II' });
  });

  it('does not replace an unknown enum with the first option', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getWaterTypeLabel('NEW_BACKEND_VALUE')).toBe('Неизвестный тип воды');
    expect(warn).toHaveBeenCalledWith('[protocol] Unknown waterType', 'NEW_BACKEND_VALUE');
    warn.mockRestore();
  });
});
