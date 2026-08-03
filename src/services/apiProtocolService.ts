import api, { ApiResponse } from './api';
import {
  extractItem,
  extractList,
  getApiErrorMessage,
  getApiStatus,
  getContentDispositionFileName,
  unwrapApiData,
  unwrapApiResponse,
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
  ProtocolListQuery,
  ProtocolResultPayload,
  ProtocolResultValue,
  ProtocolResultRow,
  ProtocolTemplate,
  ProtocolTemplateId,
  RawMeasurementRequest,
  RawMeasurementsResponse,
  SaveRawMeasurementsRequest,
  UpdateProtocolPayload,
  WeatherConditions,
} from '../types/protocols';
import type {
  CancelProtocolRequest,
  QuickCreateProtocolRequest,
  ReplaceProtocolRequest,
  ReturnForRevisionRequest,
  SignProtocolRequest,
  ProtocolVersionRequest,
} from '../features/protocols/api/protocolContracts';
import { normalizeProtocolStatus } from '../config/protocolStatus';
import { canonicalProtocolResultAliases } from '../utils/protocolResultAliases';
import { canSearchNormative, normativeSearchItemToRecord, searchNormatives } from './normativeSearchService';
import { debugProtocolPayload } from '../utils/protocolDebug';
import type { NormativeSearchRequest } from './normativeSearchService';
import { normalizeProtocolPrintVisibility } from '../utils/protocolPrintVisibility';
import {
  mapProtocolFormToPatchRequest,
  mapProtocolResultFormToRequest,
  mapProtocolsQuery,
} from '../features/protocols/api/protocolMappers';
import { mapBackendProtocolType, mapFrontendProtocolType } from '../features/protocols/api/protocolTypeMapper';
import { mapFormToCreateProtocolRequest } from '../features/protocols/mappers/mapFormToCreateProtocolRequest';
import { mapProtocolPermissions } from '../features/protocols/mappers/protocolPermissionMapper';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' ? value as UnknownRecord : {};
const unwrapData = (value: unknown): unknown => unwrapApiData(value);
const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

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
const requireProtocolVersion = (value: unknown): number => {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error('Backend contract error: protocol.version must be a non-negative integer.');
  }
  return version;
};

