import axios from 'axios';
import api, { type ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import { getAdminUsers } from './adminUserService';
import type { LaboratoryEmployee, LaboratoryProfile, LaboratorySummary } from '../types/protocols';

type UnknownRecord = Record<string, unknown>;

export type SaveLaboratoryRequest = {
  name: string;
  legalName: string | null;
  bin: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  accreditationNumber: string | null;
  accreditationIssuedAt: string | null;
  accreditationValidUntil: string | null;
  directorId: number | null;
  directorName: string | null;
  laboratoryHeadId: number | null;
  laboratoryHeadName: string | null;
  standardNote: string | null;
  isDefault: boolean;
  active: boolean;
};

export type SaveLaboratoryEmployeeRequest = {
  userId: number | null;
  fullName: string;
  position: string | null;
  email: string | null;
  role: string;
  active: boolean;
};

const asRecord = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value).trim();
const bool = (value: unknown, fallback = false) => value === undefined || value === null ? fallback : value === true || value === 'true' || value === 1;
const nullableText = (value: unknown) => text(value) || null;
const nullableId = (value: unknown) => {
  if (value === undefined || value === null || text(value) === '') return null;
  const id = Number(value);
  if (!Number.isFinite(id)) throw new Error(`Некорректный числовой ID: ${text(value)}`);
  return id;
};
const isoDate = (value: unknown) => {
  const raw = text(value);
  if (!raw) return '';
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (direct) return `${direct[1]}-${direct[2]}-${direct[3]}`;
  const dotted = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return dotted ? `${dotted[3]}-${dotted[2]}-${dotted[1]}` : '';
};

export const normalizeLaboratoryEmployee = (raw: unknown): LaboratoryEmployee => {
  const source = asRecord(raw);
  const user = asRecord(source.user);
  return {
    id: text(source.id ?? source.employeeId),
    laboratoryId: text(source.laboratoryId),
    userId: text(source.userId ?? user.id),
    fullName: text(source.fullName ?? source.name ?? user.fullName ?? user.name),
    position: text(source.position ?? user.position),
    email: text(source.email ?? user.email),
    role: text(source.role ?? user.role),
    active: !['BLOCKED', 'INACTIVE', 'ARCHIVED'].includes(text(source.status ?? user.status).toUpperCase()) && source.active !== false,
  };
};

export const normalizeLaboratoryProfile = (raw: unknown): LaboratoryProfile => {
  const source = asRecord(raw);
  const director = asRecord(source.director);
  const head = asRecord(source.laboratoryHead ?? source.head);
  return {
    id: text(source.id ?? source.laboratoryId),
    name: text(source.name ?? source.laboratoryName),
    legalName: text(source.legalName),
    bin: text(source.bin),
    address: text(source.address ?? source.laboratoryAddress),
    phone: text(source.phone),
    email: text(source.email),
    accreditationNumber: text(source.accreditationNumber ?? source.certificateNumber),
    accreditationIssuedAt: isoDate(source.accreditationIssuedAt ?? source.certificateIssuedAt),
    accreditationValidUntil: isoDate(source.accreditationValidUntil ?? source.certificateValidUntil),
    directorId: text(source.directorId ?? director.id),
    directorName: text(source.directorName ?? director.fullName ?? director.name),
    laboratoryHeadId: text(source.laboratoryHeadId ?? source.headId ?? head.id),
    laboratoryHeadName: text(source.laboratoryHeadName ?? source.headName ?? head.fullName ?? head.name),
    logoUrl: text(source.logoUrl ?? source.logo ?? source.url ?? source.fileUrl),
    standardNote: text(source.standardNote ?? source.note),
    isDefault: bool(source.isDefault ?? source.defaultLaboratory),
    active: source.active !== false && text(source.status).toUpperCase() !== 'ARCHIVED',
    employees: Array.isArray(source.employees) ? source.employees.map(normalizeLaboratoryEmployee) : [],
    createdAt: text(source.createdAt),
    updatedAt: text(source.updatedAt),
  };
};

const requireId = (id: string | number, label = 'лаборатории') => {
  const value = text(id);
  if (!value || !Number.isFinite(Number(value))) throw new Error(`Некорректный ID ${label}`);
  return Number(value);
};

export async function getLaboratories(): Promise<LaboratorySummary[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/laboratories');
  return extractList(response, ['laboratories', 'items']).map(normalizeLaboratoryProfile);
}

export async function getDefaultLaboratory(): Promise<LaboratoryProfile | null> {
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/settings/laboratories/default');
    const payload = extractItem(response, ['laboratory', 'profile']);
    return payload ? normalizeLaboratoryProfile(payload) : null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}

export async function getLaboratory(id: string | number): Promise<LaboratoryProfile> {
  const laboratoryId = requireId(id);
  const response = await api.get<ApiResponse<unknown> | unknown>(`/laboratories/${laboratoryId}`);
  return normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
}

export async function getLaboratorySettings(id: string | number): Promise<LaboratoryProfile> {
  const laboratoryId = requireId(id);
  const response = await api.get<ApiResponse<unknown> | unknown>(`/settings/laboratories/${laboratoryId}`);
  return normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
}

