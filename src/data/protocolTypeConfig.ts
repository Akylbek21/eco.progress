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
  environmentType?: string;
  category?: string;
  resultMode: ProtocolResultMode;
};

export type NormativeSearchContext = {
  sourceDocumentCode?: string;
  templateId?: ProtocolTemplateId;
  normativeTemplateId?: ProtocolTemplateId;
  category?: string;
  factorType?: ProtocolSubtype | string;
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
    sourceDocumentCode: 'DSM_138',
    docxTemplateCode: 'protocol_water',
    defaultUnit: 'мг/л',
    normativeTemplateId: 'water',
    environmentType: 'WATER',
    resultMode: 'CHEMICAL',
  },
  microclimate: {
    title: 'Микроклимат',
    templateId: 'microclimate',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_microclimate',
    defaultUnit: null,
    normativeTemplateId: 'microclimate',
    resultMode: 'PHYSICAL',
  },
  lighting: {
    title: 'Освещенность',
    templateId: 'lighting',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_lighting',
    defaultUnit: 'лк',
    normativeTemplateId: 'lighting',
    resultMode: 'PHYSICAL',
  },
  noise_vibration: {
    title: 'Шум / вибрация',
    templateId: 'noise_vibration',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_noise_vibration',
    defaultUnit: 'дБА',
    normativeTemplateId: 'noise_vibration',
    resultMode: 'PHYSICAL',
  },
  uv_emf_laser: {
    title: 'УФ / ЭМП / Лазер',
    templateId: 'uv_emf_laser',
    sourceDocumentCode: 'DSM_15',
    docxTemplateCode: 'protocol_physical_factors',
    defaultUnit: null,
    normativeTemplateId: 'uv_emf_laser',
    resultMode: 'PHYSICAL',
  },
};

export const SUPPORTED_PROTOCOL_TYPE_KEYS: ProtocolTypeKey[] = [
  'ambient_air',
  'workplace_air',
  'soil',
  'water',
  'microclimate',
  'lighting',
  'noise_vibration',
  'uv_emf_laser',
];

export const PROTOCOL_TYPE_OPTIONS = SUPPORTED_PROTOCOL_TYPE_KEYS.map((key) => ({
  key,
  title: PROTOCOL_TYPE_CONFIG[key].title,
}));

export const protocolFactorType: Partial<Record<ProtocolTypeKey, ProtocolSubtype>> = {
  microclimate: 'MICROCLIMATE',
  lighting: 'LIGHTING',
  noise_vibration: 'NOISE_VIBRATION',
  uv_emf_laser: 'UV',
};

const subtypeContextKey: Partial<Record<ProtocolSubtype, ProtocolTypeKey>> = {
  MICROCLIMATE: 'microclimate',
  LIGHTING: 'lighting',
  NOISE: 'noise_vibration',
  VIBRATION: 'noise_vibration',
  NOISE_VIBRATION: 'noise_vibration',
  INFRASOUND: 'noise_vibration',
  ULTRASOUND: 'noise_vibration',
  UV: 'uv_emf_laser',
  ELECTROMAGNETIC_FIELD: 'uv_emf_laser',
  LASER: 'uv_emf_laser',
};

export const resolveNormativeSearchContext = (
  protocol: Partial<{
    templateId: ProtocolTemplateId | string;
    protocolType: string;
    type: string;
    subtype: ProtocolSubtype | string;
    physicalFactorType: ProtocolSubtype | string;
    sourceDocumentCode: string;
    normativeTemplateId: ProtocolTemplateId | string;
    category: string;
  }> = {},
  protocolType?: string,
): NormativeSearchContext => {
  const subtype = String(protocol.subtype || protocol.physicalFactorType || '').toUpperCase() as ProtocolSubtype;
  const rawType = String(protocol.templateId || protocol.protocolType || protocol.type || protocolType || '').toLowerCase();
  const normalizedType = rawType === 'physical_factors' && subtypeContextKey[subtype]
    ? subtypeContextKey[subtype]
    : rawType;
  const config = PROTOCOL_TYPE_CONFIG[normalizedType as ProtocolTypeKey];

  if (config) {
    return {
      sourceDocumentCode: config.sourceDocumentCode || undefined,
      templateId: config.normativeTemplateId || config.templateId,
      normativeTemplateId: config.normativeTemplateId || config.templateId,
      category: config.category,
      factorType: protocolFactorType[normalizedType as ProtocolTypeKey] || subtype || undefined,
    };
  }

  if (rawType === 'industrial_emissions') {
    return { sourceDocumentCode: 'DSM_70', templateId: 'ambient_air', normativeTemplateId: 'ambient_air' };
  }
  if (rawType === 'water_wastewater') {
    return { sourceDocumentCode: 'DSM_138', templateId: 'water', normativeTemplateId: 'water' };
  }

  return {
    sourceDocumentCode: protocol.sourceDocumentCode || undefined,
    templateId: protocol.templateId as ProtocolTemplateId | undefined,
    normativeTemplateId: protocol.normativeTemplateId as ProtocolTemplateId | undefined,
    category: protocol.category || undefined,
    factorType: subtype || undefined,
  };
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
