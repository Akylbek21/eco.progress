import type { LaboratoryDetails as CanonicalLaboratoryDetails, LaboratoryEmployee as CanonicalLaboratoryEmployee, LaboratoryListItem as CanonicalLaboratoryListItem } from './laboratories';

export type ProtocolStatus =
  | 'DRAFT'
  | 'CALCULATED'
  | 'READY_FOR_APPROVAL'
  | 'NEEDS_REVISION'
  | 'APPROVED'
  | 'SIGNED'
  | 'PUBLISHED'
  | 'REPLACED'
  | 'CANCELLED'
  | 'ARCHIVED'
  | 'UNKNOWN';

export interface ProtocolPermissions {
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canCalculate?: boolean;
  canCheckNormatives?: boolean;
  canGeneratePreview?: boolean;
  canSendToApproval?: boolean;
  canReturnForRevision?: boolean;
  canReturnToDraft?: boolean;
  canApprove?: boolean;
  canSign?: boolean;
  canCreateCorrection?: boolean;
  canCancel?: boolean;
  canArchive?: boolean;
  canPublish?: boolean;
  canGenerateDocuments?: boolean;
  canRegenerateDocuments?: boolean;
  canGeneratePdf?: boolean;
  canRegeneratePdf?: boolean;
  canGenerateDocx?: boolean;
  canRegenerateDocx?: boolean;
}

export type ProtocolAvailableActions = Record<string, boolean>;

export type ProtocolWorkflowBlocker = {
  code: string;
  message: string;
  actions?: string[];
};

export type ProtocolResultValue = string | number | null | undefined | Array<string | number | null>;

export type ProtocolTemplateId =
  | 'ambient_air'
  | 'workplace_air'
  | 'soil'
  | 'microclimate'
  | 'lighting'
  | 'noise_vibration'
  | 'water'
  | 'uv_emf_laser';

export type LegacyProtocolTemplateId =
  | 'industrial_emissions'
  | 'water_wastewater'
  | 'physical_factors'
  | 'food_products'
  | 'surfaces'
  | 'udmh_special'
  | 'vehicle_emissions'
  | 'sanitary_hygiene';

export type ProtocolTemplateKey = ProtocolTemplateId | LegacyProtocolTemplateId;

export type ProtocolSubtype =
  | 'MICROCLIMATE'
  | 'LIGHTING'
  | 'NOISE'
  | 'VIBRATION'
  | 'NOISE_VIBRATION'
  | 'INFRASOUND'
  | 'ULTRASOUND'
  | 'UV'
  | 'AEROIONS'
  | 'ELECTROMAGNETIC_FIELD'
  | 'LASER';

export type ComplianceStatus =
  | 'NORMAL'
  | 'OK'
  | 'OK_MANUAL'
  | 'MANUAL_NORMATIVE'
  | 'EXCEEDED'
  | 'BELOW_REQUIRED'
  | 'NORMATIVE_NOT_FOUND'
  | 'UNIT_MISMATCH'
  | 'NEEDS_REVIEW'
  | 'EMPTY_RESULT'
  | 'INFO';

export type ProtocolInternalStatus = ComplianceStatus;

export type CalculationStatus =
  | 'WAITING_INPUTS'
  | 'CALCULATED'
  | 'MANUAL'
  | 'ERROR'
  | 'NEEDS_REPEAT'
  | 'NORMATIVE_NOT_FOUND';

export type ProtocolTemplate = {
  id: ProtocolTemplateKey;
  name: string;
  description?: string;
  sourceDocumentCode?: string;
  docxTemplateCode?: string;
  normativeTemplateId?: string;
  resultMode?: string;
  defaultUnit?: string;
  active?: boolean;
};

export type ProtocolResultColumn = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'indicator' | 'device';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

export interface MeasurementDeviceSummary {
  id: string | number;
  name?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  verificationNumber?: string | null;
  verificationValidUntil?: string | null;
}