export async function getLaboratoryEmployees(id: string | number, options: { includeInactive?: boolean } = {}): Promise<LaboratoryEmployee[]> {
  const laboratoryId = requireId(id);
  const response = await api.get<ApiResponse<unknown> | unknown>(`/laboratories/${laboratoryId}/employees`, {
    params: options.includeInactive ? undefined : { status: 'ACTIVE' },
  });
  const employees = extractList(response, ['employees', 'items']).map(normalizeLaboratoryEmployee);
  return options.includeInactive ? employees : employees.filter((employee) => employee.active);
}

export async function getEligibleLaboratoryEmployees(): Promise<LaboratoryEmployee[]> {
  const allowedRoles = new Set(['ADMIN', 'LABORATORY', 'DIRECTOR', 'HEAD', 'LAB_HEAD', 'LABORATORY_HEAD']);
  const users = await getAdminUsers();
  return users
    .filter((user) => allowedRoles.has(text(user.role).toUpperCase()) && text(user.status).toLowerCase() !== 'blocked')
    .map((user) => ({
      id: String(user.id),
      userId: String(user.id),
      fullName: text(user.fullName) || [user.lastName, user.firstName, user.middleName].map(text).filter(Boolean).join(' ') || text(user.name),
      position: text(user.position),
      email: text(user.email),
      role: text(user.role),
      active: true,
    }));
}

const laboratoryBody = (profile: LaboratoryProfile): SaveLaboratoryRequest => ({
  name: profile.name.trim(),
  legalName: nullableText(profile.legalName),
  bin: nullableText(profile.bin),
  address: nullableText(profile.address),
  phone: nullableText(profile.phone),
  email: nullableText(profile.email),
  accreditationNumber: nullableText(profile.accreditationNumber),
  accreditationIssuedAt: nullableText(profile.accreditationIssuedAt),
  accreditationValidUntil: nullableText(profile.accreditationValidUntil),
  directorId: nullableId(profile.directorId),
  directorName: nullableText(profile.directorName),
  laboratoryHeadId: nullableId(profile.laboratoryHeadId),
  laboratoryHeadName: nullableText(profile.laboratoryHeadName),
  standardNote: nullableText(profile.standardNote),
  isDefault: Boolean(profile.isDefault),
  active: Boolean(profile.active),
});

export async function saveLaboratory(profile: LaboratoryProfile): Promise<LaboratoryProfile> {
  const body = laboratoryBody(profile);
  const response = profile.id
    ? await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${requireId(profile.id)}`, body)
    : await api.post<ApiResponse<unknown> | unknown>('/laboratories', body);
  const saved = normalizeLaboratoryProfile(extractItem(response, ['laboratory', 'profile']));
  const savedId = saved.id || profile.id;
  if (!savedId) throw new Error('Backend не вернул ID сохранённой лаборатории');
  return getLaboratory(savedId);
}

export async function setLaboratoryActive(id: string | number, active: boolean): Promise<LaboratoryProfile> {
  const laboratoryId = requireId(id);
  await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${laboratoryId}`, { active });
  return getLaboratory(laboratoryId);
}

export async function saveLaboratoryEmployee(laboratoryId: string, payload: Partial<LaboratoryEmployee>): Promise<LaboratoryEmployee> {
  const id = requireId(laboratoryId);
  const body: SaveLaboratoryEmployeeRequest = {
    userId: nullableId(payload.userId),
    fullName: text(payload.fullName),
    position: nullableText(payload.position),
    email: nullableText(payload.email),
    role: text(payload.role) || 'LABORATORY',
    active: payload.active !== false,
  };
  const response = payload.id
    ? await api.patch<ApiResponse<unknown> | unknown>(`/laboratories/${id}/employees/${requireId(payload.id, 'сотрудника')}`, body)
    : await api.post<ApiResponse<unknown> | unknown>(`/laboratories/${id}/employees`, body);
  return normalizeLaboratoryEmployee(extractItem(response, ['employee', 'item']));
}

export async function deactivateLaboratoryEmployee(laboratoryId: string, employeeId: string): Promise<void> {
  await api.delete(`/laboratories/${requireId(laboratoryId)}/employees/${requireId(employeeId, 'сотрудника')}`);
}

export async function uploadLaboratoryLogo(id: string, file: File): Promise<LaboratoryProfile> {
  const formData = new FormData();
  formData.append('file', file);
  await api.post<ApiResponse<unknown> | unknown>(`/settings/laboratories/${requireId(id)}/logo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return getLaboratory(id);
}

export async function deleteLaboratoryLogo(id: string | number): Promise<void> {
  await api.delete(`/settings/laboratories/${requireId(id)}/logo`);
}

export const laboratoryLogoUrl = (id: string | number) => `/settings/laboratories/${requireId(id)}/logo`;

export const accreditationState = (validUntil?: string) => {
  if (!validUntil) return { status: 'MISSING' as const, daysLeft: null };
  const end = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(end.getTime())) return { status: 'MISSING' as const, daysLeft: null };
  const daysLeft = Math.ceil((end.getTime() - Date.now()) / 86_400_000);
  if (daysLeft < 0) return { status: 'EXPIRED' as const, daysLeft };
  if (daysLeft < 30) return { status: 'EXPIRING' as const, daysLeft };
  return { status: 'VALID' as const, daysLeft };
};
