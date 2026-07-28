import type {
  ProtocolEnvironmentalConditions,
  ProtocolPrintVisibility,
  ProtocolResultValue,
} from '../../../types/protocols';

/** DTOs in this file are the only shapes allowed to cross the protocols API boundary. */
export interface ProtocolOrganizationRequest {
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
  samplingDate: string | null;
  sampleNumber: string | null;
  samplingPlace: string | null;
  samplingDepth: string | null;
  productNormativeDocument: string | null;
  samplingMethodDocument: string | null;
  testingMethodDocument: string | null;
  testingPurpose: string | null;
  environmentConditions: string | null;
}

export interface UpdateProtocolRequest {
  version: number;
  protocolDate: string;
  companyId: string | number | null;
  objectId: string | number | null;
  laboratoryId: string | number | null;
  executorId: string | number | null;
  measurementDate: string | null;
  measurementTime: string | null;
  measurementPlace: string | null;
  testingStartDate: string | null;
  testingEndDate: string | null;
  organization: ProtocolOrganizationRequest;
  laboratory: ProtocolLaboratoryRequest;
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

export type QuickCreateProtocolTemplateId =
  | 'ambient_air'
  | 'workplace_air'
  | 'soil'
  | 'microclimate'
  | 'lighting'
  | 'noise_vibration'
  | 'water';

export interface QuickCreateProtocolEnvironment {
  temperature: number | null;
  humidity: number | null;
  pressureKpa: number | null;
  windSpeed: number | null;
  source: 'API' | 'MANUAL';
}

export interface QuickCreateProtocolMethodology {
  methodologyId?: number;
  methodologyCode?: string;
  methodologyName?: string;
}

export interface QuickCreateProtocolConditions {
  waterType?: string;
  waterUseCategory?: string;
  sampleNumber?: string;
  samplingPlace?: string;
  samplingDepth?: number;
  samplingDate?: string;
  preparationDate?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  roomType?: string;
  normLevel?: string;
  lightingType?: string;
  noiseType?: string;
  visualWorkCategory?: string;
}

export interface QuickCreateProtocolMeasurement {
  clientRowId: string;
  indicatorName: string;
  indicatorCode?: string;
  physicalFactorCode?: string;
  resultValue: number | string;
  unit: string;
  measurementDeviceId: number;
  normativeId?: string;
  normValue?: number;
  samplingPlace?: string;
  sampleNumber?: string;
  samplingDepth?: number;
  samplingDate?: string;
  methodology?: QuickCreateProtocolMethodology;
}

export interface QuickCreateProtocolRequest {
  templateId: QuickCreateProtocolTemplateId;
  companyId: number;
  objectId: number;
  laboratoryId: number;
  executorId: number;
  measurementDate: string;
  measurementTime?: string;
  measurementPlace: string;
  defaultUnit?: string;
  measurements: QuickCreateProtocolMeasurement[];
  environment?: QuickCreateProtocolEnvironment;
  conditions?: QuickCreateProtocolConditions;
  methodology?: QuickCreateProtocolMethodology;
  printVisibility: ProtocolPrintVisibility;
  orderId?: string;
  orderServiceItemId?: string;
  pekProgramId?: number;
  pekControlItemId?: number;
  pekControlEventId?: number;
  pekReportId?: number;
  monitoringPointId?: number;
  emissionSourceId?: number;
  waterOutletId?: number;
}

export interface ProtocolVersionRequest {
  version: number;
}

export interface ReturnForRevisionRequest extends ProtocolVersionRequest {
  reason: string;
}

export type ReplaceProtocolRequest = ReturnForRevisionRequest;
export type CancelProtocolRequest = ReturnForRevisionRequest;

export interface SignProtocolRequest extends ProtocolVersionRequest {
  cmsSignatureBase64: string;
}

/** @deprecated Prefer the canonical QuickCreateProtocolRequest name. */
export type QuickCreateProtocolApiRequest = QuickCreateProtocolRequest;

export interface QuickCreateProtocolResponse {
  id: string;
}
