package kz.eco.normative;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class NormativeTableParser {

    private static final int DUAL_PDK_MIN_COLUMNS = 9;
    private static final int IDX_NAME = 1;
    private static final int IDX_CAS = 2;
    private static final int IDX_FORMULA = 3;
    private static final int IDX_MAX_ONE_TIME = 4;
    private static final int IDX_DAILY_AVERAGE = 5;
    private static final int IDX_LIMITING = 6;
    private static final int IDX_HAZARD = 7;
    private static final int IDX_CODE = 8;

    // DSM_70 files get dedicated column schemas instead of generic/dual-PDK auto-detection,
    // because their layouts are too similar in column count to be told apart reliably.
    private static final String SCHEMA_MPC_ATMOSPHERIC_CODES = "MPC_atmospheric_air_with_pollutant_codes";
    private static final String SCHEMA_OEL_ATMOSPHERIC_CODES = "OEL_atmospheric_air_with_pollutant_codes";
    private static final String SCHEMA_MPC_WORK_ZONE_GENERAL = "MPC_work_zone_air_general_reference";
    private static final String SCHEMA_OEL_WORK_ZONE_GENERAL = "OEL_work_zone_air_general_reference";

    private static final int OEL_ATM_IDX_NAME = 1;
    private static final int OEL_ATM_IDX_CAS = 2;
    private static final int OEL_ATM_IDX_FORMULA = 3;
    private static final int OEL_ATM_IDX_VALUE = 4;
    private static final int OEL_ATM_IDX_CODE = 5;

    private static final int OEL_WZ_IDX_NAME = 1;
    private static final int OEL_WZ_IDX_CAS = 2;
    private static final int OEL_WZ_IDX_FORMULA = 3;
    private static final int OEL_WZ_IDX_VALUE = 4;

    private static final Pattern HAZARD_CLASS_PATTERN = Pattern.compile("^[1-4][*+]?$");
    private static final Pattern ROW_NUMBER_PATTERN = Pattern.compile("^\\d{1,5}\\.?$");

    private NormativeTableParser() {
    }

    public record ParsedNormativeRow(
            String pollutantCode,
            String name,
            String casNumber,
            String formula,
            String hazardClass,
            String limitingIndicator,
            String document,
            String subType,
            BigDecimal value,
            BigDecimal minValue,
            BigDecimal maxValue,
            String unit,
            String rawValue,
            int rowNumber
    ) {
    }

    public static List<ParsedNormativeRow> parseDataRows(List<List<String>> rows, FileTypeMapping mapping) {
        return parseDataRows(rows, mapping, null);
    }

    public static List<ParsedNormativeRow> parseDataRows(List<List<String>> rows, FileTypeMapping mapping, String fileName) {
        if (rows == null || rows.isEmpty() || mapping == null) {
            return List.of();
        }
        if (mapping.isSummationGroup() || mapping.isCodeGroup()) {
            return List.of();
        }

        String schemaKey = FileTypeMapping.resolveKey(fileName);
        if (SCHEMA_MPC_ATMOSPHERIC_CODES.equals(schemaKey)) {
            return parseMpcAtmosphericAirWithCodes(rows, mapping);
        }
        if (SCHEMA_OEL_ATMOSPHERIC_CODES.equals(schemaKey)) {
            return parseOelAtmosphericAirWithCodes(rows, mapping);
        }
        if (SCHEMA_MPC_WORK_ZONE_GENERAL.equals(schemaKey)) {
            return parseMpcWorkZoneAirGeneral(rows, mapping);
        }
        if (SCHEMA_OEL_WORK_ZONE_GENERAL.equals(schemaKey)) {
            return parseOelWorkZoneAirGeneral(rows, mapping);
        }
        return parseGenericTable(rows, mapping);
    }

    private static List<ParsedNormativeRow> parseGenericTable(List<List<String>> rows, FileTypeMapping mapping) {
        List<String> headers = buildMergedHeaders(rows);
        int dataStart = findDataStartRow(rows, headers);
        boolean dualPdk = isDualPdkTable(rows, headers);

        List<ParsedNormativeRow> parsedRows = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (isEmptyRow(row) || isHeaderRow(row) || isNumberHeaderRow(row) || isNumericSequenceRow(row)) {
                continue;
            }
            if (dualPdk && row.size() >= DUAL_PDK_MIN_COLUMNS) {
                parsedRows.addAll(parseDualPdkRow(row, mapping, i + 1));
            } else {
                ParsedNormativeRow single = parseGenericRow(row, headers, mapping, i + 1);
                if (single != null) {
                    parsedRows.add(single);
                }
            }
        }
        return parsedRows;
    }

    /**
     * MPC_atmospheric_air_with_pollutant_codes.xls.xls: fixed 9-column layout
     * (№, Name, CAS, Formula, MaxOneTime, DailyAverage, Limiting, Hazard, Code) — always dual PDK.
     */
    private static List<ParsedNormativeRow> parseMpcAtmosphericAirWithCodes(List<List<String>> rows, FileTypeMapping mapping) {
        List<String> headers = buildMergedHeaders(rows);
        int dataStart = findDataStartRow(rows, headers);
        List<ParsedNormativeRow> parsedRows = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (isEmptyRow(row) || isHeaderRow(row) || isNumberHeaderRow(row) || isNumericSequenceRow(row)) {
                continue;
            }
            parsedRows.addAll(parseDualPdkRow(row, mapping, i + 1));
        }
        return parsedRows;
    }

    /**
     * OEL_atmospheric_air_with_pollutant_codes.xls.xls: fixed 6-column layout
     * (№, Name, CAS, Formula, OBUV, Code) — single value, has a real pollutant code.
     */
    private static List<ParsedNormativeRow> parseOelAtmosphericAirWithCodes(List<List<String>> rows, FileTypeMapping mapping) {
        List<String> headers = buildMergedHeaders(rows);
        int dataStart = findDataStartRow(rows, headers);
        String unit = inferUnit(mapping);
        List<ParsedNormativeRow> parsedRows = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (isEmptyRow(row) || isHeaderRow(row) || isNumberHeaderRow(row) || isNumericSequenceRow(row)) {
                continue;
            }
            String name = getCell(row, OEL_ATM_IDX_NAME);
            String code = PollutantCodeUtils.normalizePollutantCode(getCell(row, OEL_ATM_IDX_CODE));
            if (!isValidSubstanceName(name) && (code == null || code.isBlank())) {
                continue;
            }
            String rawValue = getCell(row, OEL_ATM_IDX_VALUE);
            BigDecimal value = normalizeDecimal(rawValue);
            if (value == null) {
                continue;
            }
            parsedRows.add(new ParsedNormativeRow(
                    code, name, getCell(row, OEL_ATM_IDX_CAS), getCell(row, OEL_ATM_IDX_FORMULA),
                    null, null, null, null, value, null, null, unit, rawValue, i + 1));
        }
        return parsedRows;
    }

    /**
     * OEL_work_zone_air_general_reference.xls.xls: fixed 6-column layout
     * (№, Name, CAS, Formula, OBUV, Агрегатное состояние) — no pollutant code column at all.
     */
    private static List<ParsedNormativeRow> parseOelWorkZoneAirGeneral(List<List<String>> rows, FileTypeMapping mapping) {
        List<String> headers = buildMergedHeaders(rows);
        int dataStart = findDataStartRow(rows, headers);
        String unit = inferUnit(mapping);
        List<ParsedNormativeRow> parsedRows = new ArrayList<>();
        for (int i = dataStart; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (isEmptyRow(row) || isHeaderRow(row) || isNumberHeaderRow(row) || isNumericSequenceRow(row)) {
                continue;
            }
            String name = getCell(row, OEL_WZ_IDX_NAME);
            if (!isValidSubstanceName(name)) {
                continue;
            }
            String rawValue = getCell(row, OEL_WZ_IDX_VALUE);
            BigDecimal value = normalizeDecimal(rawValue);
            if (value == null) {
                continue;
            }
            parsedRows.add(new ParsedNormativeRow(
                    null, name, getCell(row, OEL_WZ_IDX_CAS), getCell(row, OEL_WZ_IDX_FORMULA),
                    null, null, null, null, value, null, null, unit, rawValue, i + 1));
        }
        return parsedRows;
    }

    /**
     * MPC_work_zone_air_general_reference.xls.xls has inconsistent colspan usage across
     * its ~2500 rows (name/CAS/formula shift by 1-2 raw columns depending on which field
     * happened to carry the merged-cell span in the source document), so fixed column
     * indices don't hold for the whole file. Instead, resolve columns structurally from the
     * right: the row always ends with [..., value, aggregate-state, hazard-class(1-4), optional-note],
     * so anchor on the rightmost cell matching a hazard-class digit and work backwards.
     * The file has no pollutant code column, so pollutantCode is always null here.
     */
    private static List<ParsedNormativeRow> parseMpcWorkZoneAirGeneral(List<List<String>> rows, FileTypeMapping mapping) {
        String unit = inferUnit(mapping);
        List<ParsedNormativeRow> parsedRows = new ArrayList<>();
        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (isEmptyRow(row) || isHeaderRow(row) || isSubHeaderRow(row) || isNumberHeaderRow(row) || isNumericSequenceRow(row)) {
                continue;
            }
            ParsedNormativeRow parsed = parseWorkZoneGeneralRow(row, unit, i + 1);
            if (parsed != null) {
                parsedRows.add(parsed);
            }
        }
        return parsedRows;
    }

    private static ParsedNormativeRow parseWorkZoneGeneralRow(List<String> row, String unit, int rowNumber) {
        if (row == null || row.size() < 3) {
            return null;
        }
        boolean hasRowNumber = row.get(0) != null && ROW_NUMBER_PATTERN.matcher(row.get(0).trim()).matches();
        int nameIdx = hasRowNumber ? 1 : 0;
        String name = getCell(row, nameIdx);
        if (!isValidSubstanceName(name)) {
            return null;
        }

        List<Integer> indices = new ArrayList<>();
        for (int col = nameIdx + 1; col < row.size(); col++) {
            String cell = getCell(row, col);
            if (cell != null && !cell.isBlank()) {
                indices.add(col);
            }
        }
        if (indices.isEmpty()) {
            return null;
        }

        int classPos = -1;
        for (int p = indices.size() - 1; p >= 0; p--) {
            if (HAZARD_CLASS_PATTERN.matcher(getCell(row, indices.get(p))).matches()) {
                classPos = p;
                break;
            }
        }
        int valuePos = classPos - 2;
        if (classPos < 0 || valuePos < 0) {
            return null;
        }

        String hazardClass = getCell(row, indices.get(classPos));
        String rawValue = getCell(row, indices.get(valuePos));
        BigDecimal value = normalizeWorkZoneValue(rawValue);
        if (value == null) {
            return null;
        }

        String formula = valuePos - 1 >= 0 ? getCell(row, indices.get(valuePos - 1)) : null;
        String cas = valuePos - 2 >= 0 ? getCell(row, indices.get(valuePos - 2)) : null;

        return new ParsedNormativeRow(
                null, name, cas, formula, hazardClass, null, null, null,
                value, null, null, unit, rawValue, rowNumber);
    }

    /**
     * Handles cells like "-/10" or "10/30" (max-one-time/long-term exposure crammed into
     * one cell). Picks the first parseable numeral and normalizes sign, since a stray
     * leading "-" here is a missing-value placeholder, not a real negative concentration.
     */
    private static BigDecimal normalizeWorkZoneValue(String rawValue) {
        if (rawValue == null || rawValue.isBlank()) {
            return null;
        }
        String trimmed = rawValue.trim();
        BigDecimal value;
        if (trimmed.contains("/")) {
            value = null;
            for (String part : trimmed.split("/")) {
                value = normalizeDecimal(part);
                if (value != null) {
                    break;
                }
            }
        } else {
            value = normalizeDecimal(trimmed);
        }
        return value != null ? value.abs() : null;
    }

    private static List<ParsedNormativeRow> parseDualPdkRow(List<String> row, FileTypeMapping mapping, int rowNumber) {
        String code = PollutantCodeUtils.normalizePollutantCode(getCell(row, IDX_CODE));
        String name = getCell(row, IDX_NAME);
        if (!isValidSubstanceName(name) && (code == null || code.isBlank())) {
            return List.of();
        }

        String cas = getCell(row, IDX_CAS);
        String formula = getCell(row, IDX_FORMULA);
        String limiting = getCell(row, IDX_LIMITING);
        String hazard = getCell(row, IDX_HAZARD);
        String unit = inferUnit(mapping);

        List<ParsedNormativeRow> rows = new ArrayList<>();
        addValueRow(rows, code, name, cas, formula, hazard, limiting, null, mapping, unit, row, IDX_MAX_ONE_TIME,
                NormativeSubType.MAX_ONE_TIME, rowNumber);
        addValueRow(rows, code, name, cas, formula, hazard, limiting, null, mapping, unit, row, IDX_DAILY_AVERAGE,
                NormativeSubType.DAILY_AVERAGE, rowNumber);
        return rows;
    }

    private static void addValueRow(List<ParsedNormativeRow> target,
                                    String code,
                                    String name,
                                    String cas,
                                    String formula,
                                    String hazard,
                                    String limiting,
                                    String document,
                                    FileTypeMapping mapping,
                                    String unit,
                                    List<String> row,
                                    int valueIndex,
                                    String subType,
                                    int rowNumber) {
        String rawValue = getCell(row, valueIndex);
        BigDecimal value = normalizeDecimal(rawValue);
        if (value == null) {
            return;
        }
        target.add(new ParsedNormativeRow(
                code,
                name,
                cas,
                formula,
                hazard,
                limiting,
                document,
                subType,
                value,
                null,
                null,
                unit,
                rawValue,
                rowNumber
        ));
    }

    private static ParsedNormativeRow parseGenericRow(List<String> row,
                                                      List<String> headers,
                                                      FileTypeMapping mapping,
                                                      int rowNumber) {
        int codeCol = findCol(headers, "код загрязняющ", "код вещества", "код", "code", "pollutant code");
        int nameCol = findCol(headers, "наименование вещества", "наименование", "вещество", "загрязняющее вещество", "показатель", "name");
        int casCol = findCol(headers, "cas", "номер cas", "cas №", "cas number");
        int formulaCol = findCol(headers, "формула", "formula", "химическая формула");
        int valueCol = findCol(headers, "пдк", "норматив", "значение", "value", "mpc", "обув", "oel", "предельно", "величина");
        int unitCol = findCol(headers, "единица", "ед. изм", "мг/м3", "мг/м³", "мг/дм3", "мг/дм³", "unit");
        int hazardCol = findCol(headers, "класс опасности", "класс", "hazard class", "hazard");
        int limitingCol = findCol(headers, "лимитирующий показатель", "лимитирующий");
        int docCol = findCol(headers, "документ", "нормативный документ", "основание", "нд");

        String code = PollutantCodeUtils.normalizePollutantCode(getCell(row, codeCol));
        String name = getCell(row, nameCol);
        if (!isValidDataRow(code, name)) {
            return null;
        }

        String rawValue = getCell(row, valueCol);
        BigDecimal value = normalizeDecimal(rawValue);
        if (value == null) {
            return null;
        }

        String unit = normalizeUnit(getCell(row, unitCol));
        if (unit == null || unit.isBlank()) {
            unit = inferUnit(mapping);
        }

        return new ParsedNormativeRow(
                code,
                name,
                getCell(row, casCol),
                getCell(row, formulaCol),
                getCell(row, hazardCol),
                getCell(row, limitingCol),
                getCell(row, docCol),
                null,
                value,
                null,
                null,
                unit,
                rawValue,
                rowNumber
        );
    }

    static List<String> buildMergedHeaders(List<List<String>> rows) {
        List<String> merged = new ArrayList<>();
        for (int i = 0; i < Math.min(rows.size(), 5); i++) {
            List<String> row = rows.get(i);
            for (int col = 0; col < row.size(); col++) {
                String cell = row.get(col) == null ? "" : row.get(col).toLowerCase(Locale.ROOT).trim();
                if (cell.isBlank()) {
                    continue;
                }
                while (merged.size() <= col) {
                    merged.add("");
                }
                if (merged.get(col).isBlank()) {
                    merged.set(col, cell);
                } else if (!merged.get(col).contains(cell)) {
                    merged.set(col, merged.get(col) + " " + cell);
                }
            }
        }
        return merged.stream().map(h -> h == null ? "" : h.trim()).toList();
    }

    static int findDataStartRow(List<List<String>> rows, List<String> headers) {
        for (int i = 1; i < Math.min(rows.size(), 12); i++) {
            List<String> row = rows.get(i);
            if (row.isEmpty() || isHeaderRow(row) || isSubHeaderRow(row) || isNumberHeaderRow(row)) {
                continue;
            }
            if (looksLikeDataRow(row, headers)) {
                return i;
            }
        }
        for (int i = 1; i < Math.min(rows.size(), 12); i++) {
            if (isNumberHeaderRow(rows.get(i))) {
                return i + 1;
            }
        }
        return Math.min(3, Math.max(0, rows.size() - 1));
    }

    static boolean isDualPdkTable(List<List<String>> rows, List<String> headers) {
        String joinedHeaders = String.join(" ", headers).toLowerCase(Locale.ROOT);
        if (joinedHeaders.contains("максимальн") && joinedHeaders.contains("среднесуточн")) {
            return true;
        }
        for (int i = 0; i < Math.min(rows.size(), 6); i++) {
            String joined = String.join(" ", rows.get(i)).toLowerCase(Locale.ROOT);
            if (joined.contains("максимальн") && joined.contains("среднесуточн")) {
                return true;
            }
        }
        return false;
    }

    static boolean isEmptyRow(List<String> row) {
        return row == null || row.isEmpty() || row.stream().allMatch(cell -> cell == null || cell.isBlank());
    }

    static boolean isHeaderRow(List<String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        String first = row.getFirst().toLowerCase(Locale.ROOT).trim();
        if (first.contains("№") || first.contains("наименование") || first.equals("п/п")
                || first.startsWith("код") || first.contains("показатель")) {
            return true;
        }
        String joined = String.join(" ", row).toLowerCase(Locale.ROOT);
        return joined.contains("единица измерения") || joined.contains("класс опасности")
                || joined.contains("предельно-допустим") || joined.contains("загрязняющих веществ");
    }

    static boolean isSubHeaderRow(List<String> row) {
        if (row == null || row.size() > 4) {
            return false;
        }
        String joined = String.join(" ", row).toLowerCase(Locale.ROOT);
        return joined.contains("максимальн") || joined.contains("среднесуточн")
                || joined.contains("разов") || joined.contains("среднесменн");
    }

    static boolean isNumberHeaderRow(List<String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        if (!"1".equals(row.getFirst().trim())) {
            return false;
        }
        int numericCount = 0;
        for (String cell : row) {
            if (cell != null && cell.trim().matches("\\d{1,2}")) {
                numericCount++;
            }
        }
        return numericCount >= Math.max(3, row.size() / 2);
    }

    static boolean isNumericSequenceRow(List<String> row) {
        if (row == null || row.isEmpty()) {
            return false;
        }
        String joined = row.stream()
                .filter(cell -> cell != null && !cell.isBlank())
                .map(String::trim)
                .reduce((a, b) -> a + " " + b)
                .orElse("");
        return joined.matches("(\\d\\s*){5,}");
    }

    static boolean looksLikeDataRow(List<String> row, List<String> headers) {
        if (row == null || row.size() < 3) {
            return false;
        }
        if (row.size() >= DUAL_PDK_MIN_COLUMNS && isValidSubstanceName(getCell(row, IDX_NAME))) {
            return true;
        }
        int codeCol = findCol(headers, "код загрязняющ", "код вещества", "код", "code");
        if (codeCol >= 0 && codeCol < row.size()) {
            String code = row.get(codeCol);
            if (code != null && code.trim().matches("\\d{3,5}")) {
                return true;
            }
        }
        int nameCol = findCol(headers, "наименование вещества", "наименование", "вещество");
        return nameCol >= 0 && nameCol < row.size() && isValidSubstanceName(row.get(nameCol));
    }

    private static boolean isValidDataRow(String code, String name) {
        boolean hasValidCode = code != null && !code.isBlank() && code.matches("\\d{3,10}");
        return hasValidCode || isValidSubstanceName(name);
    }

    private static boolean isValidSubstanceName(String name) {
        return name != null && !name.isBlank() && name.trim().length() > 2 && !name.trim().matches("\\d+");
    }

    static int findCol(List<String> headers, String... keys) {
        for (int i = 0; i < headers.size(); i++) {
            String header = headers.get(i) == null ? "" : headers.get(i).toLowerCase(Locale.ROOT);
            for (String key : keys) {
                if (header.contains(key.toLowerCase(Locale.ROOT))) {
                    return i;
                }
            }
        }
        return -1;
    }

    static String getCell(List<String> row, int col) {
        if (row == null || col < 0 || col >= row.size()) {
            return null;
        }
        String value = row.get(col);
        return value != null ? value.trim() : null;
    }

    static BigDecimal normalizeDecimal(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim()
                .replace(",", ".")
                .replace(" ", "")
                .replaceAll("[^0-9.\\-]", "");
        if (normalized.isEmpty() || "-".equals(normalized) || ".".equals(normalized)) {
            return null;
        }
        try {
            return new BigDecimal(normalized);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    static String normalizeUnit(String unit) {
        if (unit == null || unit.isBlank()) {
            return null;
        }
        return unit.trim()
                .replace("мг/м3", "мг/м³")
                .replace("мг/дм3", "мг/дм³")
                .replace("мг/см2", "мг/см²");
    }

    static String inferUnit(FileTypeMapping mapping) {
        if (mapping == null || mapping.environmentType() == null) {
            return null;
        }
        return switch (mapping.environmentType()) {
            case ATMOSPHERIC_AIR, WORK_ZONE_AIR -> "мг/м³";
            case WATER -> "мг/дм³";
            case SOIL -> "мг/кг";
            case SURFACE -> "мг/см²";
            case FOOD -> "мг/кг";
            default -> null;
        };
    }
}
