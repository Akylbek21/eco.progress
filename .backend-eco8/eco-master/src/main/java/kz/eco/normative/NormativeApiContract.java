package kz.eco.normative;

import kz.eco.protocol.dto.ProtocolApiDtos;

import java.util.Locale;
import java.util.Set;

/**
 * Stable API contract for normative records exposed to the frontend.
 */
public final class NormativeApiContract {

    public static final String TEMPLATE_AMBIENT_AIR = "ambient_air";
    public static final String TEMPLATE_WORKPLACE_AIR = "workplace_air";
    public static final String TEMPLATE_SOIL = "soil";
    public static final String TEMPLATE_PHYSICAL_FACTORS = "physical_factors";
    public static final String TEMPLATE_WATER_WASTEWATER = "water_wastewater";
    public static final String TEMPLATE_INDUSTRIAL_EMISSIONS = "industrial_emissions";

    public static final Set<String> CANONICAL_TEMPLATE_IDS = Set.of(
            TEMPLATE_AMBIENT_AIR,
            TEMPLATE_WORKPLACE_AIR,
            TEMPLATE_SOIL,
            TEMPLATE_PHYSICAL_FACTORS,
            TEMPLATE_WATER_WASTEWATER,
            TEMPLATE_INDUSTRIAL_EMISSIONS
    );

    public static final Set<String> CANONICAL_SOURCE_CODES = Set.of(
            SourceDocumentCode.DSM_70.name(),
            SourceDocumentCode.DSM_32.name(),
            SourceDocumentCode.DSM_15.name(),
            SourceDocumentCode.DSM_138.name()
    );

    private NormativeApiContract() {
    }

    public static String resolveTemplateId(NormativeRecord record) {
        if (record == null) {
            return null;
        }
        if (record.getTemplateType() == TemplateType.PHYSICAL_FACTORS
                || isPhysicalFactorType(record.getFactorType())) {
            return TEMPLATE_PHYSICAL_FACTORS;
        }
        EnvironmentType environmentType = record.getEnvironmentType();
        TemplateType templateType = record.getTemplateType();

        if (templateType == TemplateType.WORK_ZONE_AIR || environmentType == EnvironmentType.WORK_ZONE_AIR) {
            return TEMPLATE_WORKPLACE_AIR;
        }
        if (templateType == TemplateType.SOIL || environmentType == EnvironmentType.SOIL) {
            return TEMPLATE_SOIL;
        }
        if (templateType == TemplateType.WATER_WASTEWATER || environmentType == EnvironmentType.WATER) {
            return TEMPLATE_WATER_WASTEWATER;
        }
        if (templateType == TemplateType.ATMOSPHERIC_AIR || environmentType == EnvironmentType.ATMOSPHERIC_AIR) {
            return TEMPLATE_AMBIENT_AIR;
        }
        return null;
    }

    public static String resolveSourceDocumentCode(NormativeRecord record) {
        if (record == null) {
            return null;
        }
        if (record.getSourceDocumentCode() != null && !record.getSourceDocumentCode().isBlank()) {
            return record.getSourceDocumentCode().trim().toUpperCase(Locale.ROOT);
        }
        return inferSourceDocumentCode(resolveTemplateId(record));
    }

