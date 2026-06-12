import api, { ApiResponse } from './api';
import type {
  CreateProtocolPayload,
  NormativeSearchResult,
  Protocol,
  ProtocolResultRow,
  ProtocolTemplate,
  UpdateProtocolPayload,
} from '../types/protocols';
import { normalizeCompany } from './companyService';

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

type UnknownRecord = Record<string, unknown>;

const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const pick = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return asString(value);
  }
  return '';
};

const normalizeProtocol = (protocol: Protocol): Protocol => {
  const source = protocol as Protocol & UnknownRecord;
  const companyId = protocol.companyId || pick(source, ['company_id']);
  const snapshotCompany = protocol.company ? normalizeCompany(protocol.company) : {
    id: companyId,
    name: protocol.companyNameSnapshot || pick(source, ['company_name_snapshot']),
    bin: protocol.companyBinSnapshot || pick(source, ['company_bin_snapshot']),
    legalAddress: protocol.companyLegalAddressSnapshot || pick(source, ['company_legal_address_snapshot']),
    actualAddress: protocol.companyActualAddressSnapshot || pick(source, ['company_actual_address_snapshot']),
    phone: protocol.companyPhoneSnapshot || pick(source, ['company_phone_snapshot']),
    email: protocol.companyEmailSnapshot || pick(source, ['company_email_snapshot']),
    comment: '',
    directorFullName: protocol.companyDirectorNameSnapshot || pick(source, ['company_director_name_snapshot']),
    directorPosition: protocol.companyDirectorPositionSnapshot || pick(source, ['company_director_position_snapshot']),
    contactPerson: protocol.companyResponsiblePersonSnapshot || pick(source, ['company_responsible_person_snapshot']),
    contactPhone: protocol.companyResponsiblePersonPhoneSnapshot || pick(source, ['company_responsible_person_phone_snapshot']),
    bank: protocol.companyBankNameSnapshot || pick(source, ['company_bank_name_snapshot']),
    iban: protocol.companyIbanSnapshot || pick(source, ['company_iban_snapshot']),
    bik: protocol.companyBikSnapshot || pick(source, ['company_bik_snapshot']),
    kbe: protocol.companyKbeSnapshot || pick(source, ['company_kbe_snapshot']),
    knp: protocol.companyKnpSnapshot || pick(source, ['company_knp_snapshot']),
    contractNumber: protocol.companyContractNumberSnapshot || pick(source, ['company_contract_number_snapshot']),
    contractDate: protocol.companyContractDateSnapshot || pick(source, ['company_contract_date_snapshot']),
    objectName: protocol.objectNameSnapshot || pick(source, ['object_name_snapshot']) || protocol.organization?.objectName || '',
    objectAddress: protocol.objectAddressSnapshot || pick(source, ['object_address_snapshot']),
    activityType: protocol.activityTypeSnapshot || pick(source, ['activity_type_snapshot']),
    samplingLocation: protocol.samplingLocationSnapshot || pick(source, ['sampling_location_snapshot']),
    customerRepresentative: protocol.customerRepresentativeSnapshot || pick(source, ['customer_representative_snapshot']),
    status: 'ACTIVE' as const,
    createdAt: protocol.createdAt,
    updatedAt: protocol.updatedAt,
  };

  const hasSnapshot = Boolean(companyId || snapshotCompany.name || snapshotCompany.bin);
  return {
    ...protocol,
    companyId,
    company: hasSnapshot ? snapshotCompany : protocol.company,
  };
};

const toCreateProtocolApiPayload = (payload: CreateProtocolPayload) => ({
  templateId: payload.templateId,
  companyId: payload.companyId,
  protocolDate: payload.protocolDate,
  sampleDate: payload.sampleDate || payload.samplingDate,
  samplingDate: payload.sampleDate || payload.samplingDate,
  testingDate: payload.testingDate,
  testPurpose: payload.testPurpose || payload.testingPurpose,
  testingPurpose: payload.testPurpose || payload.testingPurpose,
  environmentConditions: payload.environmentConditions,
  organizationName: payload.organizationName,
  organizationAddress: payload.organizationAddress,
  objectName: payload.objectName,
  productName: payload.productName,
});

export async function getProtocols(params?: Record<string, string>): Promise<Protocol[]> {
  const response = await api.get<ApiResponse<Protocol[]>>('/protocols', { params });
  return unwrap(response).map(normalizeProtocol);
}

export async function getProtocolTemplates(): Promise<ProtocolTemplate[]> {
  const response = await api.get<ApiResponse<ProtocolTemplate[]>>('/protocols/templates');
  return unwrap(response);
}

export async function createProtocol(payload: CreateProtocolPayload): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>('/protocols', toCreateProtocolApiPayload(payload));
  return normalizeProtocol(unwrap(response));
}

export async function getProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.get<ApiResponse<Protocol>>(`/protocols/${protocolId}`);
  return normalizeProtocol(unwrap(response));
}

export async function updateProtocol(protocolId: string, payload: UpdateProtocolPayload): Promise<Protocol> {
  const response = await api.patch<ApiResponse<Protocol>>(`/protocols/${protocolId}`, payload);
  return normalizeProtocol(unwrap(response));
}

export async function deleteProtocol(protocolId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocols/${protocolId}`);
}

export async function addProtocolResult(protocolId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.post<ApiResponse<ProtocolResultRow>>(`/protocols/${protocolId}/results`, payload);
  return unwrap(response);
}

export async function updateProtocolResult(resultId: string, payload: Partial<ProtocolResultRow>): Promise<ProtocolResultRow> {
  const response = await api.patch<ApiResponse<ProtocolResultRow>>(`/protocol-results/${resultId}`, payload);
  return unwrap(response);
}

export async function deleteProtocolResult(resultId: string): Promise<void> {
  await api.delete<ApiResponse<null>>(`/protocol-results/${resultId}`);
}

export async function checkNormatives(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/check-normatives`);
  return normalizeProtocol(unwrap(response));
}

export async function readyForApproval(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/ready-for-approval`);
  return normalizeProtocol(unwrap(response));
}

export async function approveProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/approve`);
  return normalizeProtocol(unwrap(response));
}

export async function signProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/sign`);
  return normalizeProtocol(unwrap(response));
}

export async function replaceProtocol(protocolId: string, reason: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/replace`, { reason });
  return normalizeProtocol(unwrap(response));
}

export async function cancelProtocol(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/cancel`);
  return normalizeProtocol(unwrap(response));
}

export async function previewProtocol(protocolId: string): Promise<Blob> {
  const response = await api.get<Blob>(`/protocols/${protocolId}/preview`, { responseType: 'blob' });
  return response.data;
}

export async function generateDocx(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/generate-docx`);
  return normalizeProtocol(unwrap(response));
}

export async function generatePdf(protocolId: string): Promise<Protocol> {
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/generate-pdf`);
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
  const response = await api.post<ApiResponse<Protocol>>(`/protocols/${protocolId}/import-excel`, formData);
  return normalizeProtocol(unwrap(response));
}

export async function searchNormative(params: Record<string, string>): Promise<NormativeSearchResult> {
  const response = await api.get<ApiResponse<NormativeSearchResult>>('/normatives/search', { params });
  return unwrap(response);
}
