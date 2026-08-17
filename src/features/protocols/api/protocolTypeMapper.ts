import type { ProtocolTemplateId } from '../../../types/protocols';

export type FrontendProtocolType = ProtocolTemplateId;

const supportedTypes = new Set<FrontendProtocolType>([
  'ambient_air',
  'workplace_air',
  'soil',
  'water',
  'microclimate',
  'lighting',
  'noise_vibration',
  'uv_emf_laser',
]);

const backendAliases: Record<string, FrontendProtocolType> = {
  ambient_air_szz: 'ambient_air',
};

export const mapBackendProtocolType = (value: string): FrontendProtocolType => {
  const normalized = String(value || '').trim().toLowerCase();
  if (backendAliases[normalized]) return backendAliases[normalized];
  if (!supportedTypes.has(normalized as FrontendProtocolType)) {
    throw new Error(`Backend вернул неизвестный тип протокола: ${value || 'пустое значение'}`);
  }
  return normalized as FrontendProtocolType;
};

export const mapFrontendProtocolType = (value: FrontendProtocolType): string => value;
