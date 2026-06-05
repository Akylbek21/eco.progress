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

export type CreateAdminUserPayload = {
  email: string;
  name: string;
  password: string;
  role: string;
  type?: string;
  phone?: string;
  city?: string;
  companyName?: string;
  bin?: string;
  organizationType?: string;
  legalAddress?: string;
  position?: string;
};

export async function getAdminUsers(): Promise<AdminUserRecord[]> {
  const { data } = await api.get<ApiResponse<AdminUserRecord[]>>('/admin/users');
  return data.data;
}

export async function createAdminUser(payload: CreateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.post<ApiResponse<AdminUserRecord>>('/admin/users', payload);
  return data.data;
}