export type ProtocolResult = {
  id: string;
  protocolId?: string;
  internalStatus?: ProtocolInternalStatus;
  checkStatus?: ProtocolInternalStatus;
  indicatorName?: string;
  code?: string;
  samplingPoint?: string;
  indicator?: string;
  unit?: string;
  result?: string;
  resultValue?: string;
  primaryReading?: string;
  normative?: string;
  normativeValue?: string;
  pdk?: string;
  testingMethod?: string;
  testingMethodDocument?: string;
  testingMethodNd?: string;
  samplingMethod?: string;
  samplingMethodDocument?: string;
  samplingMethodNd?: string;
  normativeDocument?: string;
  comment?: string;
  measurementPlace?: string;
  sampleName?: string;
  deviceId?: string | number | null;
  deviceName?: string;
  measurementDeviceId?: string | number | null;
  measurementDevice?: MeasurementDeviceSummary | null;
  device?: MeasurementDeviceSummary | null;
  deviceSnapshot?: MeasurementDeviceSummary | null;
  comparisonType?: NormativeComparisonType;
  normativeMin?: string;
  normativeMax?: string;
  pollutant?: Pollutant;
  normativeReference?: NormativeReference;
  measurementSeries?: MeasurementSeries;
  calculationDetails?: CalculationDetails;
  uncertaintyValue?: string;
  calculationStatus?: CalculationStatus | string;
  calculationMessage?: string;
  warnings?: string[];
  methodTemplate?: MethodTemplateResponse;
  values: Record<string, ProtocolResultValue>;
};

export type ProtocolResultRow = ProtocolResult;

/** @deprecated Import from types/laboratories. */
export type LaboratoryEmployee = CanonicalLaboratoryEmployee;
/** @deprecated Import from types/laboratories. */
export type LaboratorySummary = CanonicalLaboratoryListItem;
/** @deprecated Import from types/laboratories. */
export type LaboratoryProfile = CanonicalLaboratoryDetails;

export type ProtocolLaboratorySnapshot = {
  id?: string;
  laboratoryId?: string;
  name?: string;
  laboratoryName: string;
  legalName?: string;
  bin?: string;
  address?: string;
  laboratoryAddress: string;
  phone?: string;
  email?: string;
  accreditationNumber: string;
  accreditationIssuedAt?: string;
  accreditationValidUntil: string;
  directorId?: string;
  directorName?: string;
  director: string;
  laboratoryHeadId?: string;
  laboratoryHeadName?: string;
  laboratoryHead: string;
  executorId?: string;
  executorName?: string;
  executor: string;
  logoUrl?: string;
  standardNote?: string;
  capturedAt?: string;
};

export type ProtocolLaboratoryData = ProtocolLaboratorySnapshot;

export interface ProtocolPrintVisibility {
  organizationName: boolean;
  organizationAddress: boolean;
  testObjectName: boolean;
  productName: boolean;
  testBasis: boolean;
  samplingDate: boolean;
  testStartDate: boolean;
  testEndDate: boolean;
  productNormativeDocument: boolean;
  samplingMethodDocument: boolean;
  testMethodDocument: boolean;
  testPurpose: boolean;
  samplingPlace: boolean;
  measurementDate: boolean;
  environmentalConditions: boolean;
  temperature: boolean;
  humidity: boolean;
  pressure: boolean;
  windSpeed: boolean;
}

export type ProtocolPrintField = keyof ProtocolPrintVisibility;

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
  testingStartDate: string;
  testingEndDate: string;
  testingDate: string;
  testingPurpose: string;
  environmentConditions: string;
  physicalFactorType?: ProtocolSubtype | string;
};

export type ProtocolEnvironmentalConditions = {
  temperature?: string;
  minTemperature?: string;
  maxTemperature?: string;
  humidity?: string;
  minHumidity?: string;
  maxHumidity?: string;
  pressureKpa?: string;
  pressureHpa?: string;
  pressure?: string;
  windSpeed?: string;
  comment?: string;
  status?: WeatherConditionsStatus;
  source?: 'API' | 'MANUAL';
  dataSource?: string;
  observedAt?: string;
  weatherObservedAt?: string;
  loadedAt?: string;
  manualChangeReason?: string;
  available?: boolean;
  warning?: string;
  conditions?: Record<string, ProtocolResultValue> | null;
};

