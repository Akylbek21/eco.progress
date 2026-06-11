import api, { ApiResponse } from './api';
import type { DirectoryQuery, MeasurementDevice } from '../types/protocols';

const unwrap = <T>(response: { data: ApiResponse<T> }) => response.data.data;

export async function getMeasurementDevices(params?: DirectoryQuery): Promise<MeasurementDevice[]> {
  const response = await api.get<ApiResponse<MeasurementDevice[]>>('/measurement-devices', { params });
  return unwrap(response);
}

export async function createMeasurementDevice(payload: Omit<MeasurementDevice, 'id'>): Promise<MeasurementDevice> {
  const response = await api.post<ApiResponse<MeasurementDevice>>('/measurement-devices', payload);
  return unwrap(response);
}

export async function updateMeasurementDevice(id: string, payload: Partial<MeasurementDevice>): Promise<MeasurementDevice> {
  const response = await api.patch<ApiResponse<MeasurementDevice>>(`/measurement-devices/${id}`, payload);
  return unwrap(response);
}

export async function archiveMeasurementDevice(id: string): Promise<MeasurementDevice> {
  const response = await api.post<ApiResponse<MeasurementDevice>>(`/measurement-devices/${id}/archive`);
  return unwrap(response);
}
