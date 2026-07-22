export type MeasurementDeviceStatus = 'ACTIVE' | 'EXPIRED' | 'ARCHIVED';

export interface MeasurementDevice {
  id: number;
  name: string;
  deviceType: string;
  model?: string;
  serialNumber: string;
  inventoryNumber?: string;
  verificationCertificateNumber?: string;
  verificationDate?: string;
  verificationValidUntil?: string;
  measurementRange?: string;
  accuracyClass?: string;
  laboratoryId?: number;
  laboratoryName?: string;
  status: MeasurementDeviceStatus;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeasurementDevicePage {
  content: MeasurementDevice[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface MeasurementDeviceListParams {
  page: number;
  size: number;
  search?: string;
  status?: MeasurementDeviceStatus;
  laboratoryId?: number;
  verificationStatus?: string;
  sort?: string;
}