const normalizeCompanySnapshot = (raw: UnknownRecord): ProtocolCompanySnapshot => {
  const snapshot = asRecord(raw.companySnapshot || raw.company_snapshot || {});
  const company = asRecord(raw.company);
  const organization = asRecord(raw.organization || {});
  const companyObject = asRecord(company.object || company.companyObject || company.company_object);
  const organizationObject = asRecord(organization.object || organization.companyObject || organization.company_object);
  const object = Object.keys(companyObject).length ? companyObject : organizationObject;
  return {
    companyName: pick(company, ['name', 'companyName']) || pick(organization, ['organizationName', 'companyName', 'name']) || pick(snapshot, ['companyName', 'name']) || pick(raw, ['companyName']),
    bin: pick(company, ['bin', 'iin']) || pick(organization, ['bin', 'iin']) || pick(snapshot, ['bin']),
    legalAddress: pick(company, ['legalAddress']) || pick(organization, ['legalAddress']) || pick(snapshot, ['legalAddress']),
    actualAddress: pick(company, ['actualAddress']) || pick(organization, ['actualAddress', 'organizationAddress']) || pick(snapshot, ['actualAddress']),
    phone: pick(company, ['phone']) || pick(organization, ['phone']) || pick(snapshot, ['phone']),
    email: pick(company, ['email']) || pick(organization, ['email']) || pick(snapshot, ['email']),
    director: pick(company, ['director', 'directorFullName']) || pick(organization, ['director']) || pick(snapshot, ['director']),
    contactPerson: pick(company, ['contactPerson']) || pick(organization, ['contactPerson']) || pick(snapshot, ['contactPerson']),
    activityType: pick(company, ['activityType']) || pick(organization, ['activityType']) || pick(snapshot, ['activityType']),
    objectName: pick(object, ['name', 'objectName']) || pick(company, ['objectName']) || pick(organization, ['objectName']) || pick(snapshot, ['objectName']) || pick(raw, ['objectName']),
    objectAddress: pick(object, ['address', 'objectAddress']) || pick(company, ['objectAddress']) || pick(organization, ['objectAddress']) || pick(snapshot, ['objectAddress']) || pick(raw, ['objectAddress']),
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
  const measurementDeviceSource = asRecord(source.measurementDevice || source.deviceSnapshot || source.device_snapshot);
  const deviceSource = asRecord(source.device);
  const deviceId = firstString(source.deviceId, measurementDeviceSource.id, deviceSource.id, values.device, values.deviceId);
  const measurementDeviceId = aliases.measurementDeviceId;
  const deviceName = firstString(source.deviceName, measurementDeviceSource.name, deviceSource.name, values.deviceName);
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
    measurementDevice: Object.keys(measurementDeviceSource).length ? {
      id: firstString(measurementDeviceSource.id, measurementDeviceId),
      name: firstString(measurementDeviceSource.name) || undefined,
      model: firstString(measurementDeviceSource.model) || undefined,
      serialNumber: firstString(measurementDeviceSource.serialNumber) || undefined,
      verificationNumber: firstString(measurementDeviceSource.verificationNumber) || undefined,
      verificationValidUntil: firstString(measurementDeviceSource.verificationValidUntil) || undefined,
    } : undefined,
    device: Object.keys(deviceSource).length ? {
      id: firstString(deviceSource.id, deviceId),
      name: firstString(deviceSource.name) || undefined,
      model: firstString(deviceSource.model) || undefined,
      serialNumber: firstString(deviceSource.serialNumber) || undefined,
      verificationNumber: firstString(deviceSource.verificationNumber) || undefined,
      verificationValidUntil: firstString(deviceSource.verificationValidUntil) || undefined,
    } : undefined,
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
  const temperature = pick(source, ['temperature', 'temperatureC']);
  const humidity = pick(source, ['humidity', 'humidityPercent']);
  const pressure = pressureKpa || convertedPressureKpa || pick(source, ['pressure']);
  const windSpeed = pick(source, ['windSpeed', 'windSpeedMs']);
  const rawSource = pick(source, ['source']);
  const explicitlyUnavailable = source.available === false || rawSource.toUpperCase() === 'UNAVAILABLE';
  const hasValues = [temperature, humidity, pressure, windSpeed].some((value) => String(value || '').trim());
  const available = !explicitlyUnavailable && hasValues;
  return {
    temperature,
    minTemperature: pick(source, ['minTemperature', 'temperatureMinC']),
    maxTemperature: pick(source, ['maxTemperature', 'temperatureMaxC']),
    humidity,
    minHumidity: pick(source, ['minHumidity', 'humidityMinPercent']),
    maxHumidity: pick(source, ['maxHumidity', 'humidityMaxPercent']),
    pressureKpa: pressure,
    pressure,
    windSpeed,
    available,
    status: available ? 'LOADED' : 'API_UNAVAILABLE',
    source: 'API',
    dataSource: pick(source, ['dataSource', 'sourceName', 'provider', 'source']) || 'Погодный сервис',
    observedAt: pick(source, ['observedAt', 'weatherObservedAt', 'recordedAt', 'weatherTimestamp', 'observationTime']),
    weatherObservedAt: pick(source, ['weatherObservedAt', 'observedAt', 'recordedAt', 'weatherTimestamp', 'observationTime']),
    loadedAt: pick(source, ['loadedAt', 'observedAt']) || new Date().toISOString(),
    warning: pick(source, ['warning']) || (!available
      ? 'Автоматические погодные данные не получены. Заполните условия среды вручную'
      : ''),
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
  const signaturesSource = Array.isArray(source.signatures)
    ? source.signatures
    : Array.isArray(source.protocolSignatures)
      ? source.protocolSignatures
      : [];
  const signatures = signaturesSource.map((item, index) => {
    const signature = asRecord(item);
    return {
      id: Number(signature.id ?? index + 1),
      userId: Number(signature.userId ?? signature.signerId ?? signature.employeeId ?? 0),
      signerFullName: pick(signature, ['signerFullName', 'fullName', 'signerName', 'userName']),
      signerPosition: pick(signature, ['signerPosition', 'position', 'jobTitle']) || null,
      signedAt: pick(signature, ['signedAt', 'createdAt', 'signed_at']),
    };
  }).sort((left, right) => new Date(left.signedAt).getTime() - new Date(right.signedAt).getTime());
  const signatureCount = Number(source.signatureCount);
  const maxSignatures = Number(source.maxSignatures);
  const header = asRecord(source.header);
  const conditions = asRecord(source.conditions || header.conditions);
  const firstResultValues = asRecord(asRecord(resultsSource[0]).values);
  const waterType = pick(conditions, ['waterType', 'water_type'])
    || pick(environment, ['waterType', 'water_type'])
    || pick(source, ['waterType', 'water_type'])
    || pick(testing, ['waterType', 'water_type'])
    || pick(firstResultValues, ['waterType', 'water_type']);
  const waterUseCategory = pick(conditions, ['waterUseCategory', 'water_use_category'])
    || pick(environment, ['waterUseCategory', 'water_use_category'])
    || pick(source, ['waterUseCategory', 'water_use_category'])
    || pick(testing, ['waterUseCategory', 'water_use_category'])
    || pick(firstResultValues, ['waterUseCategory', 'water_use_category']);
  const devicesSource = [
    ...(Array.isArray(source.measurementDevices) ? source.measurementDevices : []),
    ...(Array.isArray(source.instruments) ? source.instruments : []),
  ];
  const documentSettings = asRecord(source.documentSettings || source.document_settings);
  const printVisibility = normalizeProtocolPrintVisibility(
    source.printVisibility || source.print_visibility || documentSettings.printVisibility || documentSettings.print_visibility,
  );
  const apiStatus = pick(source, ['status']);

  return {
    id: pick(source, ['id', '_id', 'protocolId']),
    protocolNumber,
    number: protocolNumber,
    templateId: mapBackendProtocolType(pick(source, [
      'templateId',
      'template_id',
      'templateCode',
      'template_code',
    ])),
    subtype: (pick(source, ['subtype', 'physicalFactorType', 'physical_factor_type'])
      || pick(testing, ['physicalFactorType'])) as Protocol['subtype'],
    templateName: pick(source, ['templateName', 'template_name']),
    status: normalizeProtocolStatus(apiStatus),
    apiStatus,
    companyId: pick(source, ['companyId', 'company_id']),
    objectId: pick(source, ['objectId', 'object_id']),
    companySnapshot: snapshot,
    protocolDate: pick(source, ['protocolDate', 'protocol_date']),
    measurementDate: pick(source, ['measurementDate', 'measurement_date']) || samplingDate,
    measurementTime: pick(source, ['measurementTime', 'measurement_time']),
    measurementPlace: pick(source, ['measurementPlace', 'measurement_place']),
    sampleNumber: pick(source, ['sampleNumber', 'sample_number']) || pick(testing, ['sampleNumber']),
    samplingPlace: pick(source, ['samplingPlace', 'sampling_place']) || pick(testing, ['samplingPlace']),
    samplingDepth: pick(source, ['samplingDepth', 'sampling_depth']) || pick(testing, ['samplingDepth']),
    sourceNumber: pick(source, ['sourceNumber', 'source_number']),
    formCode: pick(source, ['formCode', 'form_code']),
    appendixNumber: pick(source, ['appendixNumber', 'appendix_number']),
    samplingDate,
    testingStartDate,
    testingEndDate,
    purpose,
    environmentalConditions,
    waterType,
    waterUseCategory,
    conditions: {
      ...conditions,
      ...(waterType ? { waterType } : {}),
      ...(waterUseCategory ? { waterUseCategory } : {}),
    } as Record<string, ProtocolResultValue>,
    environment: {
      temperature: pick(environment, ['temperatureC', 'temperature']),
      minTemperature: pick(environment, ['temperatureMinC', 'minTemperature', 'temperatureMin']),
      maxTemperature: pick(environment, ['temperatureMaxC', 'maxTemperature', 'temperatureMax']),
      humidity: pick(environment, ['humidityPercent', 'humidity']),
      minHumidity: pick(environment, ['humidityMinPercent', 'minHumidity', 'humidityMin']),
      maxHumidity: pick(environment, ['humidityMaxPercent', 'maxHumidity', 'humidityMax']),
      pressureKpa: pick(environment, ['pressureKpa', 'pressure']),
      pressureHpa: pick(environment, ['pressureHpa']),
      windSpeed: pick(environment, ['windSpeedMs', 'windSpeed']),
      comment: pick(environment, ['conditionsComment', 'comment']) || environmentalConditions,
      status: pick(environment, ['status']) as ProtocolEnvironmentalConditions['status'],
      source: (pick(environment, ['source']) || 'API') as ProtocolEnvironmentalConditions['source'],
      dataSource: pick(environment, ['dataSource', 'sourceName', 'provider']),
      observedAt: pick(environment, ['observedAt', 'weatherObservedAt', 'recordedAt', 'weatherTimestamp']),
      weatherObservedAt: pick(environment, ['weatherObservedAt', 'observedAt', 'recordedAt', 'weatherTimestamp']),
      loadedAt: pick(environment, ['loadedAt']),
      manualChangeReason: pick(environment, ['manualChangeReason', 'changeReason']),
    },
    productName: pick(source, ['productName']) || pick(organization, ['productName']),
    testingBasis: pick(source, ['testingBasis']) || pick(organization, ['testingBasis']),
    productNormativeDocument: pick(source, ['productNormativeDocument']) || pick(testing, ['productNormativeDocument']),
    samplingMethodDocument: pick(source, ['samplingMethodDocument']) || pick(testing, ['samplingMethodDocument']),
    testingMethodDocument: pick(source, ['testingMethodDocument']) || pick(testing, ['testingMethodDocument']),
    complianceDocument: pick(source, ['complianceDocument', 'compliance_document']),
    explanatoryNote: pick(source, ['explanatoryNote', 'note']),
    complianceResult: pick(source, ['complianceStatus', 'complianceResult', 'overallStatus', 'internalStatus']),
    executor: pick(asRecord(source.executor), ['fullName', 'name']) || pick(source, ['executorName']) || pick(laboratory, ['executor', 'executorName']),
    executorId: pick(source, ['executorId', 'laboratoryEmployeeId', 'executor_id']) || pick(asRecord(source.executor), ['laboratoryEmployeeId', 'id']) || pick(laboratory, ['executorId']),
    approver: pick(source, ['approver']),
    approvedAt: pick(source, ['approvedAt', 'approved_at']),
    signedAt: pick(source, ['signedAt', 'signed_at']),
    signedBy: pick(source, ['signedBy', 'signedByName', 'signed_by']),
    signatureCount,
    maxSignatures,
    signedByCurrentUser: source.signedByCurrentUser === true,
    signatures,
    hasDocx: source.hasDocx === true || Boolean(source.docxDocumentId || source.docxFileId || source.docxUrl),
    hasPdf: source.hasPdf === true || Boolean(source.pdfDocumentId || source.pdfFileId || source.pdfUrl),
    docxFileId: pick(source, ['docxFileId', 'docxDocumentId']),
    pdfFileId: pick(source, ['pdfFileId', 'pdfDocumentId']),
    finalPdfFileId: pick(source, ['finalPdfFileId', 'pdfFileId', 'pdfDocumentId']),
    finalPdfHash: pick(source, ['finalPdfHash', 'pdfFileHash', 'pdfHash']),
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
    version: requireProtocolVersion(source.version),
    replacedByProtocolId: pick(source, ['replacedByProtocolId', 'replaced_by_protocol_id']),
    replacesProtocolId: pick(source, ['replacesProtocolId', 'replaces_protocol_id']),
    orderId: pick(source, ['orderId', 'order_id']),
    orderServiceItemId: pick(source, ['orderServiceItemId', 'order_service_item_id']),
    orderNumber: pick(source, ['orderNumber', 'order_number']),
    pekProgramId: pick(source, ['pekProgramId', 'pek_program_id']),
    pekReportId: pick(source, ['pekReportId', 'pek_report_id']),
    pekControlItemId: pick(source, ['pekControlItemId', 'pek_control_item_id']),
    pekControlEventId: pick(source, ['pekControlEventId', 'pek_control_event_id']),
    monitoringPointId: pick(source, ['monitoringPointId', 'monitoring_point_id']),
    emissionSourceId: pick(source, ['emissionSourceId', 'emission_source_id']),
    waterOutletId: pick(source, ['waterOutletId', 'water_outlet_id']),
    permissions: mapProtocolPermissions(source.permissions),
    availableActions: Array.isArray(source.availableActions)
      ? source.availableActions.map((item) => typeof item === 'string' ? item : pick(asRecord(item), ['code', 'action'])).filter(Boolean)
      : [],
    canComplete: source.canComplete === true,
    blockingReasons: Array.isArray(source.blockingReasons) ? source.blockingReasons.map(String) : [],
    publishedToClientAt: pick(source, ['publishedAt', 'publishedToClientAt', 'published_to_client_at']),
    publishedAt: pick(source, ['publishedAt', 'published_at', 'publishedToClientAt']),
    publishedBy: pick(source, ['publishedBy', 'published_by', 'publishedByName']),
    publishedDocumentId: pick(source, ['publishedDocumentId', 'published_document_id']),
  };
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
  try {
    return requireProtocol(unwrapData(response), 'обновление');
  } catch {
    // Compatibility fallback only for older partial/204 responses.
    return getProtocol(protocolId);
  }
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

export async function getProtocolsPage(params: ProtocolListQuery, signal?: AbortSignal): Promise<ProtocolPage> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/protocols', { params: mapProtocolsQuery(params), signal });
  const items = normalizeProtocolsResponse(response);
  const payload = asRecord(unwrapData(response));
  const page = Number(payload.page ?? payload.number ?? params.page);
  const size = Number(payload.size ?? params.size);
  const hasMetadata = payload.totalElements !== undefined && payload.totalPages !== undefined;
  const totalElements = Number(payload.totalElements ?? items.length);
  const totalPages = Number(payload.totalPages ?? page + 1);
  const first = typeof payload.first === 'boolean' ? payload.first : page === 0;
  const last = typeof payload.last === 'boolean' ? payload.last : !hasMetadata;
  return {
    items,
    page,
    size,
    totalElements: Number.isFinite(totalElements) ? totalElements : items.length,
    totalPages: Number.isFinite(totalPages) ? totalPages : page + 1,
    first,
    last,
    hasNext: typeof payload.hasNext === 'boolean' ? payload.hasNext : !last,
    hasPrevious: typeof payload.hasPrevious === 'boolean' ? payload.hasPrevious : !first,
    totalElementsExact: hasMetadata,
  };
}

let protocolTemplatesRequest: Promise<ProtocolTemplate[]> | null = null;

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  if (!protocolTemplatesRequest) {
    protocolTemplatesRequest = api
      .get<ApiResponse<unknown> | unknown>('/protocols/templates')
      .then((response) => extractList(response, ['templates']).flatMap((raw) => {
        const source = asRecord(raw);
        const rawId = pick(source, ['id', 'templateId', 'code']);
        try {
          return [{
            ...source,
            id: mapBackendProtocolType(rawId),
            name: pick(source, ['name', 'label', 'title']) || rawId,
            description: pick(source, ['description']) || undefined,
            sourceDocumentCode: pick(source, ['sourceDocumentCode']) || undefined,
            docxTemplateCode: pick(source, ['docxTemplateCode']) || undefined,
            normativeTemplateId: pick(source, ['normativeTemplateId']) || undefined,
            resultMode: pick(source, ['resultMode']) || undefined,
            defaultUnit: pick(source, ['defaultUnit']) || undefined,
            active: source.active !== false,
          } as ProtocolTemplate];
        } catch (error) {
          if (import.meta.env.DEV) console.warn('[Protocols] Unsupported backend protocol type', { rawId, error });
          return [{
            ...source,
            id: rawId as ProtocolTemplate['id'],
            name: pick(source, ['name', 'label', 'title']) || rawId,
          } as ProtocolTemplate];
        }
      }))
      .finally(() => {
        protocolTemplatesRequest = null;
      });
  }
  return protocolTemplatesRequest;
}

export async function getProtocolTypes(): Promise<ProtocolTemplate[]> {
  const templates = await getProtocolTemplates();
  return templates.filter((template) => template.active !== false);
}

/**
 * Runtime API boundary for POST /protocols/quick-create.
 *
 * TypeScript's structural typing permits an object with additional form-only
 * properties to be passed as a QuickCreateProtocolRequest. Pick every DTO
 * field explicitly so aliases used by the wizard or legacy protocol editor can
 * never leak into the JSON request.
 */
export const toQuickCreateProtocolApiPayload = (
  payload: QuickCreateProtocolRequest,
): QuickCreateProtocolRequest => ({
  templateId: payload.templateId,
  sourceDocumentCode: payload.sourceDocumentCode,
  docxTemplateCode: payload.docxTemplateCode,
  subtype: payload.subtype,
  protocolDate: payload.protocolDate,
  sampleDate: payload.sampleDate,
  measurementDate: payload.measurementDate,
  testingStartDate: payload.testingStartDate,
  testingEndDate: payload.testingEndDate,
  companyId: payload.companyId,
  objectId: payload.objectId,
  laboratoryId: payload.laboratoryId,
  executorId: payload.executorId,
  measurementTime: payload.measurementTime,
  measurementPlace: payload.measurementPlace,
  sourceNumber: payload.sourceNumber,
  conditions: payload.conditions
    ? {
        sampleNumber: payload.conditions.sampleNumber,
        samplingDepth: payload.conditions.samplingDepth,
        samplingPlace: payload.conditions.samplingPlace,
        season: payload.conditions.season,
        workCategory: payload.conditions.workCategory,
        workplaceType: payload.conditions.workplaceType,
        roomType: payload.conditions.roomType,
        normLevel: payload.conditions.normLevel,
        lightingType: payload.conditions.lightingType,
        noiseType: payload.conditions.noiseType,
        visualWorkCategory: payload.conditions.visualWorkCategory,
        waterType: payload.conditions.waterType,
        waterUseCategory: payload.conditions.waterUseCategory,
        temperature: payload.conditions.temperature,
        humidity: payload.conditions.humidity,
        pressure: payload.conditions.pressure,
        windSpeed: payload.conditions.windSpeed,
        weatherSource: payload.conditions.weatherSource,
        weatherDataSource: payload.conditions.weatherDataSource,
        manualChangeReason: payload.conditions.manualChangeReason,
        weatherObservedAt: payload.conditions.weatherObservedAt,
      }
    : payload.conditions,
  measurements: payload.measurements.map((measurement) => ({
    indicatorName: measurement.indicatorName,
    pollutantCode: measurement.pollutantCode,
    factorType: measurement.factorType,
    factorCode: measurement.factorCode,
    value: measurement.value,
    unit: measurement.unit,
    measurementDeviceId: measurement.measurementDeviceId,
    deviceId: measurement.measurementDeviceId === undefined ? measurement.deviceId : undefined,
    normativeId: measurement.normativeId,
    normativeValue: measurement.normativeValue,
    testingMethodNd: measurement.testingMethodNd,
    samplingMethodNd: measurement.samplingMethodNd,
    values: measurement.values,
  })),
  printVisibility: {
    organizationName: payload.printVisibility.organizationName,
    organizationAddress: payload.printVisibility.organizationAddress,
    testObjectName: payload.printVisibility.testObjectName,
    productName: payload.printVisibility.productName,
    testBasis: payload.printVisibility.testBasis,
    samplingDate: payload.printVisibility.samplingDate,
    testStartDate: payload.printVisibility.testStartDate,
    testEndDate: payload.printVisibility.testEndDate,
    productNormativeDocument: payload.printVisibility.productNormativeDocument,
    samplingMethodDocument: payload.printVisibility.samplingMethodDocument,
    testMethodDocument: payload.printVisibility.testMethodDocument,
    testPurpose: payload.printVisibility.testPurpose,
    samplingPlace: payload.printVisibility.samplingPlace,
    measurementDate: payload.printVisibility.measurementDate,
    environmentalConditions: payload.printVisibility.environmentalConditions,
    temperature: payload.printVisibility.temperature,
    humidity: payload.printVisibility.humidity,
    pressure: payload.printVisibility.pressure,
    windSpeed: payload.printVisibility.windSpeed,
  },
  orderId: payload.orderId,
});

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(
    '/protocols',
    mapFormToCreateProtocolRequest(payload)
  );

  const result = response.data?.data ?? response.data;
  const protocol = requireProtocol(result, 'создание');
  return { ...protocol, printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility) };
}

