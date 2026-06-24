import api, { ApiResponse } from './api';
import {
  extractItem,
  extractList,
  getApiErrorMessage,
  getContentDispositionFileName,
} from './apiHelpers';
import type {
  CreateProtocolPayload,
  MeasurementDevice,
  NormativeSearchResult,
  Protocol,
  ProtocolCompanySnapshot,
  ProtocolMeasurementDevice,
  ProtocolResultPayload,
  ProtocolResultRow,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' ? value as UnknownRecord : {};
const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const pick = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return asString(value);
  }
  return '';
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

const normalizeResult = (raw: unknown): ProtocolResultRow => {
  const source = asRecord(raw);
  const values = asRecord(source.values);
  const dynamicValues = Object.fromEntries(
    Object.entries(source).filter(([key, value]) =>
      !['id', '_id', 'resultId', 'protocolId', 'protocol_id', 'internalStatus', 'checkStatus', 'status', 'values'].includes(key)
      && (typeof value === 'string' || typeof value === 'number' || value === null),
    ),
  );
  return {
    id: pick(source, ['id', '_id', 'resultId']),
    protocolId: pick(source, ['protocolId', 'protocol_id']),
    internalStatus: (pick(source, ['internalStatus', 'checkStatus', 'status']) || 'EMPTY_RESULT') as ProtocolResultRow['internalStatus'],
    checkStatus: (pick(source, ['checkStatus', 'internalStatus', 'status']) || 'EMPTY_RESULT') as ProtocolResultRow['checkStatus'],
    samplingPoint: pick(source, ['samplingPoint', 'sampling_point']) || asString(values.samplingPoint),
    indicator: pick(source, ['indicator']) || asString(values.indicator),
    unit: pick(source, ['unit']) || asString(values.unit),
    result: pick(source, ['result']) || asString(values.result),
    normative: pick(source, ['normative']) || asString(values.normative),
    testingMethod: pick(source, ['testingMethod', 'testing_method']) || asString(values.testingMethod),
    samplingMethod: pick(source, ['samplingMethod', 'sampling_method']) || asString(values.samplingMethod),
    normativeDocument: pick(source, ['normativeDocument', 'normative_document']) || asString(values.normativeDocument),
    comment: pick(source, ['comment']) || asString(values.comment),
    measurementDeviceId: pick(source, ['measurementDeviceId', 'deviceId']) || asString(values.measurementDeviceId),
    comparisonType: (pick(source, ['comparisonType']) || asString(values.comparisonType)) as ProtocolResultRow['comparisonType'],
    normativeMin: pick(source, ['normativeMin', 'min']) || asString(values.normativeMin),
    normativeMax: pick(source, ['normativeMax', 'max']) || asString(values.normativeMax),
    values: {
      ...values,
      ...dynamicValues,
      samplingPoint: pick(source, ['samplingPoint', 'sampling_point']) || asString(values.samplingPoint),
      indicator: pick(source, ['indicator']) || asString(values.indicator),
      unit: pick(source, ['unit']) || asString(values.unit),
      result: pick(source, ['result']) || asString(values.result),
      normative: pick(source, ['normative']) || asString(values.normative),
      testingMethod: pick(source, ['testingMethod', 'testing_method']) || asString(values.testingMethod),
      samplingMethod: pick(source, ['samplingMethod', 'sampling_method']) || asString(values.samplingMethod),
      normativeDocument: pick(source, ['normativeDocument', 'normative_document']) || asString(values.normativeDocument),
      comment: pick(source, ['comment']) || asString(values.comment),
      measurementDeviceId: pick(source, ['measurementDeviceId', 'deviceId']) || asString(values.measurementDeviceId),
      comparisonType: pick(source, ['comparisonType']) || asString(values.comparisonType),
      normativeMin: pick(source, ['normativeMin', 'min']) || asString(values.normativeMin),
      normativeMax: pick(source, ['normativeMax', 'max']) || asString(values.normativeMax),
    },
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
  const laboratory = asRecord(source.laboratory);
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
  const devicesSource = Array.isArray(source.measurementDevices) ? source.measurementDevices : Array.isArray(source.instruments) ? source.instruments : [];

  return {
    id: pick(source, ['id', '_id', 'protocolId']),
    protocolNumber,
    number: protocolNumber,
    templateId: pick(source, ['templateId', 'template_id']) as Protocol['templateId'],
    subtype: (pick(source, ['subtype', 'physicalFactorType', 'physical_factor_type'])
      || pick(testing, ['physicalFactorType'])) as Protocol['subtype'],
    templateName: pick(source, ['templateName', 'template_name']),
    status: (pick(source, ['status']) || 'DRAFT') as Protocol['status'],
    companyId: pick(source, ['companyId', 'company_id']),
    objectId: pick(source, ['objectId', 'object_id']),
    companySnapshot: snapshot,
    protocolDate: pick(source, ['protocolDate', 'protocol_date']),
    samplingDate,
    testingStartDate,
    testingEndDate,
    purpose,
    environmentalConditions,
    environment: {
      temperature: pick(environment, ['temperature']),
      minTemperature: pick(environment, ['minTemperature', 'temperatureMin']),
      maxTemperature: pick(environment, ['maxTemperature', 'temperatureMax']),
      humidity: pick(environment, ['humidity']),
      minHumidity: pick(environment, ['minHumidity', 'humidityMin']),
      maxHumidity: pick(environment, ['maxHumidity', 'humidityMax']),
      pressureKpa: pick(environment, ['pressureKpa', 'pressure']),
      windSpeed: pick(environment, ['windSpeed']),
      comment: pick(environment, ['comment']) || environmentalConditions,
    },
    productName: pick(source, ['productName']) || pick(organization, ['productName']),
    testingBasis: pick(source, ['testingBasis']) || pick(organization, ['testingBasis']),
    productNormativeDocument: pick(source, ['productNormativeDocument']) || pick(testing, ['productNormativeDocument']),
    samplingMethodDocument: pick(source, ['samplingMethodDocument']) || pick(testing, ['samplingMethodDocument']),
    testingMethodDocument: pick(source, ['testingMethodDocument']) || pick(testing, ['testingMethodDocument']),
    explanatoryNote: pick(source, ['explanatoryNote', 'note']),
    complianceResult: pick(source, ['complianceResult', 'overallStatus', 'internalStatus']),
    executor: pick(source, ['executor']),
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
      laboratoryName: pick(laboratory, ['laboratoryName', 'name']),
      laboratoryAddress: pick(laboratory, ['laboratoryAddress', 'address']),
      accreditationNumber: pick(laboratory, ['accreditationNumber', 'certificateNumber']),
      accreditationValidUntil: pick(laboratory, ['accreditationValidUntil', 'certificateValidUntil']),
      director: pick(laboratory, ['director']),
      laboratoryHead: pick(laboratory, ['laboratoryHead', 'head']),
      executor: pick(laboratory, ['executor']),
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
  subtype: payload.subtype,
  protocolNumber: payload.protocolNumber || '',
  protocolDate: payload.protocolDate,
  samplingDate: payload.samplingDate || '',
  sampleDate: payload.samplingDate || '',
  testingStartDate: payload.testingStartDate || '',
  testingEndDate: payload.testingEndDate || '',
  testingDate: payload.testingEndDate || payload.testingStartDate || '',
  productName: payload.productName || '',
  testingBasis: payload.testingBasis || '',
  productNormativeDocument: payload.productNormativeDocument || '',
  samplingMethodDocument: payload.samplingMethodDocument || '',
  testingMethodDocument: payload.testingMethodDocument || '',
  purpose: payload.purpose || '',
  testPurpose: payload.purpose || '',
  environment: payload.environment || {},
  environmentConditions: payload.environment?.comment || '',
});

const isProtocolLike = (value: unknown) => {
  const source = asRecord(value);
  return Boolean(
    pick(source, ['templateId', 'template_id', 'protocolNumber', 'protocol_number'])
    || source.companySnapshot
    || source.organization
    || source.testing,
  );
};

const protocolFromActionResponse = async (protocolId: string, response: unknown): Promise<Protocol> => {
  const item = extractItem(response, ['protocol']);
  return isProtocolLike(item) ? normalizeProtocol(item) : getProtocol(protocolId);
};

const requireProtocol = (input: unknown, action: string): Protocol => {
  const item = extractItem(input, ['protocol']);
  const protocol = normalizeProtocol(item);
  if (!protocol.id || !isProtocolLike(item)) throw new Error(`Backend не вернул протокол после операции «${action}».`);
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
  const response = await api.post<ApiResponse<unknown> | unknown>('/protocols', toCreateProtocolApiPayload(payload));
  return requireProtocol(response, 'создание');
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}`);
  return requireProtocol(response, 'загрузка');
}

export const getProtocolById = getProtocol;

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}`, {
    number: payload.number,
    protocolDate: payload.protocolDate,
    executor: payload.executor,
    approver: payload.approver,
    laboratory: payload.laboratory,
    organization: payload.organization,
    testing: payload.testing,
    environment: payload.environment,
    explanatoryNote: payload.explanatoryNote,
  });
  return protocolFromActionResponse(protocolId, response);
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results`, payload);
  return requireResult(response);
}

export async function updateProtocolResult(protocolId: string, resultId: string, payload: ProtocolResultPayload): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/results/${resultId}`, payload);
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
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/replace`, { reason });
  return requireProtocol(response, 'создание исправленной версии');
}

export async function cancelProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/protocols/${protocolId}/cancel`);
  return protocolFromActionResponse(protocolId, response);
}

export async function previewProtocol(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/preview`, { responseType: 'blob' });
  return response.data;
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
    return {
      blob: response.data,
      fileName: getContentDispositionFileName(response.headers['content-disposition']),
    };
  } catch (error) {
    const blob = (error as { response?: { data?: unknown } })?.response?.data;
    if (blob instanceof Blob && /json|text/.test(blob.type)) {
      try {
        const payload = JSON.parse(await blob.text()) as { message?: string; error?: string };
        throw new Error(payload.message || payload.error || getApiErrorMessage(error));
      } catch (parseError) {
        if (parseError instanceof SyntaxError) throw new Error(getApiErrorMessage(error));
        throw parseError;
      }
    }
    throw error;
  }
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
  const response = await api.get<ApiResponse<NormativeSearchResult> | NormativeSearchResult>('/normatives/search', { params });
  const candidates = extractList(response, ['normatives', 'items']) as NonNullable<NormativeSearchResult['normatives']>;
  const item = extractItem(response) as NormativeSearchResult;
  if (candidates.length) {
    return {
      ...item,
      found: true,
      normatives: candidates,
      ambiguous: candidates.length > 1 || item.ambiguous,
      normative: candidates.length === 1 ? candidates[0] : item.normative,
    };
  }
  return item;
}
