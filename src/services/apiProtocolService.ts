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
  ProtocolPage,
  QuickProtocolCreatePayload,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  SaveRawMeasurementsRequest,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';
import { canonicalProtocolResultAliases } from '../utils/protocolResultAliases';
import { canSearchNormative, normativeSearchItemToRecord, searchNormatives } from './normativeSearchService';
import type { NormativeSearchParams } from '../types/normativeSearch';
import { normalizeProtocolPrintVisibility } from '../utils/protocolPrintVisibility';

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

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    const scalar = asString(value);
    if (scalar.trim() !== '') return scalar;
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
  const aliases = canonicalProtocolResultAliases(source, values);
  const result = aliases.result;
  const normative = aliases.normative;
  const pdk = firstString(source.pdk, values.pdk);
  const status = String(firstString(source.internalStatus, source.checkStatus, source.status) || 'EMPTY_RESULT').trim().toUpperCase();
  const normalizedStatus = status === 'NORMATIVE_NOT_FOUND' && (normative || pdk) ? 'MANUAL_NORMATIVE' : status;
  const indicatorName = aliases.indicatorName;
  const code = aliases.code;
  const unit = firstString(source.unit, values.unit);
  const testingMethodDocument = aliases.testingMethodDocument;
  const samplingMethodDocument = aliases.samplingMethodDocument;
  const measurementPlace = firstString(source.measurementPlace, values.object, values.measurementPlace, values.samplingPlace);
  const sampleName = firstString(source.sampleName, values.sampleName);
  const deviceId = firstString(source.deviceId, values.device, values.deviceId);
  const measurementDeviceId = aliases.measurementDeviceId;
  const deviceName = firstString(source.deviceName, values.deviceName);
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
    resultValue: result,
    primaryReading: firstString(source.primaryReading, values.primaryReading, result),
    normative,
    normativeValue: firstString(source.normativeValue, normative),
    pdk,
    testingMethod: testingMethodDocument,
    testingMethodDocument,
    testingMethodNd: testingMethodDocument,
    samplingMethod: samplingMethodDocument,
    samplingMethodDocument,
    samplingMethodNd: samplingMethodDocument,
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
      resultValue: result,
      primaryReading: firstString(source.primaryReading, values.primaryReading, result),
      normative,
      normativeValue: firstString(source.normativeValue, normative),
      pdk,
      testingMethod: testingMethodDocument,
      testingMethodDocument,
      testingMethodNd: testingMethodDocument,
      samplingMethod: samplingMethodDocument,
      samplingMethodDocument,
      samplingMethodNd: samplingMethodDocument,
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
    sourceDocumentCode: pick(source, ['sourceDocumentCode', 'source_document_code', 'documentCode', 'dsmCode']),
    sourceDocumentName: pick(source, ['sourceDocumentName', 'source_document_name', 'documentName', 'document']),
    documentNumber: pick(source, ['documentNumber', 'document_number', 'orderNumber', 'orderNo']),
    documentDate: pick(source, ['documentDate', 'document_date', 'orderDate']),
    appendixNo: pick(source, ['appendixNo', 'appendixNumber', 'appendix', 'attachmentNo']),
    appendix: pick(source, ['appendix', 'appendixNo', 'appendixNumber', 'attachmentNo']),
    tableNo: pick(source, ['tableNo', 'tableNumber', 'table']),
    tableNumber: pick(source, ['tableNumber', 'tableNo', 'table']),
    tableTitle: pick(source, ['tableTitle', 'tableName', 'title']),
    categoryCode: pick(source, ['categoryCode', 'category_code', 'category']),
    category: pick(source, ['category', 'categoryCode', 'category_code', 'group']),
    categoryName: pick(source, ['categoryName', 'categoryTitle', 'sectionName']),
    waterType: pick(source, ['waterType', 'water_type']),
    waterUseCategory: pick(source, ['waterUseCategory', 'water_use_category']),
    matrixType: pick(source, ['matrixType', 'matrix_type']),
    assessmentCategory: pick(source, ['assessmentCategory', 'assessment_category']),
    pollutionDegree: pick(source, ['pollutionDegree', 'pollution_degree']),
    formType: pick(source, ['formType', 'form_type', 'form', 'normativeSubType', 'normativeSubtype']),
    factorType: pick(source, ['factorType', 'factor_type', 'subtype', 'physicalFactorType']),
    factorCode: pick(source, ['factorCode', 'factor_code', 'indicatorCode', 'code']),
    roomType: pick(source, ['roomType', 'room_type']),
    season: pick(source, ['season', 'period', 'yearPeriod']),
    workCategory: pick(source, ['workCategory', 'work_category', 'categoryOfWork']),
    workplaceType: pick(source, ['workplaceType', 'workplace_type', 'workPlaceType']),
    normLevel: pick(source, ['normLevel', 'norm_level', 'level', 'normativeLevel']),
    conditionJson: pick(source, ['conditionJson', 'condition_json', 'conditionsJson', 'conditions']),
    code: pick(source, ['code', 'pollutantCode', 'substanceCode', 'indicatorCode', 'referenceCode']),
    pollutantCode: pick(source, ['pollutantCode', 'pollutant_code', 'substanceCode', 'code', 'indicatorCode', 'referenceCode']),
    indicatorName: pick(source, ['indicatorName', 'indicatorNameRu', 'name', 'nameRu', 'indicator']),
    pollutantName: pick(source, ['pollutantName', 'substanceName', 'indicatorName', 'name']),
    synonyms: firstString(source.synonyms, source.synonym, source.aliases, asRecord(source.primary).synonyms),
    researchObject: pick(source, ['researchObject', 'environmentType', 'environment', 'object', 'objectName', 'medium', 'sampleType']),
    environmentType: pick(source, ['environmentType', 'environment_type', 'mediumType', 'environmentCode']),
    environment: pick(source, ['environment', 'environmentType', 'environment_type', 'researchObject', 'medium', 'sampleType']),
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
    normativeValue: pick(source, ['normativeValue', 'normative', 'value', 'pdk', 'obuv', 'limitValue']),
    pdk: pick(source, ['pdk', 'pdkValue']),
    limitValue: pick(source, ['limitValue', 'limit', 'value', 'normativeValue']),
    maxOneTimeValue: pick(source, ['maxOneTimeValue', 'max_one_time_value', 'maximumOneTimeValue', 'oneTimeValue', 'pdkMaxOneTime']),
    dailyAverageValue: pick(source, ['dailyAverageValue', 'daily_average_value', 'averageDailyValue', 'pdkDailyAverage']),
    singleValue: pick(source, ['singleValue', 'single_value', 'pdkValue']),
    obuvValue: pick(source, ['obuvValue', 'obuv_value', 'obuv']),
    obuv: pick(source, ['obuv', 'obuvValue', 'obuv_value']),
    min: pick(source, ['min', 'minValue', 'normativeMin']),
    max: pick(source, ['max', 'maxValue', 'normativeMax']),
    minValue: pick(source, ['minValue', 'min', 'normativeMin']),
    maxValue: pick(source, ['maxValue', 'max', 'normativeMax']),
    alternativeNormativeValue: pick(source, ['alternativeNormativeValue', 'alternative_normative_value', 'altValue']),
    comparisonType: (pick(source, ['comparisonType']) || 'LESS_OR_EQUAL') as NormativeRecord['comparisonType'],
    normativeDocument: pick(source, ['normativeDocument', 'document', 'documentName', 'standard']),
    hazardClass: pick(source, ['hazardClass', 'dangerClass', 'hazard', 'hazardClassName']),
    limitingIndicator: pick(source, ['limitingIndicator', 'limitingSign', 'lpv', 'limitingFactor']),
    limitingHazardIndicator: pick(source, ['limitingHazardIndicator', 'limitingIndicator', 'limitingSign', 'lpv', 'limitingFactor']),
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