export async function quickCreateProtocol(params: {
  payload: QuickCreateProtocolRequest;
  idempotencyKey: string;
}): Promise<Protocol> {
  const { payload, idempotencyKey } = params;
  if (!idempotencyKey) {
    throw new Error('Не удалось сформировать ключ безопасной отправки запроса');
  }
  const apiPayload = toQuickCreateProtocolApiPayload(payload);
  debugProtocolPayload('quick-create', {
    templateId: apiPayload.templateId,
    measurementCount: apiPayload.measurements.length,
    payloadKeys: Object.keys(apiPayload).sort(),
    measurementKeys: [...new Set(apiPayload.measurements.flatMap((item) => Object.keys(item)))].sort(),
  }, {
    idempotencyKeyPrefix: `${idempotencyKey.slice(0, 8)}…`,
  });
  const response = await api.post<ApiResponse<unknown> | unknown>(
    '/protocols/quick-create',
    apiPayload,
    {
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    },
  );
  const result = unwrapData(response);
  const protocol = requireProtocol(result, 'быстрое создание');
  const persisted = await getProtocol(protocol.id);
  const persistedChecks: Array<[string, unknown, unknown]> = [
    ['protocolDate', payload.protocolDate, persisted.protocolDate],
    ['sampleDate', payload.sampleDate, persisted.samplingDate || persisted.testing?.samplingDate],
    ['measurementDate', payload.measurementDate, persisted.measurementDate],
    ['testingStartDate', payload.testingStartDate, persisted.testingStartDate || persisted.testing?.testingStartDate],
    ['testingEndDate', payload.testingEndDate, persisted.testingEndDate || persisted.testing?.testingEndDate],
    ['sourceNumber', payload.sourceNumber, persisted.sourceNumber],
    ['conditions.waterType', payload.conditions?.waterType, persisted.conditions?.waterType || persisted.waterType],
    ['conditions.waterUseCategory', payload.conditions?.waterUseCategory, persisted.conditions?.waterUseCategory || persisted.waterUseCategory],
  ];
  const ignored = persistedChecks.find(([, expected, actual]) =>
    expected !== undefined && expected !== null && String(expected) !== String(actual ?? ''));
  if (ignored) {
    throw new Error(`PROTOCOL_API_CONTRACT_MISMATCH: backend не сохранил поле «${ignored[0]}» после quick-create.`);
  }
  return { ...persisted, printVisibility: normalizeProtocolPrintVisibility(persisted.printVisibility ?? payload.printVisibility) };
}

