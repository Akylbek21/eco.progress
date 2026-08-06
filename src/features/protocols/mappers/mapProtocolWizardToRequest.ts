import { isWaterProtocolType } from '../../../config/protocolWater';
import type { CompanyObject } from '../../../types/companies';
import type { ProtocolPrintVisibility, ProtocolTemplateId } from '../../../types/protocols';
import type {
  QuickCreateProtocolConditions,
  QuickCreateProtocolMeasurement,
  QuickCreateProtocolRequest,
  QuickCreateProtocolTemplateId,
} from '../api/protocolContracts';
import type {
  LaboratoryExecutorOption,
  MeasurementFormRow,
  ProtocolWizardForm,
  ProtocolWizardResult,
} from '../components/wizardTypes';

export interface ProtocolCreateContext {
  selectedObject?: CompanyObject;
  selectedExecutor?: LaboratoryExecutorOption;
  validateSelections?: boolean;
  validationMode?: 'draft' | 'submit';
}

export class PayloadValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

/** Backward-compatible name used by the current wizard error boundary. */
export class QuickCreateValidationError extends PayloadValidationError {
  constructor(field: string, message: string) {
    super(field, message);
    this.name = 'QuickCreateValidationError';
  }
}

export type QuickCreateProtocolDraftRequest = Omit<
  QuickCreateProtocolRequest,
  'objectId' | 'laboratoryId' | 'executorId' | 'measurementDate' | 'measurementPlace' | 'measurements'
> & {
  objectId: number | null;
  laboratoryId: number | null;
  executorId: number | null;
  measurementDate: string;
  measurementPlace: string;
  measurements: Array<Partial<QuickCreateProtocolMeasurement>>;
};

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
    throw new QuickCreateValidationError(fieldName, 'Укажите корректное числовое значение');
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
    throw new QuickCreateValidationError(fieldName, 'Выберите значение из справочника');
  }
  const id = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new QuickCreateValidationError(fieldName, 'Выберите значение из справочника');
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
    throw new QuickCreateValidationError(field, 'Укажите дату в формате ГГГГ-ММ-ДД');
  }
  const [year, month, day] = normalized.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new QuickCreateValidationError(field, 'Укажите корректную дату');
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


export const mapQuickCreateTemplateId = (
  templateId: ProtocolTemplateId | string,
): QuickCreateProtocolTemplateId => {
  const normalized = templateId;
  const supported: QuickCreateProtocolTemplateId[] = [
    'ambient_air',
    'workplace_air',
    'soil',
    'microclimate',
    'lighting',
    'noise_vibration',
    'uv_emf_laser',
    'water',
  ];
  if (!supported.includes(normalized as QuickCreateProtocolTemplateId)) {
    throw new QuickCreateValidationError(
      'templateId',
      normalized === 'physical_factors'
        ? 'Выберите конкретный тип физического фактора'
        : 'Выбранный тип протокола не поддерживается быстрым созданием',
    );
  }
  return normalized as QuickCreateProtocolTemplateId;
};

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
): QuickCreateProtocolMeasurement | Partial<QuickCreateProtocolMeasurement> {
  const indicatorName = normalizeNullableText(row.indicatorName);
  if (strict && !indicatorName) {
    throw new QuickCreateValidationError(`results.${index}.indicatorName`, 'Укажите показатель');
  }

  const numericValue = normalizeDecimal(row.value, `results.${index}.value`);
  const textValue = normalizeNullableText(row.textValue);
  const value = numericValue ?? textValue;
  if (strict && value === null) {
    throw new QuickCreateValidationError(
      `results.${index}.value`,
      'Укажите числовой или текстовый результат',
    );
  }

  const unit = normalizeProtocolUnit(row.unit);
  if (strict && !unit) {
    throw new QuickCreateValidationError(`results.${index}.unit`, 'Укажите единицу измерения');
  }
  if (unit && isNumericOnlyUnit(unit)) {
    throw new QuickCreateValidationError(
      `results.${index}.unit`,
      'В поле единицы измерения указано нормативное значение',
    );
  }

  const chemical = ['ambient_air', 'workplace_air', 'soil', 'water'].includes(form.templateId);
  const pollutantCode = chemical ? normalizeNullableText(row.pollutantCode) : null;
  const factorType = chemical ? null : normalizeNullableText(row.factorType);
  const factorCode = chemical ? null : normalizeNullableText(row.factorCode);
  if (strict && chemical && !pollutantCode) {
    throw new QuickCreateValidationError(
      `results.${index}.pollutantCode`,
      'Укажите код показателя',
    );
  }
  if (strict && !chemical && !factorType) {
    throw new QuickCreateValidationError(
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
    throw new QuickCreateValidationError(
      `results.${index}.clientRowId`,
      'Не удалось определить строку результата. Добавьте её заново',
    );
  }

  const samplingPlace = normalizeNullableText(row.samplingPlace)
    || normalizeNullableText(form.measurementPlace);
  if (strict && (form.templateId === 'soil' || isWaterProtocolType(form.templateId)) && !samplingPlace) {
    throw new QuickCreateValidationError(
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
    }),
  }) as QuickCreateProtocolMeasurement | Partial<QuickCreateProtocolMeasurement>;
}

