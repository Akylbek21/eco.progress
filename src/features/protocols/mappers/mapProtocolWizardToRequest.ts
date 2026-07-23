import { PROTOCOL_TYPE_CONFIG, type ProtocolTypeKey } from '../../../data/protocolTypeConfig';
import type { ProtocolResultValue, QuickProtocolCreatePayload, QuickProtocolMeasurementPayload } from '../../../types/protocols';
import { mapFrontendProtocolType } from '../api/protocolTypeMapper';
import { CHEMICAL_TYPES, type ProtocolWizardForm, type ProtocolWizardResult } from '../components/wizardTypes';

const optional = (value: string) => value.trim() || null;
const optionalString = (value: string) => value.trim() || undefined;
const configKey = (templateId: string): ProtocolTypeKey => templateId === 'water_wastewater' ? 'water' : templateId as ProtocolTypeKey;
export const isNonEmptyResult = (row: ProtocolWizardResult) => Boolean(row.indicatorName.trim() || row.value.trim());

const mapResultToBackend = (row: ProtocolWizardResult, defaultTestingMethod: string): QuickProtocolMeasurementPayload => ({
  indicatorName: row.indicatorName.trim(),
  value: row.value.trim(),
  unit: row.unit.trim(),
  pollutantCode: optionalString(row.pollutantCode),
  factorType: optionalString(row.factorType),
  normativeId: optional(row.normativeId),
  sourceDocumentCode: optional(row.sourceDocumentCode),
  testingMethodNd: optionalString(row.testingMethodNd) || optionalString(defaultTestingMethod),
  measurementDeviceId: optional(row.measurementDeviceId),
  values: {
    cas: optional(row.cas), formula: optional(row.formula), samplingPlace: optional(row.samplingPlace), sampleNumber: optional(row.sampleNumber), samplingDepth: optional(row.samplingDepth),
    samplingSpeed: optional(row.samplingSpeed), sampleVolume: optional(row.sampleVolume), waterType: optional(row.waterType), direction: optional(row.direction),
    minimumValue: optional(row.minimumValue), maximumValue: optional(row.maximumValue), averageValue: optional(row.averageValue), duration: optional(row.duration),
  } as Record<string, ProtocolResultValue>,
});

export const mapConditions = (form: ProtocolWizardForm): Record<string, ProtocolResultValue> => {
  const values: Record<string, ProtocolResultValue> = {
    temperature: optional(form.temperature), humidity: optional(form.humidity), pressure: optional(form.pressure), windSpeed: optional(form.windSpeed),
    windDirection: optional(form.windDirection), weatherConditions: optional(form.weatherConditions), season: optional(form.season), workCategory: optional(form.workCategory),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null && value !== ''));
};

export function mapProtocolWizardToQuickCreateRequest(form: ProtocolWizardForm): QuickProtocolCreatePayload {
  if (!form.templateId) throw new Error('Выберите тип протокола.');
  const config = PROTOCOL_TYPE_CONFIG[configKey(form.templateId)];
  const measurements = form.results.filter(isNonEmptyResult).map((row) => mapResultToBackend(row, form.testingMethodNd));
  return {
    templateId: mapFrontendProtocolType(form.templateId) as QuickProtocolCreatePayload['templateId'],
    companyId: form.companyId, objectId: form.objectId, laboratoryId: form.laboratoryId, executorId: form.executorId,
    protocolDate: form.protocolDate, sampleDate: form.sampleDate || form.measurementDate, measurementDate: form.measurementDate,
    measurementTime: form.measurementTime || '', measurementPlace: form.measurementPlace.trim(),
    testingStartDate: optional(form.testingStartDate),
    testingEndDate: optional(form.testingEndDate),
    sourceNumber: optional(form.sourceNumber),
    orderId: optional(form.orderId),
    orderServiceItemId: optional(form.orderServiceItemId),
    sourceDocumentCode: config.sourceDocumentCode,
    docxTemplateCode: config.docxTemplateCode || undefined, normativeTemplateId: mapFrontendProtocolType(config.normativeTemplateId) as QuickProtocolCreatePayload['normativeTemplateId'],
    resultMode: CHEMICAL_TYPES.has(form.templateId) ? 'CHEMICAL' : 'PHYSICAL', defaultUnit: config.defaultUnit || undefined,
    conditions: mapConditions(form),
    environment: {
      temperature: optional(form.temperature) ?? undefined,
      humidity: optional(form.humidity) ?? undefined,
      pressureKpa: optional(form.pressure) ?? undefined,
      windSpeed: optional(form.windSpeed) ?? undefined,
      source: form.environmentSource,
      dataSource: optional(form.environmentDataSource) ?? undefined,
      observedAt: optional(form.environmentObservedAt) ?? undefined,
      manualChangeReason: optional(form.environmentManualChangeReason) ?? undefined,
    },
    measurements,
  };
}

/** @deprecated Use the canonical quick-create mapper. */
export const mapProtocolWizardToRequest = mapProtocolWizardToQuickCreateRequest;
