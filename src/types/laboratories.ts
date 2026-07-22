export type AccreditationStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'NOT_SPECIFIED';

export interface Laboratory {
  id: number;
  version?: number;
  name: string;
  shortName?: string | null;
  legalName?: string | null;
  bin?: string | null;
  address: string;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  accreditationNumber?: string | null;
  accreditationIssuedAt?: string | null;
  accreditationValidUntil?: string | null;
  accreditationIssuedBy?: string | null;
  directorId?: number | null;
  directorName?: string | null;
  laboratoryHeadId?: number | null;
  laboratoryHeadName?: string | null;
  standardNote?: string | null;
  logoUrl?: string | null;
  isDefault: boolean;
  active: boolean;
  employeesCount?: number;
  devicesCount?: number;
  protocolsCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LaboratoryApiDto {
  id: number;
  version?: number;
  name?: string; shortName?: string; legalName?: string;
  bin?: string; address?: string; city?: string;
  phone?: string; email?: string; website?: string;
  accreditationNumber?: string; accreditationIssuedAt?: string; accreditationValidUntil?: string; accreditationIssuedBy?: string;
  directorId?: number; directorName?: string;
  laboratoryHeadId?: number; laboratoryHeadName?: string;
  standardNote?: string; logoUrl?: string;
  isDefault?: boolean; active?: boolean;
  employeesCount?: number; devicesCount?: number; protocolsCount?: number;
  createdAt?: string; updatedAt?: string;
}

export interface LaboratoryFormValues {
  id?: number; version?: number;
  name: string; shortName: string; legalName: string;
  bin: string; address: string; city: string;
  phone: string; email: string; website: string;
  accreditationNumber: string; accreditationIssuedAt: string; accreditationValidUntil: string; accreditationIssuedBy: string;
  directorId: number | null; laboratoryHeadId: number | null;
  standardNote: string; logoUrl: string;
  isDefault: boolean; active: boolean;
}

export interface CreateLaboratoryRequest {
  name: string; shortName?: string | null; legalName?: string | null;
  bin?: string | null; address: string; city?: string | null;
  phone?: string | null; email?: string | null; website?: string | null;
  accreditationNumber?: string | null; accreditationIssuedAt?: string | null; accreditationValidUntil?: string | null; accreditationIssuedBy?: string | null;
  directorId?: number | null; laboratoryHeadId?: number | null;
  standardNote?: string | null; logoUrl?: string | null;
  isDefault: boolean; active: boolean;
}
export interface UpdateLaboratoryRequest extends Partial<CreateLaboratoryRequest> { version?: number }

export interface LaboratoriesQuery {
  page: number; size: number; search?: string;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
  accreditationStatus?: 'ALL' | AccreditationStatus;
  city?: string; defaultOnly?: boolean; sort?: string;
}

export interface PageResponse<T> {
  content: T[]; page: number; size: number; totalElements: number; totalPages: number;
  /** Compatibility fields for existing consumers. */
  items: T[]; first: boolean; last: boolean; hasNext: boolean; hasPrevious: boolean;
}

export interface LaboratoryEmployee {
  id: number; version?: number; laboratoryId: number; userId: number | null;
  fullName: string; position: string; email: string; phone: string;
  employeeNumber: string; qualification: string; role: string;
  canExecuteMeasurements: boolean; canApproveProtocols: boolean; canSignProtocols: boolean;
  active: boolean; deactivatedAt?: string;
}

export interface LaboratoryEmployeeFormValues {
  userId: number | null; version?: number;
  fullName: string; position: string; email: string; phone: string;
  employeeNumber: string; qualification: string; role: string;
  canExecuteMeasurements: boolean; canApproveProtocols: boolean; canSignProtocols: boolean; active: boolean;
}

export interface LaboratoryListItem extends Laboratory {
  accreditationStatus: AccreditationStatus;
}
export interface LaboratoryDetails extends LaboratoryListItem {
  logoFileId?: number;
  employees?: LaboratoryEmployee[];
}
