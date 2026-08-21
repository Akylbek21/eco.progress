import { isWaterProtocolType } from '../../../config/protocolWater';
import type {
  ProtocolWizardMeasurementRequest,
} from '../api/protocolContracts';
import type {
  MeasurementFormRow,
  ProtocolWizardForm,
  ProtocolWizardResult,
} from '../components/wizardTypes';

export class ProtocolWizardMappingError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ProtocolWizardMappingError';
  }
}

export function normalizeNullableText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

export function normalizeDecimal(
  value: string | number | null | undefined,
  fieldName = 'value',
): number | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  if (!normalized) return null;
  const result = Number(normalized);
  if (!Number.isFinite(result)) {
    throw new ProtocolWizardMappingError(fieldName, 'Укажите корректное числовое значение');
  }
  return result;
}

export function requirePositiveIntegerId(value: unknown, fieldName: string): number {
  if (
    value === null
    || value === undefined
    || value === ''
    || (typeof value === 'string' && !/^\d+$/.test(value.trim()))
  ) {
    throw new ProtocolWizardMappingError(fieldName, 'Выберите значение из справочника');
  }
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ProtocolWizardMappingError(fieldName, 'Выберите значение из справочника');
  }
  return id;
}

export function normalizeOptionalId(value: unknown, fieldName = 'id'): number | null {
  if (value === null || value === undefined || value === '') return null;
  return requirePositiveIntegerId(value, fieldName);
}

export function normalizePositiveId(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function toApiDate(value: unknown, field: string): string {
  const normalized = normalizeNullableText(value);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new ProtocolWizardMappingError(field, 'Укажите дату в формате ГГГГ-ММ-ДД');
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new ProtocolWizardMappingError(field, 'Укажите корректную дату');
  }
  return normalized;
}

const optionalApiDate = (value: unknown, field: string): string | undefined =>
  normalizeNullableText(value) ? toApiDate(value, field) : undefined;

const PROTOCOL_UNIT_ALIASES: Readonly<Record<string, string>> = {
  'мг/л': 'мг/дм³',
  'мг/дм3': 'мг/дм³',
  'мг/дм³': 'мг/дм³',
  'мг/м3': 'мг/м³',
  'мг/м³': 'мг/м³',
  'мкг/м3': 'мкг/м³',
  'мкг/м³': 'мкг/м³',
  'м/с': 'м/с',
  '°с': '°C',
  '°c': '°C',
  'град. c': '°C',
  'град. с': '°C',
};

export function normalizeProtocolUnit(value: unknown): string | null {
  const unit = normalizeNullableText(value);
  if (!unit) return null;
  return PROTOCOL_UNIT_ALIASES[unit.toLowerCase()] ?? unit;
}

const isNumericOnlyUnit = (value: string): boolean =>
  /^[-+]?\d+(?:[.,]\d+)?$/.test(value.replace(/\s+/g, ''));

const compactValues = <T extends Record<string, unknown>>(values: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) =>
      value !== null && value !== undefined && value !== ''),
  ) as Partial<T>;


export const isNonEmptyResult = (row: ProtocolWizardResult): boolean => {
  const value = row.value as unknown;
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  return Boolean(
    normalizeNullableText(row.indicatorName)
    || hasValue
    || normalizeNullableText(row.textValue)
    || normalizeNullableText(row.pollutantCode)
    || normalizeNullableText(row.factorCode)
    || normalizeNullableText(row.factorType),
  );
};

