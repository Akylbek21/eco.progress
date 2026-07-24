import axios from 'axios';
import api from './api';
import type {
  ApiResponse,
  Company,
  CompanyCreateRequest,
  CompanyDetails,
  CompanyListItem,
  CompanyObject,
  CompanyObjectRequest,
  CompanyQuery,
  CompanyUpdateRequest,
  FieldErrorResponse,
  PageResponse,
} from '../types/companies';

type UnknownRecord = Record<string, unknown>;

const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const stringValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const numberValue = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const booleanValue = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;
const pick = (source: UnknownRecord, keys: string[]): string => {
  for (const key of keys) if (source[key] !== undefined && source[key] !== null) return stringValue(source[key]);
  return '';
};
const unwrap = (value: unknown): unknown => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const source = record(current);
    if (!('data' in source)) break;
    current = source.data;
  }
  return current;
};
const archived = (value: unknown): boolean =>
  ['ARCHIVED', 'INACTIVE', 'DELETED', 'DISABLED'].includes(String(value || '').toUpperCase()) || value === false;

export const normalizeCompanyObject = (raw: unknown, companyId = ''): CompanyObject => {
  const source = record(raw);
  const location = record(source.location ?? source.geoLocation ?? source.geolocation);
  const latitude = pick(source, ['latitude', 'lat']) || pick(location, ['latitude', 'lat']);
  const longitude = pick(source, ['longitude', 'lng', 'lon']) || pick(location, ['longitude', 'lng', 'lon']);
  return {
    id: pick(source, ['id', 'objectId', 'facilityId', '_id']),
    companyId: pick(source, ['companyId', 'company_id']) || companyId,
    virtual: source.virtual === true || source.isVirtual === true,
    isVirtual: source.virtual === true || source.isVirtual === true,
    name: pick(source, ['name', 'objectName', 'facilityName', 'title']),
    objectType: pick(source, ['objectType', 'type', 'facilityType']),
    address: pick(source, ['address', 'objectAddress', 'facilityAddress']),
    region: pick(source, ['region', 'regionName']),
    cityDistrict: pick(source, ['cityDistrict', 'city', 'district']),
    coordinates: pick(source, ['coordinates', 'coords']) || pick(location, ['coordinates', 'coords']) || (latitude && longitude ? `${latitude},${longitude}` : ''),
    contactPerson: pick(source, ['contactPerson', 'responsiblePerson']),
    contactPhone: pick(source, ['contactPhone', 'responsiblePersonPhone']),
    primary: source.primary === true || source.isPrimary === true,
    activityType: pick(source, ['activityType', 'businessActivity']),
    sanitaryZone: pick(source, ['sanitaryZone', 'sanitary_zone']),
    samplingLocation: pick(source, ['samplingLocation', 'samplingPlace']),
    notes: pick(source, ['notes', 'comment']),
    status: archived(source.status ?? source.active) ? 'ARCHIVED' : 'ACTIVE',
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
  };
};