const normalizeEnvironmentValue = (
  value: string,
  field: string,
  minimum: number,
  maximum: number,
): number | null => {
  const normalized = normalizeDecimal(value, field);
  if (normalized !== null && (normalized < minimum || normalized > maximum)) {
    throw new QuickCreateValidationError(
      field,
      `Значение должно быть от ${minimum} до ${maximum}`,
    );
  }
  return normalized;
};

export const mapConditions = (
  form: ProtocolWizardForm,
  rows = form.results.filter(isNonEmptyResult),
): QuickCreateProtocolConditions => {
  const sample = rows[0];
  const water = isWaterProtocolType(form.templateId);
  const soil = form.templateId === 'soil';
  return compactValues({
    waterType: water ? normalizeNullableText(form.waterType) ?? undefined : undefined,
    waterUseCategory: water
      ? normalizeNullableText(form.waterUseCategory) ?? undefined
      : undefined,
    sampleNumber: soil || water
      ? normalizeNullableText(sample?.sampleNumber) ?? undefined
      : undefined,
    samplingPlace: soil || water
      ? normalizeNullableText(sample?.samplingPlace || form.measurementPlace) ?? undefined
      : undefined,
    samplingDepth: soil
      ? normalizeNullableText(sample?.samplingDepth) ?? undefined
      : undefined,
    season: normalizeNullableText(form.season) ?? undefined,
    workCategory: normalizeNullableText(form.workCategory) ?? undefined,
    workplaceType: normalizeNullableText(form.workplaceType) ?? undefined,
    roomType: normalizeNullableText(form.roomType) ?? undefined,
    normLevel: normalizeNullableText(form.normLevel) ?? undefined,
    lightingType: normalizeNullableText(form.lightingType) ?? undefined,
    noiseType: normalizeNullableText(form.noiseType) ?? undefined,
    visualWorkCategory: normalizeNullableText(form.visualWorkCategory) ?? undefined,
    temperature: normalizeEnvironmentValue(form.temperature, 'conditions.temperature', -100, 100)?.toString(),
    humidity: normalizeEnvironmentValue(form.humidity, 'conditions.humidity', 0, 100)?.toString(),
    pressure: normalizeEnvironmentValue(form.pressure, 'conditions.pressure', 20, 120)?.toString(),
    windSpeed: normalizeEnvironmentValue(form.windSpeed, 'conditions.windSpeed', 0, 150)?.toString(),
    weatherSource: form.environmentSource || undefined,
    weatherDataSource: normalizeNullableText(form.environmentDataSource) ?? undefined,
    manualChangeReason: normalizeNullableText(form.environmentManualChangeReason) ?? undefined,
    weatherObservedAt: normalizeNullableText(form.environmentObservedAt) ?? undefined,
  }) as QuickCreateProtocolConditions;
};

