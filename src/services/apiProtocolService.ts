import api, { ApiResponse } from './api';
import {
  extractItem,
  extractList,
  getApiErrorMessage,
  getApiStatus,
  getContentDispositionFileName,
} from './apiHelpers';
import type {
  CreateProtocolPayload,
  CalculationResultResponse,
  CalculationDetails,
  MeasurementDevice,
  MethodTemplateResponse,
  MethodVariableResponse,
  NormativeRecord,
  NormativeSearchResult,
  Pollutant,
  Protocol,
  ProtocolCalculationSummaryResponse,
  ProtocolCompanySnapshot,
  ProtocolEnvironmentalConditions,
  ProtocolMeasurementDevice,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  SaveRawMeasurementsRequest,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' ? value as UnknownRecord : {};
const unwrapData = (value: unknown): unknown => {
  const response = asRecord(value);
  const data = response.data ?? value;
  const body = asRecord(data);
  return body.data ?? data;
};
function unwrapApiResponse<T>(response: any): T {
  return response?.data?.data ?? response?.data;
}
const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
const nullableDecimal = (value: unknown): string | null => {
  const normalized = asString(value).trim();
  return normalized === '' ? null : normalized;
};

const pick = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return asString(value);
  }
  return '';
};

const hasValue = (value: unknown) => value !== undefined && value !== null && String(value) !== '';
const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (hasValue(value)) return asString(value);
  }
  return '';
};
const scalarOrNull = (value: unknown): string | number | null =>
  typeof value === 'string' || typeof value === 'number' ? value : null;
const numberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeCompanySnapshot = (raw: UnknownRecord): ProtocolCompanySnapshot => {
  const snapshot = asRecord(raw.companySnapshot || raw.company_snapshot || {});
  const company = asRecord(raw.company);
  const organization = asRecord(raw.organization || {});
  const companyObject = asRecord(company.object || company.companyObject || company.company_object);
  const organizationObject = asRecord(organization.object || organization.companyObject || organization.company_object);
  const object = Object.keys(companyObject).length ? companyObject : organizationObject;
  return {
    companyName: pick(company, ['name', 'companyName']) || pick(organization, ['organizationName', 'companyName', 'name']) || pick(snapshot, ['companyName', 'name']),
    bin: pick(company, ['bin', 'iin']) || pick(organization, ['bin', 'iin']) || pick(snapshot, ['bin']),
    legalAddress: pick(company, ['legalAddress']) || pick(organization, ['legalAddress']) || pick(snapshot, ['legalAddress']),
    actualAddress: pick(company, ['actualAddress']) || pick(organization, ['actualAddress', 'organizationAddress']) || pick(snapshot, ['actualAddress']),
    phone: pick(company, ['phone']) || pick(organization, ['phone']) || pick(snapshot, ['phone']),
    email: pick(company, ['email']) || pick(organization, ['email']) || pick(snapshot, ['email']),
    director: pick(company, ['director', 'directorFullName']) || pick(organization, ['director']) || pick(snapshot, ['director']),
    contactPerson: pick(company, ['contactPerson']) || pick(organization, ['contactPerson']) || pick(snapshot, ['contactPerson']),
    activityType: pick(company, ['activityType']) || pick(organization, ['activityType']) || pick(snapshot, ['activityType']),
    objectName: pick(object, ['name', 'objectName']) || pick(company, ['objectName']) || pick(organization, ['objectName']) || pick(snapshot, ['objectName']),
    objectAddress: pick(object, ['address', 'objectAddress']) || pick(company, ['objectAddress']) || pick(organization, ['objectAddress']) || pick(snapshot, ['objectAddress']),
    objectActivityType: pick(object, ['activityType']) || pick(company, ['objectActivityType']) || pick(organization, ['objectActivityType']) || pick(snapshot, ['objectActivityType']),
    coordinates: pick(object, ['coordinates']) || pick(company, ['coordinates']) || pick(organization, ['coordinates']) || pick(snapshot, ['coordinates']),
    sanitaryZone: pick(object, ['sanitaryZone']) || pick(company, ['sanitaryZone']) || pick(organization, ['sanitaryZone']) || pick(snapshot, ['sanitaryZone']),
    bankName: pick(company, ['bankName', 'bank']) || pick(snapshot, ['bankName']),
    iban: pick(company, ['iban']) || pick(snapshot, ['iban']),
    bik: pick(company, ['bik']) || pick(snapshot, ['bik']),
    kbe: pick(company, ['kbe']) || pick(snapshot, ['kbe']),
    knp: pick(company, ['knp']) || pick(snapshot, ['knp']),
  };
};

