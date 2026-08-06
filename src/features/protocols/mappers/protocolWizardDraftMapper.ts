import type { CreateProtocolPayload, Protocol, ProtocolResultPayload, UpdateProtocolPayload } from '../../../types/protocols';
import { mapMeasurementToRequest } from './mapProtocolWizardToRequest';
import type { ProtocolWizardForm, ProtocolWizardResult } from '../components/wizardTypes';

const numericId = (value: string) => value ? Number(value) : undefined;

export const mapWizardToCreateDraft = (form: ProtocolWizardForm): CreateProtocolPayload => ({
  templateId: form.templateId as CreateProtocolPayload['templateId'],
  companyId: form.companyId,
  objectId: form.objectId,
  protocolDate: form.protocolDate,
  sampleDate: form.sampleDate || undefined,
  testingStartDate: form.testingStartDate || undefined,
  testingEndDate: form.testingEndDate || undefined,
  testingBasis: form.basis || undefined,
  testingMethodDocument: form.testingMethodNd || undefined,
  samplingMethodDocument: form.samplingMethodNd || undefined,
  measurementDate: form.measurementDate || undefined,
  measurementTime: form.measurementTime || undefined,
  measurementPlace: form.measurementPlace || undefined,
  sourceNumber: form.sourceNumber || undefined,
  formCode: form.formCode || undefined,
  appendixNumber: form.appendixNumber || undefined,
  laboratoryId: form.laboratoryId || undefined,
  executorId: form.executorId || undefined,
  environment: {
    temperature: form.temperature || undefined,
    humidity: form.humidity || undefined,
    pressure: form.pressure || undefined,
    windSpeed: form.windSpeed || undefined,
    source: form.environmentSource,
    dataSource: form.environmentDataSource || undefined,
    observedAt: form.environmentObservedAt || undefined,
    manualChangeReason: form.environmentManualChangeReason || undefined,
  },
  printVisibility: form.printVisibility,
});

export const mapWizardToUpdateDraft = (form: ProtocolWizardForm, protocol: Protocol): UpdateProtocolPayload => ({
  version: protocol.version,
  number: protocol.number || protocol.protocolNumber || '',
  protocolDate: form.protocolDate,
  companyId: numericId(form.companyId),
  objectId: numericId(form.objectId),
  laboratoryId: numericId(form.laboratoryId),
  executorId: form.executorId || undefined,
  executor: protocol.executor || protocol.laboratory.executor || '',
  approver: protocol.approver || '',
  measurementDate: form.measurementDate || undefined,
  measurementTime: form.measurementTime || undefined,
  measurementPlace: form.measurementPlace || undefined,
  sampleDate: form.sampleDate || undefined,
  sourceNumber: form.sourceNumber || undefined,
  basis: form.basis || undefined,
  formCode: form.formCode || undefined,
  appendixNumber: form.appendixNumber || undefined,
  laboratory: protocol.laboratory,
  organization: protocol.organization,
  testing: {
    ...protocol.testing,
    samplingDate: form.sampleDate || protocol.testing.samplingDate,
    testingStartDate: form.testingStartDate || protocol.testing.testingStartDate,
    testingEndDate: form.testingEndDate || protocol.testing.testingEndDate,
    testingMethodDocument: form.testingMethodNd || protocol.testing.testingMethodDocument,
    samplingMethodDocument: form.samplingMethodNd || protocol.testing.samplingMethodDocument,
  },
  environment: {
    ...protocol.environment,
    temperature: form.temperature || undefined,
    humidity: form.humidity || undefined,
    pressure: form.pressure || undefined,
    windSpeed: form.windSpeed || undefined,
    source: form.environmentSource,
    dataSource: form.environmentDataSource || undefined,
    observedAt: form.environmentObservedAt || undefined,
    manualChangeReason: form.environmentManualChangeReason || undefined,
  },
  testingMethodDocument: form.testingMethodNd || undefined,
  notes: form.note || undefined,
  printVisibility: form.printVisibility,
});

export const mapWizardResultToDraftRequest = (
  row: ProtocolWizardResult,
  form: ProtocolWizardForm,
  index: number,
): ProtocolResultPayload => {
  const measurement = mapMeasurementToRequest(row, form, index, false);
  return {
    normativeId: measurement.normativeId ?? null,
    measurementDeviceId: measurement.measurementDeviceId ?? null,
    values: {
      indicatorName: measurement.indicatorName ?? null,
      pollutantCode: measurement.pollutantCode ?? null,
      factorType: measurement.factorType ?? null,
      factorCode: measurement.factorCode ?? null,
      value: measurement.value ?? null,
      unit: measurement.unit ?? null,
      testingMethodNd: measurement.testingMethodNd ?? null,
      samplingMethodNd: measurement.samplingMethodNd ?? null,
      ...measurement.values,
      workplaceType: form.workplaceType || null,
      roomType: form.roomType || null,
      season: form.season || null,
      workCategory: form.workCategory || null,
      lightingType: form.lightingType || null,
      noiseType: form.noiseType || null,
      visualWorkCategory: form.visualWorkCategory || null,
      normLevel: form.normLevel || null,
    },
  };
};
