import type { NormativeSearchParams } from '../types/normativeSearch';

export const PROTOCOL_NORMATIVE_CONTEXT = {
  ambient_air: { templateId: 'ambient_air', sourceDocumentCode: 'DSM_70', environmentType: 'ATMOSPHERIC_AIR' },
  workplace_air: { templateId: 'workplace_air', sourceDocumentCode: 'DSM_70', environmentType: 'WORKPLACE_AIR' },
  soil: { templateId: 'soil', sourceDocumentCode: 'DSM_32' },
  water: { templateId: 'water', sourceDocumentCode: 'DSM_138' },
  microclimate: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'MICROCLIMATE' },
  lighting: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'LIGHTING' },
  noise: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'NOISE' },
  vibration: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'VIBRATION' },
  noise_vibration: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15' },
  infrasound: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'INFRASOUND' },
  ultrasound: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'ULTRASOUND' },
  uv: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'UV' },
  aeroions: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'AEROIONS' },
  electromagnetic_field: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'ELECTROMAGNETIC_FIELD' },
  laser: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15', factorType: 'LASER' },
  uv_emf_laser: { templateId: 'physical_factors', sourceDocumentCode: 'DSM_15' },
} as const satisfies Record<string, Partial<NormativeSearchParams>>;

export type ProtocolNormativeContextKey = keyof typeof PROTOCOL_NORMATIVE_CONTEXT;

const aliases: Record<string, ProtocolNormativeContextKey> = {
  atmospheric_air: 'ambient_air',
  industrial_emissions: 'ambient_air',
  workplace: 'workplace_air',
  water_wastewater: 'water',
  emf: 'electromagnetic_field',
  electromagneticfield: 'electromagnetic_field',
};

export const resolveProtocolNormativeContext = (
  protocolType?: string,
  factorType?: string,
): Partial<NormativeSearchParams> => {
  const normalizedFactor = String(factorType || '').trim().toLowerCase();
  const factorKey = aliases[normalizedFactor] || normalizedFactor;
  if (factorKey in PROTOCOL_NORMATIVE_CONTEXT) {
    return PROTOCOL_NORMATIVE_CONTEXT[factorKey as ProtocolNormativeContextKey];
  }

  const normalizedType = String(protocolType || '').trim().toLowerCase();
  const typeKey = aliases[normalizedType] || normalizedType;
  return typeKey in PROTOCOL_NORMATIVE_CONTEXT
    ? PROTOCOL_NORMATIVE_CONTEXT[typeKey as ProtocolNormativeContextKey]
    : {};
};
