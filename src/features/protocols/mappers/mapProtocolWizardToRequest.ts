import { isWaterProtocolType } from '../../../config/protocolWater';
import { PROTOCOL_TYPE_CONFIG, type ProtocolTypeKey } from '../../../data/protocolTypeConfig';
import type { CompanyObject } from '../../../types/companies';
import type {
  EntityId,
  ProtocolEnvironment,
  ProtocolResultValue,
  QuickCreateComparisonType,
  QuickCreateConditions,
  QuickCreateMeasurement,
  QuickCreateProtocolRequest,
  ProtocolTemplateKey,
} from '../../../types/protocols';
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

export function mapMeasurementToRequest(
  row: MeasurementFormRow,
  defaultUnit?: string | null,
  index = 0,
): QuickCreateMeasurement {
  const indicatorName = row.indicatorName.trim();
  if (!indicatorName) {
    throw new QuickCreateValidationError(`results.${index}.indicatorName`, 'Укажите показатель');
  }

  const value = normalizeDecimal(row.value);
  const textValue = normalizeNullableText(row.textValue);
  if (value === null && textValue === null) {
    throw new QuickCreateValidationError(`results.${index}.value`, 'Укажите числовой или текстовый результат');
  }

  const unit = normalizeNullableText(row.unit) ?? normalizeNullableText(defaultUnit);
  if (value !== null && !unit) {
    throw new QuickCreateValidationError(`results.${index}.unit`, 'Укажите единицу измерения');
  }
  if (unit && isNumericOnlyUnit(unit)) {
    throw new QuickCreateValidationError(
      `results.${index}.unit`,
      'Единица измерения не может быть нормативным значением',
    );
  }

  const values = {
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
  };

  return {
    indicatorName,
    value,
    textValue,
    unit,
    normativeValue: normalizeDecimal(row.normativeValue),
    normativeValueRaw: normalizeNullableText(row.normativeValueRaw),
    comparisonType: normalizeComparisonType(row.comparisonType),
    normativeRecordId: normalizeOptionalId(
      row.normativeRecordId || row.normativeId,
      `results.${index}.normativeRecordId`,
    ),
    measurementDeviceId: normalizeOptionalId(
      row.measurementDeviceId,
      `results.${index}.measurementDeviceId`,
    ),
    methodName: normalizeNullableText(row.methodName),
    methodDocument: normalizeNullableText(row.methodDocument || row.testingMethodNd),
    note: normalizeNullableText(row.note),
    pollutantCode: normalizeNullableText(row.pollutantCode),
    factorType: normalizeNullableText(row.factorType),
    normativeMin: normalizeDecimal(row.normativeMin),
    normativeMax: normalizeDecimal(row.normativeMax),
    normativeDocument: normalizeNullableText(row.normativeDocument),
    sourceDocumentCode: normalizeNullableText(row.sourceDocumentCode),
    values: Object.fromEntries(
      Object.entries(values).filter(([, item]) => item !== null),
    ) as Record<string, ProtocolResultValue>,
  };
}

const configKey = (templateId: string): ProtocolTypeKey =>
  templateId === 'water_wastewater' ? 'water' : templateId as ProtocolTypeKey;

export const isNonEmptyResult = (row: ProtocolWizardResult): boolean =>
  Boolean(row.indicatorName.trim() || row.value.trim() || row.textValue.trim());

export const mapConditions = (
  form: ProtocolWizardForm,
  environment?: ProtocolEnvironment,
): QuickCreateConditions => {
  const source = environment ?? {
    temperature: normalizeDecimal(form.temperature),
    humidity: normalizeDecimal(form.humidity),
    pressureKpa: normalizeDecimal(form.pressure),
    windSpeed: normalizeDecimal(form.windSpeed),
    source: form.environmentSource,
  };
  const values: QuickCreateConditions = {
    temperature: source.temperature,
    humidity: source.humidity,
    pressure: source.pressureKpa,
    windSpeed: source.windSpeed,
    windDirection: normalizeNullableText(form.windDirection),
    weatherConditions: normalizeNullableText(form.weatherConditions),
    season: normalizeNullableText(form.season),
    workCategory: normalizeNullableText(form.workCategory),
    waterType: isWaterProtocolType(form.templateId) ? normalizeNullableText(form.waterType) : null,
    waterUseCategory: isWaterProtocolType(form.templateId)
      ? normalizeNullableText(form.waterUseCategory)
      : null,
  };
  return Object.fromEntries(
    Object.entries(values).filter(([, item]) => item !== null),
  ) as QuickCreateConditions;
};

