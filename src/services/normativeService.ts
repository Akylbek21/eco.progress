import api, { ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import type { DirectoryQuery, NormativeRecord } from '../types/protocols';

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/normatives', { params });
  return extractList(response, ['normatives']) as NormativeRecord[];
}

export async function createNormative(payload: Omit<NormativeRecord, 'id'>): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/normatives', payload);
  return extractItem(response, ['normative']) as NormativeRecord;
}

export async function updateNormative(id: string, payload: Partial<NormativeRecord>): Promise<NormativeRecord> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/normatives/${id}`, payload);
  return extractItem(response, ['normative']) as NormativeRecord;
}

export async function archiveNormative(id: string): Promise<NormativeRecord> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/normatives/${id}/archive`);
  return extractItem(response, ['normative']) as NormativeRecord;
}
