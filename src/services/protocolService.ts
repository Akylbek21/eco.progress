import api, { ApiResponse } from './api';
import type {
  CreateProtocolPayload,
  MeasurementDevice,
  NormativeSearchResult,
  Protocol,
  ProtocolCompanySnapshot,
  ProtocolMeasurementDevice,
  ProtocolResultRow,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';

type UnknownRecord = Record<string, unknown>;

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;
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
  const company = asRecord(raw.company || {});
  const object = asRecord(raw.object || raw.companyObject || raw.company_object || {});
  return {
    companyName: pick(snapshot, ['companyName', 'name']) || pick(raw, ['companyNameSnapshot', 'company_name_snapshot']) || pick(company, ['name', 'companyName']),
    bin: pick(snapshot, ['bin']) || pick(raw, ['companyBinSnapshot', 'company_bin_snapshot']) || pick(company, ['bin', 'iin']),
    legalAddress: pick(snapshot, ['legalAddress']) || pick(raw, ['companyLegalAddressSnapshot', 'company_legal_address_snapshot']) || pick(company, ['legalAddress']),
    actualAddress: pick(snapshot, ['actualAddress']) || pick(raw, ['companyActualAddressSnapshot', 'company_actual_address_snapshot']) || pick(company, ['actualAddress']),
    phone: pick(snapshot, ['phone']) || pick(raw, ['companyPhoneSnapshot', 'company_phone_snapshot']) || pick(company, ['phone']),
    email: pick(snapshot, ['email']) || pick(raw, ['companyEmailSnapshot', 'company_email_snapshot']) || pick(company, ['email']),
    director: pick(snapshot, ['director']) || pick(raw, ['companyDirectorNameSnapshot', 'company_director_name_snapshot']) || pick(company, ['director', 'directorFullName']),
    contactPerson: pick(snapshot, ['contactPerson']) || pick(raw, ['companyResponsiblePersonSnapshot', 'company_responsible_person_snapshot']) || pick(company, ['contactPerson']),
    activityType: pick(snapshot, ['activityType']) || pick(raw, ['activityTypeSnapshot', 'activity_type_snapshot']) || pick(company, ['activityType']),
    objectName: pick(snapshot, ['objectName']) || pick(raw, ['objectNameSnapshot', 'object_name_snapshot']) || pick(object, ['name', 'objectName']),
    objectAddress: pick(snapshot, ['objectAddress']) || pick(raw, ['objectAddressSnapshot', 'object_address_snapshot']) || pick(object, ['address', 'objectAddress']),
    objectActivityType: pick(snapshot, ['objectActivityType']) || pick(raw, ['objectActivityTypeSnapshot', 'object_activity_type_snapshot']) || pick(object, ['activityType']),
    coordinates: pick(snapshot, ['coordinates']) || pick(object, ['coordinates']),
    sanitaryZone: pick(snapshot, ['sanitaryZone']) || pick(object, ['sanitaryZone']),
    bankName: pick(snapshot, ['bankName']) || pick(raw, ['companyBankNameSnapshot', 'company_bank_name_snapshot']) || pick(company, ['bankName', 'bank']),
    iban: pick(snapshot, ['iban']) || pick(raw, ['companyIbanSnapshot', 'company_iban_snapshot']) || pick(company, ['iban']),
    bik: pick(snapshot, ['bik']) || pick(raw, ['companyBikSnapshot', 'company_bik_snapshot']) || pick(company, ['bik']),
    kbe: pick(snapshot, ['kbe']) || pick(raw, ['companyKbeSnapshot', 'company_kbe_snapshot']) || pick(company, ['kbe']),
    knp: pick(snapshot, ['knp']) || pick(raw, ['companyKnpSnapshot', 'company_knp_snapshot']) || pick(company, ['knp']),
  };
};

const normalizeResult = (raw: unknown): ProtocolResultRow => {
  const source = asRecord(raw);
  const values = asRecord(source.values);
  return {
    id: pick(source, ['id', '_id', 'resultId']) || `result-${Math.random().toString(16).slice(2)}`,
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
    values: {
      samplingPoint: pick(source, ['samplingPoint', 'sampling_point']) || asString(values.samplingPoint),
      indicator: pick(source, ['indicator']) || asString(values.indicator),
      unit: pick(source, ['unit']) || asString(values.unit),
      result: pick(source, ['result']) || asString(values.result),
      normative: pick(source, ['normative']) || asString(values.normative),
      testingMethod: pick(source, ['testingMethod', 'testing_method']) || asString(values.testingMethod),
      samplingMethod: pick(source, ['samplingMethod', 'sampling_method']) || asString(values.samplingMethod),
      normativeDocument: pick(source, ['normativeDocument', 'normative_document']) || asString(values.normativeDocument),
      comment: pick(source, ['comment']) || asString(values.comment),
      ...values,
    },
  };
};

