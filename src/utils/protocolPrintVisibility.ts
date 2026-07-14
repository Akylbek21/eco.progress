import type { ProtocolPrintField, ProtocolPrintVisibility } from '../types/protocols';

export const PROTOCOL_PRINT_FIELDS: readonly ProtocolPrintField[] = [
  'organizationName',
  'organizationAddress',
  'testObjectName',
  'productName',
  'testBasis',
  'samplingDate',
  'testStartDate',
  'testEndDate',
  'productNormativeDocument',
  'samplingMethodDocument',
  'testMethodDocument',
  'testPurpose',
  'samplingPlace',
  'measurementDate',
  'environmentalConditions',
  'temperature',
  'humidity',
  'pressure',
  'windSpeed',
] as const;

export const DEFAULT_PROTOCOL_PRINT_VISIBILITY: ProtocolPrintVisibility = {
  organizationName: true,
  organizationAddress: true,
  testObjectName: true,
  productName: true,
  testBasis: true,
  samplingDate: true,
  testStartDate: true,
  testEndDate: true,
  productNormativeDocument: true,
  samplingMethodDocument: true,
  testMethodDocument: true,
  testPurpose: true,
  samplingPlace: true,
  measurementDate: true,
  environmentalConditions: true,
  temperature: true,
  humidity: true,
  pressure: true,
  windSpeed: true,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const booleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return undefined;
};

export const normalizeProtocolPrintVisibility = (value: unknown): ProtocolPrintVisibility => {
  if (typeof value === 'string' && value.trim()) {
    try {
      return normalizeProtocolPrintVisibility(JSON.parse(value));
    } catch {
      return { ...DEFAULT_PROTOCOL_PRINT_VISIBILITY };
    }
  }
  if (!isRecord(value)) return { ...DEFAULT_PROTOCOL_PRINT_VISIBILITY };
  return PROTOCOL_PRINT_FIELDS.reduce<ProtocolPrintVisibility>((result, field) => {
    const normalized = booleanValue(value[field]);
    result[field] = normalized ?? true;
    return result;
  }, { ...DEFAULT_PROTOCOL_PRINT_VISIBILITY });
};

export const isProtocolFieldVisible = (
  visibility: ProtocolPrintVisibility | undefined,
  field: ProtocolPrintField,
): boolean => normalizeProtocolPrintVisibility(visibility)[field];

export const setProtocolFieldVisibility = (
  visibility: ProtocolPrintVisibility | undefined,
  field: ProtocolPrintField,
  visible: boolean,
): ProtocolPrintVisibility => ({ ...normalizeProtocolPrintVisibility(visibility), [field]: visible });

export const setProtocolFieldsVisibility = (
  visibility: ProtocolPrintVisibility | undefined,
  fields: readonly ProtocolPrintField[],
  visible: boolean,
): ProtocolPrintVisibility => fields.reduce(
  (result, field) => ({ ...result, [field]: visible }),
  normalizeProtocolPrintVisibility(visibility),
);