export async function refreshLaboratoryData(protocolId: string, version: number): Promise<Protocol> {
  void version;
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
  const request = mapProtocolFormToPatchRequest(payload, payload.version);
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}`, request);
  const protocol = await protocolFromActionResponse(protocolId, response);
  const persistedChecks: Array<[string, unknown, unknown]> = [
    ['companyId', payload.companyId, protocol.companyId],
    ['objectId', payload.objectId, protocol.objectId],
    ['laboratoryId', payload.laboratoryId, protocol.laboratory?.laboratoryId],
    ['executorId', payload.executorId, protocol.executorId],
    ['protocolDate', payload.protocolDate, protocol.protocolDate],
    ['sampleDate', payload.sampleDate ?? payload.testing.samplingDate, protocol.samplingDate ?? protocol.testing?.samplingDate],
    ['measurementDate', payload.measurementDate, protocol.measurementDate],
    ['measurementTime', payload.measurementTime, protocol.measurementTime],
    ['measurementPlace', payload.measurementPlace, protocol.measurementPlace],
    ['testingStartDate', payload.testing.testingStartDate, protocol.testingStartDate ?? protocol.testing?.testingStartDate],
    ['testingEndDate', payload.testing.testingEndDate, protocol.testingEndDate ?? protocol.testing?.testingEndDate],
    ['sourceNumber', payload.sourceNumber, protocol.sourceNumber],
    ['conditions.waterType', payload.conditions?.waterType, protocol.conditions?.waterType ?? protocol.waterType],
    ['conditions.waterUseCategory', payload.conditions?.waterUseCategory, protocol.conditions?.waterUseCategory ?? protocol.waterUseCategory],
    ['conditions.sampleNumber', payload.conditions?.sampleNumber ?? payload.sampleNumber, protocol.conditions?.sampleNumber ?? protocol.sampleNumber],
    ['conditions.samplingPlace', payload.conditions?.samplingPlace ?? payload.samplingPlace, protocol.conditions?.samplingPlace ?? protocol.samplingPlace],
    ['conditions.samplingDepth', payload.conditions?.samplingDepth ?? payload.samplingDepth, protocol.conditions?.samplingDepth ?? protocol.samplingDepth],
  ];
  const ignored = persistedChecks.find(([, expected, actual]) => expected !== undefined && expected !== null && String(expected) !== String(actual ?? ''));
  if (ignored) throw new Error(`Backend не сохранил поле «${ignored[0]}». Обновите контракт PATCH /protocols/{id}.`);
  if (Number(protocol.version || 0) <= payload.version) {
    throw new Error('Backend не обновил version протокола после сохранения. Изменения не подтверждены.');
  }
  return { ...protocol, printVisibility: normalizeProtocolPrintVisibility(payload.printVisibility) };
}

export async function deleteProtocol(protocolId: string, version: number): Promise<void> {
  void version;
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: ProtocolResultPayload, version: number): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results`, {
    ...mapProtocolResultFormToRequest(payload),
    version,
  });
  return requireResult(response);
}

