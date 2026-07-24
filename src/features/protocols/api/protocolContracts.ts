import type {
  ProtocolEnvironmentalConditions,
  ProtocolPrintVisibility,
  ProtocolResultValue,
  ProtocolTemplateId,
} from '../../../types/protocols';

/** DTOs in this file are the only shapes allowed to cross the protocols API boundary. */
export interface ProtocolOrganizationRequest {
  companyId: string | number | null;
  objectId: string | number | null;
  organizationName: string | null;
  organizationAddress: string | null;
  objectName: string | null;
  productName: string | null;
  testingBasis: string | null;
}

export interface ProtocolLaboratoryRequest {
  laboratoryId: string | number | null;
  laboratoryName: string | null;
  laboratoryAddress: string | null;
  accreditationNumber: string | null;
  accreditationValidUntil: string | null;
}

export interface ProtocolExecutorRequest {
  /** The laboratory employee primary key. This is intentionally not a user id. */
  laboratoryEmployeeId: string | number | null;
  fullName: string | null;
}

export interface ProtocolTestingRequest {
  measurementDate: string | null;
  measurementTime: string | null;
  measurementPlace: string | null;
  sampleDate: string | null;
  sampleNumber: string | null;
  samplingPlace: string | null;
  samplingDepth: string | null;
  testingStartDate: string | null;
  testingEndDate: string | null;
  productNormativeDocument: string | null;
  samplingMethodDocument: string | null;
  testingMethodDocument: string | null;
  purpose: string | null;
  environmentConditions: string | null;
}

export interface UpdateProtocolRequest {
  version: number;
  protocolDate: string;
  organization: ProtocolOrganizationRequest;
  laboratory: ProtocolLaboratoryRequest;
  executor: ProtocolExecutorRequest;
  testing: ProtocolTestingRequest;
  environment: ProtocolEnvironmentRequest;
  conditions?: Record<string, ProtocolResultValue>;
  testingMethodDocument: string | null;
  complianceDocument: string | null;
  explanatoryNote: string | null;
  printVisibility: ProtocolPrintVisibility;
}

export interface ProtocolEnvironmentRequest {
  temperatureC: string | null;
  temperatureMinC: string | null;
  temperatureMaxC: string | null;
  humidityPercent: string | null;
  humidityMinPercent: string | null;
  humidityMaxPercent: string | null;
  pressureKpa: string | null;
  windSpeedMs: string | null;
  conditionsComment: string | null;
  source: ProtocolEnvironmentalConditions['source'] | null;
  dataSource: string | null;
  observedAt: string | null;
  weatherObservedAt: string | null;
  loadedAt: string | null;
  manualChangeReason: string | null;
}

export interface ProtocolResultRequest {
  values: Record<string, ProtocolResultValue>;
  measurementDeviceId: string | number | null;
  normativeId: string | number | null;
}

export interface ProtocolsQueryRequest {
  page: number;
  size: number;
  search?: string;
  status?: string;
  templateId?: string;
  companyId?: number;
  objectId?: number;
  laboratoryId?: number;
  executorId?: number;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  includeArchived?: boolean;
}