const hasExcelNormativeSource = (item: NormativeRecord) => [
  item.sourceFile,
  item.importFileName,
  item.source,
  item.normativeDocument,
].some((value) => {
  const text = String(value || '').trim().toLowerCase().replace(/ё/g, 'е');
  return text.includes('.xls') || text.includes('.xlsx') || text.includes('with_pollutant_codes') || text.includes('sourcefile');
});

const extractNormativeRecords = (response: unknown): NormativeRecord[] => {
  const map = new Map<string, NormativeRecord>();
  [
    extractList(response, ['records']),
    extractList(response, ['normatives']),
    extractList(response, ['items']),
    extractList(response, ['results']),
    extractList(response, ['content']),
  ].flat().map(normalizeNormativeRecord).forEach((item, index) => {
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

const normalizeProtocolsResponse = (response: unknown): Protocol[] => {
  const data = unwrapData(response);
  const source = asRecord(data);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(source.items)
      ? source.items
      : Array.isArray(source.records)
        ? source.records
        : Array.isArray(source.protocols)
          ? source.protocols
          : Array.isArray(source.content)
            ? source.content
            : [];
  return items.map(normalizeProtocol);
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
  const rowNormativeValue = row?.normativeValue || row?.normative || row?.pdk || (row ? asString(row.values.pdk) : '');
  return {
    protocolId: pick(source, ['protocolId', 'protocol_id']) || row?.protocolId || fallbackProtocolId,
    resultId: pick(source, ['resultId', 'result_id', 'id', '_id']) || row?.id || fallbackResultId,
    result: scalarOrNull(source.result ?? row?.result),
    uncertaintyValue: scalarOrNull(source.uncertaintyValue ?? source.uncertainty_value ?? row?.uncertaintyValue),
    normativeValue: scalarOrNull(source.normativeValue ?? source.normative_value ?? rowNormativeValue),
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
  const pressureKpa = pick(source, ['pressureKpa', 'pressure_kpa']);
  const pressureHpa = pick(source, ['pressureHpa', 'pressure_hpa']);
  const convertedPressureKpa = pressureHpa && Number.isFinite(Number(pressureHpa))
    ? String(Number(pressureHpa) / 10)
    : '';
  return {
    temperature: pick(source, ['temperature', 'temperatureC']),
    minTemperature: pick(source, ['minTemperature', 'temperatureMinC']),
    maxTemperature: pick(source, ['maxTemperature', 'temperatureMaxC']),
    humidity: pick(source, ['humidity', 'humidityPercent']),
    minHumidity: pick(source, ['minHumidity', 'humidityMinPercent']),
    maxHumidity: pick(source, ['maxHumidity', 'humidityMaxPercent']),
    pressureKpa: pressureKpa || convertedPressureKpa || pick(source, ['pressure']),
    pressure: pressureKpa || convertedPressureKpa || pick(source, ['pressure']),
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
  const samplingDate = pick(testing, ['samplingDate', 'sampleDate'])
    || pick(source, ['samplingDate', 'sampleDate', 'measurementDate', 'measurement_date']);
  const testingStartDate = pick(testing, ['testingStartDate'])
    || pick(source, ['testingStartDate', 'testing_start_date']);
  const testingEndDate = pick(testing, ['testingEndDate', 'testingDate'])
    || pick(source, ['testingEndDate', 'testingDate', 'testing_end_date']);
  const purpose = pick(testing, ['testingPurpose', 'testPurpose', 'purpose'])
    || pick(source, ['testingPurpose', 'testPurpose', 'purpose']);
  const environmentalConditions = pick(testing, ['environmentConditions', 'environmentalConditions'])
    || pick(source, ['environmentConditions', 'environmentalConditions']);
  const environment = asRecord(
    source.environment
    || source.environmentalConditionsData
    || (typeof source.environmentalConditions === 'object' ? source.environmentalConditions : {}),
  );
  const resultsSource = Array.isArray(source.results) ? source.results : [];
  const devicesSource = Array.isArray(source.instruments) ? source.instruments : Array.isArray(source.measurementDevices) ? source.measurementDevices : [];
  const documentSettings = asRecord(source.documentSettings || source.document_settings);
  const printVisibility = normalizeProtocolPrintVisibility(
    source.printVisibility || source.print_visibility || documentSettings.printVisibility || documentSettings.print_visibility,
  );

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
    status: String(pick(source, ['status']) || 'DRAFT').trim().toUpperCase() as Protocol['status'],
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
    printVisibility,
    organization: {
      organizationName: pick(organization, ['organizationName', 'companyName', 'name']) || snapshot.companyName,
      organizationAddress: pick(organization, ['organizationAddress', 'legalAddress', 'actualAddress', 'address']) || snapshot.legalAddress || snapshot.actualAddress || '',
      objectName: pick(organization, ['objectName']) || snapshot.objectName || '',
      productName: pick(organization, ['productName', 'product']) || snapshot.objectName || snapshot.activityType || '',
      testingBasis: pick(organization, ['testingBasis', 'basis']) || pick(source, ['testingBasis', 'testing_basis']),
    },
    laboratory: {
      id: pick(laboratory, ['id', 'laboratoryId']) || pick(source, ['laboratoryId', 'laboratory_id', 'labId']),
      laboratoryId: pick(laboratory, ['laboratoryId', 'id']) || pick(source, ['laboratoryId', 'laboratory_id', 'labId']),
      name: pick(laboratory, ['name', 'laboratoryName', 'legalName']) || pick(source, ['laboratoryName']),
      laboratoryName: pick(laboratory, ['laboratoryName', 'name', 'legalName']) || pick(source, ['laboratoryName']),
      legalName: pick(laboratory, ['legalName', 'fullName']),
      bin: pick(laboratory, ['bin', 'iin', 'taxId']),
      address: pick(laboratory, ['address', 'laboratoryAddress', 'legalAddress']),
      laboratoryAddress: pick(laboratory, ['laboratoryAddress', 'address', 'legalAddress']),
      phone: pick(laboratory, ['phone', 'phoneNumber']),
      email: pick(laboratory, ['email']),
      accreditationNumber: pick(laboratory, ['accreditationNumber', 'certificateNumber', 'certificateNo', 'accreditationCertificateNumber']),
      accreditationIssuedAt: pick(laboratory, ['accreditationIssuedAt', 'certificateIssuedAt', 'accreditationDate']),
      accreditationValidUntil: pick(laboratory, ['accreditationValidUntil', 'certificateValidUntil', 'validUntil', 'certificateExpiresAt']),
      directorId: pick(laboratory, ['directorId']),
      directorName: pick(laboratory, ['directorName', 'director']),
      director: pick(laboratory, ['director', 'directorName']),
      laboratoryHeadId: pick(laboratory, ['laboratoryHeadId', 'headId']),
      laboratoryHeadName: pick(laboratory, ['laboratoryHeadName', 'headName', 'laboratoryHead', 'head']),
      laboratoryHead: pick(laboratory, ['laboratoryHead', 'head', 'laboratoryHeadName', 'headName']),
      executorId: pick(laboratory, ['executorId']) || pick(source, ['executorId', 'executor_id']),
      executorName: pick(laboratory, ['executorName', 'executor']) || pick(source, ['executor']),
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
    version: source.version === undefined || source.version === null ? undefined : asString(source.version),
    replacedByProtocolId: pick(source, ['replacedByProtocolId', 'replaced_by_protocol_id']),
    replacesProtocolId: pick(source, ['replacesProtocolId', 'replaces_protocol_id']),
  };
};

const toCreateProtocolApiPayload = (payload: CreateProtocolPayload) => {
  const sampleDate = payload.sampleDate || payload.samplingDate || payload.measurementDate || null;

  return {
    companyId: Number.isNaN(Number(payload.companyId)) ? payload.companyId : Number(payload.companyId),
    objectId: Number.isNaN(Number(payload.objectId)) ? payload.objectId : Number(payload.objectId),
    templateId: payload.templateId,
    subtype: payload.subtype || null,
    protocolNumber: payload.protocolNumber || '',
    protocolDate: payload.protocolDate,
    sampleDate,
    samplingDate: sampleDate,
    testingStartDate: payload.testingStartDate || null,
    testingEndDate: payload.testingEndDate || null,
    productName: payload.productName || '',
    testingBasis: payload.testingBasis || '',
    productNormativeDocument: payload.productNormativeDocument || '',
    samplingMethodDocument: payload.samplingMethodDocument || '',
    testingMethodDocument: payload.testingMethodDocument || '',
    purpose: payload.purpose || '',
    measurementDate: payload.measurementDate || sampleDate,
    measurementTime: payload.measurementTime || null,
    measurementPlace: payload.measurementPlace || null,
    sourceNumber: payload.sourceNumber || null,
    laboratoryId: payload.laboratoryId || null,
    executorId: payload.executorId || null,
    sourceDocumentCode: payload.sourceDocumentCode || null,
    docxTemplateCode: payload.docxTemplateCode || '',
    normativeTemplateId: payload.normativeTemplateId || '',
    environmentType: payload.environmentType || '',
    defaultUnit: payload.defaultUnit || '',
    waterType: payload.waterType || '',
    waterUseCategory: payload.waterUseCategory || '',
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
    printVisibility: payload.printVisibility || {},
  };
};

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

type ApiResultValue = string | number | null | undefined | Array<string | number | null>;

const resultIdKeys = new Set(['normativeId', 'measurementDeviceId', 'deviceId', 'methodTemplateId']);
const resultNumericKeys = new Set([
  'primaryReading',
  'measurementReadings',
  'readings',
  'result',
  'resultMg',
  'resultMgM3',
  'resultValue',
  'normative',
  'normativeValue',
  'normativeMin',
  'normativeMax',
  'minValue',
  'maxValue',
  'value',
]);

const decimalNumberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const sanitizeResultField = (key: string, value: ApiResultValue): ApiResultValue => {
  if (Array.isArray(value)) {
    const sanitized = value.map((item) => resultNumericKeys.has(key) ? decimalNumberOrNull(item) : item);
    return sanitized.length ? sanitized : null;
  }
  if (resultIdKeys.has(key)) return String(value ?? '').trim() || null;
  if (resultNumericKeys.has(key)) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    const parsed = decimalNumberOrNull(value);
    return parsed ?? value;
  }
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
};

const sanitizeResultValues = (values: Record<string, ApiResultValue>) => Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, sanitizeResultField(key, value)])
) as Record<string, ApiResultValue>;

const toApiResultPayload = (payload: ProtocolResultPayload) => {
  const values = { ...payload.values };
  const measurementDeviceId = sanitizeResultField('measurementDeviceId', payload.measurementDeviceId ?? values.measurementDeviceId ?? values.deviceId ?? null);
  const normativeId = sanitizeResultField('normativeId', payload.normativeId ?? values.normativeId ?? null);
  const mapped = sanitizeResultValues({
    ...values,
    minValue: values.minValue ?? values.normativeMin ?? null,
    maxValue: values.maxValue ?? values.normativeMax ?? null,
    deviceId: values.deviceId ?? measurementDeviceId,
    subtype: values.subtype ?? values.factorType ?? null,
  });
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
  // Action and PATCH endpoints may return only changed fields. Always reload
  // the aggregate so absent collections cannot erase data in the editor.
  void response;
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

const extractActionResult = (input: unknown): unknown => {
  const axiosResponse = asRecord(input);
  const responseBody = asRecord(axiosResponse.data);
  const payload = responseBody.data ?? axiosResponse.data ?? input;
  const payloadRecord = asRecord(payload);

  if (payloadRecord.id || payloadRecord._id || payloadRecord.resultId) return payload;
  return extractItem(payload, ['result', 'row', 'item']);
};

const requireResult = (input: unknown): ProtocolResultRow => {
  const result = normalizeResult(extractActionResult(input));
  if (!result.id) throw new Error('Backend не вернул сохранённый результат с id.');
  return result;
};

export async function getProtocols(params?: Record<string, string>): Promise<Protocol[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols', { params });
  return normalizeProtocolsResponse(response);
}

export async function getProtocolsPage(params?: Record<string, string>, signal?: AbortSignal): Promise<ProtocolPage> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols', { params, signal });
  const items = normalizeProtocolsResponse(response);
  const payload = asRecord(unwrapData(response));
  const responseBody = asRecord(asRecord(response).data);
  const page = Number(payload.number ?? payload.page ?? responseBody.number ?? params?.page ?? 0);
  const size = Number(payload.size ?? responseBody.size ?? params?.size ?? (items.length || 1));
  const hasTotalElements = payload.totalElements !== undefined || payload.total_elements !== undefined || responseBody.totalElements !== undefined;
  const hasTotalPages = payload.totalPages !== undefined || payload.total_pages !== undefined || responseBody.totalPages !== undefined;
  const inferredTotal = Math.max(0, page) * Math.max(1, size) + items.length;
  const totalElements = Number(payload.totalElements ?? payload.total_elements ?? responseBody.totalElements ?? inferredTotal);
  const totalPages = Number(payload.totalPages ?? payload.total_pages ?? responseBody.totalPages
    ?? (hasTotalElements
      ? Math.max(1, Math.ceil(totalElements / Math.max(1, size)))
      : Math.max(1, page + (items.length >= size ? 2 : 1))));
  return {
    items,
    page: Number.isFinite(page) ? page : 0,
    size: Number.isFinite(size) && size > 0 ? size : Math.max(1, items.length),
    totalElements: Number.isFinite(totalElements) ? totalElements : items.length,
    totalPages: hasTotalPages || items.length < size
      ? (Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1)
      : Math.max(page + 2, totalPages),
  };
}

let protocolTemplatesRequest: Promise<ProtocolTemplate[]> | null = null;

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  if (!protocolTemplatesRequest) {
    protocolTemplatesRequest = api
      .get<ApiResponse<unknown> | unknown>('/protocols/templates')
      .then((response) => extractList(response, ['templates']) as ProtocolTemplate[])
      .finally(() => {
        protocolTemplatesRequest = null;
      });
  }
  return protocolTemplatesRequest;
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(
    '/protocols',
    toCreateProtocolApiPayload(payload)
  );

  const result = response.data?.data ?? response.data;
  const protocol = requireProtocol(result, 'создание');
  return { ...protocol, printVisibility: Object.keys(protocol.printVisibility || {}).length ? protocol.printVisibility : payload.printVisibility };
}

