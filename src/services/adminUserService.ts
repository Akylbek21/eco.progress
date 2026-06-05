import api, { type ApiResponse } from './api';

export type AdminUserRecord = {
  id: number;
  role: string;
  type: string;
  email: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  companyName?: string | null;
  bin?: string | null;
  organizationType?: string | null;
  legalAddress?: string | null;
  position?: string | null;
  status: string;
  lastLoginAt?: string | null;
  createdAt?: string | null;
};

export type AdminUserStatus = 'active' | 'blocked';

export type CreateAdminUserPayload = {
  email: string;
  name: string;
  password?: string;
  role: string;
  type?: string;
  phone?: string;
  city?: string;
  companyName?: string;
  bin?: string;
  organizationType?: string;
  legalAddress?: string;
  position?: string;
  status?: AdminUserStatus;
};

export type UpdateAdminUserPayload = Partial<CreateAdminUserPayload>;

export async function getUsers(): Promise<AdminUserRecord[]> {
  const { data } = await api.get<ApiResponse<AdminUserRecord[]>>('/admin/users');
  return data.data;
}

export async function createUser(payload: CreateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.post<ApiResponse<AdminUserRecord>>('/admin/users', payload);
  return data.data;
}

export async function updateUser(id: number, payload: UpdateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}`, payload);
  return data.data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<ApiResponse<null>>(`/admin/users/${id}`);
}

export async function changeUserStatus(id: number, status: AdminUserStatus): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}/status`, { status });
  return data.data;
}

export const getAdminUsers = getUsers;
export const createAdminUser = createUser;
