import api, { ApiResponse } from './api';
import type { Company, CompanyObject, CompanyObjectPayload, CompanyPayload, CompanyQuery } from '../types/companies';

type UnknownRecord = Record<string, unknown>;

const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

const pick = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return asString(value);
  }
  return '';
};

const normalizeStatus = (value: unknown): Company['status'] => String(value || '').toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';
const normalizeObjectStatus = (value: unknown): CompanyObject['status'] => String(value || '').toUpperCase() === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE';

export const normalizeCompanyObject = (raw: unknown, companyId = ''): CompanyObject => {
  const source = (raw || {}) as UnknownRecord;
  return {
    id: pick(source, ['id', '_id', 'objectId', 'facilityId']),
    companyId: pick(source, ['companyId', 'company_id']) || companyId,
    name: pick(source, ['name', 'objectName', 'facilityName', 'title']),
    address: pick(source, ['address', 'objectAddress', 'facilityAddress']),
    activityType: pick(source, ['activityType', 'businessActivity']),
    coordinates: pick(source, ['coordinates', 'coords']),
    sanitaryZone: pick(source, ['sanitaryZone', 'sanitary_zone']),
    notes: pick(source, ['notes', 'comment']),
    status: normalizeObjectStatus(source.status),
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
  };
};

export const normalizeCompany = (raw: unknown): Company => {
  const source = (raw || {}) as UnknownRecord;
  const object = (source.object || source.facility || {}) as UnknownRecord;
  const objectsSource = Array.isArray(source.objects)
    ? source.objects
    : Array.isArray(source.facilities)
      ? source.facilities
      : Array.isArray(source.companyObjects)
        ? source.companyObjects
        : [];
  const director = (source.director || source.manager || {}) as UnknownRecord;
  const bank = (source.bankDetails || source.requisites || {}) as UnknownRecord;
  const contract = (source.contract || {}) as UnknownRecord;

  return {
    id: pick(source, ['id', '_id', 'companyId']),
    name: pick(source, ['name', 'companyName', 'title', 'organizationName']),
    bin: pick(source, ['bin', 'iin', 'binIin', 'bin_iin', 'taxId']),
    legalAddress: pick(source, ['legalAddress', 'juridicalAddress', 'registeredAddress']),
    actualAddress: pick(source, ['actualAddress', 'factualAddress', 'physicalAddress', 'address']),
    phone: pick(source, ['phone', 'phoneNumber']),
    email: pick(source, ['email']),
    comment: pick(source, ['comment', 'notes']),
    notes: pick(source, ['notes', 'comment']),
    directorFullName: pick(source, ['directorFullName', 'directorName', 'headName']) || pick(director, ['fullName', 'name']),
    director: pick(source, ['director', 'directorFullName', 'directorName', 'headName']) || pick(director, ['fullName', 'name']),
    directorPosition: pick(source, ['directorPosition', 'headPosition']) || pick(director, ['position']),
    contactPerson: pick(source, ['contactPerson', 'responsiblePerson']),
    contactPhone: pick(source, ['contactPhone', 'responsiblePersonPhone', 'responsiblePhone']),
    bank: pick(source, ['bank', 'bankName']) || pick(bank, ['bank', 'bankName', 'name']),
    bankName: pick(source, ['bankName', 'bank']) || pick(bank, ['bankName', 'bank', 'name']),
    iban: pick(source, ['iban', 'bankAccount', 'accountNumber']) || pick(bank, ['iban', 'accountNumber']),
    bik: pick(source, ['bik', 'bic']) || pick(bank, ['bik', 'bic']),
    kbe: pick(source, ['kbe']) || pick(bank, ['kbe']),
    knp: pick(source, ['knp']) || pick(bank, ['knp']),
    contractNumber: pick(source, ['contractNumber', 'agreementNumber']) || pick(contract, ['number']),
    contractDate: pick(source, ['contractDate', 'agreementDate']) || pick(contract, ['date']),
    objectName: pick(source, ['objectName', 'facilityName']) || pick(object, ['name']),
    objectAddress: pick(source, ['objectAddress', 'facilityAddress']) || pick(object, ['address']),
    activityType: pick(source, ['activityType', 'businessActivity']) || pick(object, ['activityType']),
    samplingLocation: pick(source, ['samplingLocation', 'samplingPlace']) || pick(object, ['samplingLocation', 'samplingPlace']),
    customerRepresentative: pick(source, ['customerRepresentative', 'clientRepresentative']) || pick(object, ['customerRepresentative', 'representative']),
    objects: objectsSource.map((item) => normalizeCompanyObject(item, pick(source, ['id', '_id', 'companyId']))),
    status: normalizeStatus(source.status),
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
  };
};

