import type {
  ProtocolEnvironmentalConditions,
  ProtocolPrintVisibility,
  ProtocolResultValue,
  UpdateProtocolPayload,
} from '../../../types/protocols';

export type {
  CreateProtocolFromPekRequest,
  ProtocolCreationContext,
  ProtocolCreationContextParams,
  ProtocolCreationIndicator,
  ProtocolCreationRequirement,
  ProtocolCreationRequirementStatus,
} from './protocolCreationContracts';

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
  /** Backend executor primary key. This is intentionally not a user id. */
  executorId: string | number | null;
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
  number: string | null;
  protocolDate: string;
  objectId: string | number | null;
  executor: string | null;
  executorId: string | number | null;
  measurementDate: string | null;
  measurementTime: string | null;
  measurementPlace: string | null;
  sourceNumber: string | null;
  testingStartDate: string | null;
  testingEndDate: string | null;
  formCode: string | null;
  appendixNumber: string | null;
  organization: ProtocolOrganizationRequest;
  laboratory: ProtocolLaboratoryRequest;
  testing: ProtocolTestingRequest;
  environment: ProtocolEnvironmentRequest;
  testingMethodDocument: string | null;
  complianceDocument: string | null;
  explanatoryNote: string | null;
  printVisibility: ProtocolPrintVisibility;
  orderId: string | null;
  orderServiceItemId: string | null;
  samplingPoints: ProtocolSamplingPointRequest[];
}

export interface ProtocolPekContextRequest {
  pekProgramId?: number | null;
  pekReportId?: number | null;
  pekControlItemId?: number | null;
  pekControlEventId?: number | null;
  monitoringPointId?: number | null;
  programIndicatorId?: number | null;
  emissionSourceId?: number | null;
  waterOutletId?: number | null;
}

export interface ProtocolEnvironmentRequest {
  temperatureC: number | null;
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  humidityPercent: number | null;
  humidityMinPercent: number | null;
  humidityMaxPercent: number | null;
  pressureKpa: number | null;
  pressureHpa: number | null;
  windSpeedMs: number | null;
  conditionsComment: string | null;
  source: ProtocolEnvironmentalConditions['source'] | null;
  dataSource: string | null;
  observedAt: string | null;
  loadedAt: string | null;
  manualChangeReason: string | null;
  conditions: ProtocolTypeConditionsRequest | null;
}

export interface ProtocolTypeConditionsRequest {
  season: string | null;
  workCategory: string | null;
  roomType: string | null;
  workplaceType: string | null;
  lightingType: string | null;
  noiseType: string | null;
  visualWorkCategory: string | null;
  normLevel: string | null;
  sampleNumber: string | null;
  samplingDepth: string | null;
  samplingPlace: string | null;
  waterType: string | null;
  waterUseCategory: string | null;
  factorType: string | null;
}

export interface CreateProtocolDraftRequest {
  templateId: string;
  subtype: string | null;
  companyId: number;
  objectId: number | null;
  protocolDate: string | null;
  measurementDate: string | null;
  laboratoryId: number | null;
  executorId: number | null;
  orderId: string | null;
  orderServiceItemId: string | null;
  printVisibility: ProtocolPrintVisibility;
  testingStartDate: string | null;
  testingEndDate: string | null;
  environment: ProtocolEnvironmentRequest | null;
  pekContext?: ProtocolPekContextRequest | null;
  samplingPoints: ProtocolSamplingPointRequest[];
}

export type ProtocolSamplingPointRequest = {
  id: string | number | null;
  clientPointId: string | null;
  name: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  sortOrder: number;
};

/** PATCH /protocols/{id}/draft. Company is immutable after draft creation and is intentionally absent. */
export type UpdateProtocolDraftRequest = Omit<UpdateProtocolPayload, 'companyId'>;

export interface ProtocolResultRequest {
  values: Record<string, ProtocolResultValue>;
  samplingPointId: string | number | null;
  measurementDeviceId: string | number | null;
  normativeId: string | number | null;
}

export interface ProtocolDraftResultCreateRequest extends ProtocolResultRequest {
  clientRowId: string | null;
}

export interface ProtocolDraftResultUpdateRequest extends ProtocolResultRequest {
  id: string | number;
}

/** PATCH /protocols/{id}/draft-results applies one atomic result-row delta. */
export interface SaveProtocolDraftResultsRequest {
  version: number;
  added: ProtocolDraftResultCreateRequest[];
  updated: ProtocolDraftResultUpdateRequest[];
  deletedIds: Array<string | number>;
}

export interface ProtocolsQueryRequest {
  page: number;
  size: number;
  search?: string;
  status?: string;
  templateId?: string;
  subtype?: string;
  companyId?: number;
  objectId?: number;
  laboratoryId?: number;
  executorId?: number;
  compliance?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  includeArchived?: boolean;
  published?: boolean;
}

export interface ProtocolWizardMeasurementRequest {
  indicatorName: string;
  pollutantCode?: string;
  factorType?: string;
  factorCode?: string;
  value: number | string;
  unit: string;
  measurementDeviceId?: number;
  deviceId?: number;
  normativeId?: number;
  normativeValue?: number;
  normativeMin?: number;
  normativeMax?: number;
  comparisonType?: string;
  manualNormativeReason?: string;
  testingMethodNd?: string;
  samplingMethodNd?: string;
  samplingPlace?: string;
  sampleNumber?: string;
  samplingDepth?: number;
  samplingDate?: string;
  values?: Record<string, ProtocolResultValue>;
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
