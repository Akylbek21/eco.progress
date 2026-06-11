import api, { ApiResponse } from './api';
import type { DirectoryQuery, NormativeRecord } from '../types/protocols';

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  const response = await api.get<ApiResponse<NormativeRecord[]>>('/normatives', { params });
  return unwrap(response);
}

export async function createNormative(payload: Omit<NormativeRecord, 'id'>): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<NormativeRecord>>('/normatives', payload);
  return unwrap(response);
}

export async function updateNormative(id: string, payload: Partial<NormativeRecord>): Promise<NormativeRecord> {
  const response = await api.patch<ApiResponse<NormativeRecord>>(`/normatives/${id}`, payload);
  return unwrap(response);
}

export async function archiveNormative(id: string): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<NormativeRecord>>(`/normatives/${id}/archive`);
  return unwrap(response);
}
