package kz.eco.normative.physical;

import java.util.Locale;

public final class PhysicalFactorParserTypeResolver {

    private PhysicalFactorParserTypeResolver() {
    }

    public static String resolve(String factorType, Integer appendixNo, Integer tableNo, String fileName) {
        String specific = resolveSpecific(factorType, appendixNo, tableNo, fileName);
        return specific != null ? specific : GenericPhysicalFactorTableParser.PARSER_TYPE;
    }

    private static String resolveSpecific(String factorType, Integer appendixNo, Integer tableNo, String fileName) {
        if (appendixNo != null && tableNo != null && factorType != null) {
            String key = factorType.trim().toUpperCase(Locale.ROOT) + "_" + appendixNo + "_" + tableNo;
            return switch (key) {
                case "MICROCLIMATE_1_1" -> "MICROCLIMATE_TABLE_01";
                case "NOISE_2_1" -> "NOISE_TABLE_01";
                case "NOISE_2_2" -> "NOISE_TABLE_02";
                case "LIGHTING_3_2" -> "LIGHTING_TABLE_02";
                case "LIGHTING_3_3" -> "LIGHTING_TABLE_03";
                case "LIGHTING_3_4" -> "LIGHTING_TABLE_04";
                case "INFRASOUND_4_1" -> "INFRASOUND_TABLE_01";
                case "ULTRASOUND_5_1" -> "ULTRASOUND_TABLE_01";
                case "UV_6_1" -> "UV_TABLE_01";
                case "AEROIONS_7_1" -> "AEROIONS_TABLE_01";
                case "ELECTROMAGNETIC_FIELD_8_1" -> "ELECTROMAGNETIC_FIELD_TABLE_01";
                case "LASER_9_1" -> "LASER_TABLE_01";
                default -> null;
            };
        }
        if (fileName == null) {
            return null;
        }
        String lower = fileName.toLowerCase(Locale.ROOT);
        if (lower.contains("app_01_table_01")) {
            return "MICROCLIMATE_TABLE_01";
        }
        if (lower.contains("app_02_table_01")) {
            return "NOISE_TABLE_01";
        }
        if (lower.contains("app_02_table_02")) {
            return "NOISE_TABLE_02";
        }
        if (lower.contains("app_03_table_02")) {
            return "LIGHTING_TABLE_02";
        }
        if (lower.contains("app_03_table_03")) {
            return "LIGHTING_TABLE_03";
        }
        if (lower.contains("app_03_table_04")) {
            return "LIGHTING_TABLE_04";
        }
        if (lower.contains("app_04_table_01")) {
            return "INFRASOUND_TABLE_01";
        }
        if (lower.contains("app_05_table_01")) {
            return "ULTRASOUND_TABLE_01";
        }
        if (lower.contains("app_06_table_01")) {
            return "UV_TABLE_01";
        }
        if (lower.contains("app_07_table_01")) {
            return "AEROIONS_TABLE_01";
        }
        if (lower.contains("app_08_table_01")) {
            return "ELECTROMAGNETIC_FIELD_TABLE_01";
        }
        if (lower.contains("app_09_table_01")) {
            return "LASER_TABLE_01";
        }
        return null;
    }
}
