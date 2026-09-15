package kz.eco.normative.physical;

import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

public final class PhysicalFactorTableUtils {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final Pattern NUMERIC_CELL = Pattern.compile("^-?\\d+(?:[.,]\\d+)?$");
    private static final Pattern COLUMN_INDEX_ROW = Pattern.compile("^(\\d+\\s*)+$");

    private PhysicalFactorTableUtils() {
    }

    public static String cell(List<String> row, int index) {
        if (row == null || index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    public static boolean isColumnIndexRow(List<String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        List<String> nonEmpty = row.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).toList();
        if (nonEmpty.isEmpty()) {
            return false;
        }
        return nonEmpty.stream().allMatch(v -> v.matches("\\d+"));
    }

    public static boolean isSectionTitleRow(List<String> row) {
        List<String> nonEmpty = nonEmptyCells(row);
        if (nonEmpty.size() != 1) {
            return false;
        }
        String text = nonEmpty.getFirst();
        return text.length() < 120 && !looksNumeric(text);
    }

    public static boolean isHeaderLabelRow(List<String> row) {
        List<String> nonEmpty = nonEmptyCells(row);
        if (nonEmpty.size() < 2) {
            return false;
        }
        long textCells = nonEmpty.stream().filter(v -> !looksNumeric(v)).count();
        return textCells >= nonEmpty.size() / 2;
    }

    public static List<String> nonEmptyCells(List<String> row) {
        List<String> values = new ArrayList<>();
        if (row == null) {
            return values;
        }
        for (String cell : row) {
            if (cell != null && !cell.isBlank()) {
                values.add(cell.trim());
            }
        }
        return values;
    }

    public static String truncate(String raw, int maxLength) {
        if (raw == null) {
            return null;
        }
        if (raw.length() <= maxLength) {
            return raw;
        }
        return raw.substring(0, maxLength);
    }

    public static boolean looksNumeric(String raw) {
        if (raw == null || raw.isBlank()) {
            return false;
        }
        if (NUMERIC_CELL.matcher(raw.trim()).matches()) {
            return true;
        }
        return PhysicalFactorValueParser.parse(raw, null).value() != null
                || PhysicalFactorValueParser.parse(raw, null).comparisonType() == kz.eco.protocol.ComparisonType.RANGE;
    }

    public static String detectRowLabel(List<String> row) {
        for (int i = 0; i < Math.min(row.size(), 3); i++) {
            String cell = cell(row, i);
            if (cell == null || cell.isBlank()) {
                continue;
            }
            if (cell.matches("\\d+")) {
                continue;
            }
            if (cell.length() >= 3) {
                return cell;
            }
        }
        return null;
    }

    public static String sanitizeFactorCode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().toUpperCase(Locale.ROOT)
                .replaceAll("[^A-Z0-9]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");
        if (normalized.isBlank()) {
            return null;
        }
        return normalized.length() > 80 ? normalized.substring(0, 80) : normalized;
    }

    public static String deriveFactorCode(String factorType, String columnHeader, int columnIndex, String cellValue) {
        if (columnHeader != null && !columnHeader.isBlank()) {
            String fromHeader = mapKnownHeader(factorType, columnHeader);
            if (fromHeader != null) {
                return fromHeader;
            }
            String sanitized = sanitizeFactorCode(columnHeader);
            if (sanitized != null) {
                return sanitized;
            }
        }
        if (factorType != null && looksNumeric(cellValue)) {
            return factorType + "_VALUE_" + columnIndex;
        }
        if (factorType != null) {
            return factorType + "_COL_" + columnIndex;
        }
        return "COL_" + columnIndex;
    }

    private static String mapKnownHeader(String factorType, String header) {
        String lower = header.toLowerCase(Locale.ROOT);
        if ("NOISE".equalsIgnoreCase(factorType)) {
            if (lower.contains("эквивалент") || lower.contains("dba") || lower.contains("дба")) {
                return "NOISE_EQUIVALENT";
            }
            if (lower.matches("[\\d.,]+")) {
                return "NOISE_BAND_" + header.replace(',', '_').replace('.', '_');
            }
            return "NOISE_LEVEL";
        }
        if ("LIGHTING".equalsIgnoreCase(factorType)) {
            if (lower.contains("кео") || lower.contains("естествен")) {
                return "KEO";
            }
            if (lower.contains("освещ") || lower.contains("lux") || lower.contains("лк")) {
                return "LIGHTING";
            }
            if (lower.contains("пульсац")) {
                return "LIGHT_PULSATION";
            }
        }
        if ("INFRASOUND".equalsIgnoreCase(factorType) || "ULTRASOUND".equalsIgnoreCase(factorType)) {
            return factorType + "_LEVEL";
        }
        if ("UV".equalsIgnoreCase(factorType)) {
            return "UV_RADIATION";
        }
        if ("AEROIONS".equalsIgnoreCase(factorType)) {
            return "AEROIONS";
        }
        if ("ELECTROMAGNETIC_FIELD".equalsIgnoreCase(factorType)) {
            return "EMF_LEVEL";
        }
        if ("LASER".equalsIgnoreCase(factorType)) {
            return "LASER_RADIATION";
        }
        return null;
    }

    public static String inferUnit(String factorType, String columnHeader) {
        if (columnHeader != null) {
            String lower = columnHeader.toLowerCase(Locale.ROOT);
            if (lower.contains("лк") || lower.contains("lux")) {
                return "лк";
            }
            if (lower.contains("дб") || lower.contains("db")) {
                return "дБ";
            }
            if (lower.contains("°c") || lower.contains("град")) {
                return "°C";
            }
            if (lower.contains("м/с")) {
                return "м/с";
            }
            if (lower.contains("%")) {
                return "%";
            }
        }
        if (factorType == null) {
            return null;
        }
        return switch (factorType.toUpperCase(Locale.ROOT)) {
            case "MICROCLIMATE" -> "°C";
            case "NOISE", "INFRASOUND", "ULTRASOUND" -> "дБ";
            case "LIGHTING" -> "лк";
            case "UV", "LASER", "ELECTROMAGNETIC_FIELD" -> "Вт/м²";
            case "AEROIONS" -> "ион/см³";
            default -> null;
        };
    }

    public static String toJson(Map<String, ?> values) {
        try {
            return OBJECT_MAPPER.writeValueAsString(values);
        } catch (Exception ex) {
            return null;
        }
    }

    public static String rowJson(List<String> row, List<String> headers, int rowNumber) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("rowNumber", String.valueOf(rowNumber));
        for (int i = 0; i < row.size(); i++) {
            String value = cell(row, i);
            if (value == null) {
                continue;
            }
            String key = headers != null && i < headers.size() && headers.get(i) != null
                    ? "col" + i + "_" + sanitizeFactorCode(headers.get(i))
                    : "col" + i;
            map.put(key, value);
        }
        return toJson(map);
    }
}
