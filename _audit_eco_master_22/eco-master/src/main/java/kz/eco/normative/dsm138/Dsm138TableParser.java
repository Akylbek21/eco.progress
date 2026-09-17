package kz.eco.normative.dsm138;

import kz.eco.normative.EnvironmentType;
import kz.eco.normative.ImportNormativeType;
import kz.eco.normative.NormativeRecord;
import kz.eco.normative.SourceDocumentCode;
import kz.eco.normative.TemplateType;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Parses one already-HTML-decoded DSM_138 table (see PhysicalFactorHtmlTableReader, which already
 * resolves rowspan/colspan into a clean per-row grid) into NormativeRecord rows.
 *
 * The tables mix three kinds of non-data rows that must be skipped rather than turned into bogus
 * records: the column-index row ("1 2 3 4 5 6"), the text header row ("№ / Показатели / ..."),
 * and section-title rows that have exactly one populated cell (e.g. "Неорганические вещества",
 * "Фториды (F) для климатических районов:"). Section titles are remembered as sectionName context
 * for the rows that follow, rather than discarded.
 */
public final class Dsm138TableParser {

    private Dsm138TableParser() {
    }

    public record ParseResult(List<NormativeRecord> records, List<String> warnings) {
    }

    public static ParseResult parse(List<List<String>> rows, Dsm138FileMapping mapping,
                                     String fileName, LocalDate documentDate) {
        List<NormativeRecord> records = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            warnings.add("Пустая таблица: " + fileName);
            return new ParseResult(records, warnings);
        }

        String currentSection = null;
        int autoRowNumber = 0;

        for (List<String> row : rows) {
            List<String> nonEmpty = nonEmptyCells(row);
            if (nonEmpty.isEmpty() || isColumnIndexRow(nonEmpty)) {
                continue;
            }
            if (nonEmpty.size() == 1) {
                String only = nonEmpty.getFirst();
                if (!looksLikeRowNumber(only) && only.length() < 150) {
                    currentSection = only;
                }
                continue;
            }
            if (isHeaderRow(nonEmpty)) {
                continue;
            }

            String nameCell = cell(row, 1);
            if (nameCell == null || nameCell.isBlank()) {
                continue;
            }

            autoRowNumber++;
            Integer parsedRowNo = parseIntSafe(cell(row, 0));

            NormativeRecord record = new NormativeRecord();
            record.setSourceDocumentCode(SourceDocumentCode.DSM_138.name());
            record.setEnvironmentType(EnvironmentType.WATER);
            record.setTemplateType(TemplateType.WATER_WASTEWATER);
            record.setDocumentNumber(SourceDocumentCode.DSM_138.documentNumber());
            record.setDocumentDate(documentDate);
            record.setAppendixNo(mapping.appendixNo());
            record.setTableNo(mapping.tableNo());
            record.setCategoryCode(mapping.category().name());
            record.setWaterType(mapping.waterType());
            record.setSectionName(currentSection);
            record.setSourceFile(fileName);
            record.setSourceRowNumber(parsedRowNo != null ? parsedRowNo : autoRowNumber);
            record.setNormativeType(ImportNormativeType.PDK);
            record.setActive(true);

            String unit;
            String normativeRaw;
            switch (mapping.layout()) {
                case WITH_SYNONYMS -> {
                    record.setIndicatorNameRu(truncate(nameCell, 300));
                    record.setSynonyms(truncate(cell(row, 2), 500));
                    unit = "мг/л";
                    normativeRaw = cell(row, 3);
                    record.setLimitingIndicator(truncate(cell(row, 4), 100));
                    record.setHazardClass(truncate(cell(row, 5), 10));
                }
                case WITH_CAS -> {
                    record.setIndicatorNameRu(truncate(nameCell, 300));
                    record.setCasNumber(truncate(cell(row, 2), 80));
                    unit = "мг/л";
                    normativeRaw = cell(row, 3);
                    record.setLimitingIndicator(truncate(cell(row, 4), 100));
                    record.setHazardClass(truncate(cell(row, 5), 10));
                }
                default -> {
                    record.setIndicatorNameRu(truncate(nameCell, 300));
                    unit = cell(row, 2);
                    normativeRaw = cell(row, 3);
                    record.setLimitingIndicator(truncate(cell(row, 4), 100));
                    record.setHazardClass(truncate(cell(row, 5), 10));
                }
            }
            record.setUnit(unit);

            Dsm138ValueParser.ParsedValue parsed = Dsm138ValueParser.parse(normativeRaw);
            record.setComparisonType(parsed.comparisonType());
            record.setValue(parsed.value());
            record.setMinValue(parsed.minValue());
            record.setMaxValue(parsed.maxValue());
            record.setAlternativeNormativeValue(parsed.alternativeValue());
            record.setNotes(parsed.notes());
            record.setSourceRawValue(truncate(parsed.rawValue(), 200));

            records.add(record);
        }

        if (records.isEmpty()) {
            warnings.add("Не найдено ни одной строки данных: " + fileName);
        }
        return new ParseResult(records, warnings);
    }

    private static boolean isColumnIndexRow(List<String> nonEmpty) {
        return nonEmpty.stream().allMatch(v -> v.matches("\\d+"));
    }

    private static boolean isHeaderRow(List<String> nonEmpty) {
        String joined = String.join(" ", nonEmpty).toLowerCase(Locale.ROOT);
        return joined.contains("показател") || joined.contains("наименование вещества")
                || joined.startsWith("№");
    }

    private static boolean looksLikeRowNumber(String value) {
        return value.matches("\\d+");
    }

    private static List<String> nonEmptyCells(List<String> row) {
        List<String> values = new ArrayList<>();
        if (row == null) {
            return values;
        }
        for (String value : row) {
            if (value != null && !value.isBlank()) {
                values.add(value.trim());
            }
        }
        return values;
    }

    private static String cell(List<String> row, int index) {
        if (row == null || index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null && !value.isBlank() ? value.trim() : null;
    }

    private static Integer parseIntSafe(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String truncate(String raw, int maxLength) {
        if (raw == null) {
            return null;
        }
        return raw.length() <= maxLength ? raw : raw.substring(0, maxLength);
    }
}
