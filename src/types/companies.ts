export type CompanyStatus = 'ACTIVE' | 'ARCHIVED';

export type Company = {
  id: string;
  name: string;
  bin: string;
  legalAddress: string;
  actualAddress: string;
  phone: string;
  email: string;
  comment?: string;
  directorFullName: string;
  directorPosition: string;
  contactPerson: string;
  contactPhone: string;
  bank: string;
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
  status: CompanyStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanyPayload = Omit<Company, 'id' | 'status' | 'createdAt' | 'updatedAt'> & {
  status?: CompanyStatus;
};

export type CompanyQuery = {
  name?: string;
  bin?: string;
  search?: string;
  status?: CompanyStatus | '';
  page?: number;
  size?: number;
};
