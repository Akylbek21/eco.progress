import api, { ApiResponse } from './api';
import { extractItem, extractList, getApiStatus } from './apiHelpers';
import type { DirectoryQuery, MeasurementDevice } from '../types/protocols';

export async function getMeasurementDevices(params?: DirectoryQuery): Promise<MeasurementDevice[]> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/measurement-devices', { params });
  return extractList(response, ['devices', 'measurementDevices']) as MeasurementDevice[];
}

export async function getAvailableMeasurementDevices(params?: DirectoryQuery): Promise<MeasurementDevice[]> {
  let devices: MeasurementDevice[];
  try {
    const response = await api.get<ApiResponse<unknown> | unknown>('/measurement-devices/available', { params });
    devices = extractList(response, ['devices', 'measurementDevices']) as MeasurementDevice[];
  } catch (error) {
    if (getApiStatus(error) === 404) devices = await getMeasurementDevices(params);
    else throw error;
  }
  return devices.filter((device) => device.status === 'VALID' || device.status === 'EXPIRING');
}

export async function createMeasurementDevice(payload: Omit<MeasurementDevice, 'id'>): Promise<MeasurementDevice> {
  const response = await api.post<ApiResponse<unknown> | unknown>('/measurement-devices', payload);
  return extractItem(response, ['device', 'measurementDevice']) as MeasurementDevice;
}

export async function updateMeasurementDevice(id: string, payload: Partial<MeasurementDevice>): Promise<MeasurementDevice> {
  const response = await api.patch<ApiResponse<unknown> | unknown>(`/measurement-devices/${id}`, payload);
  return extractItem(response, ['device', 'measurementDevice']) as MeasurementDevice;
}

export async function archiveMeasurementDevice(id: string): Promise<MeasurementDevice> {
  const response = await api.post<ApiResponse<unknown> | unknown>(`/measurement-devices/${id}/archive`);
  return extractItem(response, ['device', 'measurementDevice']) as MeasurementDevice;
}
