import api, { ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import type { DirectoryQuery, NormativeRecord } from '../types/protocols';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));

export async function getNormatives(params?: DirectoryQuery): Promise<NormativeRecord[]> {
  if (useMocks) {
    await mockDelay();
    const { mockNormatives } = await import('../mocks/mockNormatives');
    const query = String(params?.search || '').toLowerCase();
    return mockNormatives.filter((item) => (!params?.templateId || item.templateId === params.templateId) && (!query || `${item.indicator} ${item.normativeDocument}`.toLowerCase().includes(query)));
  }
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