export function buildQuickCreatePayload(
  form: ProtocolWizardForm,
  context: ProtocolCreateContext = {},
): QuickCreateProtocolRequest {
  if (!form.templateId) {
    throw new QuickCreateValidationError('templateId', 'Выберите тип протокола');
  }

  const companyId = normalizeRequiredId(form.companyId, 'companyId', 'Выберите компанию');
  const objectId = normalizeRequiredId(form.objectId, 'objectId', 'Выберите объект');
  const laboratoryId = normalizeRequiredId(form.laboratoryId, 'laboratoryId', 'Выберите лабораторию');
  const executorId = normalizeRequiredId(form.executorId, 'executorId', 'Выберите исполнителя');

  if (context.validateSelections && !context.selectedObject) {
    throw new QuickCreateValidationError('objectId', 'Выберите сохранённый объект компании');
  }
  if (context.selectedObject) {
    if (context.selectedObject.virtual || context.selectedObject.isVirtual) {
      throw new QuickCreateValidationError('objectId', 'Выберите сохранённый объект компании');
    }
    if (Number(context.selectedObject.id) !== objectId
      || (context.selectedObject.companyId && Number(context.selectedObject.companyId) !== companyId)) {
      throw new QuickCreateValidationError('objectId', 'Выберите объект выбранной компании');
    }
  }

  if (context.validateSelections && !context.selectedExecutor) {
    throw new QuickCreateValidationError('executorId', 'Выберите исполнителя выбранной лаборатории');
  }
  if (context.selectedExecutor) {
    if (context.selectedExecutor.laboratoryEmployeeId !== executorId
      || context.selectedExecutor.laboratoryId !== laboratoryId) {
      throw new QuickCreateValidationError(
        'executorId',
        'Выберите исполнителя выбранной лаборатории',
      );
    }
  }

  const protocolDate = toApiDate(form.protocolDate, 'protocolDate');
  const sampleDate = toApiDate(form.sampleDate, 'sampleDate');
  const measurementDate = toApiDate(form.measurementDate, 'measurementDate');
  const testingStartDate = toApiDate(form.testingStartDate, 'testingStartDate');
  const testingEndDate = toApiDate(form.testingEndDate, 'testingEndDate');
  if (testingStartDate > testingEndDate) {
    throw new QuickCreateValidationError(
      'testingEndDate',
      'Дата окончания не может быть раньше даты начала',
    );
  }

  const measurementTime = normalizeNullableText(form.measurementTime);
  if (!measurementTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(measurementTime)) {
    throw new QuickCreateValidationError('measurementTime', 'Укажите время измерения');
  }
  const measurementPlace = normalizeNullableText(form.measurementPlace);
  if (!measurementPlace) {
    throw new QuickCreateValidationError('measurementPlace', 'Укажите место измерения');
  }

  const config = PROTOCOL_TYPE_CONFIG[configKey(form.templateId)];
  const rows = form.results.filter(isNonEmptyResult);
  if (!rows.length) {
    throw new QuickCreateValidationError('results', 'Добавьте хотя бы один результат');
  }
  const measurements = rows.map((row, index) => {
    const measurement = mapMeasurementToRequest(row, config.defaultUnit, index);
    return {
      ...measurement,
      methodDocument: measurement.methodDocument ?? normalizeNullableText(form.testingMethodNd),
    };
  });
  if (PROTOCOL_TEMPLATES[form.templateId].requiresDevice) {
    const missingDeviceIndex = measurements.findIndex((item) => item.measurementDeviceId === null);
    if (missingDeviceIndex >= 0) {
      throw new QuickCreateValidationError(
        `results.${missingDeviceIndex}.measurementDeviceId`,
        'Выберите средство измерения',
      );
    }
  }

  const sourceNumber = normalizeNullableText(form.sourceNumber);
  if (sourceNumber && sourceNumber.length > 100) {
    throw new QuickCreateValidationError('sourceNumber', 'Не более 100 символов');
  }

  const environment: ProtocolEnvironment = {
    temperature: normalizeDecimal(form.temperature),
    humidity: normalizeDecimal(form.humidity),
    pressureKpa: normalizeDecimal(form.pressure),
    windSpeed: normalizeDecimal(form.windSpeed),
    source: form.environmentSource ?? 'MANUAL',
    dataSource: normalizeNullableText(form.environmentDataSource),
    observedAt: normalizeNullableText(form.environmentObservedAt),
    manualChangeReason: normalizeNullableText(form.environmentManualChangeReason),
  };

  const payload: QuickCreateProtocolRequest = {
    templateId: mapFrontendProtocolType(form.templateId) as ProtocolTemplateKey,
    normativeTemplateId: mapFrontendProtocolType(config.normativeTemplateId),
    docxTemplateCode: normalizeNullableText(config.docxTemplateCode),
    sourceDocumentCode: normalizeNullableText(config.sourceDocumentCode),
    sourceNumber,
    resultMode: config.resultMode,
    defaultUnit: normalizeNullableText(config.defaultUnit),
    companyId,
    objectId,
    laboratoryId,
    executorId,
    orderId: normalizeOptionalId(form.orderId, 'orderId'),
    orderServiceItemId: normalizeOptionalId(form.orderServiceItemId, 'orderServiceItemId'),
    protocolDate,
    sampleDate,
    measurementDate,
    testingStartDate,
    testingEndDate,
    measurementTime,
    measurementPlace,
    conditions: mapConditions(form, environment),
    environment,
    measurements,
    printVisibility: { ...form.printVisibility },
  };

  if (
    isWaterProtocolType(form.templateId)
    && (!payload.conditions.waterType || !payload.conditions.waterUseCategory)
  ) {
    if (import.meta.env.DEV) {
      console.error('[protocol wizard] Water conditions are missing', {
        templateId: payload.templateId,
        conditions: payload.conditions,
      });
    }
    throw new QuickCreateValidationError(
      !payload.conditions.waterType ? 'waterType' : 'waterUseCategory',
      !payload.conditions.waterType
        ? 'Выберите тип воды'
        : 'Выберите категорию водопользования',
    );
  }

  return payload;
}

export const mapProtocolWizardToQuickCreateRequest = buildQuickCreatePayload;

/** @deprecated Use buildQuickCreatePayload. */
export const mapProtocolWizardToRequest = buildQuickCreatePayload;
