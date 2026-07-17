import api, { ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import type { Company, CompanyObject, CompanyObjectPayload, CompanyPage, CompanyPayload, CompanyQuery } from '../types/companies';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));

type UnknownRecord = Record<string, unknown>;

const asString = (value: unknown) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const asNumber = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
};

const pick = (source: UnknownRecord, keys: string[]) => {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null) return asString(value);
  }
  return '';
};

const isArchived = (value: unknown) => ['ARCHIVED', 'INACTIVE', 'DELETED', 'DISABLED'].includes(String(value || '').toUpperCase()) || value === false;
const normalizeStatus = (value: unknown): Company['status'] => isArchived(value) ? 'ARCHIVED' : 'ACTIVE';
const normalizeObjectStatus = (value: unknown): CompanyObject['status'] => isArchived(value) ? 'ARCHIVED' : 'ACTIVE';

export const normalizeCompanyObject = (raw: unknown, companyId = ''): CompanyObject => {
  const source = (raw || {}) as UnknownRecord;
  return {
    id: pick(source, ['id', '_id', 'objectId', 'facilityId']),
    companyId: pick(source, ['companyId', 'company_id']) || companyId,
    virtual: source.virtual === true,
    name: pick(source, ['name', 'objectName', 'facilityName', 'title']),
    address: pick(source, ['address', 'objectAddress', 'facilityAddress']),
    activityType: pick(source, ['activityType', 'businessActivity']),
    coordinates: pick(source, ['coordinates', 'coords']),
    sanitaryZone: pick(source, ['sanitaryZone', 'sanitary_zone']),
    notes: pick(source, ['notes', 'comment']),
    samplingLocation: pick(source, ['samplingLocation', 'samplingPlace']),
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
    objectCount: asNumber(source.objectCount ?? source.objectsCount ?? source.facilityCount, objectsSource.filter((item) => !isArchived(asRecord(item).status)).length),
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

const requireCompany = (company: Company, message = 'Backend не вернул идентификатор компании.') => {
  if (!company.id) throw new Error(message);
  return company;
};

const requireCompanyObject = (object: CompanyObject) => {
  if (!object.id) throw new Error('Backend не вернул идентификатор объекта.');
  return object;
};

const pageFromResponse = (response: unknown, requestedPage: number, requestedSize: number): CompanyPage => {
  let data = asRecord(response);
  for (let depth = 0; depth < 3; depth += 1) {
    const nested = asRecord(data.data ?? data.result);
    if (!Object.keys(nested).length) break;
    data = nested;
  }
  const root = asRecord(response);
  const pageSource = asRecord(data.page ?? data.pagination ?? root.page ?? root.pagination);
  const items = extractList(response, ['companies', 'content', 'items', 'results']).map(normalizeCompany);
  const totalElements = asNumber(data.totalElements ?? data.total ?? data.totalCount ?? pageSource.totalElements ?? pageSource.total, items.length);
  const size = Math.max(1, asNumber(data.size ?? data.pageSize ?? pageSource.size, requestedSize));
  return {
    items,
    totalElements,
    totalPages: Math.max(1, asNumber(data.totalPages ?? pageSource.totalPages, Math.ceil(totalElements / size) || 1)),
    page: asNumber(data.number ?? data.pageNumber ?? pageSource.number ?? pageSource.page, requestedPage),
    size,
  };
};

const toCompanyObjectApiPayload = (payload: CompanyObjectPayload): UnknownRecord => ({
  name: payload.name,
  address: payload.address,
  activityType: payload.activityType,
  coordinates: payload.coordinates,
  sanitaryZone: payload.sanitaryZone,
  notes: payload.notes,
  samplingLocation: payload.samplingLocation,
  status: payload.status,
});

export async function getCompaniesPage(params: CompanyQuery = {}, signal?: AbortSignal): Promise<CompanyPage> {
  const requestedPage = Math.max(0, params.page || 0);
  const requestedSize = Math.max(1, params.size || 20);
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const query = String(params?.search || params?.name || params?.bin || '').toLowerCase();
    const filtered = mockCompanies.filter((company) => (!params?.status || company.status === params.status) && (!query || `${company.name} ${company.bin}`.toLowerCase().includes(query)));
    const items = filtered.slice(requestedPage * requestedSize, (requestedPage + 1) * requestedSize);
    return { items, totalElements: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / requestedSize)), page: requestedPage, size: requestedSize };
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/companies', { params: { ...params, page: requestedPage, size: requestedSize }, signal });
  return pageFromResponse(response, requestedPage, requestedSize);
}

export async function getCompanies(params?: CompanyQuery, signal?: AbortSignal): Promise<Company[]> {
  return (await getCompaniesPage(params, signal)).items;
}

export async function searchCompanies(query: string): Promise<Company[]> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    return mockCompanies.filter((company) => `${company.name} ${company.bin}`.toLowerCase().includes(query.toLowerCase()));
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/companies/search', { params: { query } });
  return extractList(response, ['companies']).map(normalizeCompany);
}

