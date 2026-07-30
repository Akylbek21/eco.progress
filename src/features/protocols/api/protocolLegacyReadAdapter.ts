/**
 * Temporary read-only adapter for protocol records created by the pre-OpenAPI backend.
 *
 * Removal date: 2026-10-30.
 * Remove this file after Spring Boot returns only canonical template and permission names.
 * Never use these mappings for request payloads or query parameters.
 */

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;

const physicalFactorTemplate = (subtype: unknown) => {
  const value = String(subtype || '').trim().toUpperCase();
  if (value === 'MICROCLIMATE') return 'microclimate';
  if (value === 'LIGHTING') return 'lighting';
  if (['UV', 'AEROIONS', 'ELECTROMAGNETIC_FIELD', 'LASER'].includes(value)) return 'uv_emf_laser';
  if (['NOISE', 'VIBRATION', 'NOISE_VIBRATION', 'INFRASOUND', 'ULTRASOUND'].includes(value)) {
    return 'noise_vibration';
  }
  // Unknown physical-factor groups remain unsupported and fail in the strict mapper.
  return 'physical_factors';
};

export const adaptLegacyProtocolTemplateId = (templateId: unknown, subtype?: unknown) => {
  const value = String(templateId || '').trim().toLowerCase();
  if (value === 'ambient_air_szz' || value === 'industrial_emissions') return 'ambient_air';
  if (value === 'water_wastewater') return 'water';
  if (value === 'physical_factors') return physicalFactorTemplate(subtype);
  return value;
};

const adaptLegacyPermissions = (value: unknown): UnknownRecord | undefined => {
  const permissions = asRecord(value);
  if (!permissions) return undefined;

  return {
    ...permissions,
    // These aliases are present in the captured production response dated 2026-07-30.
    canReadyForApproval: permissions.canReadyForApproval ?? permissions.canSendToApproval,
    canReplace: permissions.canReplace ?? permissions.canCreateCorrection,
  };
};

export const adaptLegacyProtocolReadPayload = (value: unknown): unknown => {
  const source = asRecord(value);
  if (!source) return value;

  return {
    ...source,
    templateId: adaptLegacyProtocolTemplateId(
      source.templateId ?? source.templateCode ?? source.template_id,
      source.subtype ?? source.physicalFactorType,
    ),
    ...(source.permissions === undefined
      ? {}
      : { permissions: adaptLegacyPermissions(source.permissions) }),
  };
};
