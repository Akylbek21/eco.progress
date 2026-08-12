import type { Protocol, ProtocolResultPayload, UpdateProtocolPayload } from '../../../types/protocols';
import type { CreateProtocolDraftRequest, UpdateProtocolDraftRequest } from '../api/protocolContracts';
import { mapFrontendProtocolType } from '../api/protocolTypeMapper';
import { mapMeasurementToRequest } from './mapProtocolWizardToRequest';
import { normalizeProtocolWizardForm, type ProtocolWizardForm, type ProtocolWizardResult } from '../components/wizardTypes';

const numericId = (value: string) => {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
};

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
  const hasPekContext = [
    form.pekProgramId, form.pekReportId, form.pekControlItemId, form.pekControlEventId,
    form.monitoringPointId, form.emissionSourceId, form.waterOutletId,
  ].some((value) => nullableNumber(value) !== null);
  const firstSample = form.results.find((row) => row.sampleNumber.trim() || row.samplingDepth.trim() || row.samplingPlace.trim());
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
      sampleNumber: form.templateId === 'soil' ? nullableText(firstSample?.sampleNumber || '') : null,
      samplingDepth: form.templateId === 'soil' ? nullableText(firstSample?.samplingDepth || '') : null,
      samplingPlace: nullableText(firstSample?.samplingPlace || form.measurementPlace),
      waterType: nullableText(form.waterType), waterUseCategory: nullableText(form.waterUseCategory),
      factorType: nullableText(form.results.find((row) => row.factorType)?.factorType || ''),
    },
  },
  pekContext: hasPekContext ? {
    pekProgramId: nullableNumber(form.pekProgramId),
    pekReportId: nullableNumber(form.pekReportId),
    pekControlItemId: nullableNumber(form.pekControlItemId),
    pekControlEventId: nullableNumber(form.pekControlEventId),
    monitoringPointId: nullableNumber(form.monitoringPointId),
    emissionSourceId: nullableNumber(form.emissionSourceId),
    waterOutletId: nullableNumber(form.waterOutletId),
  } : null,
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
  sampleNumber: form.templateId === 'soil' ? form.results[0]?.sampleNumber || undefined : undefined,
  samplingPlace: form.results[0]?.samplingPlace || form.measurementPlace || undefined,
  samplingDepth: form.templateId === 'soil' ? form.results[0]?.samplingDepth || undefined : undefined,
  sourceNumber: nullableText(form.sourceNumber) ?? undefined,
  basis: nullableText(form.basis) ?? undefined,
  formCode: form.formCode || undefined,
  appendixNumber: form.appendixNumber || undefined,
  laboratory: protocol.laboratory,
  organization: {
    ...protocol.organization,
    testingBasis: nullableText(form.basis) ?? '',
  },
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
    sampleNumber: form.templateId === 'soil' ? form.results[0]?.sampleNumber || null : null,
    samplingDepth: form.templateId === 'soil' ? form.results[0]?.samplingDepth || null : null,
    samplingPlace: form.results[0]?.samplingPlace || form.measurementPlace || null,
    factorType: form.results.find((row) => row.factorType)?.factorType || null,
  },
});

