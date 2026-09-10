package kz.eco.normative;

import kz.eco.protocol.ComparisonType;

import java.util.Map;

public record FileTypeMapping(
        EnvironmentType environmentType,
        TemplateType templateType,
        ImportNormativeType normativeType,
        ComparisonType comparisonType,
        boolean isSummationGroup,
        boolean isCodeGroup
) {
    public String sourceDocumentCode() {
        if (isSummationGroup || isCodeGroup || templateType == null) {
            return null;
        }
        return switch (templateType) {
            case SOIL -> SourceDocumentCode.DSM_32.name();
            case ATMOSPHERIC_AIR, WORK_ZONE_AIR -> SourceDocumentCode.DSM_70.name();
            case PHYSICAL_FACTORS -> SourceDocumentCode.DSM_15.name();
            case WATER_WASTEWATER -> SourceDocumentCode.DSM_138.name();
            default -> null;
        };
    }

    public String sourceDocumentName() {
        SourceDocumentCode code = SourceDocumentCode.fromApi(sourceDocumentCode());
        return code != null ? code.documentName() : null;
    }

    private static final Map<String, FileTypeMapping> MAPPINGS = Map.ofEntries(
            Map.entry("UDMH_acceptable_daily_intake_ADI",
                    new FileTypeMapping(EnvironmentType.SPECIAL, TemplateType.UDMH_SPECIAL, ImportNormativeType.ADI, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("UDMH_exposure_concentrations_1_4_8_24h",
                    new FileTypeMapping(EnvironmentType.SPECIAL, TemplateType.UDMH_SPECIAL, ImportNormativeType.EXPOSURE_LIMIT, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("UDMH_exposure_concentrations_5_480min",
                    new FileTypeMapping(EnvironmentType.SPECIAL, TemplateType.UDMH_SPECIAL, ImportNormativeType.EXPOSURE_LIMIT, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("UDMH_permissible_levels_in_food_products",
                    new FileTypeMapping(EnvironmentType.FOOD, TemplateType.FOOD_PRODUCTS, ImportNormativeType.PDU, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("UDMH_permissible_surface_levels_mg_cm2",
                    new FileTypeMapping(EnvironmentType.SURFACE, TemplateType.SURFACE_CONTAMINATION, ImportNormativeType.PDU, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_soil_UDMH_and_rocket_fuel_components",
                    new FileTypeMapping(EnvironmentType.SOIL, TemplateType.SOIL, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_water_UDMH_and_rocket_fuel_components",
                    new FileTypeMapping(EnvironmentType.WATER, TemplateType.WATER_WASTEWATER, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_atmospheric_air_UDMH_and_rocket_fuel_components",
                    new FileTypeMapping(EnvironmentType.ATMOSPHERIC_AIR, TemplateType.ATMOSPHERIC_AIR, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_work_zone_air_UDMH_and_rocket_fuel_components",
                    new FileTypeMapping(EnvironmentType.WORK_ZONE_AIR, TemplateType.WORK_ZONE_AIR, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("OEL_work_zone_air_general_reference",
                    new FileTypeMapping(EnvironmentType.WORK_ZONE_AIR, TemplateType.WORK_ZONE_AIR, ImportNormativeType.OBUV, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_work_zone_air_general_reference",
                    new FileTypeMapping(EnvironmentType.WORK_ZONE_AIR, TemplateType.WORK_ZONE_AIR, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("Pollutant_summation_groups",
                    new FileTypeMapping(null, null, ImportNormativeType.SUMMATION_GROUP, null, true, false)),
            Map.entry("Pollutant_code_groups_classifier",
                    new FileTypeMapping(null, null, ImportNormativeType.CODE_GROUP, null, false, true)),
            Map.entry("OEL_atmospheric_air_with_pollutant_codes",
                    new FileTypeMapping(EnvironmentType.ATMOSPHERIC_AIR, TemplateType.ATMOSPHERIC_AIR, ImportNormativeType.OBUV, ComparisonType.LESS_OR_EQUAL, false, false)),
            Map.entry("MPC_atmospheric_air_with_pollutant_codes",
                    new FileTypeMapping(EnvironmentType.ATMOSPHERIC_AIR, TemplateType.ATMOSPHERIC_AIR, ImportNormativeType.PDK, ComparisonType.LESS_OR_EQUAL, false, false))
    );

    public static FileTypeMapping resolve(String fileName) {
        String key = resolveKey(fileName);
        return key != null ? MAPPINGS.get(key) : null;
    }

    /**
     * Returns the MAPPINGS key matched for this file name, so callers (parsers) can
     * apply file-specific logic beyond the generic FileTypeMapping fields.
     */
    public static String resolveKey(String fileName) {
        if (fileName == null) {
            return null;
        }
        String baseName = fileName;
        if (baseName.contains(".")) {
            baseName = baseName.substring(0, baseName.indexOf('.'));
        }
        if (MAPPINGS.containsKey(baseName)) {
            return baseName;
        }
        for (String key : MAPPINGS.keySet()) {
            if (baseName.contains(key) || fileName.contains(key)) {
                return key;
            }
        }
        return null;
    }

    /**
     * Applies manifest-declared templateType/environmentType (authoritative when present)
     * on top of the filename-resolved mapping, instead of trusting filename guessing alone.
     */
    public static FileTypeMapping withManifestOverrides(FileTypeMapping base, NormativeManifestEntry entry) {
        if (base == null || entry == null) {
            return base;
        }
        TemplateType templateType = base.templateType();
        EnvironmentType environmentType = base.environmentType();
        if (entry.templateType() != null && !entry.templateType().isBlank()) {
            try {
                templateType = TemplateType.valueOf(entry.templateType().trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // keep filename-resolved value
            }
        }
        if (entry.environmentType() != null && !entry.environmentType().isBlank()) {
            try {
                environmentType = EnvironmentType.valueOf(entry.environmentType().trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // keep filename-resolved value
            }
        }
        return new FileTypeMapping(environmentType, templateType, base.normativeType(), base.comparisonType(),
                base.isSummationGroup(), base.isCodeGroup());
    }
}
