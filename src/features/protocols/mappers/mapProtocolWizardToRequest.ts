import { isWaterProtocolType } from '../../../config/protocolWater';
import { PROTOCOL_TYPE_CONFIG, type ProtocolTypeKey } from '../../../data/protocolTypeConfig';
import type { CompanyObject } from '../../../types/companies';
import type {
  EntityId,
  ProtocolPrintVisibility,
  QuickCreateComparisonType,
  QuickCreateConditions,
  QuickCreateMeasurement,
} from '../../../types/protocols';
import type { QuickCreateProtocolApiRequest } from '../api/protocolContracts';
import { mapFrontendProtocolType } from '../api/protocolTypeMapper';
import type {
  LaboratoryExecutorOption,
  MeasurementFormRow,
  ProtocolWizardForm,
  ProtocolWizardResult,
} from '../components/wizardTypes';
import { PROTOCOL_TEMPLATES } from '../utils/protocolTemplates';

export interface ProtocolCreateContext {
  selectedObject?: CompanyObject;
  selectedExecutor?: LaboratoryExecutorOption;
  validateSelections?: boolean;
  validationMode?: 'draft' | 'submit';
}

export class QuickCreateValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = 'QuickCreateValidationError';
  }
}

export function normalizeNullableText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return value == null ? null : String(value).trim() || null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeDecimal(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/\s+/g, '').replace(',', '.');
  return normalized === '' ? null : normalized;
}

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

export function normalizeOptionalId(value: unknown, field = 'id'): EntityId | null {
  if (value === null || value === undefined || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new QuickCreateValidationError(field, 'Выберите значение из справочника');
  }
  return id;
}

const normalizeRequiredId = (value: unknown, field: string, message: string): EntityId => {
  const id = normalizeOptionalId(value, field);
  if (id === null) throw new QuickCreateValidationError(field, message);
  return id;
};

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

const optionalApiDate = (value: unknown, field: string): string | null => {
  if (!normalizeNullableText(value)) return null;
  return toApiDate(value, field);
};

const comparisonMap: Record<string, QuickCreateComparisonType | null> = {
  LE: 'LE',
  LESS_OR_EQUAL: 'LE',
  LT: 'LT',
  LESS_THAN: 'LT',
  GE: 'GE',
  GREATER_OR_EQUAL: 'GE',
  GT: 'GT',
  GREATER_THAN: 'GT',
  EQ: 'EQ',
  EQUAL: 'EQ',
  RANGE: 'RANGE',
  ABSENT: null,
  INFO: null,
};

const normalizeComparisonType = (value: unknown): QuickCreateComparisonType | null => {
  const key = normalizeNullableText(value)?.toUpperCase();
  return key ? comparisonMap[key] ?? null : null;
};

const isNumericOnlyUnit = (value: string): boolean =>
  /^[-+]?\d+(?:[.,]\d+)?$/.test(value.replace(/\s+/g, ''));

const compactValues = (values: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) =>
      value !== null && value !== undefined && value !== ''),
  );

type MeasurementDefaults = {
  testingMethodNd?: string | null;
  samplingMethodNd?: string | null;
};

