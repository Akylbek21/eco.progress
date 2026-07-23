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

const decimalOrNull = (value: unknown): string | null => {
  const text = optionalText(value);
  if (!text) return null;
  return text.replace(',', '.');
};

export const mapProtocolEnvironmentToRequest = (
  environment: UpdateProtocolPayload['environment'],
): ProtocolEnvironmentRequest => ({
  temperatureC: decimalOrNull(environment?.temperature),
  temperatureMinC: decimalOrNull(environment?.minTemperature),
  temperatureMaxC: decimalOrNull(environment?.maxTemperature),
  humidityPercent: decimalOrNull(environment?.humidity),
  humidityMinPercent: decimalOrNull(environment?.minHumidity),
  humidityMaxPercent: decimalOrNull(environment?.maxHumidity),
  pressureKpa: decimalOrNull(environment?.pressureKpa ?? environment?.pressure),
  windSpeedMs: decimalOrNull(environment?.windSpeed),
  conditionsComment: optionalText(environment?.comment),
  source: environment?.source || null,
  dataSource: optionalText(environment?.dataSource),
  observedAt: optionalText(environment?.observedAt),
  weatherObservedAt: optionalText(environment?.weatherObservedAt ?? environment?.observedAt),
  loadedAt: optionalText(environment?.loadedAt),
  manualChangeReason: optionalText(environment?.manualChangeReason),
});

export const mapProtocolFormToUpdateRequest = (
  payload: UpdateProtocolPayload,
): UpdateProtocolRequest => ({
  version: payload.version,
  protocolDate: payload.protocolDate,
  organization: {
    companyId: idOrNull(payload.companyId),
    objectId: idOrNull(payload.objectId),
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
  executor: {
    laboratoryEmployeeId: idOrNull(payload.executorId),
    fullName: optionalText(payload.executor),
  },
  testing: {
    measurementDate: optionalText(payload.measurementDate),
    measurementTime: optionalText(payload.measurementTime),
    measurementPlace: optionalText(payload.measurementPlace),
    sampleDate: optionalText(payload.sampleDate ?? payload.testing.samplingDate),
    sampleNumber: optionalText(payload.sampleNumber),
    samplingPlace: optionalText(payload.samplingPlace ?? payload.measurementPlace),
    samplingDepth: optionalText(payload.samplingDepth),
    testingStartDate: optionalText(payload.testing.testingStartDate),
    testingEndDate: optionalText(payload.testing.testingEndDate ?? payload.testing.testingDate),
    productNormativeDocument: optionalText(payload.testing.productNormativeDocument),
    samplingMethodDocument: optionalText(payload.testing.samplingMethodDocument),
    testingMethodDocument: optionalText(payload.testing.testingMethodDocument),
    purpose: optionalText(payload.testing.testingPurpose),
    environmentConditions: optionalText(payload.testing.environmentConditions),
  },
  environment: mapProtocolEnvironmentToRequest(payload.environment),
  testingMethodDocument: optionalText(payload.testingMethodDocument ?? payload.testing.testingMethodDocument),
  complianceDocument: optionalText(payload.complianceDocument),
  explanatoryNote: optionalText(payload.explanatoryNote ?? payload.notes),
  printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility),
});

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
