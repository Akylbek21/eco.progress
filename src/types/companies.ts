export type CompanyStatus = 'ACTIVE' | 'ARCHIVED';
export type CompanyObjectStatus = 'ACTIVE' | 'ARCHIVED';

export type CompanyObject = {
  id: string;
  companyId?: string;
  name: string;
  address: string;
  activityType: string;
  coordinates: string;
  sanitaryZone: string;
  notes: string;
  status: CompanyObjectStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type Company = {
  id: string;
  name: string;
  bin: string;
  legalAddress: string;
  actualAddress: string;
  phone: string;
  email: string;
  comment?: string;
  notes?: string;
  directorFullName: string;
  director?: string;
  directorPosition: string;
  contactPerson: string;
  contactPhone: string;
  bank: string;
  bankName?: string;
  iban: string;
  bik: string;
  kbe: string;
  knp: string;
  contractNumber: string;
  contractDate: string;
  objectName: string;
  objectAddress: string;
  activityType: string;
  samplingLocation: string;
  customerRepresentative: string;
  objects: CompanyObject[];
  status: CompanyStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanyPayload = Omit<Company, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'objects'> & {
  objects?: CompanyObject[];
  status?: CompanyStatus;
};

export type CompanyObjectPayload = Omit<CompanyObject, 'id' | 'companyId' | 'status' | 'createdAt' | 'updatedAt'> & {
  status?: CompanyObjectStatus;
};

export type CompanyQuery = {
  name?: string;
  bin?: string;
  search?: string;
  status?: CompanyStatus | '';
  page?: number;
  size?: number;
};
