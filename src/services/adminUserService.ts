import api, { type ApiResponse } from './api';

export type AdminUserRecord = {
  id: number;
  role: string;
  type: string;
  email: string;
  name: string;
  fullName?: string | null;
  lastName?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  phone?: string | null;
  iin?: string | null;
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

export type AdminUserStatus = 'active' | 'blocked' | 'pending';

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: AdminUserStatus;
  role?: string;
  sort?: string;
}

export interface AdminUserPageResponse {
  items: AdminUserRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type CreateAdminUserPayload = {
  email: string;
  name: string;
  password?: string;
  role: string;
  type?: string;
  phone?: string;
  iin?: string;
  city?: string;
  companyName?: string;
  bin?: string;
  organizationType?: string;
  legalAddress?: string;
  position?: string;
  status?: AdminUserStatus;
};

export type UpdateAdminUserPayload = Partial<CreateAdminUserPayload>;

export async function listUsers(params?: AdminUserListParams): Promise<AdminUserPageResponse> {
  const response = await api.get<ApiResponse<AdminUserPageResponse> | AdminUserPageResponse>('/admin/users', {
    params: {
      page: params?.page ?? 0,
      limit: params?.limit ?? 20,
      search: params?.search,
      status: params?.status,
      role: params?.role,
      sort: params?.sort ?? 'name,asc',
    },
  });
  const payload = 'success' in response.data ? response.data.data : response.data;
  return payload || { items: [], page: 0, limit: 20, total: 0, totalPages: 0 };
}

/** @deprecated Use listUsers with pagination instead */
export async function getUsers(): Promise<AdminUserRecord[]> {
  try {
    const response = await listUsers({ limit: 1000 });
    return response.items;
  } catch {
    return [];
  }
}

export async function createUser(payload: CreateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.post<ApiResponse<AdminUserRecord>>('/admin/users', payload);
  return (data as any).data;
}

export async function updateUser(id: number, payload: UpdateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}`, payload);
  return (data as any).data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<ApiResponse<null>>(`/admin/users/${id}`);
}

export async function changeUserStatus(id: number, status: AdminUserStatus): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}/status`, { status });
  return (data as any).data;
}

export const getAdminUsers = getUsers;
export const createAdminUser = createUser;
