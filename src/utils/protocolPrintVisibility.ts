import type { ProtocolPrintField, ProtocolPrintVisibility } from '../types/protocols';

export const PROTOCOL_PRINT_FIELDS: readonly ProtocolPrintField[] = [
  'organizationName',
  'organizationAddress',
  'objectName',
  'productName',
  'testingBasis',
  'protocolDate',
  'measurementDate',
  'measurementTime',
  'measurementPlace',
  'samplingDate',
  'testingStartDate',
  'testingEndDate',
  'productNormativeDocument',
  'samplingMethodDocument',
  'testingMethodDocument',
  'testingPurpose',
  'environmentConditions',
  'temperature',
  'humidity',
  'pressureKpa',
  'windSpeed',
  'formCode',
  'application',
  'sourceNumber',
  'executor',
  'approver',
  'explanatoryNote',
] as const;

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
      return {};
    }
  }
  if (!isRecord(value)) return {};
  return PROTOCOL_PRINT_FIELDS.reduce<ProtocolPrintVisibility>((result, field) => {
    const normalized = booleanValue(value[field]);
    if (normalized !== undefined) result[field] = normalized;
    return result;
  }, {});
};

export const isProtocolFieldVisible = (
  visibility: ProtocolPrintVisibility | undefined,
  field: ProtocolPrintField,
): boolean => visibility?.[field] !== false;

export const setProtocolFieldVisibility = (
  visibility: ProtocolPrintVisibility | undefined,
  field: ProtocolPrintField,
  visible: boolean,
): ProtocolPrintVisibility => ({ ...visibility, [field]: visible });

export const setProtocolFieldsVisibility = (
  visibility: ProtocolPrintVisibility | undefined,
  fields: readonly ProtocolPrintField[],
  visible: boolean,
): ProtocolPrintVisibility => fields.reduce(
  (result, field) => ({ ...result, [field]: visible }),
  { ...visibility },
);
