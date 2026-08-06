import type { Protocol, ProtocolResultPayload, UpdateProtocolPayload } from '../../../types/protocols';
import type { CreateProtocolDraftRequest, UpdateProtocolDraftRequest } from '../api/protocolContracts';
import { mapFrontendProtocolType } from '../api/protocolTypeMapper';
import { mapMeasurementToRequest } from './mapProtocolWizardToRequest';
import { normalizeProtocolWizardForm, type ProtocolWizardForm, type ProtocolWizardResult } from '../components/wizardTypes';

const numericId = (value: string) => value ? Number(value) : undefined;

const nullableNumber = (value: string): number | null => {
  const parsed = Number(value);
  return value !== '' && Number.isFinite(parsed) ? parsed : null;
};

const nullableText = (value: string): string | null => value.trim() || null;
const nullableDecimal = (value: string): number | null => {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
};

export const mapWizardToCreateDraft = (form: ProtocolWizardForm): CreateProtocolDraftRequest => {
  const companyId = nullableNumber(form.companyId);
  if (companyId === null) throw new Error('Для создания серверного черновика выберите компанию.');
  return {
  templateId: mapFrontendProtocolType(form.templateId as Exclude<ProtocolWizardForm['templateId'], ''>),
  subtype: null,
  companyId,
  objectId: nullableNumber(form.objectId),
  protocolDate: form.protocolDate,
  measurementDate: nullableText(form.measurementDate),
  testingStartDate: nullableText(form.testingStartDate),
  testingEndDate: nullableText(form.testingEndDate),
  laboratoryId: nullableNumber(form.laboratoryId),
  executorId: nullableNumber(form.executorId),
  orderId: nullableText(form.orderId),
  orderServiceItemId: nullableText(form.orderServiceItemId),
  environment: {
    temperatureC: nullableDecimal(form.temperature), temperatureMinC: null, temperatureMaxC: null,
    humidityPercent: nullableDecimal(form.humidity), humidityMinPercent: null, humidityMaxPercent: null,
    pressureKpa: nullableDecimal(form.pressure), pressureHpa: null, windSpeedMs: nullableDecimal(form.windSpeed),
    conditionsComment: nullableText(form.weatherConditions),
    source: form.environmentSource,
    dataSource: nullableText(form.environmentDataSource), observedAt: nullableText(form.environmentObservedAt),
    loadedAt: null, manualChangeReason: nullableText(form.environmentManualChangeReason),
    conditions: {
      season: nullableText(form.season), workCategory: nullableText(form.workCategory),
      roomType: nullableText(form.roomType), workplaceType: nullableText(form.workplaceType),
      lightingType: nullableText(form.lightingType), noiseType: nullableText(form.noiseType),
      visualWorkCategory: nullableText(form.visualWorkCategory), normLevel: nullableText(form.normLevel),
      sampleNumber: null, samplingDepth: null, samplingPlace: nullableText(form.measurementPlace),
      waterType: nullableText(form.waterType), waterUseCategory: nullableText(form.waterUseCategory),
      factorType: nullableText(form.results.find((row) => row.factorType)?.factorType || ''),
    },
  },
  printVisibility: form.printVisibility,
  };
};

