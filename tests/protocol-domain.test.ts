import { describe, expect, it } from 'vitest';
import { mapProtocolFormToUpdateRequest, mapProtocolResultFormToRequest, mapProtocolsQuery } from '../src/features/protocols/api/protocolMappers';
import { validateProtocol } from '../src/features/protocols/schemas/protocolSchema';
import { calculateCompliance } from '../src/features/protocols/utils/protocolCalculations';
import { PROTOCOL_TEMPLATES, isProtocolTemplateId } from '../src/features/protocols/utils/protocolTemplates';
import { mapBackendProtocolType, mapFrontendProtocolType } from '../src/features/protocols/api/protocolTypeMapper';
import { unwrapApiData } from '../src/services/apiHelpers';
import { isDeviceValidForDate } from '../src/utils/protocolDevices';
import { createWizardDefaults } from '../src/features/protocols/components/wizardTypes';
import { mapProtocolWizardToRequest } from '../src/features/protocols/mappers/mapProtocolWizardToRequest';

describe('protocol domain contract', () => {
  it('exposes all backend-supported templates including uv/emf/laser', () => {
    expect(Object.keys(PROTOCOL_TEMPLATES)).toEqual([
      'ambient_air', 'workplace_air', 'soil', 'microclimate', 'lighting', 'noise_vibration', 'water_wastewater', 'uv_emf_laser',
    ]);
    expect(isProtocolTemplateId('physical_factors')).toBe(false);
  });

  it('maps the water type only at the API boundary', () => {
    expect(mapBackendProtocolType('water')).toBe('water_wastewater');
    expect(mapFrontendProtocolType('water_wastewater')).toBe('water');
    expect(mapFrontendProtocolType('uv_emf_laser')).toBe('uv_emf_laser');
  });

  it('unwraps supported API envelopes and rejects empty contracts', () => {
    expect(unwrapApiData<{ id: number }>({ data: { data: { id: 7 } }, status: 200 })).toEqual({ id: 7 });
    expect(unwrapApiData<{ id: number }>({ data: { id: 8 } })).toEqual({ id: 8 });
    expect(() => unwrapApiData({ data: null, status: 200 })).toThrow(/пустой ответ/i);
  });

  it('rejects expired and inactive devices for the measurement date', () => {
    expect(isDeviceValidForDate({ status: 'ACTIVE', verificationValidUntil: '2026-08-20' }, '2026-07-22')).toBe(true);
    expect(isDeviceValidForDate({ status: 'VALID', verificationValidUntil: '2026-07-21' }, '2026-07-22')).toBe(false);
    expect(isDeviceValidForDate({ status: 'INACTIVE', verificationValidUntil: '2027-01-01' }, '2026-07-22')).toBe(false);
  });

  it('maps a water wizard draft to one compact quick-create request', () => {
    const form = createWizardDefaults();
    form.templateId = 'water_wastewater'; form.companyId = '15'; form.objectId = '38'; form.laboratoryId = '2'; form.executorId = '17'; form.measurementPlace = 'Точка отбора'; form.testingMethodNd = 'ГОСТ'; form.temperature = '20'; form.waterType = 'DRINKING_WATER'; form.waterUseCategory = 'I';
    form.results = [{ ...form.results[0], indicatorName: 'Хлориды', pollutantCode: 'CL', unit: 'мг/л', value: '12', measurementDeviceId: '5' }];
    const request = mapProtocolWizardToRequest(form);
    expect(request).toMatchObject({ templateId: 'water', companyId: 15, objectId: 38, laboratoryId: 2, executorId: 17, conditions: { temperature: '20', waterType: 'DRINKING_WATER', waterUseCategory: 'I' } });
    expect(request.measurements).toHaveLength(1);
    expect(request.measurements[0].methodDocument).toBe('ГОСТ');
    expect(request.environment).toMatchObject({ temperature: '20', source: 'MANUAL' });
  });

  it('maps PATCH to nested DTO and uses the laboratory employee id', () => {
    const request = mapProtocolFormToUpdateRequest({
      version: 4,
      number: 'P-1',
      protocolDate: '2026-07-22',
      companyId: 10,
      objectId: 11,
      laboratoryId: 20,
      executor: 'Иванов И.И.',
      executorId: 21,
      approver: '',
      organization: { organizationName: 'Компания', organizationAddress: 'Адрес', objectName: 'Цех', productName: 'Воздух', testingBasis: 'Договор' },
      laboratory: { laboratoryName: 'Лаборатория', laboratoryAddress: 'Адрес', accreditationNumber: 'KZ.01', accreditationValidUntil: '2027-01-01', director: '', laboratoryHead: '', executor: '' },
      testing: { productNormativeDocument: '', samplingMethodDocument: '', testingMethodDocument: 'ГОСТ', samplingDate: '2026-07-21', testingStartDate: '', testingEndDate: '', testingDate: '', testingPurpose: '', environmentConditions: '' },
      environment: { humidity: '50' },
    });
    expect(request.executor).toEqual({ laboratoryEmployeeId: 21, fullName: 'Иванов И.И.' });
    expect(request.organization.objectId).toBe(11);
    expect(request.testing.sampleDate).toBe('2026-07-21');
    expect(request).not.toHaveProperty('objectId');
    expect(request).not.toHaveProperty('executorId');
  });

  it('removes result aliases from values and keeps a single device id', () => {
    expect(mapProtocolResultFormToRequest({
      measurementDeviceId: 8,
      deviceId: 8,
      normativeId: 9,
      values: { indicator: 'NO2', unit: 'mg/m3', deviceId: 8, measurementDeviceId: 8, normativeId: 9 },
    })).toEqual({ values: { indicator: 'NO2', unit: 'mg/m3' }, measurementDeviceId: 8, normativeId: 9 });
  });

  it('omits empty query values', () => {
    expect(mapProtocolsQuery({ page: 0, size: 20, search: '', sort: undefined })).toEqual({ page: 0, size: 20 });
    expect(mapProtocolsQuery({ page: 0, size: 20, templateId: 'water_wastewater' })).toMatchObject({ templateId: 'water' });
  });

  it('validates identity, soil sample, unit, normative, device and humidity', () => {
    const errors = validateProtocol({
      templateId: 'soil', objectId: null, laboratoryId: null, executorId: null, sampleDate: '',
      environment: { humidity: 101 },
      results: [{ indicatorName: 'Lead', unit: '', measurementDeviceId: undefined }],
    });
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(['objectId', 'laboratoryId', 'executorId', 'sampleDate', 'environment.humidity', 'results.0.unit', 'results.0.normative', 'results.0.measurementDeviceId']));
  });

  it('does not compare values with different units', () => {
    expect(calculateCompliance({ result: 2, comparisonType: 'LESS_OR_EQUAL', normativeMax: 3, resultUnit: 'mg/l', normativeUnit: 'mg/m3' })).toBe('UNIT_MISMATCH');
    expect(calculateCompliance({ result: 2, comparisonType: 'LESS_OR_EQUAL', normativeMax: 3, resultUnit: 'mg/l', normativeUnit: 'mg/l' })).toBe('NORMAL');
  });
});
