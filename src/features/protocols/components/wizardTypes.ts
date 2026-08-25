import type { ProtocolPrintVisibility, ProtocolTemplateId } from '../../../types/protocols';
import { DEFAULT_PROTOCOL_PRINT_VISIBILITY } from '../../../utils/protocolPrintVisibility';

export type ProtocolWizardResult = {
  clientRowId: string;
  serverResultId?: string;
  indicatorName: string;
  pollutantCode: string;
  factorType: string;
  factorCode: string;
  cas: string;
  formula: string;
  unit: string;
  value: string;
  textValue: string;
  samplingPlace: string;
  samplingPointId: string;
  samplingDate: string;
  sampleNumber: string;
  samplingDepth: string;
  samplingSpeed: string;
  sampleVolume: string;
  waterType: string;
  direction: string;
  minimumValue: string;
  maximumValue: string;
  averageValue: string;
  duration: string;
  measurementDeviceId: string;
  normativeId: string;
  normativeSource: 'DIRECTORY' | 'MANUAL' | 'NONE';
  normativeStatus: '' | 'ACTIVE' | 'REVIEW' | 'INACTIVE';
  normativeValue: string;
  normativeValueRaw: string;
  normativeMin: string;
  normativeMax: string;
  comparisonType: string;
  normativeDocument: string;
  manualNormativeReason: string;
  sourceDocumentCode: string;
  testingMethodNd: string;
  samplingMethodNd: string;
  methodName: string;
  methodDocument: string;
  note: string;
};

export type ProtocolWizardSamplingPoint = {
  clientPointId: string;
  serverPointId?: string;
  name: string;
  description: string;
  latitude: string;
  longitude: string;
  sortOrder: number;
};

export type MeasurementFormRow = ProtocolWizardResult;

export interface LaboratoryExecutorOption {
  executorId: number;
  laboratoryEmployeeId: number;
  userId?: number;
  employeeId?: number;
  fullName: string;
  laboratoryId: number;
  active?: boolean;
}

export type ProtocolWizardForm = {
  templateId: ProtocolTemplateId | '';
  companyId: string;
  objectId: string;
  customer: string;
  basis: string;
  laboratoryId: string;
  executorId: string;
  defaultMeasurementDeviceId: string;
  protocolDate: string;
  sampleDate: string;
  measurementDate: string;
  testingStartDate: string;
  testingEndDate: string;
  measurementTime: string;
  measurementPlace: string;
  sourceNumber: string;
  temperature: string;
  humidity: string;
  pressure: string;
  windSpeed: string;
  windDirection: string;
  weatherConditions: string;
  environmentSource: 'API' | 'MANUAL';
  environmentDataSource: string;
  environmentObservedAt: string;
  environmentManualChangeReason: string;
  season: string;
  workCategory: string;
  workplaceType: string;
  roomType: string;
  normLevel: string;
  lightingType: string;
  noiseType: string;
  visualWorkCategory: string;
  waterType: string;
  waterUseCategory: string;
  testingMethodNd: string;
  samplingMethodNd: string;
  formCode: string;
  appendixNumber: string;
  applicationNumber: string;
  contractNumber: string;
  note: string;
  orderId: string;
  orderServiceItemId: string;
  pekProgramId: string;
  pekControlItemId: string;
  pekControlEventId: string;
  pekReportId: string;
  monitoringPointId: string;
  emissionSourceId: string;
  waterOutletId: string;
  printVisibility: ProtocolPrintVisibility;
  samplingPoints: ProtocolWizardSamplingPoint[];
  results: ProtocolWizardResult[];
};

const createClientRowId = () =>
  globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const emptyWizardResult = (): ProtocolWizardResult => ({
  clientRowId: createClientRowId(),
  indicatorName: '', pollutantCode: '', factorType: '', factorCode: '', cas: '', formula: '', unit: '', value: '', textValue: '', samplingPlace: '', samplingPointId: '', samplingDate: '', sampleNumber: '', samplingDepth: '', samplingSpeed: '', sampleVolume: '', waterType: '', direction: '', minimumValue: '', maximumValue: '', averageValue: '', duration: '',
  measurementDeviceId: '', normativeId: '', normativeSource: 'NONE', normativeStatus: '', normativeValue: '', normativeValueRaw: '', normativeMin: '', normativeMax: '', comparisonType: 'LESS_OR_EQUAL', normativeDocument: '', manualNormativeReason: '', sourceDocumentCode: '', testingMethodNd: '', samplingMethodNd: '',
  methodName: '', methodDocument: '', note: '',
});

