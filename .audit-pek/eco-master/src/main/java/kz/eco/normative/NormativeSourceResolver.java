package kz.eco.normative;

import kz.eco.protocol.ProtocolTemplateCode;

import java.util.Locale;

/**
 * Maps protocol template identifiers to normative source documents (ДСМ-32/70/15).
 */
public final class NormativeSourceResolver {

    private NormativeSourceResolver() {
    }

    public record ResolvedSource(
            SourceDocumentCode sourceDocumentCode,
            TemplateType templateType,
            EnvironmentType environmentType
    ) {
    }

    public static ResolvedSource resolve(String templateId, String environmentType) {
        String normalized = normalize(templateId);
        TemplateType templateType = NormativeDirectoryService.resolveTemplateType(null, templateId);
        EnvironmentType env = resolveEnvironmentType(normalized, environmentType, templateType);

        SourceDocumentCode source = switch (normalized) {
            case "ambient_air_szz", "ambient_air", "atmospheric_air", "industrial_emissions" -> SourceDocumentCode.DSM_70;
            case "work_zone_air", "workplace_air" -> SourceDocumentCode.DSM_70;
            case "soil" -> SourceDocumentCode.DSM_32;
            case "physical_factors", "microclimate", "lighting", "noise_vibration" -> SourceDocumentCode.DSM_15;
            default -> {
                ProtocolTemplateCode code = ProtocolTemplateCode.fromApi(normalized);
                if (code != null) {
                    yield switch (code) {
                        case AMBIENT_AIR_SZZ, INDUSTRIAL_EMISSIONS, WORKPLACE_AIR -> SourceDocumentCode.DSM_70;
                        case SOIL -> SourceDocumentCode.DSM_32;
                        case MICROCLIMATE, LIGHTING, NOISE_VIBRATION, UV_EMF_LASER -> SourceDocumentCode.DSM_15;
                        case WATER_WASTEWATER -> SourceDocumentCode.DSM_138;
                    };
                }
                if (templateType == TemplateType.SOIL) {
                    yield SourceDocumentCode.DSM_32;
                }
                if (templateType == TemplateType.PHYSICAL_FACTORS) {
                    yield SourceDocumentCode.DSM_15;
                }
                if (templateType == TemplateType.ATMOSPHERIC_AIR || templateType == TemplateType.WORK_ZONE_AIR) {
                    yield SourceDocumentCode.DSM_70;
                }
                yield null;
            }
        };

        if (source == SourceDocumentCode.DSM_70 && env == null && isWorkZoneTemplate(normalized)) {
            env = EnvironmentType.WORK_ZONE_AIR;
        }
        if (source == SourceDocumentCode.DSM_70 && env == null) {
            env = EnvironmentType.ATMOSPHERIC_AIR;
        }
        if (source == SourceDocumentCode.DSM_32 && env == null) {
            env = EnvironmentType.SOIL;
        }
        if (source == SourceDocumentCode.DSM_138 && env == null) {
            env = EnvironmentType.WATER;
        }

        return new ResolvedSource(source, templateType, env);
    }

    public static EnvironmentType resolveEnvironmentType(String normalizedTemplateId,
                                                         String environmentType,
                                                         TemplateType templateType) {
        if (environmentType != null && !environmentType.isBlank()) {
            try {
                return EnvironmentType.valueOf(environmentType.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ignored) {
            }
        }
        if (isWorkZoneTemplate(normalizedTemplateId) || templateType == TemplateType.WORK_ZONE_AIR) {
            return EnvironmentType.WORK_ZONE_AIR;
        }
        if (templateType == TemplateType.SOIL) {
            return EnvironmentType.SOIL;
        }
        if (templateType == TemplateType.ATMOSPHERIC_AIR) {
            return EnvironmentType.ATMOSPHERIC_AIR;
        }
        return null;
    }

    private static boolean isWorkZoneTemplate(String normalized) {
        return "work_zone_air".equals(normalized) || "workplace_air".equals(normalized);
    }

    private static String normalize(String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return "";
        }
        return templateId.trim().toLowerCase(Locale.ROOT).replace('-', '_');
    }
}