    public static String inferSourceDocumentCode(String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return null;
        }
        return switch (normalizeTemplateId(templateId)) {
            case TEMPLATE_AMBIENT_AIR, TEMPLATE_WORKPLACE_AIR, TEMPLATE_INDUSTRIAL_EMISSIONS -> SourceDocumentCode.DSM_70.name();
            case TEMPLATE_SOIL -> SourceDocumentCode.DSM_32.name();
            case TEMPLATE_PHYSICAL_FACTORS -> SourceDocumentCode.DSM_15.name();
            case TEMPLATE_WATER_WASTEWATER -> SourceDocumentCode.DSM_138.name();
            default -> null;
        };
    }

    public static String resolveSourceDocumentName(String sourceDocumentCode) {
        SourceDocumentCode code = SourceDocumentCode.fromApi(sourceDocumentCode);
        if (code != null) {
            return code.documentNumber();
        }
        return sourceDocumentCode;
    }

    /**
     * The single canonical templateId normalizer for the whole normative-search stack (search
     * filtering, source-document inference, classification). Every DSM-15 physical-factor
     * synonym must land on TEMPLATE_PHYSICAL_FACTORS here - before uv_emf_laser (and vibration,
     * noise, infrasound, ultrasound, uv, aeroions, electromagnetic_field, laser) were added to
     * this switch, {@link #matchesTemplateFilter} normalized a "uv_emf_laser" search request to
     * the literal string "uv_emf_laser" (falling through to the `default -> normalized` branch
     * unchanged) while every actual UV/EMF/laser record's own templateId normalized to
     * "physical_factors" - the two never matched, so those normatives were silently excluded
     * from every search that asked for them.
     */
    public static String normalizeTemplateId(String templateId) {
        if (templateId == null || templateId.isBlank()) {
            return null;
        }
        String normalized = templateId.trim().toLowerCase(Locale.ROOT).replace('-', '_');
        return switch (normalized) {
            case "ambient_air", "ambient_air_szz", "atmospheric_air" -> TEMPLATE_AMBIENT_AIR;
            case "industrial_emissions" -> TEMPLATE_INDUSTRIAL_EMISSIONS;
            case "work_zone_air", "workplace_air" -> TEMPLATE_WORKPLACE_AIR;
            case "soil" -> TEMPLATE_SOIL;
            case "water", "water_wastewater" -> TEMPLATE_WATER_WASTEWATER;
            case "microclimate", "lighting",
                    "noise", "vibration", "noise_vibration",
                    "infrasound", "ultrasound",
                    "uv", "aeroions", "electromagnetic_field", "laser", "uv_emf_laser",
                    "physical_factors" -> TEMPLATE_PHYSICAL_FACTORS;
            default -> normalized;
        };
    }

    public static boolean matchesTemplateFilter(String recordTemplateId, String requestedTemplateId) {
        if (requestedTemplateId == null || requestedTemplateId.isBlank()) {
            return true;
        }
        String normalizedRequest = normalizeTemplateId(requestedTemplateId);
        String normalizedRecord = normalizeTemplateId(recordTemplateId);
        if (normalizedRequest == null || normalizedRecord == null) {
            return false;
        }
        return normalizedRequest.equals(normalizedRecord);
    }

    /**
     * ACTIVE-vs-REVIEW classification. Required fields:
     * - chemical (any non-physical_factors templateId): indicatorName, unit, templateId,
     *   sourceDocumentCode;
     * - physical (templateId=physical_factors): indicatorName, templateId, sourceDocumentCode,
     *   factorType, unit.
     * factorCode is deliberately NOT required here: not every DSM-15 table row has its own code
     * (many are keyed by factorType + condition columns only), so requiring it unconditionally
     * pushed otherwise-valid physical-factor normatives into REVIEW just because that particular
     * table doesn't assign per-row codes. A record that legitimately needs a factorCode to be
     * unambiguous but doesn't have one will still surface as an ambiguous match at search time
     * (see NormativeDirectoryService/ProtocolNormativeCheckService's multi-candidate handling)
     * rather than being hidden from ACTIVE results altogether.
     */
    public static boolean isClassified(ProtocolApiDtos.NormativeRecord record) {
        if (record == null) {
            return false;
        }
        if (record.templateId() == null || record.templateId().isBlank()
                || !CANONICAL_TEMPLATE_IDS.contains(record.templateId())) {
            return false;
        }
        if (record.sourceDocumentCode() == null || record.sourceDocumentCode().isBlank()
                || !CANONICAL_SOURCE_CODES.contains(record.sourceDocumentCode().trim().toUpperCase(Locale.ROOT))) {
            return false;
        }
        if (record.indicator() == null || record.indicator().isBlank()) {
            return false;
        }
        if (record.unit() == null || record.unit().isBlank()) {
            return false;
        }
        if (TEMPLATE_PHYSICAL_FACTORS.equals(record.templateId())) {
            return record.factorType() != null && !record.factorType().isBlank();
        }
        return true;
    }

    public static boolean isReviewRecord(ProtocolApiDtos.NormativeRecord record) {
        return record != null && !isClassified(record);
    }

    public static boolean matchesStatus(ProtocolApiDtos.NormativeRecord record, String status) {
        if (record == null) {
            return false;
        }
        String normalized = status != null ? status.trim().toUpperCase(Locale.ROOT) : "ACTIVE";
        return switch (normalized) {
            case "ALL" -> true;
            case "ARCHIVED" -> Boolean.TRUE.equals(record.archived()) || !record.active();
            case "REVIEW" -> isReviewRecord(record);
            case "ACTIVE" -> record.active() && !Boolean.TRUE.equals(record.archived()) && isClassified(record);
            default -> record.active() && !Boolean.TRUE.equals(record.archived()) && isClassified(record);
        };
    }

    private static boolean isPhysicalFactorType(String factorType) {
        return FactorType.isValid(factorType);
    }
}