export async function updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload, version: number): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}`, {
    ...mapProtocolResultFormToRequest(payload),
    version,
  });
  // Some backend versions return 204 or a partial result after PATCH. Reload
  // the protocol so the editor always receives the actually persisted row.
  const protocol = await getProtocol(protocolId);
  const saved = protocol.results.find((row) => String(row.id) === String(resultId));
  if (saved) return saved;
  return requireResult(response);
}

export async function deleteProtocolResult(protocolId: string, resultId: string, version: number): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}/results/${resultId}`, { params: { version } });
}

export async function saveProtocolResults(
  protocolId: string,
  results: ProtocolResultPayload[],
  version: number,
): Promise<Protocol> {
  await api.put<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results`, {
    version,
    results: results.map(mapProtocolResultFormToRequest),
  });
  return getProtocol(protocolId);
}

export async function getProtocolAudit(protocolId: string): Promise<Protocol['history']> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/audit`);
  return extractList(response, ['history', 'audit', 'items']).map((item) => {
    const source = asRecord(item);
    return {
      id: pick(source, ['id']),
      action: pick(source, ['action']),
      actorName: pick(source, ['actorName']),
      createdAt: pick(source, ['createdAt']),
      comment: pick(source, ['comment']),
    };
  });
}

export async function bulkAssignDevice(
  protocolId: string,
  resultIds: string[],
  measurementDeviceId: string | number,
  version: number,
): Promise<Protocol> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/results/bulk-device`,
    { resultIds, measurementDeviceId, version },
  );
  return protocolFromActionResponse(protocolId, response);
}

export async function bulkUpdatePlace(
  protocolId: string,
  resultIds: string[],
  measurementPlace: string,
  version: number,
): Promise<Protocol> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/results/bulk-place`,
    { resultIds, measurementPlace, version },
  );
  return protocolFromActionResponse(protocolId, response);
}

