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
public class Dsm32SoilMicrobiologicalParser implements Dsm32TableParser {

    private static final String PARSER_TYPE = "DSM32_SOIL_MICROBIOLOGICAL_PARASITOLOGICAL_ASSESSMENT";
    private static final String MATRIX_TYPE = "SOIL_MICROBIOLOGICAL_PARASITOLOGICAL";

    @Override
    public boolean supports(String parserType) {
        return PARSER_TYPE.equalsIgnoreCase(parserType);
    }

    @Override
    public List<NormativeRecord> parse(Dsm32ImportContext context, List<List<String>> rows) {
        List<NormativeRecord> records = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            if (row.size() < 8) {
                continue;
            }

            String col0 = cell(row, 0);
            String col1 = cell(row, 1);
            String col2 = cell(row, 2);

            if (Dsm32NameCleaner.isHeaderOrGroupRow(col0, col1)) {
                continue;
            }
            if (col1 == null || col1.isBlank() || !isNumeric(col0)) {
                continue;
            }

            Map<String, String> json = new LinkedHashMap<>();
            json.put("coliTiter", cell(row, 3));
            json.put("anaerobeTiter", cell(row, 4));
            json.put("helminthEggs", cell(row, 5));
            json.put("flyLarvae", cell(row, 6));
            json.put("khlebnikovSanitaryNumber", cell(row, 7));
            json.put("thermophilesSelfCleaning", cell(row, 8));

            NormativeRecord record = new NormativeRecord();
            record.setTableNo(context.tableNo());
            record.setNormativeType(ImportNormativeType.ASSESSMENT);
            record.setMatrixType(MATRIX_TYPE);
            record.setAssessmentCategory(col1);
            record.setPollutionDegree(blankToNull(col2));
            record.setSourceRawValue(buildSummary(json));
            record.setConditionJson(Dsm32JsonHelper.rowJson(json));
            record.setComparisonType(ComparisonType.INFO);
            record.setSourceRowNumber(i + 1);
            records.add(record);
        }
        return records;
    }

    private static String buildSummary(Map<String, String> json) {
        return String.join("; ",
                json.getOrDefault("coliTiter", ""),
                json.getOrDefault("anaerobeTiter", ""),
                json.getOrDefault("helminthEggs", ""));
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