export function mapMeasurementToRequest(
  row: MeasurementFormRow,
  defaultUnit?: string | null,
  index = 0,
  defaults: MeasurementDefaults = {},
): QuickCreateMeasurement {
  const indicatorName = normalizeNullableText(row.indicatorName);
  if (!indicatorName) {
    throw new QuickCreateValidationError(`results.${index}.indicatorName`, 'Укажите показатель');
  }

  const apiValue = normalizeDecimal(row.value) ?? normalizeNullableText(row.textValue);
  if (apiValue === null) {
    throw new QuickCreateValidationError(`results.${index}.value`, 'Укажите числовой или текстовый результат');
  }

  const unit = normalizeProtocolUnit(row.unit) ?? normalizeProtocolUnit(defaultUnit);
  if (!unit) {
    throw new QuickCreateValidationError(`results.${index}.unit`, 'Укажите единицу измерения');
  }
  if (isNumericOnlyUnit(unit)) {
    throw new QuickCreateValidationError(
      `results.${index}.unit`,
      'В поле единицы измерения указано числовое значение',
    );
  }

  const normativeId = normalizeNullableText(row.normativeRecordId || row.normativeId);
  const testingMethodNd = normalizeNullableText(
    row.testingMethodNd || row.methodDocument || defaults.testingMethodNd,
  );
  const samplingMethodNd = normalizeNullableText(
    row.samplingMethodNd || defaults.samplingMethodNd,
  );

  return {
    factorType: normalizeNullableText(row.factorType),
    factorCode: normalizeNullableText(row.factorCode),
    pollutantCode: normalizeNullableText(row.pollutantCode),
    indicatorName,
    value: apiValue,
    unit,
    normativeId,
    normativeValue: normalizeDecimal(row.normativeValue),
    testingMethodNd,
    samplingMethodNd,
    measurementDeviceId: normalizeOptionalId(
      row.measurementDeviceId,
      `results.${index}.measurementDeviceId`,
    ),
    deviceId: null,
    values: compactValues({
      cas: normalizeNullableText(row.cas),
      formula: normalizeNullableText(row.formula),
      samplingPlace: normalizeNullableText(row.samplingPlace),
      sampleNumber: normalizeNullableText(row.sampleNumber),
      samplingDepth: normalizeDecimal(row.samplingDepth),
      samplingSpeed: normalizeDecimal(row.samplingSpeed),
      sampleVolume: normalizeDecimal(row.sampleVolume),
      waterType: normalizeNullableText(row.waterType),
      direction: normalizeNullableText(row.direction),
      minimumValue: normalizeDecimal(row.minimumValue),
      maximumValue: normalizeDecimal(row.maximumValue),
      averageValue: normalizeDecimal(row.averageValue),
      duration: normalizeDecimal(row.duration),
      normativeValueRaw: normalizeNullableText(row.normativeValueRaw),
      comparisonType: normalizeComparisonType(row.comparisonType),
      normativeMin: normalizeDecimal(row.normativeMin),
      normativeMax: normalizeDecimal(row.normativeMax),
      normativeDocument: normalizeNullableText(row.normativeDocument),
      sourceDocumentCode: normalizeNullableText(row.sourceDocumentCode),
      note: normalizeNullableText(row.note),
    }),
  };
}

const configKey = (templateId: string): ProtocolTypeKey =>
  templateId === 'water_wastewater' ? 'water' : templateId as ProtocolTypeKey;

export const isNonEmptyResult = (row: ProtocolWizardResult): boolean =>
  Boolean(row.indicatorName.trim() || row.value.trim() || row.textValue.trim());

