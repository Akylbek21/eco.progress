export type ProtocolStatus = 'DRAFT' | 'READY_FOR_APPROVAL' | 'APPROVED' | 'SIGNED' | 'CANCELLED' | 'REPLACED';
export type ProtocolResultValue = string | number | null | undefined | Array<string | number | null>;

export type ProtocolTemplateId =
  | 'industrial_emissions'
  | 'water_wastewater'
  | 'ambient_air'
  | 'physical_factors'
  | 'microclimate'
  | 'lighting'
  | 'noise_vibration'
  | 'soil'
  | 'workplace_air'
  | 'vehicle_emissions'
  | 'sanitary_hygiene';

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
  id: ProtocolTemplateId;
  name: string;
  description?: string;
};

export type ProtocolResultColumn = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'select' | 'indicator' | 'device';
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
};

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
  normative?: string;
  normativeValue?: string;
  pdk?: string;
  testingMethod?: string;
  testingMethodDocument?: string;
  samplingMethod?: string;
  normativeDocument?: string;
  comment?: string;
  measurementPlace?: string;
  sampleName?: string;
  deviceId?: string;
  deviceName?: string;
  measurementDeviceId?: string;
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

export type LaboratoryEmployee = {
  id: string;
  laboratoryId?: string;
  userId?: string;
  fullName: string;
  position?: string;
  email?: string;
  role?: string;
  active: boolean;
};

export type LaboratorySummary = {
  id: string;
  name: string;
  legalName?: string;
  accreditationNumber?: string;
  accreditationValidUntil?: string;
  laboratoryHeadName?: string;
  isDefault: boolean;
  active: boolean;
};

export type LaboratoryProfile = LaboratorySummary & {
  bin: string;
  address: string;
  phone: string;
  email: string;
  accreditationIssuedAt: string;
  directorId?: string;
  directorName?: string;
  laboratoryHeadId?: string;
  logoUrl?: string;
  standardNote?: string;
  employees: LaboratoryEmployee[];
  createdAt?: string;
  updatedAt?: string;
};

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
  windSpeed?: string;
  comment?: string;
  status?: WeatherConditionsStatus;
  source?: 'API' | 'MANUAL';
  dataSource?: string;
  observedAt?: string;
  loadedAt?: string;
  manualChangeReason?: string;
};

export type WeatherConditionsStatus =
  | 'IDLE'
  | 'LOADING'
  | 'LOADED'
  | 'API_UNAVAILABLE'
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
  windSpeed?: string;
  status: WeatherConditionsStatus;
  source: 'API' | 'MANUAL';
  dataSource?: string;
  observedAt?: string;
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

export interface Protocol {
  id: string;
  protocolNumber: string;
  number?: string;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  templateName?: string;
  status: ProtocolStatus;
  companyId?: string | number;
  objectId?: string | number;
  companySnapshot: ProtocolCompanySnapshot;
  protocolDate: string;
  measurementDate?: string;
  measurementTime?: string;
  measurementPlace?: string;
  sourceNumber?: string;
  formCode?: string;
  application?: string;
  samplingDate?: string;
  testingStartDate?: string;
  testingEndDate?: string;
  purpose?: string;
  environmentalConditions?: string;
  environment?: ProtocolEnvironmentalConditions;
  productName?: string;
  testingBasis?: string;
  productNormativeDocument?: string;
  samplingMethodDocument?: string;
  testingMethodDocument?: string;
  explanatoryNote?: string;
  complianceResult?: ProtocolInternalStatus | string;
  executor?: string;
  executorId?: string;
  approver?: string;
  approvedAt?: string;
  signedAt?: string;
  organization: ProtocolOrganizationData;
  laboratory: ProtocolLaboratorySnapshot;
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
  companyId: string | number;
  objectId: string | number;
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  protocolNumber?: string;
  protocolDate: string;
  sampleDate?: string;
  samplingDate?: string;
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
  laboratoryId?: string;
  executorId?: string;
  environment?: ProtocolEnvironmentalConditions;
}

export type UpdateProtocolPayload = {
  number: string;
  protocolDate: string;
  objectId?: string | number;
  measurementDate?: string;
  measurementTime?: string;
  measurementPlace?: string;
  formCode?: string;
  application?: string;
  executor: string;
  executorId?: string;
  approver: string;
  laboratory?: ProtocolLaboratorySnapshot;
  organization: ProtocolOrganizationData;
  testing: ProtocolTestingData;
  environment?: ProtocolEnvironmentalConditions;
  explanatoryNote?: string;
};

export type ProtocolResultPayload = {
  values: Record<string, ProtocolResultValue>;
  measurementDeviceId?: string | null;
  normativeId?: string | null;
};

export type QuickProtocolMeasurementPayload = {
  factorType?: string;
  factorCode?: string;
  indicatorName: string;
  value: string | number;
  unit?: string;
  normativeId?: string;
  values?: Record<string, ProtocolResultValue>;
};

export type QuickProtocolCreatePayload = {
  templateId: ProtocolTemplateId;
  subtype?: ProtocolSubtype;
  companyId: string | number;
  objectId?: string | number;
  protocolDate: string;
  measurementDate: string;
  measurementTime?: string;
  measurementPlace?: string;
  laboratoryId?: string;
  executorId?: string;
  sourceDocumentCode?: string;
  conditions?: Record<string, ProtocolResultValue>;
  measurements: QuickProtocolMeasurementPayload[];
};

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
};

export type ProtocolCalculationSummaryResponse = {
  protocolId: string;
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

export type NormativeComparisonType = 'LESS_OR_EQUAL' | 'GREATER_OR_EQUAL' | 'RANGE' | 'EQUAL' | 'INFO';

export type NormativeRecord = {
  id: string;
  templateId: ProtocolTemplateId;
  sourceDocumentCode?: string;
  sourceDocumentName?: string;
  documentNumber?: string;
  documentDate?: string;
  appendixNo?: string;
  tableNo?: string;
  matrixType?: string;
  assessmentCategory?: string;
  pollutionDegree?: string;
  formType?: string;
  factorType?: string;
  factorCode?: string;
  roomType?: string;
  season?: string;
  workCategory?: string;
  workplaceType?: string;
  normLevel?: string;
  conditionJson?: string;
  code?: string;
  pollutantCode?: string;
  indicatorName?: string;
  pollutantName?: string;
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
  maxOneTimeValue?: string;
  dailyAverageValue?: string;
  singleValue?: string;
  obuvValue?: string;
  min?: string;
  max?: string;
  comparisonType: NormativeComparisonType;
  normativeDocument: string;
  hazardClass?: string;
  limitingIndicator?: string;
  aggregateState?: string;
  actionFeatures?: string;
  source?: string;
  sourceFile?: string;
  importFileName?: string;
  testingMethod: string;
  samplingMethod: string;
  validFrom: string;
  validUntil?: string;
  version?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
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
  environmentType?: string;
  sourceDocumentCode?: string;
  factorType?: string;
  appendixNo?: string;
  tableNo?: string;
  formType?: string;
  normativeType?: string;
  subtype?: string;
  status?: string;
};
