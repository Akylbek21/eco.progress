import api, { type ApiResponse } from './api';
import { extractItem, extractList, getApiStatus } from './apiHelpers';
import type { LaboratoryEmployee, LaboratoryProfile, LaboratorySummary } from '../types/protocols';
import { mockLaboratory } from '../mocks/mockDevices';

type UnknownRecord = Record<string, unknown>;
const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const STORAGE_KEY = 'eco-progress-mock-laboratories-v1';
const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value);
const bool = (value: unknown, fallback = false) => value === undefined || value === null ? fallback : value === true || value === 'true' || value === 1;

export const normalizeLaboratoryEmployee = (raw: unknown): LaboratoryEmployee => {
  const source = asRecord(raw);
  const user = asRecord(source.user || source.employee);
  return {
    id: text(source.id || source.employeeId || user.id),
    laboratoryId: text(source.laboratoryId),
    userId: text(source.userId || user.id),
    fullName: text(source.fullName || source.name || user.name),
    position: text(source.position || user.position),
    email: text(source.email || user.email),
    role: text(source.role || user.role),
    active: !['blocked', 'inactive', 'archived'].includes(text(source.status || user.status).toLowerCase()) && source.active !== false,
  };
};

export const normalizeLaboratoryProfile = (raw: unknown): LaboratoryProfile => {
  const source = asRecord(raw);
  const director = asRecord(source.director);
  const head = asRecord(source.laboratoryHead || source.head);
  const employees = Array.isArray(source.employees) ? source.employees.map(normalizeLaboratoryEmployee) : [];
  return {
    id: text(source.id || source.laboratoryId),
    name: text(source.name || source.laboratoryName),
    legalName: text(source.legalName),
    bin: text(source.bin),
    address: text(source.address || source.laboratoryAddress),
    phone: text(source.phone),
    email: text(source.email),
    accreditationNumber: text(source.accreditationNumber || source.certificateNumber),
    accreditationIssuedAt: text(source.accreditationIssuedAt || source.certificateIssuedAt),
    accreditationValidUntil: text(source.accreditationValidUntil || source.certificateValidUntil),
    directorId: text(source.directorId || director.id),
    directorName: text(source.directorName || director.fullName || director.name),
    laboratoryHeadId: text(source.laboratoryHeadId || source.headId || head.id),
    laboratoryHeadName: text(source.laboratoryHeadName || source.headName || head.fullName || head.name),
    logoUrl: text(source.logoUrl || source.logo),
    standardNote: text(source.standardNote || source.note),
    isDefault: bool(source.isDefault || source.defaultLaboratory),
    active: source.active !== false && text(source.status).toUpperCase() !== 'ARCHIVED',
    employees,
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
};

const demoEmployees: LaboratoryEmployee[] = [
  { id: 'mock-laboratory-user', userId: 'mock-laboratory-user', fullName: 'Маханова К.М.', position: 'Инженер-лаборант', role: 'LABORATORY', active: true },
  { id: 'employee-duysenbay-ruslan', userId: 'employee-duysenbay-ruslan', fullName: 'Дуйсенбай Р.С.', position: 'Заведующий лабораторией', role: 'LAB_HEAD', active: true },
];

const demoProfile = (): LaboratoryProfile => ({
  id: 'laboratory-default',
  name: mockLaboratory.laboratoryName,
  legalName: 'ТОО «Tumar Construction Group»',
  bin: '000000000000',
  address: mockLaboratory.laboratoryAddress,
  phone: '+7 700 000 00 00',
  email: 'laboratory@ecoprogress.local',
  accreditationNumber: mockLaboratory.accreditationNumber,
  accreditationIssuedAt: '2025-01-01',
  accreditationValidUntil: mockLaboratory.accreditationValidUntil,
  directorId: 'director-default',
  directorName: mockLaboratory.director,
  laboratoryHeadId: 'employee-duysenbay-ruslan',
  laboratoryHeadName: mockLaboratory.laboratoryHead,
  logoUrl: '',
  standardNote: 'Результаты испытаний относятся только к исследованным объектам и пробам.',
  isDefault: true,
  active: true,
  employees: demoEmployees,
});

const readMocks = (): LaboratoryProfile[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as LaboratoryProfile[];
  } catch {
    // Invalid demo storage is replaced.
  }
  const initial = [demoProfile()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};
const writeMocks = (items: LaboratoryProfile[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

const requestWithSettingsFallback = async <T,>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> => {
  try {
    return await primary();
  } catch (error) {
    if (![404, 405].includes(getApiStatus(error) || 0)) throw error;
    return fallback();
  }
};

export async function getLaboratories(): Promise<LaboratorySummary[]> {
  if (useMocks) return readMocks().map(({ employees: _employees, ...item }) => item);
  const response = await requestWithSettingsFallback(
    () => api.get<ApiResponse<unknown> | unknown>('/laboratories'),
    () => api.get<ApiResponse<unknown> | unknown>('/settings/laboratories'),
  );
  return extractList(response, ['laboratories', 'items']).map(normalizeLaboratoryProfile);
}

const isInvalidLaboratoryId = (id: unknown) => {
  const value = text(id).trim();
  return !value || value.toLowerCase() === 'employees';
};

export async function getLaboratory(id: string | number): Promise<LaboratoryProfile> {
  if (isInvalidLaboratoryId(id)) throw new Error('Лаборатория не выбрана.');
  if (useMocks) {
    const item = readMocks().find((profile) => profile.id === text(id));
    if (!item) throw new Error('Карточка лаборатории не найдена.');
    return structuredClone(item);
  }
  const response = await requestWithSettingsFallback(
    () => api.get<ApiResponse<unknown> | unknown>(`/laboratories/${id}`),
    () => api.get<ApiResponse<unknown> | unknown>(`/settings/laboratories/${id}`),
  );
  return normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
}

export async function getLaboratoryEmployees(id: string | number): Promise<LaboratoryEmployee[]> {
  if (isInvalidLaboratoryId(id)) return [];
  if (useMocks) return readMocks().find((profile) => profile.id === text(id))?.employees.filter((employee) => employee.active) || [];
  const response = await requestWithSettingsFallback(
    () => api.get<ApiResponse<unknown> | unknown>(`/laboratories/${id}/employees`, { params: { status: 'ACTIVE' } }),
    () => api.get<ApiResponse<unknown> | unknown>(`/settings/laboratories/${id}/employees`, { params: { status: 'ACTIVE' } }),
  );
  return extractList(response, ['employees', 'items']).map(normalizeLaboratoryEmployee).filter((employee) => employee.active);
}

export async function getEligibleLaboratoryEmployees(): Promise<LaboratoryEmployee[]> {
  if (useMocks) return demoEmployees;
  try {
    const laboratories = await getLaboratories();
    const employees = await Promise.all(laboratories.map((laboratory) => getLaboratoryEmployees(laboratory.id)));
    const unique = new Map<string, LaboratoryEmployee>();
    employees.flat().forEach((employee) => unique.set(employee.userId || employee.id, employee));
    return Array.from(unique.values()).filter((employee) => employee.active);
  } catch (error) {
    if (![404, 405].includes(getApiStatus(error) || 0)) throw error;
    const response = await api.get<ApiResponse<unknown> | unknown>('/staff/employees', { params: { status: 'ACTIVE' } });
    return extractList(response, ['employees', 'users', 'items']).map(normalizeLaboratoryEmployee).filter((employee) => employee.active);
  }
}

export async function saveLaboratory(payload: LaboratoryProfile): Promise<LaboratoryProfile> {
  if (useMocks) {
    const items = readMocks();
    const id = payload.id || `laboratory-${Date.now()}`;
    const saved = { ...payload, id, employees: payload.employees.length ? payload.employees : demoEmployees, updatedAt: new Date().toISOString() };
    const normalized = saved.isDefault
      ? items.map((item) => ({ ...item, isDefault: item.id === id }))
      : items;
    const index = normalized.findIndex((item) => item.id === id);
    if (index >= 0) normalized[index] = saved;
    else normalized.push(saved);
    writeMocks(normalized);
    return structuredClone(saved);
  }
  const body = {
    name: payload.name,
    legalName: payload.legalName,
    bin: payload.bin,
    address: payload.address,
    phone: payload.phone,
    email: payload.email,
    accreditationNumber: payload.accreditationNumber,
    accreditationIssuedAt: payload.accreditationIssuedAt || null,
    accreditationValidUntil: payload.accreditationValidUntil || null,
    directorId: payload.directorId || null,
    laboratoryHeadId: payload.laboratoryHeadId || null,
    standardNote: payload.standardNote,
    isDefault: payload.isDefault,
    active: payload.active,
  };
  const response = payload.id
    ? await requestWithSettingsFallback(
      () => api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${payload.id}`, body),
      () => api.patch<ApiResponse<unknown> | unknown>(`/settings/laboratories/${payload.id}`, body),
    )
    : await requestWithSettingsFallback(
      () => api.post<ApiResponse<unknown> | unknown>('/laboratories', body),
      () => api.post<ApiResponse<unknown> | unknown>('/settings/laboratories', body),
    );
  return normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
}

export async function uploadLaboratoryLogo(id: string, file: File): Promise<LaboratoryProfile> {
  if (useMocks) {
    const items = readMocks();
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Сначала сохраните карточку лаборатории.');
    items[index] = { ...items[index], logoUrl: URL.createObjectURL(file) };
    writeMocks(items);
    return structuredClone(items[index]);
  }
  const formData = new FormData();
  formData.append('file', file);
  const response = await requestWithSettingsFallback(
    () => api.post<ApiResponse<unknown> | unknown>(`/laboratories/${id}/logo`, formData),
    () => api.post<ApiResponse<unknown> | unknown>(`/settings/laboratories/${id}/logo`, formData),
  );
  return normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
}

export const accreditationState = (validUntil?: string) => {
  if (!validUntil) return { status: 'MISSING' as const, daysLeft: null };
  const end = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { status: 'MISSING' as const, daysLeft: null };
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { status: 'EXPIRED' as const, daysLeft };
  if (daysLeft <= 60) return { status: 'EXPIRING' as const, daysLeft };
  return { status: 'VALID' as const, daysLeft };
};