export type WeatherConditionsStatus =
  | 'IDLE'
  | 'LOADING'
  | 'LOADED'
  | 'API_UNAVAILABLE'
  | 'ERROR'
  | 'COORDINATES_MISSING'
  | 'MANUAL';

export type WeatherConditions = {
  temperature?: string;
  minTemperature?: string;
  maxTemperature?: string;
  humidity?: string;
  minHumidity?: string;
  maxHumidity?: string;
  pressureKpa?: string;
  pressure?: string;
  windSpeed?: string;
  available: boolean;
  status: WeatherConditionsStatus;
  source: 'API' | 'MANUAL';
  dataSource?: string;
  observedAt?: string;
  weatherObservedAt?: string;
  loadedAt?: string;
  manualChangeReason?: string;
  warning?: string;
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

export type ProtocolSignature = {
  id: number;
  userId: number;
  signerFullName: string;
  signerPosition?: string | null;
  signedAt: string;
};

export interface Protocol {
  id: string;
  protocolNumber: string;
  number?: string;
  templateId: ProtocolTemplateKey;
  subtype?: ProtocolSubtype;
  templateName?: string;
  status: ProtocolStatus;
  apiStatus?: string;
  companyId?: string | number;
  objectId?: string | number;
  companySnapshot: ProtocolCompanySnapshot;
  protocolDate: string;
  measurementDate?: string;
  measurementTime?: string;
  measurementPlace?: string;
  sampleNumber?: string;
  samplingPlace?: string;
  samplingDepth?: string;
  sourceNumber?: string;
  formCode?: string;
  appendixNumber?: string;
  samplingDate?: string;
  testingStartDate?: string;
  testingEndDate?: string;
  purpose?: string;
  environmentalConditions?: string;
  waterType?: string;
  waterUseCategory?: string;
  conditions?: Record<string, ProtocolResultValue>;
  environment?: ProtocolEnvironmentalConditions;
  productName?: string;
  testingBasis?: string;
  productNormativeDocument?: string;
  samplingMethodDocument?: string;
  testingMethodDocument?: string;
  complianceDocument?: string;
  explanatoryNote?: string;
  complianceResult?: ProtocolInternalStatus | string;
  executor?: string;
  executorId?: string | number;
  approver?: string;
  approvedAt?: string;
  signedAt?: string;
  signedBy?: string;
  signatureCount: number;
  maxSignatures: number;
  signedByCurrentUser: boolean;
  signatures: ProtocolSignature[];
  hasDocx?: boolean;
  hasPdf?: boolean;
  docxFileId?: string;
  pdfFileId?: string;
  finalPdfFileId?: string;
  finalPdfHash?: string;
  printVisibility?: ProtocolPrintVisibility;
  organization: ProtocolOrganizationData;
  laboratory: ProtocolLaboratorySnapshot;
  testing: ProtocolTestingData;
  results: ProtocolResult[];
  measurementDevices: ProtocolMeasurementDevice[];
  instruments?: MeasurementDevice[];
  history?: ProtocolHistoryItem[];
  createdAt: string;
  updatedAt: string;
  version: number;
  replacedByProtocolId?: string;
  replacesProtocolId?: string;
  orderId?: string | number;
  orderServiceItemId?: string | number;
  orderNumber?: string;
  pekProgramId?: string | number;
  pekReportId?: string | number;
  pekControlItemId?: string | number;
  pekControlEventId?: string | number;
  monitoringPointId?: string | number;
  emissionSourceId?: string | number;
  waterOutletId?: string | number;
  permissions?: ProtocolPermissions;
  availableActions: ProtocolAvailableActions;
  canComplete?: boolean;
  blockingReasons?: ProtocolWorkflowBlocker[];
  publishedToClientAt?: string;
  publishedAt?: string;
  publishedBy?: string;
  publishedDocumentId?: string | number;
  syncWarning?: string;
}

export type ProtocolPage = {
  items: Protocol[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  hasNext: boolean;
  hasPrevious: boolean;
  totalElementsExact?: boolean;
};

export type ProtocolComplianceFilter = 'COMPLIANT' | 'NON_COMPLIANT' | 'NOT_EVALUATED';

export interface ProtocolListItem {
  id: string;
  protocolNumber: string;
  protocolDate: string;
  companyName: string;
  objectName: string;
  templateId: ProtocolTemplateKey;
  templateName?: string;
  subtype?: ProtocolSubtype;
  laboratoryName: string;
  executorName: string;
  status: ProtocolStatus;
  compliance: ProtocolComplianceFilter;
  updatedAt: string;
  version: number;
  signatureCount: number;
  maxSignatures: number;
  hasDocx: boolean;
  hasPdf: boolean;
  docxFileId?: string;
  pdfFileId?: string;
  publishedAt?: string;
  publishedBy?: string;
  replacesProtocolId?: string;
  replacedByProtocolId?: string;
  orderId?: string | number;
  pekProgramId?: string | number;
  pekReportId?: string | number;
  permissions: Record<string, boolean>;
}

export interface ProtocolListQuery {
  page: number;
  size: number;
  search?: string;
  status?: ProtocolStatus;
  templateId?: ProtocolTemplateId;
  subtype?: string;
  companyId?: number;
  objectId?: number;
  laboratoryId?: number;
  executorId?: number;
  compliance?: ProtocolComplianceFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  includeArchived?: boolean;
}

export type ProtocolHistoryItem = {
  id: string;
  action: string;
  actorName?: string;
  createdAt: string;
  comment?: string;
  reason?: string;
};

export interface CreateProtocolPayload {
  companyId: string | number;
  objectId: string | number;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  protocolNumber?: string;
  protocolDate: string;
  sampleDate?: string;
  testingStartDate?: string;
  testingEndDate?: string;
  productName?: string;
  testingBasis?: string;
  productNormativeDocument?: string;
  samplingMethodDocument?: string;
  testingMethodDocument?: string;
  purpose?: string;
  measurementDate?: string;
  measurementTime?: string;
  measurementPlace?: string;
  sourceNumber?: string;
  formCode?: string;
  appendixNumber?: string;
  laboratoryId?: string;
  executorId?: string;
  sourceDocumentCode?: string | null;
  docxTemplateCode?: string;
  normativeTemplateId?: ProtocolTemplateId;
  environmentType?: string;
  defaultUnit?: string;
  waterType?: string;
  waterUseCategory?: string;
  environment?: ProtocolEnvironmentalConditions;
  printVisibility?: ProtocolPrintVisibility;
  orderId?: string | number;
  orderServiceItemId?: string | number;
}

export type UpdateProtocolPayload = {
  version: number;
  number: string;
  protocolDate: string;
  companyId?: string | number;
  objectId?: string | number;
  laboratoryId?: string | number;
  measurementDate?: string;
  measurementTime?: string;
  measurementPlace?: string;
  sampleDate?: string;
  sampleNumber?: string;
  samplingPlace?: string;
  samplingDepth?: string;
  sourceNumber?: string;
  basis?: string;
  formCode?: string;
  appendixNumber?: string;
  executor: string;
  executorId?: string;
  approver: string;
  laboratory?: ProtocolLaboratorySnapshot;
  organization: ProtocolOrganizationData;
  testing: ProtocolTestingData;
  environment?: ProtocolEnvironmentalConditions;
  conditions?: Record<string, ProtocolResultValue>;
  explanatoryNote?: string;
  testingMethodDocument?: string;
  complianceDocument?: string;
  notes?: string;
  printVisibility?: ProtocolPrintVisibility;
  orderId?: string | number;
  orderServiceItemId?: string | number;
};

export type ProtocolResultPayload = {
  values: Record<string, ProtocolResultValue>;
  measurementDeviceId?: string | number | null;
  deviceId?: string | number | null;
  normativeId?: string | number | null;
};

export type ComparisonType = NormativeComparisonType;

export interface ProtocolResultForm {
  id?: number;
  indicatorId?: number;
  indicatorName: string;
  indicatorCode?: string;
  cas?: string;
  formula?: string;
  unit: string;
  resultValue?: number;
  resultText?: string;
  comparisonType?: ComparisonType;
  normativeMin?: number;
  normativeMax?: number;
  normativeValue?: number;
  normativeDocument?: string;
  measurementDeviceId?: number;
  samplingPlace?: string;
  sampleNumber?: string;
  samplingDepth?: number;
  externalLaboratory?: boolean;
  notes?: string;
}

export type EntityId = number;

export type QuickCreateComparisonType = 'LE' | 'LT' | 'GE' | 'GT' | 'EQ' | 'RANGE';

export type MethodVariableResponse = {
  id: string | number;
  variableKey: string;
  variableLabel: string;
  unit?: string | null;
  type?: string;
  required?: boolean;
  minValue?: number | null;
  maxValue?: number | null;
  defaultValue?: number | null;
  displayOrder?: number;
};

export type MethodTemplateResponse = {
  id: string;
  code: string;
  name: string;
  protocolTemplateCode?: string;
  pollutantCode?: string;
  pollutantName?: string;
  methodDocument?: string;
  measurementUnit?: string;
  resultUnit?: string;
  formulaExpression?: string;
  decimalPlaces?: number;
  active?: boolean;
  variables: MethodVariableResponse[];
};

export type RawMeasurementRequest = {
  variableKey: string;
  variableValue: string | number | null;
  unit?: string | null;
  sourceType?: 'MANUAL' | 'DEVICE_IMPORT' | 'EXCEL_IMPORT';
  deviceId?: string | number | null;
};

export type SaveRawMeasurementsRequest = {
  methodTemplateId?: string | number | null;
  measurements: RawMeasurementRequest[];
};

export type RawMeasurementsResponse = {
  protocolId: string | number;
  resultId: string | number;
  methodTemplate?: MethodTemplateResponse | null;
  variables: MethodVariableResponse[];
  measurements: RawMeasurementRequest[];
  calculationStatus?: CalculationStatus | string;
  calculationMessage?: string;
};

export type SaveRawMeasurementsResponse = {
  version: number;
  row?: ProtocolResultRow;
};

export type CalculationResultResponse = {
  protocolId: string;
  resultId: string;
  result?: string | number | null;
  uncertaintyValue?: string | number | null;
  normativeValue?: string | number | null;
  internalStatus?: ProtocolInternalStatus | string;
  calculationStatus?: CalculationStatus | string;
  calculationMessage?: string;
  warnings?: string[];
  row?: ProtocolResultRow;
  version?: number;
};

export type ProtocolCalculationSummaryResponse = {
  protocolId: string;
  version?: number;
  total: number;
  calculated: number;
  manual: number;
  waitingInputs: number;
  needsRepeat: number;
  normativeNotFound: number;
  errors: number;
  exceeded: number;
  complies: number;
  rows: CalculationResultResponse[];
};

export type MeasurementReading = {
  id?: string;
  value: string;
  unit?: string;
  measuredAt?: string;
  place?: string;
  deviceId?: string;
  note?: string;
};

export type MeasurementSeries = {
  type: 'CONCENTRATION' | 'MICROCLIMATE' | 'LIGHTING' | 'NOISE' | 'VIBRATION' | 'LAB_RESULT';
  readings: MeasurementReading[];
  sourceParameters?: Record<string, string>;
  externalLaboratory?: {
    name?: string;
    accreditationNumber?: string;
    documentName?: string;
    documentId?: string;
  };
};

export type CalculationDetails = {
  formula?: string;
  substitutedValues?: string;
  intermediateResults?: Array<{ label: string; value: string }>;
  rounding?: string;
  finalValue?: string;
  unit?: string;
  normativeValue?: string;
  comparisonResult?: string;
  methodVersion?: string;
};

export type Pollutant = {
  id?: string;
  code: string;
  name: string;
  cas?: string;
  formula?: string;
  unit?: string;
  testingMethod?: string;
  samplingMethod?: string;
  normatives?: NormativeReference[];
};

export type NormativeReference = {
  id: string;
  code?: string;
  pollutantCode?: string;
  indicator: string;
  environment?: string;
  unit: string;
  normativeType: string;
  value?: string;
  min?: string;
  max?: string;
  comparisonType: NormativeComparisonType;
  normativeDocument: string;
  testingMethod?: string;
  samplingMethod?: string;
  validFrom?: string;
  validUntil?: string;
  version?: string;
  active?: boolean;
};

export type ObjectEmissionLimit = {
  id?: string;
  objectId: string;
  sourceNumber: string;
  pollutantCode: string;
  concentrationLimit?: string;
  massFlowLimit?: string;
  unit?: string;
  validFrom?: string;
  validUntil?: string;
};

export type NormativeComparisonType = 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL' | 'RANGE' | 'EQUAL' | 'ABSENT' | 'INFO';

export type NormativeRecord = {
  id: string;
  templateId: ProtocolTemplateKey;
  sourceDocumentCode?: string;
  sourceDocumentName?: string;
  documentNumber?: string;
  documentDate?: string;
  appendixNo?: string;
  appendix?: string;
  appNo?: string;
  tableNo?: string;
  tableNumber?: string;
  tableTitle?: string;
  categoryCode?: string;
  category?: string;
  categoryName?: string;
  waterType?: string;
  waterUseCategory?: string;
  matrixType?: string;
  assessmentCategory?: string;
  pollutionDegree?: string;
  hazardLevel?: string;
  pollutionLevel?: string;
  radioactiveIndicator?: string;
  coliTiter?: string;
  anaerobeTiter?: string;
  helminth?: string;
  flyLarvae?: string;
  sanitaryNumber?: string;
  ecologicalDisaster?: string;
  emergencySituation?: string;
  satisfactorySituation?: string;
  formType?: string;
  factorType?: string;
  factorCode?: string;
  roomType?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  normLevel?: string;
  lightingType?: string;
  noiseType?: string;
  visualWorkCategory?: string;
  conditionJson?: string;
  summationGroup?: string;
  name?: string;
  code?: string;
  pollutantCode?: string;
  indicatorName?: string;
  pollutantName?: string;
  synonyms?: string;
  researchObject: string;
  indicator: string;
  environmentType?: string;
  environment?: string;
  cas?: string;
  casNumber?: string;
  formula?: string;
  chemicalFormula?: string;
  unit: string;
  normativeType: string;
  normativeSubType?: string;
  subtype?: string;
  value: string;
  normativeValue?: string | number;
  pdk?: string | number;
  limitValue?: string | number;
  maxOneTimeValue?: string;
  dailyAverageValue?: string;
  singleValue?: string;
  obuvValue?: string;
  obuv?: string | number;
  min?: string;
  max?: string;
  minValue?: string | number;
  maxValue?: string | number;
  alternativeNormativeValue?: string;
  comparisonType: NormativeComparisonType;
  normativeDocument: string;
  hazardClass?: string;
  limitingIndicator?: string;
  limitingHazardIndicator?: string;
  aggregateState?: string;
  actionFeatures?: string;
  source?: string;
  sourceFile?: string;
  sourceFileName?: string;
  importFileName?: string;
  testingMethod: string;
  samplingMethod: string;
  validFrom: string;
  validUntil?: string;
  version?: string;
  status?: 'ACTIVE' | 'REVIEW' | 'INACTIVE' | 'ARCHIVED';
  matchQuality?: 'EXACT' | 'CONTEXT_GENERAL' | 'TEMPLATE_DOCUMENT' | 'TEMPLATE_ONLY' | string;
  active: boolean;
  archived?: boolean;
};

export type NormativeSearchResult = {
  found: boolean;
  normative?: NormativeRecord;
  normatives?: NormativeRecord[];
  items?: NormativeRecord[];
  ambiguous?: boolean;
  warning?: string;
};

export type MeasurementDeviceStatus = 'VALID' | 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'ARCHIVED' | 'INACTIVE' | 'OUT_OF_SERVICE';

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
  laboratoryId?: string | number;
};

export type DirectoryQuery = {
  search?: string;
  query?: string;
  q?: string;
  templateId?: string;
  environmentType?: string;
  sourceDocumentCode?: string;
  categoryCode?: string;
  waterType?: string;
  factorType?: string;
  factorCode?: string;
  appendixNo?: string;
  tableNo?: string;
  formType?: string;
  normativeType?: string;
  subtype?: string;
  status?: string;
  laboratoryId?: string | number;
  measurementDate?: string;
};