export const normalizeCompany = (raw: unknown): CompanyDetails => {
  const source = record(raw);
  const id = pick(source, ['id', 'companyId', '_id']);
  const objectsRaw = Array.isArray(source.objects)
    ? source.objects
    : Array.isArray(source.companyObjects) ? source.companyObjects : Array.isArray(source.facilities) ? source.facilities : [];
  const objects = objectsRaw.map((item) => normalizeCompanyObject(item, id));
  const bank = record(source.bankDetails ?? source.requisites);
  return {
    id,
    name: pick(source, ['name', 'companyName', 'title', 'organizationName']),
    shortName: pick(source, ['shortName', 'short_name']),
    bin: pick(source, ['bin', 'iin', 'binIin', 'bin_iin', 'taxId']),
    legalAddress: pick(source, ['legalAddress', 'juridicalAddress', 'registeredAddress']),
    actualAddress: pick(source, ['actualAddress', 'factualAddress', 'physicalAddress', 'address']),
    phone: pick(source, ['phone', 'phoneNumber']),
    email: pick(source, ['email']),
    website: pick(source, ['website', 'site']),
    directorFullName: pick(source, ['directorFullName', 'directorName', 'director', 'headName']),
    director: pick(source, ['director', 'directorFullName', 'directorName', 'headName']),
    directorPosition: pick(source, ['directorPosition', 'headPosition']),
    contactPerson: pick(source, ['contactPerson', 'responsiblePerson']),
    contactPhone: pick(source, ['contactPhone', 'responsiblePersonPhone', 'responsiblePhone']),
    contactEmail: pick(source, ['contactEmail', 'responsiblePersonEmail']),
    bankName: pick(source, ['bankName', 'bank']) || pick(bank, ['bankName', 'bank', 'name']),
    bank: pick(source, ['bank', 'bankName']) || pick(bank, ['bank', 'bankName', 'name']),
    iban: pick(source, ['iban', 'bankAccount', 'accountNumber']) || pick(bank, ['iban', 'accountNumber']),
    bik: pick(source, ['bik', 'bic']) || pick(bank, ['bik', 'bic']),
    kbe: pick(source, ['kbe']) || pick(bank, ['kbe']),
    knp: pick(source, ['knp']) || pick(bank, ['knp']),
    notes: pick(source, ['notes', 'comment']),
    comment: pick(source, ['comment', 'notes']),
    contractNumber: pick(source, ['contractNumber', 'agreementNumber']),
    contractDate: pick(source, ['contractDate', 'agreementDate']),
    objectName: pick(source, ['objectName', 'facilityName']),
    objectAddress: pick(source, ['objectAddress', 'facilityAddress']),
    activityType: pick(source, ['activityType', 'businessActivity']),
    samplingLocation: pick(source, ['samplingLocation', 'samplingPlace']),
    customerRepresentative: pick(source, ['customerRepresentative', 'clientRepresentative']),
    objects,
    objectCount: numberValue(source.objectCount, objects.filter((item) => item.status === 'ACTIVE').length),
    status: archived(source.status ?? source.active) ? 'ARCHIVED' : 'ACTIVE',
    createdAt: pick(source, ['createdAt', 'created_at']),
    updatedAt: pick(source, ['updatedAt', 'updated_at']),
  };
};

const normalizeListItem = (raw: unknown): CompanyListItem => {
  const company = normalizeCompany(raw);
  return company;
};

/** Transitional adapter. Remove after every environment returns data.items and page metadata. */
export function normalizeCompaniesResponse(
  response: unknown,
  requestedPage: number,
  requestedSize: number,
): PageResponse<CompanyListItem> {
  const payload = unwrap(response);
  const source = record(payload);
  const isLegacyArray = Array.isArray(payload);
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.content) ? source.content : isLegacyArray ? payload : [];
  const items = rawItems.map(normalizeListItem);

  if (isLegacyArray) {
    return {
      items,
      page: requestedPage,
      size: requestedSize,
      totalElements: items.length,
      totalPages: requestedPage + 1,
      first: requestedPage === 0,
      last: true,
      hasNext: false,
      hasPrevious: requestedPage > 0,
      totalElementsExact: false,
    };
  }

  const page = numberValue(source.page ?? source.number, requestedPage);
  const size = Math.max(1, numberValue(source.size, requestedSize));
  const totalElements = numberValue(source.totalElements, items.length);
  const totalPages = numberValue(source.totalPages, totalElements === 0 ? 0 : Math.ceil(totalElements / size));
  const first = booleanValue(source.first, page === 0);
  const last = booleanValue(source.last, totalPages === 0 || page >= totalPages - 1);
  return {
    items,
    page,
    size,
    totalElements,
    totalPages,
    first,
    last,
    hasNext: booleanValue(source.hasNext, !last),
    hasPrevious: booleanValue(source.hasPrevious, !first),
    totalElementsExact: true,
  };
}

export async function getCompanies(params: CompanyQuery, signal?: AbortSignal): Promise<PageResponse<CompanyListItem>> {
  const response = await api.get<ApiResponse<PageResponse<unknown>> | unknown>('/companies', { params, signal });
  return normalizeCompaniesResponse(response, params.page, params.size);
}

export const getCompaniesPage = getCompanies;

export async function getActiveCompanies(signal?: AbortSignal): Promise<Company[]> {
  const firstPage = await getCompanies({ page: 0, size: 100, status: 'ACTIVE' }, signal);
  if (!firstPage.hasNext || firstPage.totalPages <= 1) return firstPage.items.map((item) => normalizeCompany(item));
  const remaining = await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
    getCompanies({ page: index + 1, size: firstPage.size, status: 'ACTIVE' }, signal)));
  return [firstPage, ...remaining].flatMap((page) => page.items).map((item) => normalizeCompany(item));
}