const normalizeMeasurementDevice = (raw: unknown): ProtocolMeasurementDevice => {
  const source = asRecord(raw);
  const snapshot = asRecord(source.deviceSnapshot || source.device_snapshot || source.device || {});
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
  const protocolNumber = pick(source, ['protocolNumber', 'protocol_number', 'number']);
  const samplingDate = pick(source, ['samplingDate', 'sampling_date', 'sampleDate']);
  const testingStartDate = pick(source, ['testingStartDate', 'testing_start_date']);
  const testingEndDate = pick(source, ['testingEndDate', 'testing_end_date', 'testingDate']);
  const purpose = pick(source, ['purpose', 'testPurpose', 'testingPurpose']);
  const environmentalConditions = pick(source, ['environmentalConditions', 'environment_conditions', 'environmentConditions']);
  const resultsSource = Array.isArray(source.results) ? source.results : [];
  const devicesSource = Array.isArray(source.measurementDevices) ? source.measurementDevices : Array.isArray(source.instruments) ? source.instruments : [];

  return {
    id: pick(source, ['id', '_id', 'protocolId']),
    protocolNumber,
    number: protocolNumber,
    templateId: pick(source, ['templateId', 'template_id']) as Protocol['templateId'],
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
    executor: pick(source, ['executor']),
    approver: pick(source, ['approver']),
    approvedAt: pick(source, ['approvedAt', 'approved_at']),
    signedAt: pick(source, ['signedAt', 'signed_at']),
    organization: {
      organizationName: snapshot.companyName,
      organizationAddress: snapshot.legalAddress || snapshot.actualAddress || '',
      objectName: snapshot.objectName || '',
      productName: snapshot.objectName || snapshot.activityType || '',
      testingBasis: pick(source, ['testingBasis', 'testing_basis']),
    },
    laboratory: asRecord(source.laboratory) as Protocol['laboratory'],
    testing: {
      productNormativeDocument: pick(source, ['productNormativeDocument', 'product_normative_document']),
      samplingMethodDocument: pick(source, ['samplingMethodDocument', 'sampling_method_document']),
      testingMethodDocument: pick(source, ['testingMethodDocument', 'testing_method_document']),
      samplingDate,
      testingDate: testingEndDate,
      testingPurpose: purpose,
      environmentConditions: environmentalConditions,
      physicalFactorType: pick(source, ['physicalFactorType', 'physical_factor_type']),
    },
    results: resultsSource.map(normalizeResult),
    measurementDevices: devicesSource.map(normalizeMeasurementDevice),
    instruments: devicesSource.map((item) => normalizeMeasurementDevice(item).deviceSnapshot as MeasurementDevice),
    history: Array.isArray(source.history) ? source.history as Protocol['history'] : [],
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
    replacedByProtocolId: pick(source, ['replacedByProtocolId', 'replaced_by_protocol_id']),
    replacesProtocolId: pick(source, ['replacesProtocolId', 'replaces_protocol_id']),
  };
};

const toCreateProtocolApiPayload = (payload: CreateProtocolPayload) => ({
  companyId: payload.companyId,
  objectId: payload.objectId || undefined,
  templateId: payload.templateId,
  protocolNumber: payload.protocolNumber || undefined,
  protocolDate: payload.protocolDate,
  samplingDate: payload.samplingDate || undefined,
  testingStartDate: payload.testingStartDate || undefined,
  testingEndDate: payload.testingEndDate || undefined,
  purpose: payload.purpose || undefined,
  environmentalConditions: payload.environmentalConditions || undefined,
});

export async function getProtocols(params?: Record<string, string>): Promise<Protocol[]> {
  const response = await api.get<ApiResponse<unknown[]>>('/protocols', { params });
  return unwrap(response).map(normalizeProtocol);
}

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  const response = await api.get<ApiResponse<ProtocolTemplate[]>>('/protocols/templates');
  return unwrap(response);
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>('/protocols', toCreateProtocolApiPayload(payload));
  return normalizeProtocol(unwrap(response));
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.get<ApiResponse<unknown>>(`/protocols/${protocolId}`);
  return normalizeProtocol(unwrap(response));
}

export const getProtocolById = getProtocol;

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  const response = await api.patch<ApiResponse<unknown>>(`/protocols/${protocolId}`, payload);
  return normalizeProtocol(unwrap(response));
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/results`, payload);
  return normalizeResult(unwrap(response));
}

export async function updateProtocolResult(resultId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<unknown>>(`/protocol-results/${resultId}`, payload);
  return normalizeResult(unwrap(response));
}

export async function deleteProtocolResult(resultId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocol-results/${resultId}`);
}

export async function checkNormatives(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/check-normatives`);
  return normalizeProtocol(unwrap(response));
}

export async function readyForApproval(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/ready-for-approval`);
  return normalizeProtocol(unwrap(response));
}

export async function approveProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/approve`);
  return normalizeProtocol(unwrap(response));
}

export async function returnToDraft(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/return-to-draft`);
  return normalizeProtocol(unwrap(response));
}

export async function signProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/sign`);
  return normalizeProtocol(unwrap(response));
}

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/replace`, { reason });
  return normalizeProtocol(unwrap(response));
}

export async function previewProtocol(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/preview`, { responseType: 'blob' });
  return response.data;
}

export async function generateDocx(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/generate-docx`);
  return normalizeProtocol(unwrap(response));
}

export async function generatePdf(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/generate-pdf`);
  return normalizeProtocol(unwrap(response));
}

export async function downloadDocx(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/download-docx`, { responseType: 'blob' });
  return response.data;
}

export async function downloadPdf(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/download-pdf`, { responseType: 'blob' });
  return response.data;
}

export async function importExcel(protocolId: string, file: File): Promise<Protocol> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/import-excel`, formData);
  return normalizeProtocol(unwrap(response));
}

export async function addProtocolMeasurementDevice(protocolId: string, deviceId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<unknown>>(`/protocols/${protocolId}/measurement-devices`, { deviceId });
  return normalizeProtocol(unwrap(response));
}

export async function searchNormative(params: Record<string, string>): Promise<NormativeSearchResult> {
  const response = await api.get<ApiResponse<NormativeSearchResult>>('/normatives/search', { params });
  return unwrap(response);
}