export const normalizeProtocolResult = (raw: unknown): ProtocolResultRow => {
  const source = asRecord(raw);
  const apiValues = asRecord(source.values);
  const values: UnknownRecord = {
    ...apiValues,
    normativeMin: apiValues.normativeMin ?? apiValues.minValue,
    normativeMax: apiValues.normativeMax ?? apiValues.maxValue,
    measurementDeviceId: apiValues.measurementDeviceId ?? apiValues.deviceId ?? apiValues.device,
    factorType: apiValues.factorType ?? apiValues.subtype,
  };
  const dynamicValues = Object.fromEntries(
    Object.entries(source).filter(([key, value]) =>
      !['id', '_id', 'resultId', 'protocolId', 'protocol_id', 'internalStatus', 'checkStatus', 'status', 'values'].includes(key)
      && (typeof value === 'string' || typeof value === 'number' || value === null),
    ),
  );
  const pollutantSource = asRecord(source.pollutant || apiValues.pollutant);
  const normativeSource = asRecord(source.normativeReference || (typeof source.normative === 'object' ? source.normative : undefined) || apiValues.normativeReference);
  const calculationSource = asRecord(source.calculationDetails || source.calculation || apiValues.calculationDetails);
  const result = firstString(source.result, values.resultMg, values.result);
  const normative = firstString(source.normative, source.normativeValue, values.normative, values.pdk);
  const pdk = firstString(source.pdk, values.pdk);
  const status = firstString(source.internalStatus, source.checkStatus, source.status) || 'EMPTY_RESULT';
  const normalizedStatus = status === 'NORMATIVE_NOT_FOUND' && (normative || pdk) ? 'MANUAL_NORMATIVE' : status;
  const indicatorName = firstString(source.indicatorName, values.indicator);
  const code = firstString(source.code, values.code) || '—';
  const unit = firstString(source.unit, values.unit);
  const testingMethodDocument = firstString(source.testingMethodDocument, values.testingMethodDocument, values.testingMethod);
  const measurementPlace = firstString(source.measurementPlace, values.object, values.measurementPlace, values.samplingPlace);
  const sampleName = firstString(source.sampleName, values.sampleName);
  const deviceId = firstString(source.deviceId, values.device, values.deviceId);
  const measurementDeviceId = firstString(source.measurementDeviceId, source.deviceId, values.measurementDeviceId, values.deviceId, values.device);
  const deviceName = firstString(source.deviceName, values.deviceName) || '—';
  return {
    id: pick(source, ['id', '_id', 'resultId']),
    protocolId: pick(source, ['protocolId', 'protocol_id']),
    internalStatus: normalizedStatus as ProtocolResultRow['internalStatus'],
    checkStatus: normalizedStatus as ProtocolResultRow['checkStatus'],
    indicatorName,
    code,
    samplingPoint: pick(source, ['samplingPoint', 'sampling_point']) || asString(values.samplingPoint),
    indicator: firstString(source.indicator, indicatorName),
    unit,
    result,
    normative,
    normativeValue: firstString(source.normativeValue, normative),
    pdk,
    testingMethod: firstString(source.testingMethod, source.testing_method, values.testingMethod),
    testingMethodDocument,
    samplingMethod: pick(source, ['samplingMethod', 'sampling_method']) || asString(values.samplingMethod),
    normativeDocument: pick(source, ['normativeDocument', 'normative_document']) || asString(values.normativeDocument),
    comment: pick(source, ['comment']) || asString(values.comment),
    measurementPlace,
    sampleName,
    deviceId,
    deviceName,
    measurementDeviceId,
    comparisonType: (pick(source, ['comparisonType']) || asString(values.comparisonType)) as ProtocolResultRow['comparisonType'],
    normativeMin: pick(source, ['normativeMin', 'min']) || asString(values.normativeMin),
    normativeMax: pick(source, ['normativeMax', 'max']) || asString(values.normativeMax),
    pollutant: Object.keys(pollutantSource).length ? normalizePollutant(pollutantSource) : undefined,
    normativeReference: Object.keys(normativeSource).length ? {
      id: pick(normativeSource, ['id', '_id']),
      code: pick(normativeSource, ['code']),
      pollutantCode: pick(normativeSource, ['pollutantCode', 'pollutant_code']),
      indicator: pick(normativeSource, ['indicator', 'name']),
      environment: pick(normativeSource, ['environment', 'researchObject']),
      unit: pick(normativeSource, ['unit']),
      normativeType: pick(normativeSource, ['normativeType', 'type']),
      value: pick(normativeSource, ['value']),
      min: pick(normativeSource, ['min', 'minValue']),
      max: pick(normativeSource, ['max', 'maxValue']),
      comparisonType: (pick(normativeSource, ['comparisonType']) || 'LESS_OR_EQUAL') as Exclude<ProtocolResultRow['comparisonType'], undefined>,
      normativeDocument: pick(normativeSource, ['normativeDocument', 'document']),
      testingMethod: pick(normativeSource, ['testingMethod']),
      samplingMethod: pick(normativeSource, ['samplingMethod']),
      validFrom: pick(normativeSource, ['validFrom']),
      validUntil: pick(normativeSource, ['validUntil']),
      version: pick(normativeSource, ['version']),
      active: normativeSource.active !== false,
    } : undefined,
    calculationDetails: Object.keys(calculationSource).length ? normalizeCalculationDetails(calculationSource) : undefined,
    uncertaintyValue: firstString(source.uncertaintyValue, values.uncertaintyValue),
    calculationStatus: firstString(source.calculationStatus, values.calculationStatus) as ProtocolResultRow['calculationStatus'],
    calculationMessage: firstString(source.calculationMessage, values.calculationMessage),
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : undefined,
    values: {
      ...values,
      ...dynamicValues,
      samplingPoint: pick(source, ['samplingPoint', 'sampling_point']) || asString(values.samplingPoint),
      indicator: firstString(source.indicator, indicatorName),
      indicatorName,
      code,
      unit,
      result,
      normative,
      normativeValue: firstString(source.normativeValue, normative),
      pdk,
      testingMethod: firstString(source.testingMethod, source.testing_method, values.testingMethod),
      testingMethodDocument,
      samplingMethod: pick(source, ['samplingMethod', 'sampling_method']) || asString(values.samplingMethod),
      normativeDocument: pick(source, ['normativeDocument', 'normative_document']) || asString(values.normativeDocument),
      comment: pick(source, ['comment']) || asString(values.comment),
      measurementPlace,
      object: firstString(values.object, measurementPlace),
      sampleName,
      device: firstString(values.device, deviceId),
      deviceId,
      deviceName,
      measurementDeviceId,
      comparisonType: pick(source, ['comparisonType']) || asString(values.comparisonType),
      normativeMin: pick(source, ['normativeMin', 'min']) || asString(values.normativeMin),
      normativeMax: pick(source, ['normativeMax', 'max']) || asString(values.normativeMax),
      uncertaintyValue: firstString(source.uncertaintyValue, values.uncertaintyValue),
      calculationStatus: firstString(source.calculationStatus, values.calculationStatus),
      calculationMessage: firstString(source.calculationMessage, values.calculationMessage),
    },
  };
};

const normalizeResult = normalizeProtocolResult;

export const normalizePollutant = (raw: unknown): Pollutant => {
  const source = asRecord(raw);
  return {
    id: pick(source, ['id', '_id']),
    code: pick(source, ['code', 'pollutantCode', 'substanceCode', 'indicatorCode', 'referenceCode']),
    name: pick(source, ['name', 'nameRu', 'nameKz', 'indicator', 'indicatorName', 'indicatorNameRu', 'indicatorNameKz', 'pollutantName', 'substanceName', 'title']),
    cas: pick(source, ['cas', 'casNumber']),
    formula: pick(source, ['formula', 'chemicalFormula']),
    unit: pick(source, ['unit']),
    testingMethod: pick(source, ['testingMethod', 'method']),
    samplingMethod: pick(source, ['samplingMethod']),
  };
};