export async function getCompanyById(id: string, signal?: AbortSignal): Promise<CompanyDetails> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${id}`, { signal });
  const company = normalizeCompany(unwrap(response));
  if (!company.id) throw new Error('Компания не найдена или backend вернул пустой ответ.');
  return company;
}

export async function createCompany(payload: CompanyCreateRequest): Promise<CompanyDetails> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/companies', payload);
  const company = normalizeCompany(unwrap(response));
  if (!company.id) throw new Error('Backend не вернул идентификатор созданной компании.');
  return company;
}

export async function updateCompany(id: string, payload: CompanyUpdateRequest): Promise<CompanyDetails> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${id}`, payload);
  const company = normalizeCompany(unwrap(response));
  if (!company.id) throw new Error('Backend не вернул идентификатор компании.');
  return company;
}

export async function archiveCompany(id: string): Promise<CompanyDetails> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${id}/archive`);
  const company = normalizeCompany(unwrap(response));
  return company.id ? company : { ...company, id, status: 'ARCHIVED' };
}

export async function restoreCompany(companyId: string | number): Promise<CompanyDetails> {
  const id = String(companyId);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${id}/restore`);
  const company = normalizeCompany(unwrap(response));
  return company.id ? company : { ...company, id, status: 'ACTIVE' };
}

export async function getCompanyObjects(companyId: string, includeArchivedObjects = false, signal?: AbortSignal): Promise<CompanyObject[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`, { params: { includeArchivedObjects }, signal });
  const payload = unwrap(response);
  const source = record(payload);
  const items = Array.isArray(payload) ? payload
    : Array.isArray(source.items) ? source.items
      : Array.isArray(source.objects) ? source.objects
        : Array.isArray(source.content) ? source.content : [];
  return items.map((item) => normalizeCompanyObject(item, companyId));
}

export async function getCompanyObject(companyId: string, objectId: string, signal?: AbortSignal): Promise<CompanyObject> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`, { signal });
  const object = normalizeCompanyObject(unwrap(response), companyId);
  if (!object.id) throw new Error('Объект не найден.');
  return object;
}

export async function createCompanyObject(companyId: string, payload: CompanyObjectRequest): Promise<CompanyObject> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects`, payload);
  const object = normalizeCompanyObject(unwrap(response), companyId);
  if (!object.id) throw new Error('Backend не вернул идентификатор объекта.');
  return object;
}

export async function updateCompanyObject(companyId: string, objectId: string, payload: CompanyObjectRequest): Promise<CompanyObject> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}`, payload);
  const object = normalizeCompanyObject(unwrap(response), companyId);
  if (!object.id) throw new Error('Backend не вернул идентификатор объекта.');
  return object;
}

export async function archiveCompanyObject(companyId: string, objectId: string): Promise<CompanyObject> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyId}/objects/${objectId}/archive`);
  const object = normalizeCompanyObject(unwrap(response), companyId);
  return object.id ? object : { ...object, id: objectId, companyId, status: 'ARCHIVED' };
}

export async function restoreCompanyObject(companyId: string | number, objectId: string | number): Promise<CompanyObject> {
  const companyKey = String(companyId);
  const objectKey = String(objectId);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/companies/${companyKey}/objects/${objectKey}/restore`);
  const object = normalizeCompanyObject(unwrap(response), companyKey);
  return object.id ? object : { ...object, id: objectKey, companyId: companyKey, status: 'ACTIVE' };
}

export function getCompanyFieldErrors(error: unknown): FieldErrorResponse[] {
  if (!axios.isAxiosError(error)) return [];
  const response = record(error.response?.data);
  const nested = record(response.data);
  const errors = response.errors ?? nested.errors;
  if (Array.isArray(errors)) {
    return errors.flatMap((item) => {
      const value = record(item);
      const field = pick(value, ['field', 'property', 'name']);
      const message = pick(value, ['message', 'defaultMessage']);
      return field && message ? [{ field, message }] : [];
    });
  }
  const fieldErrors = record(errors);
  return Object.entries(fieldErrors).flatMap(([field, message]) =>
    typeof message === 'string' ? [{ field, message }] : []);
}