export const mapPrintVisibilityToApi = (
  visibility: ProtocolPrintVisibility,
): ProtocolPrintVisibility => ({
  organizationName: Boolean(visibility.organizationName),
  organizationAddress: Boolean(visibility.organizationAddress),
  testObjectName: Boolean(visibility.testObjectName),
  productName: Boolean(visibility.productName),
  testBasis: Boolean(visibility.testBasis),
  samplingDate: Boolean(visibility.samplingDate),
  testStartDate: Boolean(visibility.testStartDate),
  testEndDate: Boolean(visibility.testEndDate),
  productNormativeDocument: Boolean(visibility.productNormativeDocument),
  samplingMethodDocument: Boolean(visibility.samplingMethodDocument),
  testMethodDocument: Boolean(visibility.testMethodDocument),
  testPurpose: Boolean(visibility.testPurpose),
  samplingPlace: Boolean(visibility.samplingPlace),
  measurementDate: Boolean(visibility.measurementDate),
  environmentalConditions: Boolean(visibility.environmentalConditions),
  temperature: Boolean(visibility.temperature),
  humidity: Boolean(visibility.humidity),
  pressure: Boolean(visibility.pressure),
  windSpeed: Boolean(visibility.windSpeed),
});

const validatePersistedObject = (
  selectedObject: CompanyObject | undefined,
  objectId: number,
  companyId: number,
): void => {
  if (!selectedObject) {
    throw new QuickCreateValidationError(
      'objectId',
      'Перед созданием протокола сохраните объект компании',
    );
  }
  if (
    selectedObject.virtual === true
    || selectedObject.isVirtual === true
    || selectedObject.persisted === false
  ) {
    throw new QuickCreateValidationError(
      'objectId',
      'Перед созданием протокола сохраните объект компании',
    );
  }
  if (
    requirePositiveIntegerId(selectedObject.id, 'objectId') !== objectId
    || (
      selectedObject.companyId
      && requirePositiveIntegerId(selectedObject.companyId, 'companyId') !== companyId
    )
  ) {
    throw new QuickCreateValidationError(
      'objectId',
      'Выберите объект выбранной компании',
    );
  }
};

const validateExecutor = (
  selectedExecutor: LaboratoryExecutorOption | undefined,
  executorId: number,
  laboratoryId: number,
): void => {
  if (!selectedExecutor) {
    throw new QuickCreateValidationError(
      'executorId',
      'Выберите исполнителя выбранной лаборатории',
    );
  }
  if (selectedExecutor.active === false) {
    throw new QuickCreateValidationError('executorId', 'Выбранный исполнитель неактивен');
  }
  if (
    selectedExecutor.executorId !== executorId
    || selectedExecutor.laboratoryId !== laboratoryId
  ) {
    throw new QuickCreateValidationError(
      'executorId',
      'Выберите исполнителя выбранной лаборатории',
    );
  }
};

