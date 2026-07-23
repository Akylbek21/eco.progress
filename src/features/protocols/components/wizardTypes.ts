import type { ProtocolTemplateId } from '../../../types/protocols';

export type ProtocolWizardResult = {
  indicatorName: string;
  pollutantCode: string;
  factorType: string;
  cas: string;
  formula: string;
  unit: string;
  value: string;
  samplingPlace: string;
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
  normativeValue: string;
  normativeMin: string;
  normativeMax: string;
  comparisonType: string;
  normativeDocument: string;
  sourceDocumentCode: string;
  testingMethodNd: string;
};

export type ProtocolWizardForm = {
  templateId: ProtocolTemplateId | '';
  companyId: string;
  objectId: string;
  customer: string;
  basis: string;
  laboratoryId: string;
  executorId: string;
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
  testingMethodNd: string;
  formCode: string;
  appendixNumber: string;
  applicationNumber: string;
  contractNumber: string;
  note: string;
  orderId: string;
  orderServiceItemId: string;
  results: ProtocolWizardResult[];
};

export const emptyWizardResult = (): ProtocolWizardResult => ({
  indicatorName: '', pollutantCode: '', factorType: '', cas: '', formula: '', unit: '', value: '', samplingPlace: '', sampleNumber: '', samplingDepth: '', samplingSpeed: '', sampleVolume: '', waterType: '', direction: '', minimumValue: '', maximumValue: '', averageValue: '', duration: '',
  measurementDeviceId: '', normativeId: '', normativeValue: '', normativeMin: '', normativeMax: '', comparisonType: 'LESS_OR_EQUAL', normativeDocument: '', sourceDocumentCode: '', testingMethodNd: '',
});

export const createWizardDefaults = (): ProtocolWizardForm => {
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    templateId: '', companyId: '', objectId: '', customer: '', basis: '', laboratoryId: '', executorId: '', protocolDate: date,
    sampleDate: date, measurementDate: date, testingStartDate: date, testingEndDate: date, measurementTime: '12:00', measurementPlace: '', sourceNumber: '',
    temperature: '', humidity: '', pressure: '', windSpeed: '', windDirection: '', weatherConditions: '',
    environmentSource: 'MANUAL', environmentDataSource: '', environmentObservedAt: '', environmentManualChangeReason: '',
    season: '', workCategory: '',
    testingMethodNd: '', formCode: '', appendixNumber: '', applicationNumber: '', contractNumber: '', note: '',
    orderId: '', orderServiceItemId: '', results: [emptyWizardResult()],
  };
};

export const CHEMICAL_TYPES = new Set<ProtocolTemplateId>(['ambient_air', 'workplace_air', 'soil', 'water_wastewater']);