export async function getCompanyById(id: string, signal?: AbortSignal): Promise<Company> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = mockCompanies.find((item) => item.id === id);
    if (!company) throw new Error('Компания не найдена.');
    return company;
  }
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${id}`, { signal });
  return requireCompany(normalizeCompany(extractItem(response, ['company'])), 'Компания не найдена или backend вернул пустой ответ.');
}

export async function createCompany(payload: CompanyPayload): Promise<Company> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = normalizeCompany({ ...payload, id: `company-${Date.now()}`, status: 'ACTIVE', createdAt: new Date().toISOString(), objects: payload.objects || [] });
    mockCompanies.unshift(company);
    return company;
  }
  const response = await api.post<ApiResponse<unknown> | unknown>('/companies', toCompanyApiPayload(payload));
  return requireCompany(normalizeCompany(extractItem(response, ['company'])));
}

export async function updateCompany(id: string, payload: CompanyPayload): Promise<Company> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const index = mockCompanies.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Компания не найдена.');
    mockCompanies[index] = normalizeCompany({ ...mockCompanies[index], ...payload, id, objects: mockCompanies[index].objects, updatedAt: new Date().toISOString() });
    return mockCompanies[index];
  }
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${id}`, toCompanyApiPayload(payload));
  return requireCompany(normalizeCompany(extractItem(response, ['company'])));
}

export async function deleteCompany(id: string): Promise<Company | null> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/companies/${id}`);
  const item = extractItem(response, ['company']);
  return item ? normalizeCompany(item) : null;
}

export async function archiveCompany(id: string): Promise<Company> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = mockCompanies.find((item) => item.id === id);
    if (!company) throw new Error('Компания не найдена.');
    company.status = 'ARCHIVED';
    company.updatedAt = new Date().toISOString();
    return company;
  }
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${id}/archive`);
  return requireCompany(normalizeCompany(extractItem(response, ['company'])));
}

export async function getCompanyObjects(companyId: string, signal?: AbortSignal): Promise<CompanyObject[]> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    return mockCompanies.find((company) => company.id === companyId)?.objects || [];
  }
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`, { signal });
  return extractList(response, ['objects', 'companyObjects', 'facilities']).map((item) => normalizeCompanyObject(item, companyId));
}

export async function createCompanyObject(companyId: string, payload: CompanyObjectPayload): Promise<CompanyObject> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = mockCompanies.find((item) => item.id === companyId);
    if (!company) throw new Error('Компания не найдена.');
    const object = normalizeCompanyObject({ ...payload, id: `object-${Date.now()}`, companyId, status: 'ACTIVE', createdAt: new Date().toISOString() }, companyId);
    company.objects.push(object);
    company.objectCount = company.objects.filter((item) => item.status === 'ACTIVE').length;
    return object;
  }
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`, toCompanyObjectApiPayload(payload));
  return requireCompanyObject(normalizeCompanyObject(extractItem(response, ['object', 'companyObject']), companyId));
}

export async function updateCompanyObject(companyId: string, objectId: string, payload: CompanyObjectPayload): Promise<CompanyObject> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = mockCompanies.find((item) => item.id === companyId);
    const index = company?.objects.findIndex((item) => item.id === objectId) ?? -1;
    if (!company || index < 0) throw new Error('Объект не найден.');
    company.objects[index] = normalizeCompanyObject({ ...company.objects[index], ...payload, id: objectId, companyId, updatedAt: new Date().toISOString() }, companyId);
    return company.objects[index];
  }
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`, toCompanyObjectApiPayload(payload));
  return requireCompanyObject(normalizeCompanyObject(extractItem(response, ['object', 'companyObject']), companyId));
}

export async function deleteCompanyObject(companyId: string, objectId: string): Promise<CompanyObject | null> {
  const response = await api.delete<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`);
  const item = extractItem(response, ['object', 'companyObject']);
  return item ? normalizeCompanyObject(item, companyId) : null;
}

export async function archiveCompanyObject(companyId: string, objectId: string): Promise<CompanyObject> {
  if (useMocks) {
    await mockDelay();
    const { mockCompanies } = await import('../mocks/mockCompanies');
    const company = mockCompanies.find((item) => item.id === companyId);
    const object = company?.objects.find((item) => item.id === objectId);
    if (!company || !object) throw new Error('Объект не найден.');
    object.status = 'ARCHIVED';
    object.updatedAt = new Date().toISOString();
    company.objectCount = company.objects.filter((item) => item.status === 'ACTIVE').length;
    return object;
  }
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}/archive`);
  const item = extractItem(response, ['object', 'companyObject']);
  return item ? normalizeCompanyObject(item, companyId) : {
    id: objectId,
    companyId,
    name: '',
    address: '',
    activityType: '',
    coordinates: '',
    sanitaryZone: '',
    notes: '',
    samplingLocation: '',
    status: 'ARCHIVED',
  };
}