const normalizeNormativeRecord = (raw: unknown): NormativeRecord => {
  const source = asRecord(raw);
  return {
    id: pick(source, ['id', '_id']),
    templateId: pick(source, ['templateId', 'templateCode']).toLowerCase() as NormativeRecord['templateId'],
    code: pick(source, ['code', 'pollutantCode', 'substanceCode', 'indicatorCode', 'referenceCode']),
    pollutantCode: pick(source, ['pollutantCode', 'pollutant_code', 'substanceCode', 'code', 'indicatorCode', 'referenceCode']),
    indicatorName: pick(source, ['indicatorName', 'indicatorNameRu', 'name', 'nameRu', 'indicator']),
    pollutantName: pick(source, ['pollutantName', 'substanceName', 'indicatorName', 'name']),
    researchObject: pick(source, ['researchObject', 'environment', 'object', 'objectName', 'medium', 'sampleType']),
    environment: pick(source, ['environment', 'researchObject', 'medium', 'sampleType']),
    indicator: pick(source, ['indicator', 'indicatorName', 'indicatorNameRu', 'indicatorNameKz', 'name', 'nameRu', 'nameKz', 'pollutantName', 'substanceName']),
    cas: pick(source, ['cas', 'casNumber']),
    casNumber: pick(source, ['casNumber', 'cas']),
    formula: pick(source, ['formula', 'chemicalFormula']),
    chemicalFormula: pick(source, ['chemicalFormula', 'formula']),
    unit: pick(source, ['unit', 'measurementUnit', 'resultUnit']),
    normativeType: pick(source, ['normativeType', 'type', 'limitType', 'category']),
    normativeSubType: pick(source, ['normativeSubType', 'normativeSubtype', 'subType', 'subtype']),
    subtype: pick(source, ['subtype', 'subType', 'normativeSubType', 'normativeSubtype']),
    value: pick(source, ['value', 'normative', 'normativeValue']),
    min: pick(source, ['min', 'minValue', 'normativeMin']),
    max: pick(source, ['max', 'maxValue', 'normativeMax']),
    comparisonType: (pick(source, ['comparisonType']) || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'],
    normativeDocument: pick(source, ['normativeDocument', 'document', 'documentName', 'standard']),
    hazardClass: pick(source, ['hazardClass', 'dangerClass', 'hazard', 'hazardClassName']),
    limitingIndicator: pick(source, ['limitingIndicator', 'limitingSign', 'lpv', 'limitingFactor']),
    source: pick(source, ['source', 'sourceName', 'dataSource', 'normativeDocument', 'document', 'documentName']),
    sourceFile: pick(source, ['sourceFile', 'sourceFileName', 'fileName', 'importFileName', 'excelFileName', 'workbookName']),
    importFileName: pick(source, ['importFileName', 'fileName', 'sourceFile', 'excelFileName', 'workbookName']),
    testingMethod: pick(source, ['testingMethod', 'method', 'methodName', 'measurementMethod']),
    samplingMethod: pick(source, ['samplingMethod', 'sampleMethod', 'samplingMethodName']),
    validFrom: pick(source, ['validFrom']),
    validUntil: pick(source, ['validUntil']),
    version: pick(source, ['version']),
    status: (pick(source, ['status']) || (source.active === false ? 'INACTIVE' : 'ACTIVE')) as NormativeRecord['status'],
    active: source.active !== false,
    archived: source.archived === true || source.status === 'ARCHIVED',
  };
};

const normalizeNormativeText = (value: unknown) => String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
const demoNormativeIndicators = ['e.coli', 'пыль', 'железо', 'шум', 'диоксид азота'];
const demoNormativeSources = ['сэм рк (демо)', 'demo', 'демо'];
const hasExcelNormativeSource = (item: NormativeRecord) => [
  item.sourceFile,
  item.importFileName,
  item.source,
  item.normativeDocument,
].some((value) => {
  const text = normalizeNormativeText(value);
  return text.includes('.xls') || text.includes('.xlsx') || text.includes('with_pollutant_codes') || text.includes('sourcefile');
});
const isDemoNormativeRecord = (item: NormativeRecord) => {
  const sourceText = normalizeNormativeText([item.source, item.normativeDocument].filter(Boolean).join(' '));
  const indicatorText = normalizeNormativeText([item.indicator, item.indicatorName, item.pollutantName].filter(Boolean).join(' '));
  return demoNormativeSources.some((marker) => sourceText.includes(marker))
    || demoNormativeIndicators.some((indicator) => indicatorText === indicator || indicatorText.includes(indicator));
};
const isVisibleNormativeRecord = (item: NormativeRecord) => hasExcelNormativeSource(item) && !isDemoNormativeRecord(item);

const extractNormativeRecords = (response: unknown): NormativeRecord[] => {
  const map = new Map<string, NormativeRecord>();
  [
    extractList(response, ['records']),
    extractList(response, ['normatives']),
    extractList(response, ['items']),
    extractList(response, ['results']),
    extractList(response, ['content']),
  ].flat().map(normalizeNormativeRecord).filter(isVisibleNormativeRecord).forEach((item, index) => {
    const key = item.id || `${item.pollutantCode || item.code}-${item.indicator}-${item.normativeDocument}-${index}`;
    map.set(key, item);
  });
  return Array.from(map.values());
};

const extractPollutants = (response: unknown): Pollutant[] => {
  const map = new Map<string, Pollutant>();
  [
    extractList(response, ['pollutants']),
    extractList(response, ['records']),
    extractList(response, ['normatives']),
    extractList(response, ['items']),
    extractList(response, ['results']),
    extractList(response, ['content']),
  ].flat().map(normalizePollutant).filter((item) => item.code || item.name).forEach((item, index) => {
    map.set(item.id || `${item.code}-${item.name}-${index}`, item);
  });
  return Array.from(map.values());
};

const normalizeCalculationDetails = (raw: unknown): CalculationDetails => {
  const source = asRecord(raw);
  const intermediate = Array.isArray(source.intermediateResults) ? source.intermediateResults : [];
  return {
    formula: pick(source, ['formula']),
    substitutedValues: pick(source, ['substitutedValues', 'substitution']),
    intermediateResults: intermediate.map((item) => {
      const row = asRecord(item);
      return { label: pick(row, ['label', 'name']), value: pick(row, ['value']) };
    }),
    rounding: pick(source, ['rounding']),
    finalValue: pick(source, ['finalValue', 'result']),
    unit: pick(source, ['unit']),
    normativeValue: pick(source, ['normativeValue', 'normative']),
    comparisonResult: pick(source, ['comparisonResult', 'comparison']),
    methodVersion: pick(source, ['methodVersion', 'version']),
  };
};

const normalizeMethodVariable = (raw: unknown): MethodVariableResponse => {
  const source = asRecord(raw);
  const displayOrder = Number(source.displayOrder ?? source.display_order);
  return {
    id: pick(source, ['id', '_id']),
    variableKey: pick(source, ['variableKey', 'variable_key', 'key', 'code']),
    variableLabel: pick(source, ['variableLabel', 'variable_label', 'label', 'name']),
    unit: pick(source, ['unit']),
    type: pick(source, ['type', 'valueType', 'value_type']),
    required: source.required === true || source.required === 'true',
    minValue: numberOrNull(source.minValue ?? source.min_value),
    maxValue: numberOrNull(source.maxValue ?? source.max_value),
    defaultValue: numberOrNull(source.defaultValue ?? source.default_value),
    displayOrder: Number.isFinite(displayOrder) ? displayOrder : undefined,
  };
};

const normalizeMethodTemplate = (raw: unknown): MethodTemplateResponse => {
  const source = asRecord(raw);
  const variables = Array.isArray(source.variables) ? source.variables : [];
  const decimalPlaces = Number(source.decimalPlaces ?? source.decimal_places);
  return {
    id: pick(source, ['id', '_id']),
    code: pick(source, ['code']),
    name: pick(source, ['name', 'title']),
    protocolTemplateCode: pick(source, ['protocolTemplateCode', 'protocol_template_code', 'templateCode']),
    pollutantCode: pick(source, ['pollutantCode', 'pollutant_code']),
    pollutantName: pick(source, ['pollutantName', 'pollutant_name']),
    methodDocument: pick(source, ['methodDocument', 'method_document']),
    measurementUnit: pick(source, ['measurementUnit', 'measurement_unit']),
    resultUnit: pick(source, ['resultUnit', 'result_unit']),
    formulaExpression: pick(source, ['formulaExpression', 'formula_expression', 'formula']),
    decimalPlaces: Number.isFinite(decimalPlaces) ? decimalPlaces : undefined,
    active: source.active !== false,
    variables: variables.map(normalizeMethodVariable).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
  };
};

const normalizeRawMeasurements = (raw: unknown, fallbackProtocolId = '', fallbackResultId = ''): RawMeasurementsResponse => {
  const payload = unwrapData(raw);
  const source = asRecord(payload);
  const templateSource = source.methodTemplate ?? source.method_template ?? source.template;
  const methodTemplate = templateSource ? normalizeMethodTemplate(templateSource) : undefined;
  const variablesSource = Array.isArray(source.variables)
    ? source.variables
    : methodTemplate?.variables || [];
  const measurementsSource = Array.isArray(source.measurements)
    ? source.measurements
    : Array.isArray(source.rawMeasurements)
      ? source.rawMeasurements
      : [];
  return {
    protocolId: pick(source, ['protocolId', 'protocol_id']) || fallbackProtocolId,
    resultId: pick(source, ['resultId', 'result_id']) || fallbackResultId,
    methodTemplate,
    variables: variablesSource.map(normalizeMethodVariable).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
    measurements: measurementsSource.map((item) => {
      const measurement = asRecord(item);
      return {
        variableKey: pick(measurement, ['variableKey', 'variable_key', 'key']),
        variableValue: scalarOrNull(measurement.variableValue ?? measurement.variable_value ?? measurement.value),
        unit: pick(measurement, ['unit']),
        sourceType: (pick(measurement, ['sourceType', 'source_type']) || 'MANUAL') as RawMeasurementRequest['sourceType'],
        deviceId: pick(measurement, ['deviceId', 'device_id']),
      };
    }),
    calculationStatus: pick(source, ['calculationStatus', 'calculation_status']) as RawMeasurementsResponse['calculationStatus'],
    calculationMessage: pick(source, ['calculationMessage', 'calculation_message', 'message']),
  };
};

const normalizeCalculationResult = (raw: unknown, fallbackProtocolId = '', fallbackResultId = ''): CalculationResultResponse => {
  const payload = unwrapData(raw);
  const source = asRecord(payload);
  const embeddedResult = source.result;
  const rowSource = source.row
    ?? source.resultRow
    ?? source.result_row
    ?? (source.values || source.indicatorName || source.indicator ? source : embeddedResult);
  const row = rowSource && typeof rowSource === 'object' ? normalizeResult(rowSource) : undefined;
  return {
    protocolId: pick(source, ['protocolId', 'protocol_id']) || row?.protocolId || fallbackProtocolId,
    resultId: pick(source, ['resultId', 'result_id', 'id', '_id']) || row?.id || fallbackResultId,
    result: scalarOrNull(source.result ?? row?.result),
    uncertaintyValue: scalarOrNull(source.uncertaintyValue ?? source.uncertainty_value ?? row?.uncertaintyValue),
    normativeValue: scalarOrNull(source.normativeValue ?? source.normative_value ?? row?.normativeValue ?? row?.normative),
    internalStatus: (pick(source, ['internalStatus', 'internal_status', 'status']) || row?.internalStatus) as CalculationResultResponse['internalStatus'],
    calculationStatus: (pick(source, ['calculationStatus', 'calculation_status']) || row?.calculationStatus) as CalculationResultResponse['calculationStatus'],
    calculationMessage: pick(source, ['calculationMessage', 'calculation_message', 'message']) || row?.calculationMessage,
    warnings: Array.isArray(source.warnings) ? source.warnings.map(String) : undefined,
    row,
  };
};

const numberFrom = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const normalizeCalculationSummary = (raw: unknown, protocolId: string): ProtocolCalculationSummaryResponse => {
  const payload = unwrapData(raw);
  const source = asRecord(payload);
  const rowsSource = Array.isArray(source.rows)
    ? source.rows
    : Array.isArray(source.results)
      ? source.results
      : [];
  const rows = rowsSource.map((item) => normalizeCalculationResult(item, protocolId));
  return {
    protocolId: pick(source, ['protocolId', 'protocol_id']) || protocolId,
    total: numberFrom(source.total ?? rows.length),
    calculated: numberFrom(source.calculated),
    manual: numberFrom(source.manual),
    waitingInputs: numberFrom(source.waitingInputs ?? source.waiting_inputs),
    needsRepeat: numberFrom(source.needsRepeat ?? source.needs_repeat),
    normativeNotFound: numberFrom(source.normativeNotFound ?? source.normative_not_found),
    errors: numberFrom(source.errors),
    exceeded: numberFrom(source.exceeded),
    complies: numberFrom(source.complies),
    rows,
  };
};

export const normalizeWeatherConditions = (raw: unknown): WeatherConditions => {
  const source = asRecord(extractItem(raw, ['conditions', 'weather']));
  return {
    temperature: pick(source, ['temperature', 'temperatureC']),
    minTemperature: pick(source, ['minTemperature', 'temperatureMinC']),
    maxTemperature: pick(source, ['maxTemperature', 'temperatureMaxC']),
    humidity: pick(source, ['humidity', 'humidityPercent']),
    minHumidity: pick(source, ['minHumidity', 'humidityMinPercent']),
    maxHumidity: pick(source, ['maxHumidity', 'humidityMaxPercent']),
    pressureKpa: pick(source, ['pressureKpa', 'pressure']),
    windSpeed: pick(source, ['windSpeed', 'windSpeedMs']),
    status: 'LOADED',
    source: 'API',
    dataSource: pick(source, ['dataSource', 'sourceName', 'provider', 'source']) || 'Погодный сервис',
    observedAt: pick(source, ['observedAt', 'recordedAt', 'weatherTimestamp', 'observationTime']),
    loadedAt: pick(source, ['loadedAt', 'observedAt']) || new Date().toISOString(),
    warning: pick(source, ['warning']),
  };
};

const normalizeMeasurementDevice = (raw: unknown): ProtocolMeasurementDevice => {
  const source = asRecord(raw);
  const nestedSnapshot = asRecord(source.deviceSnapshot || source.device_snapshot || source.device || {});
  const snapshot = Object.keys(nestedSnapshot).length ? nestedSnapshot : source;
  return {
    id: pick(source, ['id', '_id', 'protocolDeviceId']) || pick(snapshot, ['id']),
    protocolId: pick(source, ['protocolId', 'protocol_id']),
    deviceId: pick(source, ['deviceId', 'device_id']) || pick(snapshot, ['id']),
    deviceSnapshot: {
      name: pick(snapshot, ['name']),
      model: pick(snapshot, ['model']),
      serialNumber: pick(snapshot, ['serialNumber', 'serial_number']),
      verificationCertificateNumber: pick(snapshot, ['verificationCertificateNumber', 'verification_certificate_number']),
      verificationDate: pick(snapshot, ['verificationDate', 'verification_date']),
      verificationValidUntil: pick(snapshot, ['verificationValidUntil', 'verification_valid_until']),
      units: pick(snapshot, ['units']),
      status: (pick(snapshot, ['status']) || 'VALID') as ProtocolMeasurementDevice['deviceSnapshot']['status'],
    },
  };
};

export const normalizeProtocol = (raw: unknown): Protocol => {
  const source = asRecord(raw);
  const snapshot = normalizeCompanySnapshot(source);
  const organization = asRecord(source.organization);
  const laboratory = asRecord(source.laboratorySnapshot || source.laboratory_snapshot || source.laboratory);
  const testing = asRecord(source.testing);
  const protocolNumber = pick(source, ['protocolNumber', 'protocol_number', 'number']);
  const samplingDate = pick(testing, ['samplingDate', 'sampleDate']);
  const testingStartDate = pick(testing, ['testingStartDate']);
  const testingEndDate = pick(testing, ['testingEndDate', 'testingDate']);
  const purpose = pick(testing, ['testingPurpose', 'testPurpose', 'purpose']);
  const environmentalConditions = pick(testing, ['environmentConditions', 'environmentalConditions']);
  const environment = asRecord(
    source.environment
    || source.environmentalConditionsData
    || (typeof source.environmentalConditions === 'object' ? source.environmentalConditions : {}),
  );
  const resultsSource = Array.isArray(source.results) ? source.results : [];
  const devicesSource = Array.isArray(source.instruments) ? source.instruments : Array.isArray(source.measurementDevices) ? source.measurementDevices : [];

  return {
    id: pick(source, ['id', '_id', 'protocolId']),
    protocolNumber,
    number: protocolNumber,
    templateId: pick(source, [
      'templateId',
      'template_id',
      'templateCode',
      'template_code',
    ]).toLowerCase() as Protocol['templateId'],
    subtype: (pick(source, ['subtype', 'physicalFactorType', 'physical_factor_type'])
      || pick(testing, ['physicalFactorType'])) as Protocol['subtype'],
    templateName: pick(source, ['templateName', 'template_name']),
    status: (pick(source, ['status']) || 'DRAFT') as Protocol['status'],
    companyId: pick(source, ['companyId', 'company_id']),
    objectId: pick(source, ['objectId', 'object_id']),
    companySnapshot: snapshot,
    protocolDate: pick(source, ['protocolDate', 'protocol_date']),
    measurementDate: pick(source, ['measurementDate', 'measurement_date']) || samplingDate,
    measurementTime: pick(source, ['measurementTime', 'measurement_time']),
    measurementPlace: pick(source, ['measurementPlace', 'measurement_place']),
    sourceNumber: pick(source, ['sourceNumber', 'source_number']),
    formCode: pick(source, ['formCode', 'form_code']),
    application: pick(source, ['appendixNumber', 'application', 'appendix_number']),
    samplingDate,
    testingStartDate,
    testingEndDate,
    purpose,
    environmentalConditions,
    environment: {
      temperature: pick(environment, ['temperatureC', 'temperature']),
      minTemperature: pick(environment, ['temperatureMinC', 'minTemperature', 'temperatureMin']),
      maxTemperature: pick(environment, ['temperatureMaxC', 'maxTemperature', 'temperatureMax']),
      humidity: pick(environment, ['humidityPercent', 'humidity']),
      minHumidity: pick(environment, ['humidityMinPercent', 'minHumidity', 'humidityMin']),
      maxHumidity: pick(environment, ['humidityMaxPercent', 'maxHumidity', 'humidityMax']),
      pressureKpa: pick(environment, ['pressureKpa', 'pressure']),
      windSpeed: pick(environment, ['windSpeedMs', 'windSpeed']),
      comment: pick(environment, ['conditionsComment', 'comment']) || environmentalConditions,
      status: pick(environment, ['status']) as ProtocolEnvironmentalConditions['status'],
      source: (pick(environment, ['source']) || 'API') as ProtocolEnvironmentalConditions['source'],
      dataSource: pick(environment, ['dataSource', 'sourceName', 'provider']),
      observedAt: pick(environment, ['observedAt', 'recordedAt', 'weatherTimestamp']),
      loadedAt: pick(environment, ['loadedAt']),
      manualChangeReason: pick(environment, ['manualChangeReason', 'changeReason']),
    },
    productName: pick(source, ['productName']) || pick(organization, ['productName']),
    testingBasis: pick(source, ['testingBasis']) || pick(organization, ['testingBasis']),
    productNormativeDocument: pick(source, ['productNormativeDocument']) || pick(testing, ['productNormativeDocument']),
    samplingMethodDocument: pick(source, ['samplingMethodDocument']) || pick(testing, ['samplingMethodDocument']),
    testingMethodDocument: pick(source, ['testingMethodDocument']) || pick(testing, ['testingMethodDocument']),
    explanatoryNote: pick(source, ['explanatoryNote', 'note']),
    complianceResult: pick(source, ['complianceStatus', 'complianceResult', 'overallStatus', 'internalStatus']),
    executor: pick(source, ['executor']) || pick(laboratory, ['executor', 'executorName']),
    executorId: pick(source, ['executorId', 'executor_id']) || pick(laboratory, ['executorId']),
    approver: pick(source, ['approver']),
    approvedAt: pick(source, ['approvedAt', 'approved_at']),
    signedAt: pick(source, ['signedAt', 'signed_at']),
    organization: {
      organizationName: pick(organization, ['organizationName', 'companyName', 'name']) || snapshot.companyName,
      organizationAddress: pick(organization, ['organizationAddress', 'legalAddress', 'actualAddress', 'address']) || snapshot.legalAddress || snapshot.actualAddress || '',
      objectName: pick(organization, ['objectName']) || snapshot.objectName || '',
      productName: pick(organization, ['productName', 'product']) || snapshot.objectName || snapshot.activityType || '',
      testingBasis: pick(organization, ['testingBasis', 'basis']) || pick(source, ['testingBasis', 'testing_basis']),
    },
    laboratory: {
      laboratoryId: pick(laboratory, ['laboratoryId', 'id']) || pick(source, ['laboratoryId', 'laboratory_id', 'labId']),
      laboratoryName: pick(laboratory, ['laboratoryName', 'name', 'legalName']) || pick(source, ['laboratoryName']),
      legalName: pick(laboratory, ['legalName', 'fullName']),
      bin: pick(laboratory, ['bin', 'iin', 'taxId']),
      laboratoryAddress: pick(laboratory, ['laboratoryAddress', 'address', 'legalAddress']),
      phone: pick(laboratory, ['phone', 'phoneNumber']),
      email: pick(laboratory, ['email']),
      accreditationNumber: pick(laboratory, ['accreditationNumber', 'certificateNumber', 'certificateNo', 'accreditationCertificateNumber']),
      accreditationIssuedAt: pick(laboratory, ['accreditationIssuedAt', 'certificateIssuedAt', 'accreditationDate']),
      accreditationValidUntil: pick(laboratory, ['accreditationValidUntil', 'certificateValidUntil', 'validUntil', 'certificateExpiresAt']),
      directorId: pick(laboratory, ['directorId']),
      director: pick(laboratory, ['director', 'directorName']),
      laboratoryHeadId: pick(laboratory, ['laboratoryHeadId', 'headId']),
      laboratoryHead: pick(laboratory, ['laboratoryHead', 'head', 'laboratoryHeadName', 'headName']),
      executorId: pick(laboratory, ['executorId']) || pick(source, ['executorId', 'executor_id']),
      executor: pick(laboratory, ['executor', 'executorName']) || pick(source, ['executor']),
      logoUrl: pick(laboratory, ['logoUrl', 'logo']),
      standardNote: pick(laboratory, ['standardNote', 'note']),
      capturedAt: pick(laboratory, ['capturedAt', 'snapshotAt']),
    },
    testing: {
      productNormativeDocument: pick(testing, ['productNormativeDocument']) || pick(source, ['productNormativeDocument', 'product_normative_document']),
      samplingMethodDocument: pick(testing, ['samplingMethodDocument', 'samplingMethod']) || pick(source, ['samplingMethodDocument', 'sampling_method_document']),
      testingMethodDocument: pick(testing, ['testingMethodDocument', 'testingMethod']) || pick(source, ['testingMethodDocument', 'testing_method_document']),
      samplingDate,
      testingStartDate,
      testingEndDate,
      testingDate: pick(testing, ['testingDate']) || testingEndDate,
      testingPurpose: pick(testing, ['testingPurpose', 'testPurpose']) || purpose,
      environmentConditions: pick(testing, ['environmentConditions', 'environmentalConditions']) || environmentalConditions,
      physicalFactorType: pick(testing, ['physicalFactorType']) || pick(source, ['physicalFactorType', 'physical_factor_type']),
    },
    results: resultsSource.map(normalizeResult),
    measurementDevices: devicesSource.map(normalizeMeasurementDevice),
    instruments: devicesSource.map((item) => normalizeMeasurementDevice(item).deviceSnapshot as MeasurementDevice),
    history: Array.isArray(source.history)
      ? source.history as Protocol['history']
      : Array.isArray(source.audit)
        ? source.audit as Protocol['history']
        : [],
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
    replacedByProtocolId: pick(source, ['replacedByProtocolId', 'replaced_by_protocol_id']),
    replacesProtocolId: pick(source, ['replacesProtocolId', 'replaces_protocol_id']),
  };
};

const toCreateProtocolApiPayload = (payload: CreateProtocolPayload) => ({
  companyId: Number.isNaN(Number(payload.companyId)) ? payload.companyId : Number(payload.companyId),
  objectId: Number.isNaN(Number(payload.objectId)) ? payload.objectId : Number(payload.objectId),
  templateId: payload.templateId,
  subtype: payload.subtype || null,
  protocolNumber: payload.protocolNumber || '',
  protocolDate: payload.protocolDate,
  samplingDate: payload.samplingDate || null,
  testingStartDate: payload.testingStartDate || null,
  testingEndDate: payload.testingEndDate || null,
  productName: payload.productName || '',
  testingBasis: payload.testingBasis || '',
  productNormativeDocument: payload.productNormativeDocument || '',
  samplingMethodDocument: payload.samplingMethodDocument || '',
  testingMethodDocument: payload.testingMethodDocument || '',
  purpose: payload.purpose || '',
  measurementDate: payload.measurementDate || payload.samplingDate || null,
  measurementTime: payload.measurementTime || null,
  measurementPlace: payload.measurementPlace || null,
  sourceNumber: payload.sourceNumber || null,
  laboratoryId: payload.laboratoryId || null,
  executorId: payload.executorId || null,
  environment: {
    temperatureC: nullableDecimal(payload.environment?.temperature),
    temperatureMinC: nullableDecimal(payload.environment?.minTemperature),
    temperatureMaxC: nullableDecimal(payload.environment?.maxTemperature),
    humidityPercent: nullableDecimal(payload.environment?.humidity),
    humidityMinPercent: nullableDecimal(payload.environment?.minHumidity),
    humidityMaxPercent: nullableDecimal(payload.environment?.maxHumidity),
    pressureKpa: nullableDecimal(payload.environment?.pressureKpa),
    windSpeedMs: nullableDecimal(payload.environment?.windSpeed),
    conditionsComment: payload.environment?.comment || '',
    source: payload.environment?.source || null,
    dataSource: payload.environment?.dataSource || null,
    observedAt: payload.environment?.observedAt || null,
    loadedAt: payload.environment?.loadedAt || null,
    manualChangeReason: payload.environment?.manualChangeReason || null,
  },
});

const toApiEnvironment = (environment: UpdateProtocolPayload['environment']) => ({
  temperatureC: nullableDecimal(environment?.temperature),
  temperatureMinC: nullableDecimal(environment?.minTemperature),
  temperatureMaxC: nullableDecimal(environment?.maxTemperature),
  humidityPercent: nullableDecimal(environment?.humidity),
  humidityMinPercent: nullableDecimal(environment?.minHumidity),
  humidityMaxPercent: nullableDecimal(environment?.maxHumidity),
  pressureKpa: nullableDecimal(environment?.pressureKpa),
  windSpeedMs: nullableDecimal(environment?.windSpeed),
  conditionsComment: environment?.comment || '',
  source: environment?.source || null,
  dataSource: environment?.dataSource || null,
  observedAt: environment?.observedAt || null,
  loadedAt: environment?.loadedAt || null,
  manualChangeReason: environment?.manualChangeReason || null,
});

const toApiResultPayload = (payload: ProtocolResultPayload) => {
  const values = { ...payload.values };
  const measurementDeviceId = payload.measurementDeviceId ?? values.measurementDeviceId ?? values.deviceId ?? null;
  const normativeId = payload.normativeId ?? values.normativeId ?? null;
  const mapped: Record<string, string | number | null | undefined> = {
    ...values,
    minValue: values.minValue ?? values.normativeMin ?? null,
    maxValue: values.maxValue ?? values.normativeMax ?? null,
    deviceId: values.deviceId ?? measurementDeviceId,
    subtype: values.subtype ?? values.factorType ?? null,
  };
  delete mapped.measurementDeviceId;
  delete mapped.factorType;
  return { ...mapped, measurementDeviceId, normativeId, values: mapped };
};

const isProtocolLike = (value: unknown) => {
  const source = asRecord(value);

  return Boolean(
    pick(source, ['id', '_id', 'protocolId']) &&
    (
      pick(source, [
        'templateId',
        'template_id',
        'templateCode',
        'template_code',
        'protocolNumber',
        'protocol_number',
        'number',
      ])
      || source.organization
      || source.testing
    )
  );
};

const protocolFromActionResponse = async (protocolId: string, response: unknown): Promise<Protocol> => {
  const axiosResponse = asRecord(response);
  const body = asRecord(axiosResponse?.data);
  const payload = body?.data ?? axiosResponse?.data ?? response;

  if (isProtocolLike(payload)) {
    return normalizeProtocol(payload);
  }

  return getProtocol(protocolId);
};

const requireProtocol = (input: unknown, action: string): Protocol => {
  const direct = asRecord(input);
  const item = direct && isProtocolLike(direct)
    ? direct
    : extractItem(input, ['protocol']);

  if (!item || !isProtocolLike(item)) {
    throw new Error(
      `Backend не вернул протокол после операции «${action}».`
    );
  }

  const protocol = normalizeProtocol(item);

  if (!protocol.id) {
    throw new Error(
      `Backend вернул протокол без id после операции «${action}».`
    );
  }

  return protocol;
};

const requireResult = (input: unknown): ProtocolResultRow => {
  const result = normalizeResult(extractItem(input, ['result']));
  if (!result.id) throw new Error('Backend не вернул сохранённый результат с id.');
  return result;
};

export async function getProtocols(params?: Record<string, string>): Promise<Protocol[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols', { params });
  return extractList(response, ['protocols']).map(normalizeProtocol);
}

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols/templates');
  return extractList(response, ['templates']) as ProtocolTemplate[];
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(
    '/protocols',
    toCreateProtocolApiPayload(payload)
  );

  const result = response.data?.data ?? response.data;
  return requireProtocol(result, 'создание');
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.get<ApiResponse<unknown>>(
    `/protocols/${protocolId}`
  );

  const payload = response.data?.data ?? response.data;
  return requireProtocol(payload, 'загрузка');
}

