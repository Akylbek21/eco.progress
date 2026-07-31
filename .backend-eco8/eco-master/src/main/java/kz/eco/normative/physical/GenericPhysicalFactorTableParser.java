package kz.eco.normative.physical;

import kz.eco.normative.ImportNormativeType;
import kz.eco.normative.NormativeRecord;
import kz.eco.protocol.ComparisonType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class GenericPhysicalFactorTableParser implements PhysicalFactorTableParser {

    public static final String PARSER_TYPE = "GENERIC_FALLBACK";

    @Override
    public boolean supports(String parserType) {
        if (parserType == null || parserType.isBlank()) {
            return true;
        }
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(PhysicalFactorImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            return records;
        }

        List<String> headers = detectColumnHeaders(rows);
        String factorType = context.factorType() != null ? context.factorType().trim().toUpperCase(Locale.ROOT) : null;

        for (int rowIndex = 0; rowIndex < rows.size(); rowIndex++) {
            List<String> row = rows.get(rowIndex);
            if (shouldSkipRow(row)) {
                continue;
            }

            String rowLabel = PhysicalFactorTableUtils.detectRowLabel(row);
            if (rowLabel == null || rowLabel.toLowerCase(Locale.ROOT).contains("примечание")) {
                continue;
            }

            boolean hasNumeric = false;
            for (int col = 0; col < row.size(); col++) {
                String cell = PhysicalFactorTableUtils.cell(row, col);
                if (cell == null || cell.equals(rowLabel) || cell.matches("\\d+")) {
                    continue;
                }

                String header = col < headers.size() ? headers.get(col) : null;
                var parsed = PhysicalFactorValueParser.parse(cell, ComparisonType.LESS_OR_EQUAL);
                if (parsed.comparisonType() != ComparisonType.INFO
                        && (parsed.value() != null || parsed.minValue() != null || parsed.maxValue() != null)) {
                    hasNumeric = true;
                    records.add(buildNumericRecord(context, factorType, rowLabel, header, col, cell, parsed, row, rowIndex + 1));
                }
            }

            if (!hasNumeric) {
                records.add(buildInfoRecord(context, factorType, rowLabel, row, headers, rowIndex + 1));
            }
        }
        return records;
    }

    private static List<String> detectColumnHeaders(List<List<String>> rows) {
        for (int i = 0; i < Math.min(rows.size(), 6); i++) {
            List<String> row = rows.get(i);
            if (PhysicalFactorTableUtils.isHeaderLabelRow(row) && !PhysicalFactorTableUtils.isColumnIndexRow(row)) {
                return normalizeHeaders(row);
            }
        }
        List<String> fallback = new ArrayList<>();
        int maxCols = rows.stream().mapToInt(List::size).max().orElse(0);
        for (int i = 0; i < maxCols; i++) {
            fallback.add("col" + i);
        }
        return fallback;
    }

    private static List<String> normalizeHeaders(List<String> row) {
        List<String> headers = new ArrayList<>();
        for (String cell : row) {
            headers.add(cell != null && !cell.isBlank() ? cell.trim() : null);
        }
        return headers;
    }

    private static boolean shouldSkipRow(List<String> row) {
        if (row == null || row.isEmpty()) {
            return true;
        }
        if (PhysicalFactorTableUtils.isColumnIndexRow(row)) {
            return true;
        }
        if (PhysicalFactorTableUtils.isSectionTitleRow(row)) {
            return true;
        }
        List<String> nonEmpty = PhysicalFactorTableUtils.nonEmptyCells(row);
        if (nonEmpty.isEmpty()) {
            return true;
        }
        String first = nonEmpty.getFirst().toLowerCase(Locale.ROOT);
        return first.contains("№") || first.contains("наименование") || first.contains("показат")
                || first.contains("примечание")
                || nonEmpty.stream().anyMatch(v -> v.toLowerCase(Locale.ROOT).contains("примечание"));
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

    private static NormativeRecord buildNumericRecord(PhysicalFactorImportContext context,
                                                      String factorType,
                                                      String rowLabel,
                                                      String columnHeader,
                                                      int columnIndex,
                                                      String rawValue,
                                                      PhysicalFactorValueParser.ParsedValue parsed,
                                                      List<String> row,
                                                      int rowNumber) {
        NormativeRecord record = baseRecord(context, factorType, rowLabel, row, rowNumber);
        record.setFactorCode(PhysicalFactorTableUtils.deriveFactorCode(factorType, columnHeader, columnIndex, rawValue));
        record.setUnit(PhysicalFactorTableUtils.inferUnit(factorType, columnHeader));
        record.setValue(parsed.value());
        record.setMinValue(parsed.minValue());
        record.setMaxValue(parsed.maxValue());
        record.setComparisonType(parsed.comparisonType());
        record.setNormativeType(ImportNormativeType.PDK);
        record.setSourceRawValue(PhysicalFactorTableUtils.truncate(rawValue, 200));
        if (columnHeader != null && !columnHeader.isBlank()) {
            record.setIndicatorNameRu(PhysicalFactorTableUtils.truncate(rowLabel + " — " + columnHeader, 300));
        }
        Map<String, String> json = new LinkedHashMap<>();
        json.put("rowLabel", rowLabel);
        json.put("columnHeader", columnHeader);
        json.put("rawValue", rawValue);
        record.setConditionJson(PhysicalFactorTableUtils.toJson(json));
        return record;
    }

    private static NormativeRecord buildInfoRecord(PhysicalFactorImportContext context,
                                                   String factorType,
                                                   String rowLabel,
                                                   List<String> row,
                                                   List<String> headers,
                                                   int rowNumber) {
        NormativeRecord record = baseRecord(context, factorType, rowLabel, row, rowNumber);
        record.setFactorCode(PhysicalFactorTableUtils.sanitizeFactorCode(factorType + "_ROW_" + rowNumber));
        record.setComparisonType(ComparisonType.INFO);
        record.setNormativeType(ImportNormativeType.ASSESSMENT);
        record.setSourceRawValue(PhysicalFactorTableUtils.truncate(
                String.join(" | ", PhysicalFactorTableUtils.nonEmptyCells(row)), 200));
        record.setConditionJson(PhysicalFactorTableUtils.rowJson(row, headers, rowNumber));
        return record;
    }

    private static NormativeRecord baseRecord(PhysicalFactorImportContext context,
                                              String factorType,
                                              String rowLabel,
                                              List<String> row,
                                              int rowNumber) {
        NormativeRecord record = new NormativeRecord();
        record.setFactorType(factorType);
        record.setIndicatorNameRu(PhysicalFactorTableUtils.truncate(rowLabel, 300));
        record.setAppendixNo(context.appendixNo());
        record.setTableNo(context.tableNo());
        record.setSourceFile(context.fileName());
        record.setSourceRowNumber(rowNumber);
        record.setRoomType(PhysicalFactorTableUtils.truncate(extractWorkplaceHint(rowLabel), 100));
        return record;
    }

    private static String extractWorkplaceHint(String rowLabel) {
        if (rowLabel == null || rowLabel.length() > 100) {
            return rowLabel != null ? PhysicalFactorTableUtils.truncate(rowLabel, 100) : null;
        }
        return rowLabel;
    }
}
