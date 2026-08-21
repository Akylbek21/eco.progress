import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import EnvironmentStep from '../src/features/protocols/components/steps/EnvironmentStep';
import ProtocolResultRow from '../src/features/protocols/components/components/ProtocolResultRow';
import { createWizardDefaults, emptyWizardResult, type ProtocolWizardForm } from '../src/features/protocols/components/wizardTypes';
import { mapWizardToCreateDraft } from '../src/features/protocols/mappers/protocolWizardDraftMapper';
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

const DirectoryNormativeResultHarness = () => {
  const defaults = createWizardDefaults();
  defaults.templateId = 'noise_vibration';
  defaults.results = [{
    ...emptyWizardResult(),
    clientRowId: 'directory-row',
    normativeId: '12',
    normativeSource: 'DIRECTORY',
    indicatorName: 'Шум',
    factorType: 'NOISE',
    value: '1',
    unit: 'дБА',
    normativeValue: '80',
  }];
  const form = useForm<ProtocolWizardForm>({ defaultValues: defaults });
  return (
    <FormProvider {...form}>
      <ProtocolResultRow index={0} chemical={false} devices={[]} measurementDate="2026-08-14" laboratoryId="" invalidDevice={false} onRemove={() => undefined} />
    </FormProvider>
  );
};

describe('water protocol wizard and editor contract', () => {
  it('does not lock draft result fields after selecting a directory normative', () => {
    const markup = renderToStaticMarkup(<DirectoryNormativeResultHarness />);
    expect(markup).not.toContain('readonly=""');
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain('name="results.0.indicatorName"');
    expect(markup).toContain('name="results.0.factorType"');
    expect(markup).toContain('name="results.0.normativeValue"');
    expect(markup).toContain('name="results.0.minimumValue"');
    expect(markup).toContain('name="results.0.maximumValue"');
    expect(markup).toContain('name="results.0.averageValue"');
    expect(markup).toContain('name="results.0.duration"');
  });

  it('shows two required water selectors only for a water protocol', () => {
    const water = renderToStaticMarkup(<EnvironmentHarness templateId="water" />);
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

  it('puts water characteristics in the V2 draft environment and clears them for air', () => {
    const water = createWizardDefaults();
    water.templateId = 'water';
    water.waterType = 'DRINKING_WATER';
    water.waterUseCategory = 'I';
    water.companyId = '1';
    expect(mapWizardToCreateDraft(water).environment.conditions).toMatchObject({ waterType: 'DRINKING_WATER', waterUseCategory: 'I' });
    const air = createWizardDefaults();
    air.templateId = 'ambient_air';
    air.companyId = '1';
    expect(mapWizardToCreateDraft(air).environment.conditions.waterType).toBeNull();
    expect(mapWizardToCreateDraft(air).environment.conditions.waterUseCategory).toBeNull();
  });

  it('hydrates nested backend environment conditions and preserves them in PATCH', () => {
    const normalized = normalizeProtocol({
      id: 1,
      templateId: 'water',
      status: 'DRAFT',
      version: 1,
      environment: { conditions: { waterType: 'SURFACE_WATER', waterUseCategory: 'II' } },
      testing: {},
      results: [],
    });
    expect(normalized).toMatchObject({
      templateId: 'water',
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
    expect(request.environment?.conditions).toMatchObject({ waterType: 'SURFACE_WATER', waterUseCategory: 'II' });
  });

  it('does not replace an unknown enum with the first option', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getWaterTypeLabel('NEW_BACKEND_VALUE')).toBe('Неизвестный тип воды');
    expect(warn).toHaveBeenCalledWith('[protocol] Unknown waterType', 'NEW_BACKEND_VALUE');
    warn.mockRestore();
  });
});
