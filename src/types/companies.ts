export type CompanyStatus = 'ACTIVE' | 'ARCHIVED';
export type CompanyStatusFilter = CompanyStatus | 'ALL';
export type CompanyObjectStatus = 'ACTIVE' | 'ARCHIVED';

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
  /** False only for the temporary legacy-array contract. */
  totalElementsExact?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string | null;
}

export interface FieldErrorResponse {
  field: string;
  message: string;
}

export interface CompanyListItem {
  id: string;
  name: string;
  shortName?: string;
  bin: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  phone?: string;
  email?: string;
  legalAddress?: string;
  actualAddress?: string;
  objectCount?: number;
  status: CompanyStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyObject {
  id: string;
  companyId?: string;
  virtual?: boolean;
  isVirtual?: boolean;
  name: string;
  objectType?: string;
  address: string;
  region?: string;
  cityDistrict?: string;
  coordinates: string;
  contactPerson?: string;
  contactPhone?: string;
  primary?: boolean;
  activityType: string;
  sanitaryZone: string;
  notes: string;
  samplingLocation: string;
  status: CompanyObjectStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CompanyDetails extends CompanyListItem {
  legalAddress: string;
  actualAddress: string;
  phone: string;
  email: string;
  website?: string;
  directorFullName: string;
  director: string;
  directorPosition: string;
  contactPerson: string;
  contactPhone: string;
  bankName?: string;
  bank: string;
  iban: string;
  bik: string;
  kbe: string;
  knp: string;
  notes?: string;
  comment?: string;
  contractNumber: string;
  contractDate: string;
  objects: CompanyObject[];
  // Transitional snapshot fields still returned by the current backend.
  objectName: string;
  objectAddress: string;
  activityType: string;
  samplingLocation: string;
  customerRepresentative: string;
}

export interface CompanyFormValues {
  name: string;
  shortName: string;
  bin: string;
  legalAddress: string;
  actualAddress: string;
  phone: string;
  email: string;
  website: string;
  directorFullName: string;
  contactPerson: string;
  contactPhone: string;
  contactEmail: string;
  bankName: string;
  bik: string;
  iban: string;
  kbe: string;
  notes: string;
}

export interface CompanyCreateRequest {
  name: string;
  shortName: string | null;
  bin: string;
  legalAddress: string | null;
  actualAddress: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  directorFullName: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bik: string | null;
  iban: string | null;
  kbe: string | null;
  notes: string | null;
}

export type CompanyUpdateRequest = CompanyCreateRequest;

export interface CompanyObjectFormValues {
  name: string;
  objectType: string;
  address: string;
  region: string;
  cityDistrict: string;
  coordinates: string;
  contactPerson: string;
  contactPhone: string;
  primary: boolean;
  activityType: string;
  sanitaryZone: string;
  samplingLocation: string;
  notes: string;
}

export interface CompanyObjectRequest {
  name: string;
  objectType: string | null;
  address: string;
  region: string | null;
  cityDistrict: string | null;
  coordinates: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  primary: boolean;
  activityType: string | null;
  sanitaryZone: string | null;
  samplingLocation: string | null;
  notes: string | null;
}

export interface CompanyQuery {
  page: number;
  size: number;
  search?: string;
  status?: CompanyStatusFilter;
  sort?: string;
}

// Compatibility aliases used by protocol snapshot components.
export type Company = CompanyDetails;
export type CompanyPage = PageResponse<CompanyListItem>;
export type CompanyPayload = CompanyCreateRequest;
export type CompanyObjectPayload = CompanyObjectRequest;
