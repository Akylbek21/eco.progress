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
public class Dsm32SoilSanitaryAssessmentParser implements Dsm32TableParser {

    private static final String PARSER_TYPE = "DSM32_SOIL_SANITARY_CHEMICAL_RADIOLOGICAL_ASSESSMENT";
    private static final String MATRIX_TYPE = "SOIL_SANITARY_CHEMICAL_RADIOLOGICAL";

    @Override
    public boolean supports(String parserType) {
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(Dsm32ImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row.size() < 4) {
                continue;
            }

            String col0 = cell(row, 0);
            String col1 = cell(row, 1);
            String col2 = cell(row, 2);
            String col3 = cell(row, 3);
            String col4 = cell(row, 4);

            if (Dsm32NameCleaner.isHeaderOrGroupRow(col0, col1)) {
                continue;
            }
            if (col1 == null || col1.isBlank() || !isNumeric(col0)) {
                continue;
            }

            Map<String, String> json = new LinkedHashMap<>();
            json.put("dangerLevel", col1);
            json.put("pollutionDegree", blankToNull(col2));
            json.put("pdkExceedanceRatio", col3);
            json.put("radiologicalIndicator", blankToNull(col4));

            NormativeRecord record = new NormativeRecord();
            record.setTableNo(context.tableNo());
            record.setNormativeType(ImportNormativeType.ASSESSMENT);
            record.setMatrixType(MATRIX_TYPE);
            record.setAssessmentCategory(col1);
            record.setPollutionDegree(blankToNull(col2));
            record.setSourceRawValue(col3);
            record.setConditionJson(Dsm32JsonHelper.rowJson(json));
            record.setComparisonType(ComparisonType.INFO);
            record.setSourceRowNumber(i + 1);
            records.add(record);
        }
        return records;
    }

    private static String blankToNull(String raw) {
        return raw == null || raw.isBlank() ? null : raw.trim();
    }

    private static boolean isNumeric(String raw) {
        return raw != null && raw.matches("\\d+");
    }

    private static String cell(List<String> row, int index) {
        if (index >= row.size()) {
            return null;
        }
        String value = row.get(index);
        return value != null ? value.trim() : null;
    }
}
