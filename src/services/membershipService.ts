import api from './api';
import type { CompanyMembership, CreateMembershipRequest, MembershipList, MembershipStatus, UpdateMembershipRequest } from '../types/memberships';

type MembershipScope = 'companies' | 'pek';
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const unwrap = (value: unknown): unknown => {
  let current = value;
  for (let depth = 0; depth < 3; depth += 1) {
    const source = row(current);
    if (!('data' in source)) break;
    current = source.data;
  }
  return current;
};
const actions = (value: unknown): Record<string, boolean> => Object.fromEntries(
  Object.entries(row(value)).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
);
const membership = (value: unknown): CompanyMembership => {
  const source = row(value);
  const user = row(source.user ?? source.employee);
  const id = Number(source.id ?? source.membershipId);
  const userId = Number(source.userId ?? user.id);
  if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(userId) || userId <= 0) throw new Error('Backend вернул membership без корректного id или userId.');
  const rawStatus = String(source.status || (source.active === false ? 'INACTIVE' : 'ACTIVE')).toUpperCase();
  return {
    id,
    userId,
    fullName: String(source.fullName ?? source.userName ?? user.fullName ?? user.name ?? `Сотрудник №${userId}`),
    email: source.email == null && user.email == null ? undefined : String(source.email ?? user.email),
    role: String(source.role || ''),
    status: (rawStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as MembershipStatus,
    availableActions: actions(source.availableActions),
  };
};
const base = (scope: MembershipScope, companyId: string | number) => scope === 'pek'
  ? `/pek/companies/${companyId}/members`
  : `/companies/${companyId}/members`;

export const getMemberships = async (scope: MembershipScope, companyId: string | number, signal?: AbortSignal): Promise<MembershipList> => {
  const payload = unwrap(await api.get(base(scope, companyId), { signal }));
  const source = row(payload);
  const values = Array.isArray(payload) ? payload : Array.isArray(source.items) ? source.items : Array.isArray(source.members) ? source.members : Array.isArray(source.content) ? source.content : [];
  return { items: values.map(membership), availableActions: actions(source.availableActions ?? source.permissions) };
};
export const createMembership = async (scope: MembershipScope, companyId: string | number, body: CreateMembershipRequest) => {
  await api.post(base(scope, companyId), body);
};
export const updateMembership = async (scope: MembershipScope, companyId: string | number, membershipId: number, body: UpdateMembershipRequest) => {
  await api.patch(`${base(scope, companyId)}/${membershipId}`, body);
};
export const deleteMembership = async (scope: MembershipScope, companyId: string | number, membershipId: number) => {
  await api.delete(`${base(scope, companyId)}/${membershipId}`);
};
