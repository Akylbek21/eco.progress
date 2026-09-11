import api, { type ApiResponse } from './api';
import { unwrapApiResponse } from './apiHelpers';

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

type AdminUserPageApiResponse = Partial<AdminUserPageResponse> & {
  items?: AdminUserRecord[];
  size?: number;
  totalElements?: number;
};

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
  const response = await api.get<ApiResponse<AdminUserPageApiResponse> | AdminUserPageApiResponse>('/admin/users', {
    params: {
      page: params?.page ?? 0,
      limit: params?.limit ?? 20,
      search: params?.search,
      status: params?.status,
      role: params?.role,
      sort: params?.sort ?? 'name,asc',
    },
  });
  const payload = unwrapApiResponse<AdminUserPageApiResponse>(response.data);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  return {
    items,
    page: payload?.page ?? params?.page ?? 0,
    limit: payload?.limit ?? payload?.size ?? params?.limit ?? 20,
    total: payload?.total ?? payload?.totalElements ?? items.length,
    totalPages: payload?.totalPages ?? (items.length ? 1 : 0),
  };
}

/** @deprecated Use listUsers with pagination instead */
export async function getUsers(): Promise<AdminUserRecord[]> {
  const pageSize = 100; // Backend contract allows at most 100 records per request.
  const firstPage = await listUsers({ page: 0, limit: pageSize });
  if (firstPage.totalPages <= 1) return firstPage.items;

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      listUsers({ page: index + 1, limit: pageSize })),
  );
  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function createUser(payload: CreateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.post<ApiResponse<AdminUserRecord>>('/admin/users', payload);
  return unwrapApiResponse(data);
}

export async function updateUser(id: number, payload: UpdateAdminUserPayload): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}`, payload);
  return unwrapApiResponse(data);
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete<ApiResponse<null>>(`/admin/users/${id}`);
}

export async function changeUserStatus(id: number, status: AdminUserStatus): Promise<AdminUserRecord> {
  const { data } = await api.patch<ApiResponse<AdminUserRecord>>(`/admin/users/${id}/status`, { status });
  return unwrapApiResponse(data);
}

export const getAdminUsers = getUsers;
export const createAdminUser = createUser;