export function buildQuickCreatePayload(
  form: ProtocolWizardForm,
  context: ProtocolCreateContext & { validationMode: 'draft' },
): QuickCreateProtocolDraftRequest;
export function buildQuickCreatePayload(
  form: ProtocolWizardForm,
  context?: ProtocolCreateContext,
): QuickCreateProtocolRequest;
export function buildQuickCreatePayload(
  form: ProtocolWizardForm,
  context: ProtocolCreateContext = {},
): QuickCreateProtocolRequest | QuickCreateProtocolDraftRequest {
  if (!form.templateId) {
    throw new QuickCreateValidationError('templateId', 'Выберите тип протокола');
  }
  const templateId = mapQuickCreateTemplateId(form.templateId);
  const companyId = requirePositiveIntegerId(form.companyId, 'companyId');
  const strict = context.validationMode !== 'draft';
  const objectId = strict
    ? requirePositiveIntegerId(form.objectId, 'objectId')
    : normalizeOptionalId(form.objectId, 'objectId');
  const laboratoryId = strict
    ? requirePositiveIntegerId(form.laboratoryId, 'laboratoryId')
    : normalizeOptionalId(form.laboratoryId, 'laboratoryId');
  const executorId = strict
    ? requirePositiveIntegerId(form.executorId, 'executorId')
    : normalizeOptionalId(form.executorId, 'executorId');

  if (
    strict
    && context.validateSelections
    && objectId !== null
  ) {
    validatePersistedObject(context.selectedObject, objectId, companyId);
  }
  if (
    strict
    && context.validateSelections
    && executorId !== null
    && laboratoryId !== null
  ) {
    validateExecutor(context.selectedExecutor, executorId, laboratoryId);
  }

  const protocolDate = strict
    ? toApiDate(form.protocolDate, 'protocolDate')
    : optionalApiDate(form.protocolDate, 'protocolDate') || '';
  const measurementDate = strict
    ? toApiDate(form.measurementDate, 'measurementDate')
    : optionalApiDate(form.measurementDate, 'measurementDate') || '';
  const sampleDate = strict
    ? toApiDate(form.sampleDate, 'sampleDate')
    : optionalApiDate(form.sampleDate, 'sampleDate') || '';
  const testingStartDate = strict
    ? toApiDate(form.testingStartDate, 'testingStartDate')
    : optionalApiDate(form.testingStartDate, 'testingStartDate') || '';
  const testingEndDate = strict
    ? toApiDate(form.testingEndDate, 'testingEndDate')
    : optionalApiDate(form.testingEndDate, 'testingEndDate') || '';
  if (testingStartDate && testingEndDate && testingEndDate < testingStartDate) {
    throw new QuickCreateValidationError(
      'testingEndDate',
      'Дата завершения испытаний не может быть раньше даты начала',
    );
  }
  if (sampleDate && measurementDate && measurementDate < sampleDate) {
    throw new QuickCreateValidationError(
      'measurementDate',
      'Дата измерения не может быть раньше даты отбора',
    );
  }
  const measurementTime = normalizeNullableText(form.measurementTime);
  if (
    strict
    && measurementTime
    && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(measurementTime)
  ) {
    throw new QuickCreateValidationError('measurementTime', 'Укажите корректное время измерения');
  }
  const measurementPlace = normalizeNullableText(form.measurementPlace);
  if (strict && !measurementPlace) {
    throw new QuickCreateValidationError('measurementPlace', 'Укажите место измерения');
  }
  const sourceNumber = normalizeNullableText(form.sourceNumber);

  const rows = form.results.filter(isNonEmptyResult);
  if (strict && rows.length === 0) {
    throw new QuickCreateValidationError('results', 'Добавьте хотя бы один результат');
  }
  const measurements = rows.map((row, index) =>
    mapMeasurementToRequest(row, form, index, strict),
  );

  const conditions = mapConditions(form, rows);
  if (strict && templateId === 'water') {
    if (!conditions.waterType) {
      throw new QuickCreateValidationError('waterType', 'Выберите тип воды');
    }
    if (!conditions.waterUseCategory) {
      throw new QuickCreateValidationError(
        'waterUseCategory',
        'Выберите категорию водопользования',
      );
    }
    if (!conditions.samplingPlace) {
      throw new QuickCreateValidationError(
        'results.0.samplingPlace',
        'Укажите место отбора воды',
      );
    }
  }

  const orderId = normalizeNullableText(form.orderId);

  const payload = compactValues({
    templateId,
    protocolDate,
    sampleDate,
    measurementDate,
    testingStartDate,
    testingEndDate,
    companyId,
    objectId,
    laboratoryId,
    executorId,
    measurementTime: measurementTime ?? undefined,
    measurementPlace: measurementPlace ?? '',
    sourceNumber: sourceNumber ?? '',
    measurements,
    conditions: Object.keys(conditions).length ? conditions : undefined,
    printVisibility: mapPrintVisibilityToApi(form.printVisibility),
    orderId: orderId ?? undefined,
  });

  return payload as QuickCreateProtocolRequest | QuickCreateProtocolDraftRequest;
}

export const mapProtocolWizardToQuickCreateRequest = buildQuickCreatePayload;

/** @deprecated Use buildQuickCreatePayload. */
export const mapProtocolWizardToRequest = buildQuickCreatePayload;
