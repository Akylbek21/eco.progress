import type { ProtocolTemplateId } from '../../../types/protocols';

export type FrontendProtocolType = ProtocolTemplateId;

const supportedTypes = new Set<FrontendProtocolType>([
  'ambient_air',
  'workplace_air',
  'soil',
  'water_wastewater',
  'microclimate',
  'lighting',
  'noise_vibration',
  'uv_emf_laser',
]);

export const mapBackendProtocolType = (value: string): FrontendProtocolType => {
  const normalized = String(value || '').trim().toLowerCase();
  const frontendValue = normalized === 'water' ? 'water_wastewater' : normalized;
  if (!supportedTypes.has(frontendValue as FrontendProtocolType)) {
    throw new Error(`Backend вернул неизвестный тип протокола: ${value || 'пустое значение'}`);
  }
  return frontendValue as FrontendProtocolType;
};

export const mapFrontendProtocolType = (value: FrontendProtocolType): string =>
  value === 'water_wastewater' ? 'water' : value;

export const tryMapBackendProtocolType = (value: unknown): FrontendProtocolType | undefined => {
  try {
    return mapBackendProtocolType(String(value || ''));
  } catch {
    return undefined;
  }
};