export async function bulkDeleteResults(
  protocolId: string,
  resultIds: string[],
  version: number,
): Promise<Protocol> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/results/bulk`,
    { data: { resultIds, version } },
  );
  return protocolFromActionResponse(protocolId, response);
}

export async function checkNormatives(protocolId: string, version: number): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/check-normatives`, { version });
  return protocolFromActionResponse(protocolId, response);
}

export async function readyForApproval(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/ready-for-approval`, request);
  return protocolFromActionResponse(protocolId, response);
}

export const markReadyForApproval = readyForApproval;

export async function approveProtocol(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/approve`, request);
  return protocolFromActionResponse(protocolId, response);
}

export async function returnForRevision(protocolId: string, request: ReturnForRevisionRequest): Promise<Protocol> {
  const reason = request.reason.trim();
  if (reason.length < 3 || reason.length > 1000) throw new Error('Причина должна содержать от 3 до 1000 символов.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/return-for-revision`, { version: request.version, reason });
  return protocolFromActionResponse(protocolId, response);
}

export async function signProtocol(protocolId: string | number, request: SignProtocolRequest): Promise<Protocol> {
  if (!request.cmsSignatureBase64.trim()) throw new Error('CMS-подпись не сформирована.');
  const response = await api.post<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/sign`,
    { cmsSignatureBase64: request.cmsSignatureBase64 },
  );
  return requireProtocol(unwrapData(response), 'подписание');
}

export async function prepareSigning(protocolId: string | number, version: number) {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/prepare-signing`, { version });
  const payload = unwrapData(response.data);
  const source = asRecord(payload);
  const signingPayload = String(source.signingPayload || source.payload || source.dataToSign || '');
  if (!signingPayload) throw new Error('Backend не вернул данные для подписания протокола.');
  const protocolSource = source.protocol || source;
  return { protocol: normalizeProtocol(protocolSource), signingPayload };
}

