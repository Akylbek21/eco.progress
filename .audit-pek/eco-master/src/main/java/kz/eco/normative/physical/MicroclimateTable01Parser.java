package kz.eco.normative.physical;

import kz.eco.normative.NormativeRecord;
import kz.eco.protocol.ComparisonType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class MicroclimateTable01Parser implements PhysicalFactorTableParser {

    private static final String PARSER_TYPE = "MICROCLIMATE_TABLE_01";
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Override
    public boolean supports(String parserType) {
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(PhysicalFactorImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();
        String currentSeason = null;
        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row.size() < 4) {
                continue;
            }
            String seasonCell = cell(row, 1);
            if (seasonCell != null && !seasonCell.isBlank() && !isNumeric(seasonCell)) {
                currentSeason = parseSeason(seasonCell);
            }
            String workCategoryCell = cell(row, 2);
            if (workCategoryCell == null || workCategoryCell.isBlank() || isHeaderRow(workCategoryCell)) {
                continue;
            }
            String workCategory = parseWorkCategory(workCategoryCell);
            if (workCategory == null || currentSeason == null) {
                continue;
            }

            addTemperatureRecords(records, context, currentSeason, workCategory, row, i + 1);
            addHumidityRecords(records, context, currentSeason, workCategory, row, i + 1);
            addAirSpeedRecords(records, context, currentSeason, workCategory, row, i + 1);
        }
        return records;
    }

    private void addTemperatureRecords(List<NormativeRecord> records,
                                       PhysicalFactorImportContext context,
                                       String season,
                                       String workCategory,
                                       List<String> row,
                                       int rowNumber) {
        addTemperatureRecord(records, context, season, workCategory, "ANY", "OPTIMAL",
                cell(row, 3), ComparisonType.RANGE, null, rowNumber);

        addTemperatureRecord(records, context, season, workCategory, "PERMANENT", "ALLOWABLE",
                cell(row, 4), ComparisonType.LESS_OR_EQUAL, boundJson("UPPER"), rowNumber);
        addTemperatureRecord(records, context, season, workCategory, "TEMPORARY", "ALLOWABLE",
                cell(row, 5), ComparisonType.LESS_OR_EQUAL, boundJson("UPPER"), rowNumber);
        addTemperatureRecord(records, context, season, workCategory, "PERMANENT", "ALLOWABLE",
                cell(row, 6), ComparisonType.GREATER_OR_EQUAL, boundJson("LOWER"), rowNumber);
        addTemperatureRecord(records, context, season, workCategory, "TEMPORARY", "ALLOWABLE",
                cell(row, 7), ComparisonType.GREATER_OR_EQUAL, boundJson("LOWER"), rowNumber);
    }

    private void addHumidityRecords(List<NormativeRecord> records,
                                    PhysicalFactorImportContext context,
                                    String season,
                                    String workCategory,
                                    List<String> row,
                                    int rowNumber) {
        addFactorRecord(records, context, "HUMIDITY", "Относительная влажность", "%",
                season, workCategory, "ANY", "OPTIMAL",
                PhysicalFactorValueParser.parse(cell(row, 8), ComparisonType.RANGE),
                null, rowNumber);
        addFactorRecord(records, context, "HUMIDITY", "Относительная влажность", "%",
                season, workCategory, "ANY", "ALLOWABLE",
                PhysicalFactorValueParser.parse(cell(row, 9), ComparisonType.LESS_OR_EQUAL),
                null, rowNumber);
    }

    private void addAirSpeedRecords(List<NormativeRecord> records,
                                    PhysicalFactorImportContext context,
                                    String season,
                                    String workCategory,
                                    List<String> row,
                                    int rowNumber) {
        addFactorRecord(records, context, "AIR_SPEED", "Скорость движения воздуха", "м/с",
                season, workCategory, "ANY", "OPTIMAL",
                PhysicalFactorValueParser.parse(cell(row, 10), ComparisonType.LESS_OR_EQUAL),
                null, rowNumber);
        addFactorRecord(records, context, "AIR_SPEED", "Скорость движения воздуха", "м/с",
                season, workCategory, "ANY", "ALLOWABLE",
                PhysicalFactorValueParser.parse(cell(row, 11), ComparisonType.LESS_OR_EQUAL),
                null, rowNumber);
    }

    private void addTemperatureRecord(List<NormativeRecord> records,
                                      PhysicalFactorImportContext context,
                                      String season,
                                      String workCategory,
                                      String workplaceType,
                                      String normLevel,
                                      String rawValue,
                                      ComparisonType defaultComparison,
                                      String conditionJson,
                                      int rowNumber) {
        addFactorRecord(records, context, "AIR_TEMPERATURE", "Температура воздуха", "°C",
                season, workCategory, workplaceType, normLevel,
                PhysicalFactorValueParser.parse(rawValue, defaultComparison),
                conditionJson, rowNumber);
    }

    private void addFactorRecord(List<NormativeRecord> records,
                                 PhysicalFactorImportContext context,
                                 String factorCode,
                                 String indicatorName,
                                 String unit,
                                 String season,
                                 String workCategory,
                                 String workplaceType,
                                 String normLevel,
                                 PhysicalFactorValueParser.ParsedValue parsed,
                                 String conditionJson,
                                 int rowNumber) {
        if (parsed == null || parsed.comparisonType() == ComparisonType.INFO) {
            return;
        }
        if (parsed.minValue() == null && parsed.maxValue() == null && parsed.value() == null) {
            return;
        }

        NormativeRecord record = new NormativeRecord();
        record.setFactorType("MICROCLIMATE");
        record.setFactorCode(factorCode);
        record.setIndicatorNameRu(indicatorName);
        record.setUnit(unit);
        record.setSeason(season);
        record.setWorkCategory(workCategory);
        record.setWorkplaceType(workplaceType);
        record.setNormLevel(normLevel);
        record.setConditionJson(conditionJson);
        record.setMinValue(parsed.minValue());
        record.setMaxValue(parsed.maxValue());
        record.setValue(parsed.value());
        record.setComparisonType(parsed.comparisonType());
        record.setAppendixNo(context.appendixNo());
        record.setTableNo(context.tableNo());
        record.setSourceFile(context.fileName());
        record.setSourceRowNumber(rowNumber);
        records.add(record);
    }

    private static String boundJson(String boundType) {
        try {
            Map<String, String> map = new LinkedHashMap<>();
            map.put("boundType", boundType);
            return OBJECT_MAPPER.writeValueAsString(map);
        } catch (Exception ex) {
            return "{\"boundType\":\"" + boundType + "\"}";
        }
    }

    private static String cell(List<String> row, int index) {
        if (index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private static boolean isHeaderRow(String value) {
        String lower = value.toLowerCase(Locale.ROOT);
        return lower.contains("категор") || lower.contains("период") || lower.equals("3");
    }

    private static boolean isNumeric(String value) {
        return value.matches("\\d+");
    }

    static String parseSeason(String raw) {
        if (raw == null) {
            return null;
        }
        String lower = raw.toLowerCase(Locale.ROOT);
        if (lower.contains("холод")) {
            return "COLD";
        }
        if (lower.contains("тепл")) {
            return "WARM";
        }
        return null;
    }

    static String parseWorkCategory(String raw) {
        if (raw == null) {
            return null;
        }
        String normalized = raw.toLowerCase(Locale.ROOT)
                .replace('а', 'a')
                .replace('б', 'b')
                .replace("–", "-")
                .replace("—", "-")
                .replaceAll("\\s+", " ");
        if (normalized.contains("1a") || normalized.contains("1а") || normalized.contains("1 a")) {
            return "IA";
        }
        if (normalized.contains("1b") || normalized.contains("1б") || normalized.contains("1 b")) {
            return "IB";
        }
        if (normalized.contains("ii a") || normalized.contains("ii-a") || normalized.contains("2a")) {
            return "IIA";
        }
        if (normalized.contains("ii b") || normalized.contains("ii-b") || normalized.contains("2b")) {
            return "IIB";
        }
        if (normalized.contains("iii") || normalized.contains("3")) {
            return "III";
        }
        return null;
    }
}