export async function quickCreateProtocol(payload: QuickProtocolCreatePayload): Promise<Protocol> {
  const measurements = payload.measurements.map((measurement) => {
    const measurementDeviceId = String(
      measurement.measurementDeviceId
      || measurement.deviceId
      || measurement.values?.measurementDeviceId
      || measurement.values?.deviceId
      || '',
    ).trim();
    return {
      ...measurement,
      ...(measurementDeviceId ? { measurementDeviceId, deviceId: measurementDeviceId } : {}),
      values: {
        ...(measurement.values || {}),
        ...(measurementDeviceId ? { measurementDeviceId, deviceId: measurementDeviceId } : {}),
      },
    };
  });
  const response = await api.post<ApiResponse<unknown> | unknown>('/protocols/quick-create', { ...payload, measurements });
  const result = unwrapData(response);
  const protocol = requireProtocol(result, 'быстрое создание');
  return { ...protocol, printVisibility: Object.keys(protocol.printVisibility || {}).length ? protocol.printVisibility : payload.printVisibility };
}

export async function refreshLaboratoryData(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/refresh-laboratory-data`);
  return requireProtocol(unwrapData(response), 'refresh laboratory data');
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
    productName: payload.organization.productName || '',
    testingBasis: payload.organization.testingBasis || '',
    sampleDate: payload.testing.samplingDate || payload.measurementDate || null,
    samplingDate: payload.testing.samplingDate || payload.measurementDate || null,
    testingStartDate: payload.testing.testingStartDate || null,
    testingEndDate: payload.testing.testingEndDate || payload.testing.testingDate || null,
    productNormativeDocument: payload.testing.productNormativeDocument || '',
    samplingMethodDocument: payload.testing.samplingMethodDocument || '',
    testingMethodDocument: payload.testing.testingMethodDocument || '',
    purpose: payload.testing.testingPurpose || '',
    environmentalConditions: payload.testing.environmentConditions || '',
    organization: payload.organization,
    testing: payload.testing,
    environment: toApiEnvironment(payload.environment),
    explanatoryNote: payload.explanatoryNote,
    printVisibility: payload.printVisibility || {},
  });
  const protocol = await protocolFromActionResponse(protocolId, response);
  return { ...protocol, printVisibility: Object.keys(protocol.printVisibility || {}).length ? protocol.printVisibility : payload.printVisibility };
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
  // Some backend versions return 204 or a partial result after PATCH. Reload
  // the protocol so the editor always receives the actually persisted row.
  const protocol = await getProtocol(protocolId);
  const saved = protocol.results.find((row) => String(row.id) === String(resultId));
  if (saved) return saved;
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

const duplicateProtocolFallback = async (protocolId: string): Promise<Protocol> => {
  const source = await getProtocol(protocolId);
  const created = await createProtocol({
    companyId: source.companyId || '',
    objectId: source.objectId || '',
    templateId: source.templateId,
    subtype: source.subtype,
    protocolDate: source.protocolDate,
    sampleDate: source.testing.samplingDate || source.measurementDate,
    samplingDate: source.testing.samplingDate,
    testingStartDate: source.testing.testingStartDate,
    testingEndDate: source.testing.testingEndDate,
    measurementDate: source.measurementDate,
    measurementTime: source.measurementTime,
    measurementPlace: source.measurementPlace,
    laboratoryId: source.laboratory?.laboratoryId || source.laboratory?.id,
    executorId: source.executorId || source.laboratory?.executorId,
    productName: source.organization.productName,
    testingBasis: source.organization.testingBasis,
    productNormativeDocument: source.testing.productNormativeDocument,
    samplingMethodDocument: source.testing.samplingMethodDocument,
    testingMethodDocument: source.testing.testingMethodDocument,
    purpose: source.testing.testingPurpose,
    environment: source.environment,
    printVisibility: source.printVisibility,
  });

  await Promise.all((source.measurementDevices || []).map(async (device) => {
    if (!device.deviceId) return;
    try {
      await api.post<ApiResponse<unknown> | unknown>(`/protocols/${created.id}/measurement-devices`, { deviceId: device.deviceId });
    } catch (error) {
      console.warn(`Measurement device ${device.deviceId} was not copied to protocol ${created.id}.`, error);
      // Device copying is best-effort when backend has no duplicate endpoint.
    }
  }));

  const copiedResults: Array<{ source: ProtocolResultRow; target: ProtocolResultRow }> = [];
  for (const row of source.results || []) {
    const rowValues = asRecord(row.values);
    const saved = await addProtocolResult(created.id, {
      measurementDeviceId: row.measurementDeviceId || asString(rowValues.measurementDeviceId),
      normativeId: row.normativeReference?.id || asString(rowValues.normativeId),
      values: {
        ...row.values,
        copiedFromResultId: row.id,
      },
    });
    copiedResults.push({ source: row, target: saved });
  }

  for (const pair of copiedResults) {
    try {
      const raw = await getRawMeasurements(protocolId, pair.source.id);
      if (raw.measurements.length) {
        await saveRawMeasurements(created.id, pair.target.id, raw.measurements, raw.methodTemplate?.id);
      }
    } catch (error) {
      console.warn(`Raw measurements for result ${pair.source.id} were not copied to protocol ${created.id}.`, error);
      // Raw measurements are copied only when backend exposes them for the source row.
    }
  }

  return getProtocol(created.id);
};

export async function duplicateProtocol(protocolId: string): Promise<Protocol> {
  for (const endpoint of [`/protocols/${protocolId}/duplicate`, `/protocols/${protocolId}/copy`]) {
    try {
      const response = await api.post<ApiResponse<unknown> | unknown>(endpoint);
      return requireProtocol(unwrapData(response), 'создание копии');
    } catch (error) {
      if (![404, 405].includes(getApiStatus(error) || 0)) throw error;
    }
  }
  return duplicateProtocolFallback(protocolId);
}

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  for (const endpoint of [`/protocols/${protocolId}/correction`, `/protocols/${protocolId}/replace`]) {
    try {
      const response = await api.post<ApiResponse<unknown> | unknown>(endpoint, { reason });
      return requireProtocol(unwrapData(response), 'создание исправленной версии');
    } catch (error) {
      if (![404, 405].includes(getApiStatus(error) || 0)) throw error;
    }
  }
  throw new Error('Backend не поддерживает создание исправленной версии протокола.');
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

const protocolFileMimeTypes: Record<'pdf' | 'docx', string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const ensureFileExtension = (fileName: string | undefined, extension: 'pdf' | 'docx') => {
  const normalized = fileName?.trim();
  if (!normalized) return undefined;
  return normalized.toLowerCase().endsWith(`.${extension}`) ? normalized : `${normalized}.${extension}`;
};

const normalizeDownloadedProtocolBlob = (blob: Blob, kind: 'pdf' | 'docx') =>
  blob.type === protocolFileMimeTypes[kind] ? blob : new Blob([blob], { type: protocolFileMimeTypes[kind] });

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
      blob: normalizeDownloadedProtocolBlob(response.data, kind),
      fileName: ensureFileExtension(getContentDispositionFileName(response.headers['content-disposition']), kind),
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

const NORMATIVE_SEARCH_LIMIT = 20;
const SEARCH_CACHE_TTL_MS = 30_000;
const canRunNormativeSearch = canSearchNormative;
const pollutantSearchCache = new Map<string, { expiresAt: number; value: Pollutant[] }>();
const searchCacheKey = (params: Record<string, string>) => JSON.stringify(
  Object.entries(params).filter(([, value]) => value !== undefined).sort(([left], [right]) => left.localeCompare(right)),
);

export async function searchNormative(params: Record<string, string>, signal?: AbortSignal): Promise<NormativeSearchResult> {
  const query = params.query || params.search || params.q || [params.code || params.pollutantCode, params.indicator].filter(Boolean).join(' ').trim();
  if (!canRunNormativeSearch(query)) return { found: false, normatives: [], items: [] };
  const requestParams: NormativeSearchParams = {
    query,
    templateId: params.templateId || undefined,
    sourceDocumentCode: params.sourceDocumentCode || undefined,
    environmentType: params.environmentType || undefined,
    categoryCode: params.categoryCode || undefined,
    waterType: params.waterType || undefined,
    waterUseCategory: params.waterUseCategory || undefined,
    page: params.page ? Number(params.page) : 0,
    size: params.size || params.limit ? Number(params.size || params.limit) : 30,
    factorType: params.factorType || undefined,
    factorCode: params.factorCode || undefined,
    roomType: params.roomType || undefined,
    season: params.season || undefined,
    workCategory: params.workCategory || undefined,
    workplaceType: params.workplaceType || undefined,
    normLevel: params.normLevel || undefined,
    noiseType: params.noiseType || undefined,
    visualWorkCategory: params.visualWorkCategory || undefined,
    lightingType: params.lightingType || undefined,
    unit: params.unit || undefined,
    status: params.status === 'REVIEW' || params.status === 'ALL' ? params.status : 'ACTIVE',
  };
  const result = await searchNormatives(requestParams, signal);
  const normatives = result.items.map(normativeSearchItemToRecord);
  return {
    found: normatives.length > 0,
    normatives,
    items: normatives,
    ambiguous: normatives.length > 1,
    normative: normatives.length === 1 ? normatives[0] : undefined,
  };
}

export async function searchPollutants(query: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<Pollutant[]> {
  if (!canRunNormativeSearch(query)) return [];
  const cacheKey = searchCacheKey({ ...params, query });
  const cached = pollutantSearchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const remember = (value: Pollutant[]) => {
    pollutantSearchCache.set(cacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value });
    return value;
  };
  const fromNormatives = async () => {
    const response = await api.get<ApiResponse<unknown> | unknown>('/normatives/search', {
      params: {
        ...params,
        query,
        q: query,
        code: params.code || query,
        pollutantCode: params.pollutantCode || query,
        search: params.search || query,
        limit: params.limit || NORMATIVE_SEARCH_LIMIT,
      },
      signal,
    });
    return extractNormativeRecords(response).map((item) => {
      const source = asRecord(item);
      return normalizePollutant({
        id: source.pollutantId || source.id,
        code: source.pollutantCode || source.code,
        name: source.indicator || source.indicatorName || source.pollutantName || source.name,
        cas: source.cas || source.casNumber,
        formula: source.formula || source.chemicalFormula,
        unit: source.unit,
        testingMethod: source.testingMethod,
        samplingMethod: source.samplingMethod,
      });
    });
  };
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/pollutants/search', {
      params: { ...params, query, q: query, limit: params.limit || NORMATIVE_SEARCH_LIMIT },
      signal,
    });
    const pollutants = extractPollutants(response);
    return remember(pollutants);
  } catch (error) {
    if (![400, 404, 405].includes(getApiStatus(error) || 0)) throw error;
    return remember(await fromNormatives());
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
      coordinates: params.coordinates || undefined,
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