export async function signAndComplete(protocolId: string | number, request: { version: number; cmsSignatureBase64: string }): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/sign-and-complete`, request);
  return normalizeProtocol(extractItem(response, ['protocol']));
}

export async function publishToClient(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/publish-to-client`, request);
  return protocolFromActionResponse(protocolId, response);
}

export async function createCorrection(protocolId: string, request: ReplaceProtocolRequest): Promise<Protocol> {
  const correctionReason = request.reason.trim();
  if (!correctionReason) throw new Error('Укажите причину создания исправленной версии.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/corrections`, { version: request.version, reason: correctionReason });
  return requireProtocol(unwrapData(response), 'создание исправленной версии');
}

export const replaceProtocol = createCorrection;

export async function cancelProtocol(protocolId: string, request: CancelProtocolRequest): Promise<Protocol> {
  const reason = request.reason.trim();
  if (reason.length < 3 || reason.length > 1000) throw new Error('Причина должна содержать от 3 до 1000 символов.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/cancel`, { version: request.version, reason });
  return protocolFromActionResponse(protocolId, response);
}

export async function archiveProtocol(protocolId: string, request: ProtocolVersionRequest): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/archive`, request);
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

export async function generateDocx(protocolId: string, version: number): Promise<Protocol> {
  void version;
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/generate-docx`);
  return protocolFromActionResponse(protocolId, response);
}

