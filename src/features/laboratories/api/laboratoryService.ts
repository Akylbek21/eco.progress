import api, { type ApiResponse } from '../../../services/api';
import { extractItem, extractList, getApiStatus } from '../../../services/apiHelpers';
import type { LaboratoriesQuery, LaboratoryDetails, LaboratoryEmployee, LaboratoryEmployeeFormValues, LaboratoryFormValues, LaboratoryListItem, PageResponse } from '../../../types/laboratories';
import { accreditationDaysLeft, getAccreditationStatus } from '../utils/laboratoryFormatters';
import { mapLaboratoriesResponse, mapLaboratoryDtoToModel, mapLaboratoryEmployeeDto, mapLaboratoryFormToCreateRequest, mapLaboratoryFormToUpdateRequest, mapLaboratoryListItem } from './laboratoryMappers';

const requireId = (value: string | number, label = 'лаборатории') => { const id = Number(value); if (!Number.isInteger(id) || id <= 0) throw new Error(`Некорректный ID ${label}`); return id; };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const details = (raw: unknown): LaboratoryDetails => {
  const model = mapLaboratoryDtoToModel(raw); const source = record(extractItem(raw, ['laboratory', 'profile', 'item']) ?? raw); const list = mapLaboratoryListItem(source);
  return { ...list, ...model, accreditationStatus: getAccreditationStatus(model.accreditationValidUntil), logoFileId: Number(source.logoFileId) || undefined, employees: Array.isArray(source.employees) ? source.employees.map(mapLaboratoryEmployeeDto) : [] };
};

export async function getLaboratories(query: LaboratoriesQuery, signal?: AbortSignal): Promise<PageResponse<LaboratoryListItem>> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories', { signal });
  return mapLaboratoriesResponse(response, query);
}
export async function getActiveLaboratories(signal?: AbortSignal): Promise<LaboratoryListItem[]> {
  return (await getLaboratories({ page: 0, size: 10_000, status: 'ACTIVE', sort: 'isDefault,desc' }, signal)).content;
}
export async function getLaboratory(id: string | number, signal?: AbortSignal): Promise<LaboratoryDetails> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/settings/laboratories/${requireId(id)}`, { signal });
  return details(response);
}
export async function getDefaultLaboratory(signal?: AbortSignal): Promise<LaboratoryDetails | null> {
  try { return details(await api.get<ApiResponse<unknown> | unknown>('/settings/laboratories/default', { signal })); }
  catch (error) { if (getApiStatus(error) === 404) return null; throw error; }
}
export async function createLaboratory(values: LaboratoryFormValues): Promise<LaboratoryDetails> {
  return details(await api.post<ApiResponse<unknown> | unknown>('/laboratories', mapLaboratoryFormToCreateRequest(values)));
}
export async function updateLaboratory(id: string | number, values: LaboratoryFormValues): Promise<LaboratoryDetails> {
  return details(await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(id)}`, mapLaboratoryFormToUpdateRequest(values)));
}
export const setDefaultLaboratory = async (id: string | number) => { await api.patch(`/laboratories/${requireId(id)}`, { isDefault: true }); };
export const deactivateLaboratory = async (id: string | number) => { await api.patch(`/laboratories/${requireId(id)}`, { active: false }); };
export const activateLaboratory = async (id: string | number) => { await api.patch(`/laboratories/${requireId(id)}`, { active: true }); };

export async function getLaboratoryEmployees(id: string | number, options: { includeInactive?: boolean; signal?: AbortSignal } = {}): Promise<LaboratoryEmployee[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(id)}/employees`, { params: options.includeInactive ? { includeInactive: true } : undefined, signal: options.signal });
  return extractList(response, ['employees', 'items']).map(mapLaboratoryEmployeeDto);
}
export async function getEligibleLaboratoryEmployees(laboratoryId: string | number, signal?: AbortSignal): Promise<LaboratoryEmployee[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories/eligible-employees', { params: { laboratoryId: requireId(laboratoryId) }, signal });
  return extractList(response, ['employees', 'users', 'items']).map(mapLaboratoryEmployeeDto).filter((employee) => employee.active);
}
const employeePayload = (values: LaboratoryEmployeeFormValues) => ({ userId: values.userId, version: values.version, fullName: values.fullName.trim() || null, position: values.position.trim() || null, email: values.email.trim() || null, phone: values.phone.trim() || null, employeeNumber: values.employeeNumber.trim() || null, qualification: values.qualification.trim() || null, role: values.role.trim() || null, canExecuteMeasurements: values.canExecuteMeasurements, canApproveProtocols: values.canApproveProtocols, canSignProtocols: values.canSignProtocols, active: values.active });
export async function addLaboratoryEmployee(laboratoryId: string | number, values: LaboratoryEmployeeFormValues): Promise<LaboratoryEmployee> {
  return mapLaboratoryEmployeeDto(await api.post<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(laboratoryId)}/employees`, employeePayload(values)));
}
export async function updateLaboratoryEmployee(laboratoryId: string | number, employeeId: string | number, values: LaboratoryEmployeeFormValues): Promise<LaboratoryEmployee> {
  return mapLaboratoryEmployeeDto(await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}`, employeePayload(values)));
}
export const deactivateLaboratoryEmployee = async (laboratoryId: string | number, employeeId: string | number) => { await api.delete(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}`); };

export async function uploadLaboratoryLogo(id: string | number, file: File): Promise<LaboratoryDetails> {
  const formData = new FormData(); formData.append('file', file);
  const response = await api.post<ApiResponse<unknown> | unknown>(`/settings/laboratories/${requireId(id)}/logo`, formData);
  const candidate = extractItem(response, ['laboratory', 'item']);
  return candidate ? details(candidate) : getLaboratory(id);
}
export const removeLaboratoryLogo = async (id: string | number) => { await api.delete(`/settings/laboratories/${requireId(id)}/logo`); };
export const getLaboratoryLogoUrl = (id: string | number) => `/settings/laboratories/${requireId(id)}/logo`;
export const accreditationState = (validUntil?: string | null) => ({ status: getAccreditationStatus(validUntil), daysLeft: accreditationDaysLeft(validUntil) });

export const laboratoryService = { getLaboratories, getLaboratory, getDefaultLaboratory, createLaboratory, updateLaboratory, setDefaultLaboratory, deactivateLaboratory, activateLaboratory, getEmployees: getLaboratoryEmployees, getEligibleEmployees: getEligibleLaboratoryEmployees, addEmployee: addLaboratoryEmployee, updateEmployee: updateLaboratoryEmployee, deactivateEmployee: deactivateLaboratoryEmployee, uploadLogo: uploadLaboratoryLogo, removeLogo: removeLaboratoryLogo, getLogoUrl: getLaboratoryLogoUrl };