export const getProtocolById = getProtocol;

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}`, {
    number: payload.number,
    protocolDate: payload.protocolDate,
    objectId: payload.objectId,
    measurementDate: payload.measurementDate || null,
    measurementTime: payload.measurementTime || null,
    measurementPlace: payload.measurementPlace || null,
    formCode: payload.formCode,
    appendixNumber: payload.application,
    executor: payload.executor,
    executorId: payload.executorId || null,
    approver: payload.approver,
    organization: payload.organization,
    testing: payload.testing,
    environment: toApiEnvironment(payload.environment),
    explanatoryNote: payload.explanatoryNote,
  });
  return protocolFromActionResponse(protocolId, response);
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results`, toApiResultPayload(payload));
  return requireResult(response);
}

export async function updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}`, toApiResultPayload(payload));
  return requireResult(response);
}

export async function deleteProtocolResult(protocolId: string, resultId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}/results/${resultId}`);
}

export async function checkNormatives(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/check-normatives`);
  return protocolFromActionResponse(protocolId, response);
}

export async function readyForApproval(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/ready-for-approval`);
  return protocolFromActionResponse(protocolId, response);
}

export async function approveProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/approve`);
  return protocolFromActionResponse(protocolId, response);
}

export async function returnToDraft(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/return-to-draft`);
  return protocolFromActionResponse(protocolId, response);
}