export const mapWizardToUpdateDraft = (form: ProtocolWizardForm, protocol: Protocol): UpdateProtocolDraftRequest => ({
  version: protocol.version,
  number: protocol.number || protocol.protocolNumber || '',
  protocolDate: form.protocolDate,
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
  orderId: form.orderId || undefined,
  orderServiceItemId: form.orderServiceItemId || undefined,
  conditions: {
    season: form.season || null, workCategory: form.workCategory || null,
    workplaceType: form.workplaceType || null, roomType: form.roomType || null,
    normLevel: form.normLevel || null, lightingType: form.lightingType || null,
    noiseType: form.noiseType || null, visualWorkCategory: form.visualWorkCategory || null,
    waterType: form.waterType || null, waterUseCategory: form.waterUseCategory || null,
    factorType: form.results.find((row) => row.factorType)?.factorType || null,
  },
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

const textValue = (value: unknown): string => value === null || value === undefined ? '' : String(value);

/** Restores the wizard from the authoritative GET response, including environment.conditions. */
export const mapProtocolToWizardForm = (protocol: Protocol): ProtocolWizardForm => {
  const conditions = protocol.environment?.conditions ?? protocol.conditions ?? {};
  return normalizeProtocolWizardForm({
    templateId: protocol.templateId,
    companyId: textValue(protocol.companyId), objectId: textValue(protocol.objectId),
    laboratoryId: textValue(protocol.laboratory?.laboratoryId ?? protocol.laboratory?.id),
    executorId: textValue(protocol.executorId ?? protocol.laboratory?.executorId),
    protocolDate: protocol.protocolDate, sampleDate: protocol.samplingDate ?? protocol.testing?.samplingDate,
    measurementDate: protocol.measurementDate, testingStartDate: protocol.testingStartDate ?? protocol.testing?.testingStartDate,
    testingEndDate: protocol.testingEndDate ?? protocol.testing?.testingEndDate,
    measurementTime: protocol.measurementTime, measurementPlace: protocol.measurementPlace,
    sourceNumber: protocol.sourceNumber,
    temperature: textValue(protocol.environment?.temperature), humidity: textValue(protocol.environment?.humidity),
    pressure: textValue(protocol.environment?.pressureKpa ?? protocol.environment?.pressure),
    windSpeed: textValue(protocol.environment?.windSpeed), environmentSource: protocol.environment?.source ?? 'MANUAL',
    environmentDataSource: protocol.environment?.dataSource, environmentObservedAt: protocol.environment?.observedAt,
    environmentManualChangeReason: protocol.environment?.manualChangeReason,
    season: textValue(conditions.season), workCategory: textValue(conditions.workCategory),
    workplaceType: textValue(conditions.workplaceType), roomType: textValue(conditions.roomType),
    normLevel: textValue(conditions.normLevel), lightingType: textValue(conditions.lightingType),
    noiseType: textValue(conditions.noiseType), visualWorkCategory: textValue(conditions.visualWorkCategory),
    waterType: textValue(conditions.waterType), waterUseCategory: textValue(conditions.waterUseCategory),
    testingMethodNd: protocol.testingMethodDocument ?? protocol.testing?.testingMethodDocument,
    samplingMethodNd: protocol.samplingMethodDocument ?? protocol.testing?.samplingMethodDocument,
    formCode: protocol.formCode, appendixNumber: protocol.appendixNumber,
    note: protocol.explanatoryNote, orderId: textValue(protocol.orderId), orderServiceItemId: textValue(protocol.orderServiceItemId),
    pekProgramId: textValue(protocol.pekProgramId), pekReportId: textValue(protocol.pekReportId),
    pekControlItemId: textValue(protocol.pekControlItemId), pekControlEventId: textValue(protocol.pekControlEventId),
    monitoringPointId: textValue(protocol.monitoringPointId), emissionSourceId: textValue(protocol.emissionSourceId),
    waterOutletId: textValue(protocol.waterOutletId), printVisibility: protocol.printVisibility,
    results: protocol.results.map((row) => ({
      serverResultId: row.id, indicatorName: textValue(row.values.indicatorName ?? row.indicatorName),
      pollutantCode: textValue(row.values.pollutantCode ?? row.code), factorType: textValue(row.values.factorType),
      factorCode: textValue(row.values.factorCode), cas: textValue(row.values.cas ?? row.values.casNumber),
      formula: textValue(row.values.formula), unit: textValue(row.values.unit ?? row.unit),
      value: textValue(row.values.value ?? row.values.resultValue ?? row.resultValue ?? row.result),
      textValue: textValue(row.values.textValue), samplingPlace: textValue(row.values.samplingPlace ?? row.measurementPlace),
      samplingDate: textValue(row.values.samplingDate), sampleNumber: textValue(row.values.sampleNumber),
      samplingDepth: textValue(row.values.samplingDepth), measurementDeviceId: textValue(row.measurementDeviceId),
      normativeId: textValue(row.values.normativeId), normativeValue: textValue(row.values.normativeValue ?? row.normativeValue),
      normativeMin: textValue(row.values.normativeMin ?? row.normativeMin), normativeMax: textValue(row.values.normativeMax ?? row.normativeMax),
      comparisonType: textValue(row.values.comparisonType ?? row.comparisonType), normativeDocument: textValue(row.values.normativeDocument ?? row.normativeDocument),
      testingMethodNd: textValue(row.values.testingMethodNd ?? row.testingMethodNd), samplingMethodNd: textValue(row.values.samplingMethodNd ?? row.samplingMethodNd),
      note: textValue(row.values.note ?? row.comment),
    })),
  });
};