export const mapWizardResultToDraftRequest = (
  row: ProtocolWizardResult,
  form: ProtocolWizardForm,
  index: number,
): ProtocolResultPayload => {
  const measurement = mapMeasurementToRequest(row, form, index, false);
  const { sampleName: _legacySampleName, ...measurementValues } = measurement.values ?? {};
  return {
    normativeId: measurement.normativeId ?? null,
    measurementDeviceId: measurement.measurementDeviceId ?? numericId(form.defaultMeasurementDeviceId) ?? null,
    values: {
      indicatorName: measurement.indicatorName ?? null,
      pollutantCode: measurement.pollutantCode ?? null,
      factorType: measurement.factorType ?? null,
      factorCode: measurement.factorCode ?? null,
      resultValue: measurement.value ?? null,
      unit: measurement.unit ?? null,
      testingMethodNd: measurement.testingMethodNd ?? null,
      samplingMethodNd: measurement.samplingMethodNd ?? null,
      ...measurementValues,
      textValue: nullableText(row.textValue),
      cas: nullableText(row.cas),
      formula: nullableText(row.formula),
      measurementPlace: nullableText(row.samplingPlace || form.measurementPlace),
      samplingPlace: nullableText(row.samplingPlace || form.measurementPlace),
      samplingDate: nullableText(row.samplingDate || form.sampleDate),
      samplingSpeed: nullableText(row.samplingSpeed),
      sampleVolume: nullableText(row.sampleVolume),
      sampleNumber: nullableText(row.sampleNumber),
      samplingDepth: form.templateId === 'soil' ? nullableDecimal(row.samplingDepth) : null,
      waterType: nullableText(row.waterType || form.waterType),
      direction: nullableText(row.direction),
      minimumValue: nullableDecimal(row.minimumValue),
      maximumValue: nullableDecimal(row.maximumValue),
      averageValue: nullableDecimal(row.averageValue),
      duration: nullableDecimal(row.duration),
      normativeSource: row.normativeSource,
      normativeStatus: nullableText(row.normativeStatus),
      normativeValue: nullableDecimal(row.normativeValue),
      normativeValueRaw: nullableText(row.normativeValueRaw),
      normativeMin: nullableDecimal(row.normativeMin),
      normativeMax: nullableDecimal(row.normativeMax),
      comparisonType: nullableText(row.comparisonType),
      normativeDocument: nullableText(row.normativeDocument),
      manualNormativeReason: nullableText(row.manualNormativeReason),
      sourceDocumentCode: nullableText(row.sourceDocumentCode),
      methodName: nullableText(row.methodName),
      methodDocument: nullableText(row.methodDocument),
      note: nullableText(row.note),
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
    basis: protocol.organization?.testingBasis ?? protocol.testingBasis ?? '',
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
      clientRowId: textValue(row.values.clientRowId) || undefined,
      serverResultId: row.id, indicatorName: textValue(row.values.indicatorName ?? row.indicatorName),
      pollutantCode: textValue(row.values.pollutantCode ?? row.code), factorType: textValue(row.values.factorType),
      factorCode: textValue(row.values.factorCode), cas: textValue(row.values.cas ?? row.values.casNumber),
      formula: textValue(row.values.formula), unit: textValue(row.values.unit ?? row.unit),
      value: textValue(row.values.resultValue ?? row.resultValue ?? row.result ?? row.values.value),
      textValue: textValue(row.values.textValue), samplingPlace: textValue(row.values.samplingPlace ?? row.measurementPlace),
      samplingDate: textValue(row.values.samplingDate), sampleNumber: textValue(row.values.sampleNumber),
      samplingDepth: textValue(row.values.samplingDepth), measurementDeviceId: textValue(row.measurementDeviceId),
      samplingSpeed: textValue(row.values.samplingSpeed), sampleVolume: textValue(row.values.sampleVolume),
      waterType: textValue(row.values.waterType), direction: textValue(row.values.direction),
      minimumValue: textValue(row.values.minimumValue), maximumValue: textValue(row.values.maximumValue),
      averageValue: textValue(row.values.averageValue), duration: textValue(row.values.duration),
      normativeId: textValue(row.normativeReference?.id ?? row.values.normativeId),
      normativeSource: row.values.normativeSource === 'MANUAL' ? 'MANUAL' : row.normativeReference?.id || row.values.normativeId ? 'DIRECTORY' : 'NONE',
      normativeStatus: textValue(row.values.normativeStatus || (row.normativeReference?.active ? 'ACTIVE' : '')) as ProtocolWizardResult['normativeStatus'],
      normativeValue: textValue(row.values.normativeValue ?? row.normativeValue), normativeValueRaw: textValue(row.values.normativeValueRaw),
      normativeMin: textValue(row.values.normativeMin ?? row.normativeMin), normativeMax: textValue(row.values.normativeMax ?? row.normativeMax),
      comparisonType: textValue(row.values.comparisonType ?? row.comparisonType), normativeDocument: textValue(row.values.normativeDocument ?? row.normativeDocument),
      manualNormativeReason: textValue(row.values.manualNormativeReason), sourceDocumentCode: textValue(row.values.sourceDocumentCode),
      testingMethodNd: textValue(row.values.testingMethodNd ?? row.testingMethodNd), samplingMethodNd: textValue(row.values.samplingMethodNd ?? row.samplingMethodNd),
      methodName: textValue(row.values.methodName), methodDocument: textValue(row.values.methodDocument),
      note: textValue(row.values.note ?? row.comment),
    })),
  });
};