const toCompanyApiPayload = (payload: CompanyPayload): UnknownRecord => ({
  name: payload.name,
  bin: payload.bin,
  legalAddress: payload.legalAddress,
  actualAddress: payload.actualAddress,
  phone: payload.phone,
  email: payload.email,
  comment: payload.comment,
  notes: payload.notes || payload.comment,
  directorName: payload.directorFullName,
  director: payload.director || payload.directorFullName,
  directorPosition: payload.directorPosition,
  responsiblePerson: payload.contactPerson,
  responsiblePersonPhone: payload.contactPhone,
  bankName: payload.bank,
  bank: payload.bankName || payload.bank,
  iban: payload.iban,
  bik: payload.bik,
  kbe: payload.kbe,
  knp: payload.knp,
  contractNumber: payload.contractNumber,
  contractDate: payload.contractDate || null,
  objectName: payload.objectName,
  objectAddress: payload.objectAddress,
  activityType: payload.activityType,
  samplingLocation: payload.samplingLocation,
  customerRepresentative: payload.customerRepresentative,
  status: payload.status,
});

const toCompanyObjectApiPayload = (payload: CompanyObjectPayload): UnknownRecord => ({
  name: payload.name,
  address: payload.address,
  activityType: payload.activityType,
  coordinates: payload.coordinates,
  sanitaryZone: payload.sanitaryZone,
  notes: payload.notes,
  status: payload.status,
});

const unwrap = <T>(payload: ApiResponse<T> | T): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiResponse<T>).data;
  }
  return payload as T;
};

const unwrapList = (payload: unknown): unknown[] => {
  const data = unwrap(payload as ApiResponse<unknown> | unknown);
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const source = data as UnknownRecord;
    if (Array.isArray(source.items)) return source.items;
    if (Array.isArray(source.companies)) return source.companies;
    if (Array.isArray(source.rows)) return source.rows;
  }
  return [];
};

const unwrapItem = (payload: unknown): unknown => {
  const data = unwrap(payload as ApiResponse<unknown> | unknown);
  if (data && typeof data === 'object') {
    const source = data as UnknownRecord;
    return source.company || source.item || source.row || data;
  }
  return data;
};

export async function getCompanies(params?: CompanyQuery): Promise<Company[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/companies', { params });
  return unwrapList(response.data).map(normalizeCompany);
}

export async function searchCompanies(query: string): Promise<Company[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/companies/search', { params: { query } });
  return unwrapList(response.data).map(normalizeCompany);
}

export async function getCompanyById(id: string): Promise<Company> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${id}`);
  return normalizeCompany(unwrapItem(response.data));
}

export async function createCompany(payload: CompanyPayload): Promise<Company> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/companies', toCompanyApiPayload(payload));
  return normalizeCompany(unwrapItem(response.data));
}

export async function updateCompany(id: string, payload: CompanyPayload): Promise<Company> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${id}`, toCompanyApiPayload(payload));
  return normalizeCompany(unwrapItem(response.data));
}

export async function deleteCompany(id: string): Promise<Company | null> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/companies/${id}`);
  const item = unwrapItem(response.data);
  return item ? normalizeCompany(item) : null;
}

export async function archiveCompany(id: string): Promise<Company> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${id}/archive`);
  return normalizeCompany(unwrapItem(response.data));
}

export async function getCompanyObjects(companyId: string): Promise<CompanyObject[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`);
  return unwrapList(response.data).map((item) => normalizeCompanyObject(item, companyId));
}

export async function createCompanyObject(companyId: string, payload: CompanyObjectPayload): Promise<CompanyObject> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`, toCompanyObjectApiPayload(payload));
  return normalizeCompanyObject(unwrapItem(response.data), companyId);
}

export async function updateCompanyObject(companyId: string, objectId: string, payload: CompanyObjectPayload): Promise<CompanyObject> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`, toCompanyObjectApiPayload(payload));
  return normalizeCompanyObject(unwrapItem(response.data), companyId);
}

export async function deleteCompanyObject(companyId: string, objectId: string): Promise<CompanyObject | null> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`);
  const item = unwrapItem(response.data);
  return item ? normalizeCompanyObject(item, companyId) : null;
}

export async function archiveCompanyObject(companyId: string, objectId: string): Promise<CompanyObject> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`);
  const item = unwrapItem(response.data);
  return item ? normalizeCompanyObject(item, companyId) : {
    id: objectId,
    companyId,
    name: '',
    address: '',
    activityType: '',
    coordinates: '',
    sanitaryZone: '',
    notes: '',
    status: 'ARCHIVED',
  };
}
