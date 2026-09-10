package kz.eco.normative;

import java.util.List;
import java.util.Locale;

/**
 * Thin TemplateType-flavoured view over the single canonical templateId normalizer,
 * {@link NormativeApiContract#normalizeTemplateId}. Before this existed,
 * ProtocolTemplateMapper.toTemplateType, NormativeDirectoryService.resolveTemplateType, and
 * ProtocolNormativeCheckService.mapTemplateCode each carried their own copy of the same
 * templateId-synonym switch, and none of them recognised most of the physical-factor synonyms
 * (vibration, noise, infrasound, ultrasound, uv, aeroions, electromagnetic_field, laser,
 * uv_emf_laser) - they'd fall through to null and silently stop filtering by template, which is
 * how normatives "went missing" from search. All three now delegate here.
 */
public final class ProtocolTemplateMapper {

    private ProtocolTemplateMapper() {
    }

    /** @deprecated delegates to {@link NormativeApiContract#normalizeTemplateId} - call that
     * directly in new code; kept only so existing callers don't need to change their import. */
    @Deprecated
    public static String normalizeTemplateId(String templateId) {
        return NormativeApiContract.normalizeTemplateId(templateId);
    }

    public static TemplateType toTemplateType(String templateId) {
        String canonical = NormativeApiContract.normalizeTemplateId(templateId);
        if (canonical == null) {
            return null;
        }
        return switch (canonical) {
            case NormativeApiContract.TEMPLATE_AMBIENT_AIR, NormativeApiContract.TEMPLATE_INDUSTRIAL_EMISSIONS ->
                    TemplateType.ATMOSPHERIC_AIR;
            case NormativeApiContract.TEMPLATE_WORKPLACE_AIR -> TemplateType.WORK_ZONE_AIR;
            case NormativeApiContract.TEMPLATE_SOIL -> TemplateType.SOIL;
            case NormativeApiContract.TEMPLATE_WATER_WASTEWATER -> TemplateType.WATER_WASTEWATER;
            case NormativeApiContract.TEMPLATE_PHYSICAL_FACTORS -> TemplateType.PHYSICAL_FACTORS;
            default -> null;
        };
    }

    /**
     * factorType synonym -> canonical DSM-15 factorType code. Used when templateId=uv_emf_laser
     * (or any physical-factor synonym) is searched without an explicit factorType: the caller
     * widens the search to every factorType this synonym could plausibly mean instead of picking
     * one arbitrarily. See NormativeDirectoryService for how this is applied.
     */
    public static String normalizeFactorType(String factorType) {
        if (factorType == null || factorType.isBlank()) {
            return null;
        }
        String normalized = factorType.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (normalized) {
            case "microclimate" -> "MICROCLIMATE";
            case "lighting" -> "LIGHTING";
            case "noise" -> "NOISE";
            case "vibration" -> "VIBRATION";
            case "noise_vibration" -> "NOISE_VIBRATION";
            case "infrasound" -> "INFRASOUND";
            case "ultrasound" -> "ULTRASOUND";
            case "uv" -> "UV";
            case "aeroions" -> "AEROIONS";
            case "electromagnetic_field" -> "ELECTROMAGNETIC_FIELD";
            case "laser" -> "LASER";
            default -> factorType.trim().toUpperCase(Locale.ROOT);
        };
    }

    /** templateId=uv_emf_laser with no explicit factorType must search UV + ELECTROMAGNETIC_FIELD
     * + LASER together, never just one of them and never all of DSM_15. */
    public static List<String> factorTypesForTemplateSynonym(String templateId) {
        if (templateId == null) {
            return List.of();
        }
        String normalized = templateId.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (normalized) {
            case "uv_emf_laser" -> List.of("UV", "ELECTROMAGNETIC_FIELD", "LASER");
            case "noise_vibration" -> List.of("NOISE", "VIBRATION", "NOISE_VIBRATION");
            default -> List.of();
        };
    }
}