export async function generatePdf(protocolId: string, version: number): Promise<Protocol> {
  void version;
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

export async function importExcel(protocolId: string, file: File, version: number): Promise<Protocol> {
  void version;
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/import-excel`, formData);
  return protocolFromActionResponse(protocolId, response);
}

export async function addProtocolMeasurementDevice(
  protocolId: string,
  device: MeasurementDevice,
  version: number,
): Promise<Protocol> {
  if (device.status !== 'VALID' && device.status !== 'EXPIRING') throw new Error('Этот прибор недоступен для выбора.');
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/measurement-devices`, { deviceId: device.id, version });
  return protocolFromActionResponse(protocolId, response);
}

export async function removeProtocolMeasurementDevice(protocolId: string, deviceId: string, version: number): Promise<Protocol> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/measurement-devices/${deviceId}`,
    { params: { version } },
  );
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
  const query = params.query ?? params.search ?? params.q ?? '';
  const pollutantCode = params.pollutantCode || undefined;
  const code = params.code || undefined;
  if (!canRunNormativeSearch(query) && !pollutantCode && !code && !params.casNumber && !params.formula) {
    return { found: false, normatives: [], items: [] };
  }
  const requestParams: NormativeSearchRequest = {
    query: query || undefined,
    pollutantCode,
    code,
    casNumber: params.casNumber || undefined,
    formula: params.formula || undefined,
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
  const payload = unwrapApiResponse<unknown>(response.data);
  return extractList(payload, ['methodTemplates', 'method_templates', 'templates']).map(normalizeMethodTemplate);
}

export async function getMethodTemplate(id: string): Promise<MethodTemplateResponse> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/method-templates/${id}`);
  const payload = unwrapApiResponse<unknown>(response.data);
  return normalizeMethodTemplate(extractItem(payload, ['methodTemplate', 'method_template', 'template']));
}

export async function getRawMeasurements(protocolId: string, resultId: string): Promise<RawMeasurementsResponse> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}/raw-measurements`);
  return normalizeRawMeasurements(unwrapApiResponse<unknown>(response.data), protocolId, resultId);
}

export async function saveRawMeasurements(
  protocolId: string,
  resultId: string,
  payload: RawMeasurementRequest[],
  methodTemplateId: string | number | null | undefined,
  version: number,
): Promise<ProtocolResultRow | undefined> {
  const request: SaveRawMeasurementsRequest = {
    methodTemplateId: methodTemplateId || null,
    measurements: payload,
  };
  void version;
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

export async function calculateResult(protocolId: string, resultId: string, version: number): Promise<CalculationResultResponse> {
  void version;
  const response = await api.post<ApiResponse<unknown> | unknown>(
    `/protocols/${protocolId}/results/${resultId}/calculate`,
  );
  return normalizeCalculationResult(unwrapApiResponse<unknown>(response.data), protocolId, resultId);
}

export async function calculateProtocolSummary(protocolId: string, version: number): Promise<ProtocolCalculationSummaryResponse> {
  void version;
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/calculate`);
  return normalizeCalculationSummary(unwrapApiResponse<unknown>(response.data), protocolId);
}

export async function getCalculationHistory(protocolId: string, resultId: string): Promise<CalculationResultResponse[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}/calculation-history`);
  const payload = unwrapApiResponse<unknown>(response.data);
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

export async function calculateProtocol(protocolId: string, version: number): Promise<Protocol> {
  await calculateProtocolSummary(protocolId, version);
  return getProtocol(protocolId);
}
