export type ProtocolStatus = 'DRAFT' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'SIGNED' | 'CANCELLED' | 'REPLACED';

export type ProtocolTemplateId =
  | 'industrial_emissions'
  | 'water_wastewater'
  | 'workplace_air'
  | 'ambient_air'
  | 'vehicle_emissions'
  | 'physical_factors'
  | 'sanitary_hygiene';

export type ProtocolInternalStatus =
  | 'NORMAL'
  | 'EXCEEDED'
  | 'BELOW_REQUIRED'
  | 'NORMATIVE_NOT_FOUND'
  | 'UNIT_MISMATCH'
  | 'EMPTY_RESULT'
  | 'INFO';

export type ProtocolTemplate = {
  id: ProtocolTemplateId;
  name: string;
  description?: string;
};

export type ProtocolResultColumn = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select';
  required?: boolean;
};

export type ProtocolResult = {
  id: string;
  protocolId?: string;
  internalStatus?: ProtocolInternalStatus;
  checkStatus?: ProtocolInternalStatus;
  samplingPoint?: string;
  indicator?: string;
  unit?: string;
  result?: string;
  normative?: string;
  testingMethod?: string;
  samplingMethod?: string;
  normativeDocument?: string;
  comment?: string;
  values: Record<string, string | number | null | undefined>;
};

export type ProtocolResultRow = ProtocolResult;

export type ProtocolLaboratoryData = {
  laboratoryName: string;
  laboratoryAddress: string;
  accreditationNumber: string;
  accreditationValidUntil: string;
  director: string;
  laboratoryHead: string;
  executor: string;
};

export type ProtocolOrganizationData = {
  organizationName: string;
  organizationAddress: string;
  objectName: string;
  productName: string;
  testingBasis: string;
};

export type ProtocolTestingData = {
  productNormativeDocument: string;
  samplingMethodDocument: string;
  testingMethodDocument: string;
  samplingDate: string;
  testingDate: string;
  testingPurpose: string;
  environmentConditions: string;
  physicalFactorType?: string;
};

export interface ProtocolCompanySnapshot {
  companyName: string;
  bin?: string;
  legalAddress?: string;
  actualAddress?: string;
  phone?: string;
  email?: string;
  director?: string;
  contactPerson?: string;
  activityType?: string;
  objectName?: string;
  objectAddress?: string;
  objectActivityType?: string;
  coordinates?: string;
  sanitaryZone?: string;
  bankName?: string;
  iban?: string;
  bik?: string;
  kbe?: string;
  knp?: string;
}

export type ProtocolMeasurementDevice = {
  id: string;
  protocolId?: string;
  deviceId: string;
  deviceSnapshot: {
    name: string;
    model: string;
    serialNumber: string;
    verificationCertificateNumber: string;
    verificationDate: string;
    verificationValidUntil: string;
    units: string;
    status: MeasurementDeviceStatus;
  };
};

export interface Protocol {
  id: string;
  protocolNumber: string;
  number?: string;
  templateId: ProtocolTemplateId;
  templateName?: string;
  status: ProtocolStatus;
  companyId?: string;
  objectId?: string;
  companySnapshot: ProtocolCompanySnapshot;
  protocolDate: string;
  samplingDate?: string;
  testingStartDate?: string;
  testingEndDate?: string;
  purpose?: string;
  environmentalConditions?: string;
  executor?: string;
  approver?: string;
  approvedAt?: string;
  signedAt?: string;
  organization: ProtocolOrganizationData;
  laboratory: ProtocolLaboratoryData;
  testing: ProtocolTestingData;
  results: ProtocolResult[];
  measurementDevices: ProtocolMeasurementDevice[];
  instruments?: MeasurementDevice[];
  history?: ProtocolHistoryItem[];
  createdAt: string;
  updatedAt: string;
  replacedByProtocolId?: string;
  replacesProtocolId?: string;
}

export type ProtocolHistoryItem = {
  id: string;
  action: string;
  actorName?: string;
  createdAt: string;
  comment?: string;
};

export interface CreateProtocolPayload {
  companyId: string;
  objectId?: string;
  templateId: ProtocolTemplateId;
  protocolNumber?: string;
  protocolDate: string;
  samplingDate?: string;
  testingStartDate?: string;
  testingEndDate?: string;
  purpose?: string;
  environmentalConditions?: string;
}

export type UpdateProtocolPayload = Partial<
  Pick<Protocol, 'protocolNumber' | 'number' | 'protocolDate' | 'samplingDate' | 'testingStartDate' | 'testingEndDate' | 'purpose' | 'environmentalConditions' | 'executor' | 'approver' | 'laboratory' | 'organization' | 'testing' | 'results'>
>;

export type NormativeComparisonType = 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL' | 'RANGE' | 'EQUAL' | 'INFO';

export type NormativeRecord = {
  id: string;
  templateId: ProtocolTemplateId;
  researchObject: string;
  indicator: string;
  unit: string;
  normativeType: string;
  value: string;
  min?: string;
  max?: string;
  comparisonType: NormativeComparisonType;
  normativeDocument: string;
  testingMethod: string;
  samplingMethod: string;
  validFrom: string;
  validUntil?: string;
  active: boolean;
  archived?: boolean;
};

export type NormativeSearchResult = {
  found: boolean;
  normative?: NormativeRecord;
  warning?: string;
};

export type MeasurementDeviceStatus = 'VALID' | 'EXPIRING' | 'EXPIRED' | 'ARCHIVED';

export type MeasurementDevice = {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  verificationCertificateNumber: string;
  verificationDate: string;
  verificationValidUntil: string;
  units: string;
  status: MeasurementDeviceStatus;
  archived?: boolean;
};

export type DirectoryQuery = {
  search?: string;
  templateId?: string;
  status?: string;
};