export const mapConditions = (
  form: ProtocolWizardForm,
  rows = form.results.filter(isNonEmptyResult),
): QuickCreateConditions => {
  const sample = rows[0];
  const values: QuickCreateConditions = {
    season: normalizeNullableText(form.season),
    workCategory: normalizeNullableText(form.workCategory),
    workplaceType: normalizeNullableText(form.workplaceType),
    roomType: normalizeNullableText(form.roomType),
    normLevel: normalizeNullableText(form.normLevel),
    temperature: normalizeDecimal(form.temperature),
    humidity: normalizeDecimal(form.humidity),
    pressure: normalizeDecimal(form.pressure),
    windSpeed: normalizeDecimal(form.windSpeed),
    sampleNumber: form.templateId === 'soil' ? normalizeNullableText(sample?.sampleNumber) : null,
    samplingDepth: form.templateId === 'soil' ? normalizeDecimal(sample?.samplingDepth) : null,
    samplingPlace: form.templateId === 'soil' ? normalizeNullableText(sample?.samplingPlace) : null,
    lightingType: normalizeNullableText(form.lightingType),
    noiseType: normalizeNullableText(form.noiseType),
    visualWorkCategory: normalizeNullableText(form.visualWorkCategory),
    waterType: isWaterProtocolType(form.templateId) ? normalizeNullableText(form.waterType) : null,
    waterUseCategory: isWaterProtocolType(form.templateId)
      ? normalizeNullableText(form.waterUseCategory)
      : null,
    weatherSource: normalizeNullableText(form.environmentSource),
    weatherDataSource: normalizeNullableText(form.environmentDataSource),
    manualChangeReason: normalizeNullableText(form.environmentManualChangeReason),
    weatherObservedAt: normalizeNullableText(form.environmentObservedAt),
  };
  return compactValues(values as unknown as Record<string, unknown>) as QuickCreateConditions;
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

const normalizeSourceNumber = (value: unknown): string | null => {
  const normalized = normalizeNullableText(
    normalizeNullableText(value)?.replace(/[\u0000-\u001F\u007F]/g, ''),
  );
  if (normalized && normalized.length > 80) {
    throw new QuickCreateValidationError(
      'sourceNumber',
      'Номер источника должен содержать не более 80 символов',
    );
  }
  return normalized;
};

export function buildQuickCreatePayload(
  form: ProtocolWizardForm,
  context: ProtocolCreateContext = {},
): QuickCreateProtocolApiRequest {
  if (!form.templateId) {
    throw new QuickCreateValidationError('templateId', 'Выберите тип протокола');
  }

  const companyId = normalizeRequiredId(form.companyId, 'companyId', 'Выберите компанию');
  const strict = context.validationMode !== 'draft';
  const objectId = strict
    ? normalizeRequiredId(form.objectId, 'objectId', 'Выберите объект')
    : normalizeOptionalId(form.objectId, 'objectId');
  const laboratoryId = strict
    ? normalizeRequiredId(form.laboratoryId, 'laboratoryId', 'Выберите лабораторию')
    : normalizeOptionalId(form.laboratoryId, 'laboratoryId');
  const executorId = strict
    ? normalizeRequiredId(form.executorId, 'executorId', 'Выберите исполнителя')
    : normalizeOptionalId(form.executorId, 'executorId');

  if (strict && context.validateSelections && !context.selectedObject) {
    throw new QuickCreateValidationError('objectId', 'Выберите сохранённый объект компании');
  }
  if (objectId !== null && context.selectedObject) {
    if (context.selectedObject.virtual || context.selectedObject.isVirtual) {
      throw new QuickCreateValidationError('objectId', 'Выберите сохранённый объект компании');
    }
    if (
      Number(context.selectedObject.id) !== objectId
      || (context.selectedObject.companyId && Number(context.selectedObject.companyId) !== companyId)
    ) {
      throw new QuickCreateValidationError('objectId', 'Выберите объект выбранной компании');
    }
  }

  if (strict && context.validateSelections && !context.selectedExecutor) {
    throw new QuickCreateValidationError('executorId', 'Выберите исполнителя выбранной лаборатории');
  }
  if (
    executorId !== null
    && laboratoryId !== null
    && context.selectedExecutor
    && (
      context.selectedExecutor.laboratoryEmployeeId !== executorId
      || context.selectedExecutor.laboratoryId !== laboratoryId
    )
  ) {
    throw new QuickCreateValidationError('executorId', 'Выберите исполнителя выбранной лаборатории');
  }

  const protocolDate = optionalApiDate(form.protocolDate, 'protocolDate');
  const sampleDate = optionalApiDate(form.sampleDate, 'sampleDate');
  const measurementDate = optionalApiDate(form.measurementDate, 'measurementDate');
  const testingStartDate = optionalApiDate(form.testingStartDate, 'testingStartDate');
  const testingEndDate = optionalApiDate(form.testingEndDate, 'testingEndDate');
  if (testingStartDate && testingEndDate && testingStartDate > testingEndDate) {
    throw new QuickCreateValidationError(
      'testingEndDate',
      'Дата окончания не может быть раньше даты начала',
    );
  }

  const measurementTime = normalizeNullableText(form.measurementTime);
  if (strict && (!measurementTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(measurementTime))) {
    throw new QuickCreateValidationError('measurementTime', 'Укажите время измерения');
  }
  const measurementPlace = normalizeNullableText(form.measurementPlace);
  if (strict && !measurementPlace) {
    throw new QuickCreateValidationError('measurementPlace', 'Укажите место измерения');
  }

  const config = PROTOCOL_TYPE_CONFIG[configKey(form.templateId)];
  const rows = form.results.filter(isNonEmptyResult);
  if (strict && !rows.length) {
    throw new QuickCreateValidationError('results', 'Добавьте хотя бы один результат');
  }
  const measurements = rows.map((row, index) => {
    if (strict) {
      return mapMeasurementToRequest(row, config.defaultUnit, index, {
        testingMethodNd: form.testingMethodNd,
        samplingMethodNd: form.samplingMethodNd,
      });
    }
    const unit = normalizeProtocolUnit(row.unit);
    if (unit && isNumericOnlyUnit(unit)) {
      throw new QuickCreateValidationError(
        `results.${index}.unit`,
        'В поле единицы измерения указано числовое значение',
      );
    }
    return {
      factorType: normalizeNullableText(row.factorType),
      factorCode: normalizeNullableText(row.factorCode),
      pollutantCode: normalizeNullableText(row.pollutantCode),
      indicatorName: normalizeNullableText(row.indicatorName) || '',
      value: normalizeDecimal(row.value) ?? normalizeNullableText(row.textValue),
      unit: unit || '',
      normativeId: normalizeNullableText(row.normativeRecordId || row.normativeId),
      normativeValue: normalizeDecimal(row.normativeValue),
      testingMethodNd: normalizeNullableText(row.testingMethodNd || row.methodDocument || form.testingMethodNd),
      samplingMethodNd: normalizeNullableText(row.samplingMethodNd || form.samplingMethodNd),
      measurementDeviceId: normalizeOptionalId(row.measurementDeviceId, `results.${index}.measurementDeviceId`),
      deviceId: null,
      values: compactValues({
        cas: normalizeNullableText(row.cas),
        formula: normalizeNullableText(row.formula),
        samplingPlace: normalizeNullableText(row.samplingPlace),
        comparisonType: normalizeComparisonType(row.comparisonType),
        normativeMin: normalizeDecimal(row.normativeMin),
        normativeMax: normalizeDecimal(row.normativeMax),
        normativeDocument: normalizeNullableText(row.normativeDocument),
      }),
    };
  });

  if (strict && PROTOCOL_TEMPLATES[form.templateId].requiresDevice) {
    const missingDeviceIndex = measurements.findIndex((item) => item.measurementDeviceId === null);
    if (missingDeviceIndex >= 0) {
      throw new QuickCreateValidationError(
        `results.${missingDeviceIndex}.measurementDeviceId`,
        'Выберите средство измерения',
      );
    }
  }

  const conditions = mapConditions(form, rows);
  if (
    strict
    && isWaterProtocolType(form.templateId)
    && (!conditions.waterType || !conditions.waterUseCategory)
  ) {
    if (import.meta.env.DEV) {
      console.error('[protocol wizard] Water conditions are missing', {
        templateId: mapFrontendProtocolType(form.templateId),
        conditions,
      });
    }
    throw new QuickCreateValidationError(
      !conditions.waterType ? 'waterType' : 'waterUseCategory',
      !conditions.waterType
        ? 'Выберите тип воды'
        : 'Выберите категорию водопользования',
    );
  }

  return {
    templateId: mapFrontendProtocolType(form.templateId),
    sourceDocumentCode: normalizeNullableText(config.sourceDocumentCode),
    docxTemplateCode: normalizeNullableText(config.docxTemplateCode),
    subtype: null,
    companyId,
    objectId,
    laboratoryId,
    executorId,
    protocolDate,
    sampleDate,
    measurementDate,
    measurementTime,
    measurementPlace,
    testingStartDate,
    testingEndDate,
    sourceNumber: normalizeSourceNumber(form.sourceNumber),
    conditions,
    measurements,
    printVisibility: mapPrintVisibilityToApi(form.printVisibility),
    orderId: normalizeNullableText(form.orderId),
    ...(form.pekProgramId ? { pekProgramId: normalizeOptionalId(form.pekProgramId, 'pekProgramId') } : {}),
    ...(form.pekControlItemId ? { pekControlItemId: normalizeOptionalId(form.pekControlItemId, 'pekControlItemId') } : {}),
    ...(form.pekControlEventId ? { pekControlEventId: normalizeOptionalId(form.pekControlEventId, 'pekControlEventId') } : {}),
    ...(form.pekReportId ? { pekReportId: normalizeOptionalId(form.pekReportId, 'pekReportId') } : {}),
    ...(form.monitoringPointId ? { monitoringPointId: normalizeOptionalId(form.monitoringPointId, 'monitoringPointId') } : {}),
    ...(form.emissionSourceId ? { emissionSourceId: normalizeOptionalId(form.emissionSourceId, 'emissionSourceId') } : {}),
    ...(form.waterOutletId ? { waterOutletId: normalizeOptionalId(form.waterOutletId, 'waterOutletId') } : {}),
  };
}

export const mapProtocolWizardToQuickCreateRequest = buildQuickCreatePayload;

/** @deprecated Use buildQuickCreatePayload. */
export const mapProtocolWizardToRequest = buildQuickCreatePayload;