export const createWizardSamplingPoint = (name = ''): ProtocolWizardSamplingPoint => ({
  clientPointId: globalThis.crypto?.randomUUID?.() || `point-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  name,
  description: '',
  latitude: '',
  longitude: '',
  sortOrder: 0,
});

export const createDefaultAmbientSamplingPoints = (): ProtocolWizardSamplingPoint[] =>
  ['Север', 'Юг', 'Восток', 'Запад'].map((name, sortOrder) => ({ ...createWizardSamplingPoint(name), sortOrder }));

export const createWizardDefaults = (): ProtocolWizardForm => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    templateId: '', companyId: '', objectId: '', customer: '', basis: '', laboratoryId: '', executorId: '', defaultMeasurementDeviceId: '', protocolDate: date,
    sampleDate: date, measurementDate: date, testingStartDate: date, testingEndDate: date, measurementTime: '12:00', measurementPlace: '', sourceNumber: '',
    temperature: '', humidity: '', pressure: '', windSpeed: '', windDirection: '', weatherConditions: '',
    environmentSource: 'MANUAL', environmentDataSource: '', environmentObservedAt: '', environmentManualChangeReason: '',
    season: '', workCategory: '', workplaceType: '', roomType: '', normLevel: '', lightingType: '', noiseType: '', visualWorkCategory: '', waterType: '', waterUseCategory: '',
    testingMethodNd: '', samplingMethodNd: '', formCode: '', appendixNumber: '', applicationNumber: '', contractNumber: '', note: '',
    orderId: '', orderServiceItemId: '', pekProgramId: '', pekControlItemId: '', pekControlEventId: '', pekReportId: '',
    monitoringPointId: '', emissionSourceId: '', waterOutletId: '', printVisibility: { ...DEFAULT_PROTOCOL_PRINT_VISIBILITY }, samplingPoints: [], results: [],
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

const normalizeStringDefaults = <T extends Record<string, unknown>>(
  defaults: T,
  source: Record<string, unknown>,
) => Object.fromEntries(
  Object.entries(defaults)
    .filter(([, defaultValue]) => typeof defaultValue === 'string')
    .map(([key, defaultValue]) => [
      key,
      typeof source[key] === 'string' ? source[key] : defaultValue,
    ]),
);

/**
 * Migrates incomplete session drafts and route prefills to the current form shape.
 * Missing/null scalar fields must never reach inputs or validation as undefined.
 */
export const normalizeProtocolWizardForm = (value?: unknown): ProtocolWizardForm => {
  const defaults = createWizardDefaults();
  const source = asRecord(value);
  const sourceRows = Array.isArray(source.results) ? source.results : [];
  const sourcePoints = Array.isArray(source.samplingPoints) ? source.samplingPoints : [];
  const results = sourceRows.map((row) => {
    const rowDefaults = emptyWizardResult();
    const rowSource = asRecord(row);
    const legacyNormativeId = rowSource.normativeRecordId;
    const normativeId = typeof rowSource.normativeId === 'string'
      ? rowSource.normativeId
      : typeof legacyNormativeId === 'string'
        ? legacyNormativeId
        : '';
    return {
      ...rowDefaults,
      ...rowSource,
      ...normalizeStringDefaults(rowDefaults, rowSource),
      normativeId,
      normativeSource: rowSource.normativeSource === 'MANUAL'
        ? 'MANUAL'
        : normativeId
          ? 'DIRECTORY'
          : 'NONE',
    };
  }) as ProtocolWizardResult[];

  return {
    ...defaults,
    ...source,
    ...normalizeStringDefaults(defaults, source),
    printVisibility: {
      ...defaults.printVisibility,
      ...asRecord(source.printVisibility),
    },
    samplingPoints: sourcePoints.map((point, index) => {
      const item = asRecord(point);
      return {
        ...createWizardSamplingPoint(),
        ...item,
        clientPointId: String(item.clientPointId || item.serverPointId || item.id || createWizardSamplingPoint().clientPointId),
        serverPointId: item.serverPointId == null && item.id == null ? undefined : String(item.serverPointId ?? item.id),
        name: typeof item.name === 'string' ? item.name : '',
        description: typeof item.description === 'string' ? item.description : '',
        latitude: item.latitude == null ? '' : String(item.latitude),
        longitude: item.longitude == null ? '' : String(item.longitude),
        sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
      };
    }).sort((left, right) => left.sortOrder - right.sortOrder),
    results,
  } as ProtocolWizardForm;
};

export const CHEMICAL_TYPES = new Set<ProtocolTemplateId>(['ambient_air', 'workplace_air', 'soil', 'water']);
