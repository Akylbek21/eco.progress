import api, { ApiResponse } from './api';
import { extractItem, extractList } from './apiHelpers';
import type { DirectoryQuery, MeasurementDevice } from '../types/protocols';
import type { MeasurementDevice as CanonicalMeasurementDevice, MeasurementDeviceListParams, MeasurementDevicePage } from '../types/measurementDevices';

const useMocks = String(import.meta.env.VITE_USE_PROTOCOL_MOCKS || '').toLowerCase() === 'true';
const mockDelay = () => new Promise((resolve) => setTimeout(resolve, 300 + Math.floor(Math.random() * 301)));
type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
const text = (value: unknown) => value === undefined || value === null ? '' : String(value).trim();
const number = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const mapMeasurementDeviceDto = (raw: unknown): CanonicalMeasurementDevice => {
  const source = record(raw);
  const verificationValidUntil = text(source.verificationValidUntil) || undefined;
  const archived = source.archived === true || source.active === false || text(source.status).toUpperCase() === 'ARCHIVED';
  const expired = Boolean(verificationValidUntil && new Date(`${verificationValidUntil}T23:59:59`).getTime() < Date.now());
  return {
    id: number(source.id ?? source.measurementDeviceId), name: text(source.name), deviceType: text(source.deviceType ?? source.type),
    model: text(source.model) || undefined, serialNumber: text(source.serialNumber), inventoryNumber: text(source.inventoryNumber) || undefined,
    verificationCertificateNumber: text(source.verificationCertificateNumber ?? source.verificationNumber) || undefined,
    verificationDate: text(source.verificationDate).slice(0, 10) || undefined, verificationValidUntil: verificationValidUntil?.slice(0, 10),
    measurementRange: text(source.measurementRange ?? source.range) || undefined, accuracyClass: text(source.accuracyClass) || undefined,
    laboratoryId: number(source.laboratoryId) || undefined, laboratoryName: text(source.laboratoryName) || undefined,
    status: archived ? 'ARCHIVED' : expired ? 'EXPIRED' : 'ACTIVE', active: !archived,
    createdAt: text(source.createdAt) || undefined, updatedAt: text(source.updatedAt) || undefined,
  };
};

export async function getMeasurementDevicesPage(params: MeasurementDeviceListParams, signal?: AbortSignal): Promise<MeasurementDevicePage> {
  const response = await api.get<ApiResponse<unknown> | unknown>('/measurement-devices', { params, signal });
  const body = record(record(response).data);
  const nested = record(body.data);
  const container = Object.keys(nested).length ? nested : body;
  const content = extractList(response, ['content', 'devices', 'measurementDevices']).map(mapMeasurementDeviceDto);
  const page = number(container.page ?? container.number, params.page);
  const size = number(container.size, params.size) || params.size;
  const totalElements = container.totalElements === undefined ? content.length : number(container.totalElements);
  const totalPages = container.totalPages === undefined ? Math.ceil(totalElements / size) : number(container.totalPages);
  return { content, page, size, totalElements, totalPages };
}

export async function getMeasurementDevices(params?: DirectoryQuery): Promise<MeasurementDevice[]> {
  if (useMocks) {
    await mockDelay();
    const { mockDevices } = await import('../mocks/mockDevices');
    const query = String(params?.search || '').toLowerCase();
    return mockDevices.filter((item) => (!params?.status || item.status === params.status) && (!query || `${item.name} ${item.model} ${item.serialNumber}`.toLowerCase().includes(query)));
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/measurement-devices', { params });
  return extractList(response, ['devices', 'measurementDevices']) as MeasurementDevice[];
}

export async function getAvailableMeasurementDevices(params?: DirectoryQuery): Promise<MeasurementDevice[]> {
  if (useMocks) {
    const devices = await getMeasurementDevices(params);
    return devices.filter((device) => device.status === 'VALID' || device.status === 'EXPIRING');
  }
  const response = await api.get<ApiResponse<unknown> | unknown>('/measurement-devices/available', { params });
  return extractList(response, ['devices', 'measurementDevices']) as MeasurementDevice[];
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
