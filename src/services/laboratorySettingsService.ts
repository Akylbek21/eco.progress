import api, { type ApiResponse } from './api';
import { extractItem, extractList, getApiStatus } from './apiHelpers';
import type {
  AccreditationStatus,
  LaboratoryDetails,
  LaboratoryEmployee,
  LaboratoryEmployeeFormValues,
  LaboratoryFormValues,
  LaboratoryListItem,
  PageResponse,
} from '../types/laboratories';

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value).trim();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const bool = (value: unknown, fallback = false) => value === undefined || value === null ? fallback : value === true || value === 'true' || value === 1;
const nullable = (value: string) => value.trim() || null;
const requireId = (value: string | number, label = 'лаборатории') => {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`Некорректный ID ${label}`);
  return id;
};

const accreditationStatus = (source: UnknownRecord): AccreditationStatus => {
  const status = text(source.accreditationStatus).toUpperCase();
  if (['VALID', 'EXPIRING', 'EXPIRED', 'NOT_CONFIGURED'].includes(status)) return status as AccreditationStatus;
  const validUntil = text(source.accreditationValidUntil ?? source.certificateValidUntil);
  if (!validUntil) return 'NOT_CONFIGURED';
  const days = Math.ceil((new Date(`${validUntil.slice(0, 10)}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  if (!Number.isFinite(days)) return 'NOT_CONFIGURED';
  if (days < 0) return 'EXPIRED';
  return days < 30 ? 'EXPIRING' : 'VALID';
};

export const normalizeLaboratoryListItem = (raw: unknown): LaboratoryListItem => {
  const source = asRecord(raw);
  const archived = bool(source.archived) || text(source.status).toUpperCase() === 'ARCHIVED';
  return {
    id: number(source.id ?? source.laboratoryId),
    name: text(source.name ?? source.laboratoryName),
    shortName: text(source.shortName) || undefined,
    bin: text(source.bin) || undefined,
    address: text(source.address ?? source.laboratoryAddress) || undefined,
    accreditationNumber: text(source.accreditationNumber ?? source.certificateNumber) || undefined,
    accreditationValidUntil: text(source.accreditationValidUntil ?? source.certificateValidUntil).slice(0, 10) || undefined,
    accreditationStatus: accreditationStatus(source),
    defaultLaboratory: bool(source.defaultLaboratory ?? source.isDefault),
    isDefault: bool(source.defaultLaboratory ?? source.isDefault),
    active: source.active !== false && !archived,
    archived,
    employeesCount: number(source.employeesCount ?? source.totalEmployees),
    activeEmployeesCount: number(source.activeEmployeesCount),
    updatedAt: text(source.updatedAt) || undefined,
  };
};

export const normalizeLaboratoryEmployee = (raw: unknown): LaboratoryEmployee => {
  const source = asRecord(raw);
  const user = asRecord(source.user);
  return {
    id: number(source.id ?? source.laboratoryEmployeeId ?? source.employeeId),
    laboratoryId: number(source.laboratoryId),
    userId: number(source.userId ?? user.id),
    fullName: text(source.fullName ?? source.name ?? user.fullName ?? user.name),
    position: text(source.position) || undefined,
    phone: text(source.phone ?? user.phone) || undefined,
    email: text(source.email ?? user.email) || undefined,
    employeeNumber: text(source.employeeNumber) || undefined,
    qualification: text(source.qualification) || undefined,
    canExecuteMeasurements: bool(source.canExecuteMeasurements, true),
    canApproveProtocols: bool(source.canApproveProtocols),
    canSignProtocols: bool(source.canSignProtocols),
    active: source.active !== false && !['INACTIVE', 'DEACTIVATED', 'ARCHIVED'].includes(text(source.status).toUpperCase()),
    deactivatedAt: text(source.deactivatedAt) || undefined,
  };
};

export const normalizeLaboratoryDetails = (raw: unknown): LaboratoryDetails => {
  const source = asRecord(raw);
  const list = normalizeLaboratoryListItem(source);
  return {
    ...list,
    legalName: text(source.legalName) || undefined,
    city: text(source.city) || undefined,
    phone: text(source.phone) || undefined,
    email: text(source.email) || undefined,
    website: text(source.website ?? source.site) || undefined,
    notes: text(source.notes ?? source.standardNote) || undefined,
    accreditationValidFrom: text(source.accreditationValidFrom ?? source.accreditationIssuedAt).slice(0, 10) || undefined,
    accreditationIssuedAt: text(source.accreditationValidFrom ?? source.accreditationIssuedAt).slice(0, 10) || undefined,
    accreditationIssuedBy: text(source.accreditationIssuedBy) || undefined,
    directorEmployeeId: number(source.directorEmployeeId ?? source.directorId) || undefined,
    directorId: number(source.directorEmployeeId ?? source.directorId) || undefined,
    directorName: text(source.directorName ?? asRecord(source.director).fullName) || undefined,
    headEmployeeId: number(source.headEmployeeId ?? source.laboratoryHeadId ?? source.headId) || undefined,
    laboratoryHeadId: number(source.headEmployeeId ?? source.laboratoryHeadId ?? source.headId) || undefined,
    laboratoryHeadName: text(source.laboratoryHeadName ?? source.headName ?? asRecord(source.laboratoryHead).fullName) || undefined,
    logoFileId: number(source.logoFileId) || undefined,
    logoUrl: text(source.logoUrl) || undefined,
    createdAt: text(source.createdAt) || undefined,
    protocolsCount: source.protocolsCount === undefined ? undefined : number(source.protocolsCount),
    measurementDevicesCount: source.measurementDevicesCount === undefined ? undefined : number(source.measurementDevicesCount),
    journalsCount: source.journalsCount === undefined ? undefined : number(source.journalsCount),
    standardNote: text(source.notes ?? source.standardNote) || undefined,
    employees: Array.isArray(source.employees) ? source.employees.map(normalizeLaboratoryEmployee) : [],
  };
};

const normalizePage = (response: unknown, requestedPage: number, requestedSize: number): PageResponse<LaboratoryListItem> => {
  const body = asRecord(asRecord(response).data);
  const data = asRecord(body.data);
  const container = Object.keys(data).length ? data : body;
  const items = Array.isArray(container.items) ? container.items.map(normalizeLaboratoryListItem) : extractList(response, ['items', 'content', 'laboratories']).map(normalizeLaboratoryListItem);
  const page = number(container.page ?? container.number ?? requestedPage);
  const size = number(container.size ?? requestedSize) || requestedSize;
  const totalElements = number(container.totalElements);
  const totalPages = number(container.totalPages);
  const first = typeof container.first === 'boolean' ? container.first : page === 0;
  const last = typeof container.last === 'boolean' ? container.last : totalPages > 0 ? page >= totalPages - 1 : true;
  return {
    items, page, size, totalElements, totalPages, first, last,
    hasNext: typeof container.hasNext === 'boolean' ? container.hasNext : !last,
    hasPrevious: typeof container.hasPrevious === 'boolean' ? container.hasPrevious : !first,
  };
};

export type LaboratoryListParams = {
  page: number;
  size: number;
  search?: string;
  status?: 'ACTIVE' | 'ARCHIVED' | 'ALL';
  accreditationStatus?: AccreditationStatus;
  sort?: string;
};

export async function getLaboratories(params: LaboratoryListParams, signal?: AbortSignal): Promise<PageResponse<LaboratoryListItem>> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories', { params, signal });
  return normalizePage(response, params.page, params.size);
}

export async function getActiveLaboratories(signal?: AbortSignal): Promise<LaboratoryListItem[]> {
  const page = await getLaboratories({ page: 0, size: 100, status: 'ACTIVE', sort: 'defaultLaboratory,desc' }, signal);
  return page.items.filter((item) => item.active && !item.archived);
}

export async function getDefaultLaboratory(signal?: AbortSignal): Promise<LaboratoryDetails | null> {
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories/default', { signal });
    const details = normalizeLaboratoryDetails(extractItem(response, ['laboratory', 'item']));
    return details.id ? details : null;
  } catch (error) {
    if (getApiStatus(error) && getApiStatus(error) !== 404) throw error;
    const active = await getActiveLaboratories(signal);
    const selected = active.find((item) => item.defaultLaboratory);
    return selected ? getLaboratory(selected.id, signal) : null;
  }
}

export async function getLaboratory(id: string | number, signal?: AbortSignal): Promise<LaboratoryDetails> {
  const laboratoryId = requireId(id);
  const response = await api.get<ApiResponse<unknown> | unknown>(`/settings/laboratories/${laboratoryId}`, { signal });
  const details = normalizeLaboratoryDetails(extractItem(response, ['laboratory', 'profile', 'item']));
  if (!details.id) throw new Error('Backend вернул пустую карточку лаборатории');
  return details;
}

const laboratoryPayload = (values: LaboratoryFormValues) => ({
  name: values.name.trim(), shortName: nullable(values.shortName), bin: nullable(values.bin), address: nullable(values.address),
  city: nullable(values.city), phone: nullable(values.phone), email: nullable(values.email), website: nullable(values.website), notes: nullable(values.notes),
  accreditationNumber: nullable(values.accreditationNumber), accreditationValidFrom: nullable(values.accreditationValidFrom),
  accreditationValidUntil: nullable(values.accreditationValidUntil), accreditationIssuedBy: nullable(values.accreditationIssuedBy),
  directorEmployeeId: values.directorEmployeeId, headEmployeeId: values.headEmployeeId,
});

export async function createLaboratory(values: LaboratoryFormValues): Promise<LaboratoryDetails> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/laboratories', laboratoryPayload(values));
  return normalizeLaboratoryDetails(extractItem(response, ['laboratory', 'item']));
}
export async function updateLaboratory(id: string | number, values: LaboratoryFormValues): Promise<LaboratoryDetails> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(id)}`, laboratoryPayload(values));
  return normalizeLaboratoryDetails(extractItem(response, ['laboratory', 'item']));
}
export async function setDefaultLaboratory(id: string | number): Promise<void> { await api.post(`/laboratories/${requireId(id)}/default`); }
export async function archiveLaboratory(id: string | number): Promise<void> { await api.post(`/laboratories/${requireId(id)}/archive`); }
export async function restoreLaboratory(id: string | number): Promise<void> { await api.post(`/laboratories/${requireId(id)}/restore`); }

export async function getLaboratoryEmployees(id: string | number, options: { includeInactive?: boolean; signal?: AbortSignal } = {}): Promise<LaboratoryEmployee[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(id)}/employees`, {
    params: { includeInactive: options.includeInactive === true }, signal: options.signal,
  });
  return extractList(response, ['employees', 'items']).map(normalizeLaboratoryEmployee);
}
export async function getEligibleLaboratoryEmployees(laboratoryId: string | number, signal?: AbortSignal): Promise<LaboratoryEmployee[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories/eligible-employees', { params: { laboratoryId: requireId(laboratoryId) }, signal });
  return extractList(response, ['employees', 'users', 'items']).map(normalizeLaboratoryEmployee).filter((item) => item.active);
}
export async function addLaboratoryEmployee(laboratoryId: string | number, values: LaboratoryEmployeeFormValues): Promise<LaboratoryEmployee> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(laboratoryId)}/employees`, values);
  return normalizeLaboratoryEmployee(extractItem(response, ['employee', 'item']));
}
export async function updateLaboratoryEmployee(laboratoryId: string | number, employeeId: string | number, values: LaboratoryEmployeeFormValues): Promise<LaboratoryEmployee> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}`, values);
  return normalizeLaboratoryEmployee(extractItem(response, ['employee', 'item']));
}
export async function deactivateLaboratoryEmployee(laboratoryId: string | number, employeeId: string | number): Promise<void> {
  await api.post(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}/deactivate`);
}
export async function activateLaboratoryEmployee(laboratoryId: string | number, employeeId: string | number): Promise<void> {
  await api.post(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}/activate`);
}

export async function uploadLaboratoryLogo(id: string | number, file: File): Promise<LaboratoryDetails> {
  const formData = new FormData(); formData.append('file', file);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/settings/laboratories/${requireId(id)}/logo`, formData);
  const details = normalizeLaboratoryDetails(extractItem(response, ['laboratory', 'item']));
  return details.id ? details : getLaboratory(id);
}
export async function removeLaboratoryLogo(id: string | number): Promise<void> { await api.delete(`/settings/laboratories/${requireId(id)}/logo`); }
export const getLaboratoryLogoUrl = (id: string | number) => `/settings/laboratories/${requireId(id)}/logo`;

export const accreditationState = (validUntil?: string, backendStatus?: AccreditationStatus) => {
  const status = backendStatus || accreditationStatus({ accreditationValidUntil: validUntil });
  if (!validUntil) return { status, daysLeft: null };
  const daysLeft = Math.ceil((new Date(`${validUntil}T23:59:59`).getTime() - Date.now()) / 86_400_000);
  return { status, daysLeft: Number.isFinite(daysLeft) ? daysLeft : null };
};

export const laboratoryService = {
  getLaboratories, getLaboratory, createLaboratory, updateLaboratory, setDefaultLaboratory, archiveLaboratory, restoreLaboratory,
  getEmployees: getLaboratoryEmployees, getEligibleEmployees: getEligibleLaboratoryEmployees, addEmployee: addLaboratoryEmployee,
  updateEmployee: updateLaboratoryEmployee, deactivateEmployee: deactivateLaboratoryEmployee, activateEmployee: activateLaboratoryEmployee,
  uploadLogo: uploadLaboratoryLogo, getLogoUrl: getLaboratoryLogoUrl, removeLogo: removeLaboratoryLogo,
};
