package kz.eco.normative.dsm32;

import kz.eco.normative.ImportNormativeType;
import kz.eco.normative.NormativeRecord;
import kz.eco.protocol.ComparisonType;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class Dsm32SoilDegradationParser implements Dsm32TableParser {

    private static final String PARSER_TYPE = "DSM32_SOIL_DEGRADATION_POLLUTION_CRITERIA";
    private static final String MATRIX_TYPE = "SOIL_DEGRADATION_POLLUTION_CRITERIA";

    @Override
    public boolean supports(String parserType) {
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(Dsm32ImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row.size() < 2) {
                continue;
            }

            String col0 = cell(row, 0);
            String col1 = cell(row, 1);
            String col2 = cell(row, 2);
            String col3 = cell(row, 3);
            String col4 = cell(row, 4);

            if (col1 == null || col1.isBlank()) {
                continue;
            }
            if (col1.toLowerCase().contains("показател") || col1.toLowerCase().contains("основные")) {
                continue;
            }
            if (isHeaderRow(col0, col1)) {
                continue;
            }
            if (col1.endsWith(":") && isBlank(col2) && isBlank(col3) && isBlank(col4)) {
                continue;
            }
            if (isBlank(col2) && isBlank(col3) && isBlank(col4)) {
                continue;
            }

            Map<String, String> json = new LinkedHashMap<>();
            json.put("ecologicalDisaster", blankToNull(col2));
            json.put("emergencyEcologicalSituation", blankToNull(col3));
            json.put("relativelySatisfactory", blankToNull(col4));

            NormativeRecord record = new NormativeRecord();
            record.setTableNo(context.tableNo());
            record.setNormativeType(ImportNormativeType.ASSESSMENT);
            record.setMatrixType(MATRIX_TYPE);
            record.setIndicatorNameRu(col1);
            record.setSourceRawValue(joinParameters(col2, col3, col4));
            record.setConditionJson(Dsm32JsonHelper.rowJson(json));
            record.setComparisonType(ComparisonType.INFO);
            record.setSourceRowNumber(i + 1);
            records.add(record);
        }
        return records;
    }

    private static boolean isHeaderRow(String col0, String col1) {
        if (col0 != null && col0.toLowerCase().contains("№")) {
            return true;
        }
        return col1 != null && (col1.matches("[1-5]") || col1.toLowerCase().contains("параметр"));
    }

    private static String joinParameters(String col2, String col3, String col4) {
        List<String> parts = new ArrayList<>();
        if (!isBlank(col2)) {
            parts.add(col2);
        }
        if (!isBlank(col3)) {
            parts.add(col3);
        }
        if (!isBlank(col4)) {
            parts.add(col4);
        }
        return parts.isEmpty() ? null : String.join(" / ", parts);
    }

    private static boolean isBlank(String raw) {
        return raw == null || raw.isBlank();
    }

    private static String blankToNull(String raw) {
        return isBlank(raw) ? null : raw.trim();
    }

    private static String cell(List<String> row, int index) {
        if (index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null ? value.trim() : null;
    }
}
