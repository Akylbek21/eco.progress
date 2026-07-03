import { PHYSICAL_FACTOR_UNITS } from './physicalFactors';
import type { NormativeRecord, Pollutant, ProtocolSubtype, ProtocolTemplateId } from '../types/protocols';

export type ProtocolResultMode = 'CHEMICAL' | 'PHYSICAL';
export type ProtocolTypeKey =
  | 'ambient_air'
  | 'workplace_air'
  | 'soil'
  | 'water'
  | 'microclimate'
  | 'lighting'
  | 'noise_vibration'
  | 'uv_emf_laser';

export type ProtocolTypeConfig = {
  title: string;
  templateId: ProtocolTemplateId;
  sourceDocumentCode: string | null;
  docxTemplateCode: string;
  defaultUnit: string | null;
  normativeTemplateId: ProtocolTemplateId;
  resultMode: ProtocolResultMode;
};

export const PROTOCOL_TYPE_CONFIG: Record<ProtocolTypeKey, ProtocolTypeConfig> = {
  ambient_air: {
    title: 'Атмосферный воздух',
    templateId: 'ambient_air',
    sourceDocumentCode: 'DSM_70',
    docxTemplateCode: 'protocol_ambient_air',
    defaultUnit: 'мг/м³',
    normativeTemplateId: 'ambient_air',
    resultMode: 'CHEMICAL',
  },
  workplace_air: {
    title: 'Воздух рабочей зоны',
    templateId: 'workplace_air',
    sourceDocumentCode: 'DSM_70',
    docxTemplateCode: 'protocol_workplace_air',
    defaultUnit: 'мг/м³',
    normativeTemplateId: 'workplace_air',
    resultMode: 'CHEMICAL',
  },
  soil: {
    title: 'Почва',
    templateId: 'soil',
    sourceDocumentCode: 'DSM_32',
    docxTemplateCode: 'protocol_soil',
    defaultUnit: 'мг/кг',
    normativeTemplateId: 'soil',
    resultMode: 'CHEMICAL',
  },
  water: {
    title: 'Вода',
    templateId: 'water',
    sourceDocumentCode: null,
    docxTemplateCode: 'protocol_water',
    defaultUnit: 'мг/дм³',
    normativeTemplateId: 'water_wastewater',
    resultMode: 'CHEMICAL',
  },
  microclimate: {
    title: 'Микроклимат',
    templateId: 'physical_factors',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_microclimate',
    defaultUnit: null,
    normativeTemplateId: 'physical_factors',
    resultMode: 'PHYSICAL',
  },
  lighting: {
    title: 'Освещенность',
    templateId: 'physical_factors',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_lighting',
    defaultUnit: 'лк',
    normativeTemplateId: 'physical_factors',
    resultMode: 'PHYSICAL',
  },
  noise_vibration: {
    title: 'Шум / вибрация',
    templateId: 'physical_factors',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_noise_vibration',
    defaultUnit: null,
    normativeTemplateId: 'physical_factors',
    resultMode: 'PHYSICAL',
  },
  uv_emf_laser: {
    title: 'УФ / ЭМП / Лазер',
    templateId: 'physical_factors',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_physical_factors',
    defaultUnit: null,
    normativeTemplateId: 'physical_factors',
    resultMode: 'PHYSICAL',
  },
};

export const PROTOCOL_TYPE_OPTIONS = Object.entries(PROTOCOL_TYPE_CONFIG).map(([key, config]) => ({
  key: key as ProtocolTypeKey,
  title: config.title,
}));

export const protocolFactorType: Partial<Record<ProtocolTypeKey, ProtocolSubtype>> = {
  microclimate: 'MICROCLIMATE',
  lighting: 'LIGHTING',
  noise_vibration: 'NOISE_VIBRATION',
  uv_emf_laser: 'UV',
};

export const isChemicalProtocolType = (config: ProtocolTypeConfig) => config.resultMode === 'CHEMICAL';
export const isPhysicalProtocolType = (config: ProtocolTypeConfig) => config.resultMode === 'PHYSICAL';

export const resolveProtocolUnit = (
  type: ProtocolTypeKey,
  item: Partial<Pollutant & NormativeRecord & { measurementUnit?: string; units?: string }> = {},
) => {
  if (item.unit) return item.unit;
  if (item.measurementUnit) return item.measurementUnit;
  if (item.units) return item.units;

  const config = PROTOCOL_TYPE_CONFIG[type];
  if (config.defaultUnit) return config.defaultUnit;

  const factorCode = item.factorCode || item.code || '';
  if (PHYSICAL_FACTOR_UNITS[factorCode]) return PHYSICAL_FACTOR_UNITS[factorCode];
  if (factorCode === 'NOISE') return 'дБА';
  if (factorCode === 'VIBRATION') return 'дБ';

  return '';
};