export async function signProtocol(protocolId: string, cmsSignatureBase64: string): Promise<Protocol> {
  if (!cmsSignatureBase64.trim()) throw new Error('NCALayer не вернул CMS-подпись.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/sign`, { cmsSignatureBase64 });
  return protocolFromActionResponse(protocolId, response);
}

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(
    `/protocols/${protocolId}/replace`,
    { reason }
  );

  const result = response.data?.data ?? response.data;

  return requireProtocol(
    result,
    'создание исправленной версии'
  );
}

export async function cancelProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/cancel`);
  return protocolFromActionResponse(protocolId, response);
}

export async function previewProtocol(protocolId: string): Promise<Blob> {
  try {
    const response = await api.get<Blob>(`/protocols/${protocolId}/preview`, { responseType: 'blob' });
    if (!response.data.size) throw new Error('Backend вернул пустой файл предпросмотра.');
    return response.data;
  } catch (error) {
    throw await normalizeBlobError(error);
  }
}

export async function generateDocx(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/generate-docx`);
  return protocolFromActionResponse(protocolId, response);
}

export async function generatePdf(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/generate-pdf`);
  return protocolFromActionResponse(protocolId, response);
}

export type DownloadedProtocolFile = {
  blob: Blob;
  fileName?: string;
};

export async function downloadDocx(protocolId: string): Promise<DownloadedProtocolFile> {
  return downloadProtocolFile(protocolId, 'docx');
}

export async function downloadPdf(protocolId: string): Promise<DownloadedProtocolFile> {
  return downloadProtocolFile(protocolId, 'pdf');
}

const downloadProtocolFile = async (protocolId: string, kind: 'pdf' | 'docx'): Promise<DownloadedProtocolFile> => {
  try {
    const response = await api.get<Blob>(`/protocols/${protocolId}/download-${kind}`, { responseType: 'blob' });
    if (!response.data.size) throw new Error(`Backend вернул пустой ${kind.toUpperCase()} файл.`);
    return {
      blob: response.data,
      fileName: getContentDispositionFileName(response.headers['content-disposition']),
    };
  } catch (error) {
    throw await normalizeBlobError(error);
  }
};

const normalizeBlobError = async (error: unknown): Promise<Error> => {
  const blob = (error as { response?: { data?: unknown } })?.response?.data;
  if (blob instanceof Blob && /json|text/.test(blob.type)) {
    const text = await blob.text();
    try {
      const payload = JSON.parse(text) as { message?: string; error?: string };
      return new Error(payload.message || payload.error || getApiErrorMessage(error));
    } catch {
      if (text.trim()) return new Error(text);
    }
  }
  return error instanceof Error ? error : new Error(getApiErrorMessage(error));
};

export async function importExcel(protocolId: string, file: File): Promise<Protocol> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/import-excel`, formData);
  return protocolFromActionResponse(protocolId, response);
}

