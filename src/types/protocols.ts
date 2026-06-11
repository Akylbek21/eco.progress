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

export type ProtocolResultRow = {
  id: string;
  protocolId?: string;
  internalStatus?: ProtocolInternalStatus;
  values: Record<string, string | number | null | undefined>;
};

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

export type Protocol = {
  id: string;
  number: string;
  templateId: ProtocolTemplateId;
  templateName?: string;
  status: ProtocolStatus;
  protocolDate: string;
  executor: string;
  approver?: string;
  approvedAt?: string;
  signedAt?: string;
  organization: ProtocolOrganizationData;
  laboratory: ProtocolLaboratoryData;
  testing: ProtocolTestingData;
  results: ProtocolResultRow[];
  instruments?: MeasurementDevice[];
  history?: ProtocolHistoryItem[];
  createdAt?: string;
  updatedAt?: string;
  replacedByProtocolId?: string;
  replacesProtocolId?: string;
};

export type ProtocolHistoryItem = {
  id: string;
  action: string;
  actorName?: string;
  createdAt: string;
  comment?: string;
};

export type CreateProtocolPayload = {
  templateId: ProtocolTemplateId;
  organizationName: string;
  organizationAddress: string;
  objectName: string;
  productName: string;
  protocolDate: string;
  samplingDate: string;
  testingDate: string;
  testingPurpose: string;
  environmentConditions: string;
};

export type UpdateProtocolPayload = Partial<
  Pick<Protocol, 'number' | 'protocolDate' | 'executor' | 'approver' | 'status' | 'laboratory' | 'organization' | 'testing' | 'results' | 'instruments'>
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
