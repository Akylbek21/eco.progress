import { isWaterProtocolType } from '../../../config/protocolWater';
import { PROTOCOL_TYPE_CONFIG, type ProtocolTypeKey } from '../../../data/protocolTypeConfig';
import type { CompanyObject } from '../../../types/companies';
import type { ProtocolPrintVisibility, ProtocolTemplateId } from '../../../types/protocols';
import type {
  QuickCreateProtocolConditions,
  QuickCreateProtocolEnvironment,
  QuickCreateProtocolMeasurement,
  QuickCreateProtocolMethodology,
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

const configKey = (templateId: string): ProtocolTypeKey =>
  templateId === 'water_wastewater' ? 'water' : templateId as ProtocolTypeKey;

export const mapQuickCreateTemplateId = (
  templateId: ProtocolTemplateId | string,
): QuickCreateProtocolTemplateId => {
  const normalized = templateId === 'water_wastewater' ? 'water' : templateId;
  const supported: QuickCreateProtocolTemplateId[] = [
    'ambient_air',
    'workplace_air',
    'soil',
    'microclimate',
    'lighting',
    'noise_vibration',
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
    row.indicatorName.trim()
    || hasValue
    || row.textValue.trim()
    || row.pollutantCode.trim()
    || row.factorCode.trim()
    || row.factorType.trim(),
  );
};

const mapMethodology = (
  row: MeasurementFormRow,
  form: ProtocolWizardForm,
  strict: boolean,
  index: number,
): QuickCreateProtocolMethodology | undefined => {
  const methodologyCode = normalizeNullableText(
    row.testingMethodNd || row.methodDocument || form.testingMethodNd,
  );
  const methodologyName = normalizeNullableText(row.methodName || row.methodDocument);
  if (strict && !methodologyCode && !methodologyName) {
    throw new QuickCreateValidationError(
      `results.${index}.testingMethodNd`,
      'Укажите методику испытаний',
    );
  }
  if (!methodologyCode && !methodologyName) return undefined;
  return compactValues({
    methodologyCode: methodologyCode ?? undefined,
    methodologyName: methodologyName ?? undefined,
  }) as QuickCreateProtocolMethodology;
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
  const resultValue = numericValue ?? textValue;
  if (strict && resultValue === null) {
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

  const chemical = ['ambient_air', 'workplace_air', 'soil', 'water_wastewater'].includes(form.templateId);
  const indicatorCode = chemical ? normalizeNullableText(row.pollutantCode) : null;
  const physicalFactorCode = chemical
    ? null
    : normalizeNullableText(row.factorCode || row.factorType);
  if (strict && chemical && !indicatorCode) {
    throw new QuickCreateValidationError(
      `results.${index}.pollutantCode`,
      'Укажите код показателя',
    );
  }
  if (strict && !chemical && !physicalFactorCode) {
    throw new QuickCreateValidationError(
      `results.${index}.factorCode`,
      'Укажите код физического фактора',
    );
  }

  const measurementDeviceId = strict
    ? requirePositiveIntegerId(
        row.measurementDeviceId,
        `results.${index}.measurementDeviceId`,
      )
    : normalizeOptionalId(row.measurementDeviceId, `results.${index}.measurementDeviceId`);
  const clientRowId = normalizeNullableText(row.clientRowId);
  if (strict && !clientRowId) {
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
    clientRowId: clientRowId ?? undefined,
    indicatorName: indicatorName ?? undefined,
    indicatorCode: indicatorCode ?? undefined,
    physicalFactorCode: physicalFactorCode ?? undefined,
    resultValue: resultValue ?? undefined,
    unit: unit ?? undefined,
    measurementDeviceId: measurementDeviceId ?? undefined,
    normativeId: normalizeNullableText(row.normativeRecordId || row.normativeId) ?? undefined,
    normValue: normalizeDecimal(row.normativeValue, `results.${index}.normativeValue`) ?? undefined,
    samplingPlace: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
      ? samplingPlace ?? undefined
      : undefined,
    sampleNumber: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
      ? normalizeNullableText(row.sampleNumber) ?? undefined
      : undefined,
    samplingDepth: form.templateId === 'soil'
      ? normalizeDecimal(row.samplingDepth, `results.${index}.samplingDepth`) ?? undefined
      : undefined,
    samplingDate: (form.templateId === 'soil' || isWaterProtocolType(form.templateId))
      ? optionalApiDate(form.sampleDate, 'sampleDate')
      : undefined,
    methodology: mapMethodology(row, form, strict, index),
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

export const mapEnvironment = (form: ProtocolWizardForm): QuickCreateProtocolEnvironment => ({
  temperature: normalizeEnvironmentValue(form.temperature, 'environment.temperature', -100, 100),
  humidity: normalizeEnvironmentValue(form.humidity, 'environment.humidity', 0, 100),
  pressureKpa: normalizeEnvironmentValue(form.pressure, 'environment.pressureKpa', 20, 120),
  windSpeed: normalizeEnvironmentValue(form.windSpeed, 'environment.windSpeed', 0, 150),
  source: form.environmentSource === 'API' ? 'API' : 'MANUAL',
});

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
      ? normalizeDecimal(sample?.samplingDepth, 'results.0.samplingDepth') ?? undefined
      : undefined,
    samplingDate: soil || water ? optionalApiDate(form.sampleDate, 'sampleDate') : undefined,
    season: normalizeNullableText(form.season) ?? undefined,
    workCategory: normalizeNullableText(form.workCategory) ?? undefined,
    workplaceType: normalizeNullableText(form.workplaceType) ?? undefined,
    roomType: normalizeNullableText(form.roomType) ?? undefined,
    normLevel: normalizeNullableText(form.normLevel) ?? undefined,
    lightingType: normalizeNullableText(form.lightingType) ?? undefined,
    noiseType: normalizeNullableText(form.noiseType) ?? undefined,
    visualWorkCategory: normalizeNullableText(form.visualWorkCategory) ?? undefined,
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

  const measurementDate = strict
    ? toApiDate(form.measurementDate, 'measurementDate')
    : optionalApiDate(form.measurementDate, 'measurementDate') || '';
  const sampleDate = optionalApiDate(form.sampleDate, 'sampleDate');
  const testingStartDate = optionalApiDate(form.testingStartDate, 'testingStartDate');
  const testingEndDate = optionalApiDate(form.testingEndDate, 'testingEndDate');
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

  const config = PROTOCOL_TYPE_CONFIG[configKey(form.templateId)];
  const methodology = mapMethodology(rows[0] || ({} as MeasurementFormRow), form, strict, 0);
  const orderId = normalizeNullableText(form.orderId);

  const payload = compactValues({
    templateId,
    companyId,
    objectId,
    laboratoryId,
    executorId,
    measurementDate,
    measurementTime: measurementTime ?? undefined,
    measurementPlace: measurementPlace ?? '',
    defaultUnit: normalizeProtocolUnit(config?.defaultUnit) ?? undefined,
    measurements,
    environment: mapEnvironment(form),
    conditions: Object.keys(conditions).length ? conditions : undefined,
    methodology,
    printVisibility: mapPrintVisibilityToApi(form.printVisibility),
    orderId: orderId ?? undefined,
    orderServiceItemId: normalizeNullableText(form.orderServiceItemId) ?? undefined,
    pekProgramId: normalizeOptionalId(form.pekProgramId, 'pekProgramId') ?? undefined,
    pekControlItemId: normalizeOptionalId(form.pekControlItemId, 'pekControlItemId') ?? undefined,
    pekControlEventId: normalizeOptionalId(form.pekControlEventId, 'pekControlEventId') ?? undefined,
    pekReportId: normalizeOptionalId(form.pekReportId, 'pekReportId') ?? undefined,
    monitoringPointId: normalizeOptionalId(form.monitoringPointId, 'monitoringPointId') ?? undefined,
    emissionSourceId: normalizeOptionalId(form.emissionSourceId, 'emissionSourceId') ?? undefined,
    waterOutletId: normalizeOptionalId(form.waterOutletId, 'waterOutletId') ?? undefined,
  });

  return payload as QuickCreateProtocolRequest | QuickCreateProtocolDraftRequest;
}

export const mapProtocolWizardToQuickCreateRequest = buildQuickCreatePayload;

/** @deprecated Use buildQuickCreatePayload. */
export const mapProtocolWizardToRequest = buildQuickCreatePayload;
