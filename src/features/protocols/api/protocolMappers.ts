import { normalizeProtocolPrintVisibility } from '../../../utils/protocolPrintVisibility';
import type {
  ProtocolListQuery,
  ProtocolResultPayload,
  ProtocolResultValue,
  UpdateProtocolPayload,
} from '../../../types/protocols';
import type {
  ProtocolEnvironmentRequest,
  ProtocolResultRequest,
  ProtocolsQueryRequest,
  UpdateProtocolRequest,
} from './protocolContracts';
import { mapFrontendProtocolType } from './protocolTypeMapper';

const optionalText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

const idOrNull = (value: unknown): string | number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  return optionalText(value);
};

const decimalOrNull = (value: unknown): number | null => {
  const text = optionalText(value);
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const mapProtocolEnvironmentToRequest = (
  environment: UpdateProtocolPayload['environment'],
  conditions: UpdateProtocolPayload['conditions'] = environment?.conditions ?? undefined,
): ProtocolEnvironmentRequest => ({
  temperatureC: decimalOrNull(environment?.temperature),
  temperatureMinC: decimalOrNull(environment?.minTemperature),
  temperatureMaxC: decimalOrNull(environment?.maxTemperature),
  humidityPercent: decimalOrNull(environment?.humidity),
  humidityMinPercent: decimalOrNull(environment?.minHumidity),
  humidityMaxPercent: decimalOrNull(environment?.maxHumidity),
  pressureKpa: decimalOrNull(environment?.pressureKpa ?? environment?.pressure),
  pressureHpa: decimalOrNull(environment?.pressureHpa),
  windSpeedMs: decimalOrNull(environment?.windSpeed),
  conditionsComment: optionalText(environment?.comment),
  source: environment?.source || null,
  dataSource: optionalText(environment?.dataSource),
  observedAt: optionalText(environment?.observedAt),
  loadedAt: optionalText(environment?.loadedAt),
  manualChangeReason: optionalText(environment?.manualChangeReason),
  conditions: conditions ? {
    season: optionalText(conditions.season),
    workCategory: optionalText(conditions.workCategory),
    roomType: optionalText(conditions.roomType),
    workplaceType: optionalText(conditions.workplaceType),
    lightingType: optionalText(conditions.lightingType),
    noiseType: optionalText(conditions.noiseType),
    visualWorkCategory: optionalText(conditions.visualWorkCategory),
    normLevel: optionalText(conditions.normLevel),
    sampleNumber: optionalText(conditions.sampleNumber),
    samplingDepth: optionalText(conditions.samplingDepth),
    samplingPlace: optionalText(conditions.samplingPlace),
    waterType: optionalText(conditions.waterType),
    waterUseCategory: optionalText(conditions.waterUseCategory),
    factorType: optionalText(conditions.factorType),
  } : null,
});

export const mapProtocolFormToPatchRequest = (
  payload: UpdateProtocolPayload,
  version = payload.version,
): UpdateProtocolRequest => ({
  version,
  number: optionalText(payload.number),
  protocolDate: payload.protocolDate,
  objectId: idOrNull(payload.objectId),
  executor: optionalText(payload.executor),
  laboratoryEmployeeId: idOrNull(payload.executorId),
  measurementDate: optionalText(payload.measurementDate),
  measurementTime: optionalText(payload.measurementTime),
  measurementPlace: optionalText(payload.measurementPlace),
  sourceNumber: optionalText(payload.sourceNumber),
  testingStartDate: optionalText(payload.testing.testingStartDate),
  testingEndDate: optionalText(payload.testing.testingEndDate ?? payload.testing.testingDate),
  formCode: optionalText(payload.formCode),
  appendixNumber: optionalText(payload.appendixNumber),
  organization: {
    organizationName: optionalText(payload.organization.organizationName),
    organizationAddress: optionalText(payload.organization.organizationAddress),
    objectName: optionalText(payload.organization.objectName),
    productName: optionalText(payload.organization.productName),
    testingBasis: optionalText(payload.organization.testingBasis),
  },
  laboratory: {
    laboratoryId: idOrNull(payload.laboratoryId ?? payload.laboratory?.laboratoryId ?? payload.laboratory?.id),
    laboratoryName: optionalText(payload.laboratory?.laboratoryName),
    laboratoryAddress: optionalText(payload.laboratory?.laboratoryAddress),
    accreditationNumber: optionalText(payload.laboratory?.accreditationNumber),
    accreditationValidUntil: optionalText(payload.laboratory?.accreditationValidUntil),
  },
  testing: {
    samplingDate: optionalText(payload.sampleDate ?? payload.testing.samplingDate),
    sampleNumber: optionalText(payload.sampleNumber),
    samplingPlace: optionalText(payload.samplingPlace ?? payload.measurementPlace),
    samplingDepth: optionalText(payload.samplingDepth),
    productNormativeDocument: optionalText(payload.testing.productNormativeDocument),
    samplingMethodDocument: optionalText(payload.testing.samplingMethodDocument),
    testingMethodDocument: optionalText(payload.testing.testingMethodDocument),
    testingPurpose: optionalText(payload.testing.testingPurpose),
    environmentConditions: optionalText(payload.testing.environmentConditions),
  },
  environment: mapProtocolEnvironmentToRequest(payload.environment, payload.conditions),
  testingMethodDocument: optionalText(payload.testingMethodDocument ?? payload.testing.testingMethodDocument),
  complianceDocument: optionalText(payload.complianceDocument),
  explanatoryNote: optionalText(payload.explanatoryNote ?? payload.notes),
  printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility),
  orderId: optionalText(payload.orderId),
  orderServiceItemId: optionalText(payload.orderServiceItemId),
});

/** @deprecated Use mapProtocolFormToPatchRequest(form, version). */
export const mapProtocolFormToUpdateRequest = mapProtocolFormToPatchRequest;

const legacyResultKeys = new Set(['deviceId', 'measurementDeviceId', 'normativeId']);

const normalizeResultValue = (value: ProtocolResultValue): ProtocolResultValue =>
  typeof value === 'string' && value.trim() === '' ? null : value;

export const mapProtocolResultFormToRequest = (payload: ProtocolResultPayload): ProtocolResultRequest => {
  const measurementDeviceId = idOrNull(
    payload.measurementDeviceId ?? payload.deviceId ?? payload.values.measurementDeviceId ?? payload.values.deviceId,
  );
  const normativeId = idOrNull(payload.normativeId ?? payload.values.normativeId);
  const values = Object.fromEntries(
    Object.entries(payload.values)
      .filter(([key]) => !legacyResultKeys.has(key))
      .map(([key, value]) => [key, normalizeResultValue(value)]),
  );

  return { values, measurementDeviceId, normativeId };
};

export const mapProtocolsQuery = (query: ProtocolListQuery): ProtocolsQueryRequest => Object.fromEntries(
  Object.entries({
    ...query,
    templateId: query.templateId ? mapFrontendProtocolType(query.templateId) : undefined,
  }).filter(([, value]) => value !== undefined && value !== null && value !== ''),
) as unknown as ProtocolsQueryRequest;
