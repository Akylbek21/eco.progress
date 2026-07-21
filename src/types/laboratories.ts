export type AccreditationStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NOT_CONFIGURED';

export interface PageResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface LaboratoryListItem {
  id: number;
  name: string;
  shortName?: string;
  bin?: string;
  address?: string;
  accreditationNumber?: string;
  accreditationValidUntil?: string;
  accreditationStatus: AccreditationStatus;
  defaultLaboratory: boolean;
  active: boolean;
  archived: boolean;
  employeesCount: number;
  activeEmployeesCount: number;
  updatedAt?: string;
  /** @deprecated Use defaultLaboratory. */
  isDefault?: boolean;
}

export interface LaboratoryEmployee {
  id: number;
  laboratoryId: number;
  userId: number;
  fullName: string;
  position?: string;
  phone?: string;
  email?: string;
  employeeNumber?: string;
  qualification?: string;
  canExecuteMeasurements: boolean;
  canApproveProtocols: boolean;
  canSignProtocols: boolean;
  active: boolean;
  deactivatedAt?: string;
}

export interface LaboratoryDetails extends LaboratoryListItem {
  legalName?: string;
  city?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  accreditationValidFrom?: string;
  accreditationIssuedAt?: string;
  accreditationIssuedBy?: string;
  directorEmployeeId?: number;
  directorId?: number;
  directorName?: string;
  headEmployeeId?: number;
  laboratoryHeadId?: number;
  laboratoryHeadName?: string;
  logoFileId?: number;
  logoUrl?: string;
  createdAt?: string;
  protocolsCount?: number;
  measurementDevicesCount?: number;
  journalsCount?: number;
  standardNote?: string;
  employees?: LaboratoryEmployee[];
}

export interface LaboratoryFormValues {
  name: string;
  shortName: string;
  bin: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  notes: string;
  accreditationNumber: string;
  accreditationValidFrom: string;
  accreditationValidUntil: string;
  accreditationIssuedBy: string;
  directorEmployeeId: number | null;
  headEmployeeId: number | null;
}

export interface LaboratoryEmployeeFormValues {
  userId: number | null;
  position: string;
  employeeNumber: string;
  qualification: string;
  canExecuteMeasurements: boolean;
  canApproveProtocols: boolean;
  canSignProtocols: boolean;
}