export async function addProtocolMeasurementDevice(
  protocolId: string,
  device: MeasurementDevice,
): Promise<Protocol> {
  if (device.status !== 'VALID' && device.status !== 'EXPIRING') throw new Error('Этот прибор недоступен для выбора.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/measurement-devices`, { deviceId: device.id });
  return protocolFromActionResponse(protocolId, response);
}

export async function removeProtocolMeasurementDevice(protocolId: string, deviceId: string): Promise<Protocol> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/measurement-devices/${deviceId}`);
  return protocolFromActionResponse(protocolId, response);
}

export async function searchNormative(params: Record<string, string>): Promise<NormativeSearchResult> {
  const { testingDate, ...rest } = params;
  const query = params.query || [params.code || params.pollutantCode, params.indicator].filter(Boolean).join(' ').trim();
  const requestParams = {
    ...rest,
    search: params.search || query,
    query,
    q: params.q || query,
    code: params.code || params.pollutantCode || undefined,
    pollutantCode: params.pollutantCode || params.code || undefined,
    indicator: params.indicator || undefined,
    templateId: params.templateId || undefined,
    subtype: params.subtype || undefined,
    unit: params.unit || undefined,
    objectId: params.objectId || undefined,
    date: params.date || testingDate || undefined,
  };
  let response: ApiResponse<NormativeSearchResult> | NormativeSearchResult | unknown;
  try {
    response = await api.get<ApiResponse<NormativeSearchResult> | NormativeSearchResult>('/normatives/search', { params: requestParams });
  } catch (error) {
    if (![400, 404, 405].includes(getApiStatus(error) || 0)) throw error;
    response = await api.get<ApiResponse<unknown> | unknown>('/normatives/records', { params: requestParams });
  }
  const candidates = extractNormativeRecords(response);
  const item = extractItem(response) as NormativeSearchResult;
  const normative = item.normative ? normalizeNormativeRecord(item.normative) : undefined;
  if (candidates.length) {
    return {
      ...item,
      found: true,
      normatives: candidates,
      ambiguous: candidates.length > 1 || item.ambiguous,
      normative: candidates.length === 1 ? candidates[0] : normative,
    };
  }
  return { ...item, normative };
}

export async function searchPollutants(query: string, params: Record<string, string> = {}): Promise<Pollutant[]> {
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/pollutants/search', {
      params: { ...params, query, q: query },
    });
    return extractPollutants(response);
  } catch (error) {
    if (![400, 404, 405].includes(getApiStatus(error) || 0)) throw error;
    const response = await api.get<ApiResponse<unknown> | unknown>('/normatives/search', {
      params: { ...params, query, q: query },
    });
    return extractNormativeRecords(response).map((item) => {
      const source = asRecord(item);
      return normalizePollutant({
        id: source.pollutantId || source.id,
        code: source.pollutantCode || source.code,
        name: source.indicator || source.name,
        cas: source.cas,
        formula: source.formula,
        unit: source.unit,
        testingMethod: source.testingMethod,
        samplingMethod: source.samplingMethod,
      });
    });
  }
}

export async function getMethodTemplates(): Promise<MethodTemplateResponse[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols/method-templates');
  const payload = unwrapApiResponse<unknown>(response);
  return extractList(payload, ['methodTemplates', 'method_templates', 'templates']).map(normalizeMethodTemplate);
}

export async function getMethodTemplate(id: string): Promise<MethodTemplateResponse> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/method-templates/${id}`);
  const payload = unwrapApiResponse<unknown>(response);
  return normalizeMethodTemplate(extractItem(payload, ['methodTemplate', 'method_template', 'template']));
}