export function mapMeasurementToRequest(
  row: MeasurementFormRow,
  form: ProtocolWizardForm,
  index: number,
  strict: boolean,
): ProtocolWizardMeasurementRequest | Partial<ProtocolWizardMeasurementRequest> {
  const indicatorName = normalizeNullableText(row.indicatorName);
  if (strict && !indicatorName) {
    throw new ProtocolWizardMappingError(`results.${index}.indicatorName`, 'Укажите показатель');
  }

  const numericValue = normalizeDecimal(row.value, `results.${index}.value`);
  const textValue = normalizeNullableText(row.textValue);
  const value = numericValue ?? textValue;
  if (strict && value === null) {
    throw new ProtocolWizardMappingError(
      `results.${index}.value`,
      'Укажите числовой или текстовый результат',
    );
  }

  const unit = normalizeProtocolUnit(row.unit);
  if (strict && !unit) {
    throw new ProtocolWizardMappingError(`results.${index}.unit`, 'Укажите единицу измерения');
  }
  if (unit && isNumericOnlyUnit(unit)) {
    throw new ProtocolWizardMappingError(
      `results.${index}.unit`,
      'В поле единицы измерения указано нормативное значение',
    );
  }

  const chemical = ['ambient_air', 'workplace_air', 'soil', 'water'].includes(form.templateId);
  const pollutantCode = chemical ? normalizeNullableText(row.pollutantCode) : null;
  const factorType = chemical ? null : normalizeNullableText(row.factorType);
  const factorCode = chemical ? null : normalizeNullableText(row.factorCode);
  if (strict && chemical && !pollutantCode) {
    throw new ProtocolWizardMappingError(
      `results.${index}.pollutantCode`,
      'Укажите код показателя',
    );
  }
  if (strict && !chemical && !factorType) {
    throw new ProtocolWizardMappingError(
      `results.${index}.factorType`,
      'Выберите тип физического фактора',
    );
  }

  const rowRecord = row as MeasurementFormRow & { normativeRecordId?: unknown };
  const normativeId = normalizePositiveId(row.normativeId)
    ?? normalizePositiveId(rowRecord.normativeRecordId);
  const manualNormative = row.normativeSource === 'MANUAL';

  const measurementDeviceId = strict
    ? requirePositiveIntegerId(
        row.measurementDeviceId,
        `results.${index}.measurementDeviceId`,
      )
    : normalizeOptionalId(row.measurementDeviceId, `results.${index}.measurementDeviceId`);
  if (strict && !normalizeNullableText(row.clientRowId)) {
    throw new ProtocolWizardMappingError(
      `results.${index}.clientRowId`,
      'Не удалось определить строку результата. Добавьте её заново',
    );
  }

  const samplingPlace = normalizeNullableText(row.samplingPlace)
    || normalizeNullableText(form.measurementPlace);
  if (strict && (form.templateId === 'soil' || isWaterProtocolType(form.templateId)) && !samplingPlace) {
    throw new ProtocolWizardMappingError(
      `results.${index}.samplingPlace`,
      'Укажите место отбора пробы',
    );
  }

  return compactValues({
    indicatorName: indicatorName ?? undefined,
    pollutantCode: pollutantCode ?? undefined,
    factorType: factorType ?? undefined,
    factorCode: factorCode ?? undefined,
    value: value ?? undefined,
    unit: unit ?? undefined,
    measurementDeviceId: measurementDeviceId ?? undefined,
    normativeId,
    normativeValue: manualNormative
      ? normalizeDecimal(row.normativeValue, `results.${index}.normativeValue`) ?? undefined
      : undefined,
    testingMethodNd: normalizeNullableText(row.testingMethodNd || row.methodDocument || form.testingMethodNd) ?? undefined,
    samplingMethodNd: normalizeNullableText(row.samplingMethodNd || form.samplingMethodNd) ?? undefined,
    values: compactValues({
      samplingDate: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
        ? optionalApiDate(row.samplingDate || form.sampleDate, `results.${index}.samplingDate`)
        : undefined,
      samplingPlace: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
        ? samplingPlace ?? undefined
        : undefined,
      sampleName: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
        ? normalizeNullableText(row.sampleNumber) ?? undefined
        : undefined,
      samplingDepth: form.templateId === 'soil'
        ? normalizeNullableText(row.samplingDepth) ?? undefined
        : undefined,
      cas: normalizeNullableText(row.cas) ?? undefined,
      formula: normalizeNullableText(row.formula) ?? undefined,
      note: normalizeNullableText(row.note) ?? undefined,
      normativeSource: row.normativeSource,
      normativeMin: manualNormative ? normalizeDecimal(row.normativeMin, `results.${index}.normativeMin`) ?? undefined : undefined,
      normativeMax: manualNormative ? normalizeDecimal(row.normativeMax, `results.${index}.normativeMax`) ?? undefined : undefined,
      comparisonType: manualNormative ? normalizeNullableText(row.comparisonType) ?? undefined : undefined,
      normativeDocument: manualNormative ? normalizeNullableText(row.normativeDocument) ?? undefined : undefined,
      manualNormativeReason: manualNormative ? normalizeNullableText(row.manualNormativeReason) ?? undefined : undefined,
    }),
  }) as ProtocolWizardMeasurementRequest | Partial<ProtocolWizardMeasurementRequest>;
}