export async function getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}/raw-measurements`);
  return normalizeRawMeasurements(unwrapApiResponse<unknown>(response), protocolId, resultId);
}

export async function saveRawMeasurements(
  protocolId: string,
  resultId: string,
  payload: RawMeasurementRequest[],
  methodTemplateId?: string | number | null,
): Promise<ProtocolResultRow | undefined> {
  const request: SaveRawMeasurementsRequest = {
    methodTemplateId: methodTemplateId || null,
    measurements: payload,
  };
  const response = await api.post<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/results/${resultId}/raw-measurements`,
    request,
  );
  const item = extractItem(response, ['result', 'row']);
  const source = asRecord(item);
  if (!Object.keys(source).length) return undefined;
  const row = normalizeResult(item);
  return row.id ? row : undefined;
}

export async function calculateResult(protocolId: string, resultId: string): Promise<CalculationResultResponse> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}/calculate`);
  return normalizeCalculationResult(unwrapApiResponse<unknown>(response), protocolId, resultId);
}

export async function calculateProtocolSummary(protocolId: string): Promise<ProtocolCalculationSummaryResponse> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/calculate`);
  return normalizeCalculationSummary(unwrapApiResponse<unknown>(response), protocolId);
}

export async function getCalculationHistory(protocolId: string, resultId: string): Promise<CalculationResultResponse[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}/calculation-history`);
  const payload = unwrapApiResponse<unknown>(response);
  return extractList(payload, ['history', 'calculationHistory', 'calculation_history', 'rows']).map((item) =>
    normalizeCalculationResult(item, protocolId, resultId),
  );
}

export async function getWeatherConditions(params: {
  objectId: string | number;
  coordinates?: string;
  date: string;
  time: string;
  signal?: AbortSignal;
}): Promise<WeatherConditions> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/weather/shymkent', {
    params: {
      objectId: params.objectId,
      date: params.date,
      time: params.time,
    },
    signal: params.signal,
  });
  return normalizeWeatherConditions(response);
}

export async function calculateProtocol(protocolId: string): Promise<Protocol> {
  await calculateProtocolSummary(protocolId);
  return getProtocol(protocolId);
}
